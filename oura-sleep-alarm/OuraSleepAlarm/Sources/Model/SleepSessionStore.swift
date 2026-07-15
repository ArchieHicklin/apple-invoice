import Foundation
import SwiftUI

/// App-level state machine + persistence.
///
/// States: idle → sleeping (plan active) → [awake (reported wake)] → sleeping → idle.
/// The plan and state are persisted so that force-quitting and reopening the
/// app mid-night restores the session (the AlarmKit alarms survive regardless).
@MainActor
final class SleepSessionStore: ObservableObject {
    enum Phase: String, Codable {
        case idle
        case sleeping
        case reportedAwake
    }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var plan: AlarmPlan?
    @Published private(set) var stats: SleepStats = .defaults
    @Published var targetHours: Double = 7.0
    @Published var lastStatsError: String?

    let scheduler: AlarmScheduler
    private let defaults = UserDefaults.standard

    private var ouraClient: OuraClient {
        OuraClient(tokenProvider: { UserDefaults.standard.string(forKey: "ouraToken") })
    }

    init(scheduler: AlarmScheduler = AlarmScheduler()) {
        self.scheduler = scheduler
        restore()
    }

    // MARK: - Lifecycle

    /// User taps "Start Sleep" in bed.
    func startSleep() async throws {
        let estimator = SleepEstimator(stats: stats)
        let now = Date()
        var newPlan = AlarmPlan(
            startedAt: now,
            target: targetHours * 3600,
            estimatedLatency: estimator.onsetLatency(startingAt: now),
            priorAwakeCredit: estimator.priorAwakeCredit()
        )
        // Sanity: fireDate is clamped by construction, but assert the contract.
        assert(newPlan.fireDate >= newPlan.floorDate && newPlan.fireDate <= newPlan.ceilingDate)
        try await scheduler.schedule(for: newPlan)
        plan = newPlan
        phase = .sleeping
        persist()
    }

    /// User woke mid-night and opened the app / tapped "I'm awake".
    func reportAwake() {
        guard phase == .sleeping, var p = plan else { return }
        p.beginReportedWake()
        plan = p
        phase = .reportedAwake
        persist()
    }

    /// User is going back to sleep — push the alarm back by the awake span.
    func backToSleep() async {
        guard phase == .reportedAwake, var p = plan else { return }
        p.endReportedWake()
        plan = p
        phase = .sleeping
        persist()
        // Best-effort reschedule; if it fails the previous alarms are still
        // set (fail-safe: alarm fires slightly early rather than never).
        try? await scheduler.schedule(for: p)
    }

    /// User got up for good / stopped the alarm.
    func endSession() {
        scheduler.cancelAll()
        plan = nil
        phase = .idle
        persist()
    }

    // MARK: - Oura stats refresh (never on the critical path)

    func refreshStats() async {
        do {
            let sessions = try await ouraClient.recentSleepSessions(days: 60)
            stats = SleepEstimator.computeStats(from: sessions)
            lastStatsError = nil
            persist()
        } catch OuraError.notConfigured {
            lastStatsError = "Add your Oura personal access token in Settings to personalise the alarm."
        } catch OuraError.unauthorized {
            lastStatsError = "Oura token was rejected — check it in Settings."
        } catch {
            lastStatsError = "Couldn't reach Oura (\(error.localizedDescription)). Using cached stats."
        }
    }

    // MARK: - Persistence

    private func persist() {
        let encoder = JSONEncoder()
        defaults.set(phase.rawValue, forKey: "phase")
        defaults.set(targetHours, forKey: "targetHours")
        defaults.set(try? encoder.encode(plan), forKey: "plan")
        defaults.set(try? encoder.encode(stats), forKey: "stats")
    }

    private func restore() {
        let decoder = JSONDecoder()
        if let raw = defaults.string(forKey: "phase"), let p = Phase(rawValue: raw) { phase = p }
        let storedTarget = defaults.double(forKey: "targetHours")
        if storedTarget > 0 { targetHours = storedTarget }
        if let data = defaults.data(forKey: "plan"),
           let p = try? decoder.decode(AlarmPlan.self, from: data) { plan = p }
        if let data = defaults.data(forKey: "stats"),
           let s = try? decoder.decode(SleepStats.self, from: data) { stats = s }

        // If the whole window has passed (alarm fired while app was dead),
        // fall back to idle.
        if let p = plan, p.ceilingDate < Date() {
            plan = nil
            phase = .idle
        }
    }
}
