import Foundation
import AVFoundation
import CoreMotion
import UIKit

/// Keeps the app alive all night and turns raw phone signals into
/// sleep/wake events — the same approach Sleep Cycle uses.
///
/// Signals fused per 30s epoch:
///  - microphone RMS level (movement/rustling/talking is loud; sleep is quiet)
///  - accelerometer (phone on the mattress: body movement; on a nightstand:
///    only picks up the user grabbing the phone — still a strong wake signal)
///  - screen/interaction events (`protectedDataDidBecomeAvailable`, app
///    foregrounding — unambiguous "user is awake")
///
/// Keep-alive: an AVAudioSession in play-and-record with a silent output
/// keeps the process running while backgrounded (audio background mode).
/// This is why the phone should charge overnight.
///
/// The engine only *narrows* the alarm inside the AlarmPlan's fixed
/// floor/ceiling window. If iOS kills the app anyway, the already-scheduled
/// AlarmKit alarms still fire — sensing is an accuracy layer, never the
/// reliability layer.
@MainActor
final class NightSensingEngine: ObservableObject {
    enum Event {
        /// Sustained quiet + stillness first reached: best-guess sleep onset.
        case onsetDetected(Date)
        /// Sustained activity after onset: user is (probably) awake.
        case wakeDetected(Date)
        /// Quiet again after a detected wake: user fell back asleep.
        case backToSleepDetected(Date)
    }

    var onEvent: ((Event) -> Void)?

    @Published private(set) var isRunning = false
    @Published private(set) var lastEpochActivity: Double = 0

    // Tunables (validated against Oura's morning ground truth over time).
    private let epochLength: TimeInterval = 30
    /// Consecutive quiet epochs to call sleep onset (10 min).
    private let onsetQuietEpochs = 20
    /// Consecutive active epochs to call a wake (2.5 min — short blips like
    /// turning over must NOT count as a wake; cost asymmetry: a missed short
    /// wake barely moves the alarm, a false wake delays it).
    private let wakeActiveEpochs = 5
    /// Consecutive quiet epochs after a wake to call back-to-sleep (7.5 min).
    private let resettleQuietEpochs = 15
    private let quietRMSThreshold: Double = 0.015
    private let motionThreshold: Double = 0.03 // g, deviation from 1g

    private enum SensedState { case settling, asleep, awake }
    private var state: SensedState = .settling
    private var quietStreak = 0
    private var activeStreak = 0
    private var interactionFlag = false

    private let audioEngine = AVAudioEngine()
    private let motion = CMMotionManager()
    private var epochTimer: Timer?
    private var epochPeakRMS: Double = 0
    private var epochPeakMotion: Double = 0
    private var observers: [NSObjectProtocol] = []

    func start() throws {
        guard !isRunning else { return }
        state = .settling
        quietStreak = 0
        activeStreak = 0

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement,
                                options: [.mixWithOthers, .allowBluetooth])
        try session.setActive(true)

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
            guard let channel = buffer.floatChannelData?[0] else { return }
            let frames = Int(buffer.frameLength)
            var sum: Float = 0
            for i in 0..<frames { sum += channel[i] * channel[i] }
            let rms = Double(sqrt(sum / Float(max(frames, 1))))
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.epochPeakRMS = max(self.epochPeakRMS, rms)
            }
        }
        try audioEngine.start()

        if motion.isAccelerometerAvailable {
            motion.accelerometerUpdateInterval = 0.5
            motion.startAccelerometerUpdates(to: .main) { [weak self] data, _ in
                guard let self, let a = data?.acceleration else { return }
                let magnitude = abs(sqrt(a.x * a.x + a.y * a.y + a.z * a.z) - 1.0)
                self.epochPeakMotion = max(self.epochPeakMotion, magnitude)
            }
        }

        // Unambiguous wake signals: device unlocked / app brought forward.
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: UIApplication.protectedDataDidBecomeAvailableNotification,
                               object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.interactionFlag = true }
            },
            center.addObserver(forName: UIApplication.didBecomeActiveNotification,
                               object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.interactionFlag = true }
            },
        ]

        epochTimer = Timer.scheduledTimer(withTimeInterval: epochLength, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.closeEpoch() }
        }
        isRunning = true
    }

    func stop() {
        guard isRunning else { return }
        epochTimer?.invalidate()
        epochTimer = nil
        audioEngine.inputNode.removeTap(onBus: 0)
        audioEngine.stop()
        motion.stopAccelerometerUpdates()
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers = []
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        isRunning = false
    }

    private func closeEpoch() {
        let active = interactionFlag
            || epochPeakRMS > quietRMSThreshold
            || epochPeakMotion > motionThreshold
        lastEpochActivity = max(epochPeakRMS / quietRMSThreshold, epochPeakMotion / motionThreshold)
        let interacted = interactionFlag
        epochPeakRMS = 0
        epochPeakMotion = 0
        interactionFlag = false

        if active { activeStreak += 1; quietStreak = 0 } else { quietStreak += 1; activeStreak = 0 }

        let now = Date()
        switch state {
        case .settling:
            if quietStreak >= onsetQuietEpochs {
                state = .asleep
                // Onset was at the *start* of the quiet run, not now.
                let onset = now.addingTimeInterval(-Double(onsetQuietEpochs) * epochLength)
                onEvent?(.onsetDetected(onset))
            }
        case .asleep:
            // Device interaction is an immediate wake; sound/motion needs a streak.
            if interacted || activeStreak >= wakeActiveEpochs {
                state = .awake
                let wakeStart = interacted
                    ? now
                    : now.addingTimeInterval(-Double(wakeActiveEpochs) * epochLength)
                onEvent?(.wakeDetected(wakeStart))
            }
        case .awake:
            if quietStreak >= resettleQuietEpochs {
                state = .asleep
                let backToSleep = now.addingTimeInterval(-Double(resettleQuietEpochs) * epochLength)
                onEvent?(.backToSleepDetected(backToSleep))
            }
        }
    }
}
