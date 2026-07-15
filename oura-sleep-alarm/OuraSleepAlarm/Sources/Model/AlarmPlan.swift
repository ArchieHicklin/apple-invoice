import Foundation

/// The core safety contract of the app.
///
/// Given a start tap at `startedAt` and a target sleep duration `target`,
/// the alarm time is ALWAYS inside:
///
///   floor   = startedAt + target                       (cannot have slept T sooner)
///   ceiling = startedAt + target + latencyCap + totalAwakeCreditCap
///
/// The estimated fire time moves inside that window as the estimate and
/// user-reported wakes change, but the window itself is fixed at Start.
/// A separate backup alarm is scheduled at `ceiling` so that even a total
/// logic failure still produces a wake-up.
struct AlarmPlan: Codable, Equatable {
    let startedAt: Date
    let target: TimeInterval

    /// Estimated sleep-onset latency at planning time.
    var estimatedLatency: TimeInterval
    /// Onset measured live by the night-sensing engine (mic + motion +
    /// interaction). When present it replaces the latency estimate.
    /// Clamped so it can never push the alarm outside the window.
    var measuredOnsetAt: Date?
    /// Awake credit baked in from history (capped).
    var priorAwakeCredit: TimeInterval
    /// Awake credit accumulated from user-reported mid-night wakes (capped).
    var reportedAwakeCredit: TimeInterval = 0
    /// An in-progress reported wake (user said "I'm awake", hasn't slept yet).
    var currentWakeStartedAt: Date?

    var floorDate: Date { startedAt.addingTimeInterval(target) }
    var ceilingDate: Date {
        startedAt.addingTimeInterval(target + EstimatorBounds.latencyCap + EstimatorBounds.totalAwakeCreditCap)
    }

    var totalAwakeCredit: TimeInterval {
        (priorAwakeCredit + reportedAwakeCredit).clamped(to: 0...EstimatorBounds.totalAwakeCreditCap)
    }

    /// The alarm fire time, always clamped into [floor, ceiling].
    /// Prefers the measured onset (real signal) over the latency estimate.
    var fireDate: Date {
        let onsetDelay: TimeInterval
        if let measured = measuredOnsetAt {
            onsetDelay = max(0, measured.timeIntervalSince(startedAt))
        } else {
            onsetDelay = estimatedLatency
        }
        let raw = startedAt.addingTimeInterval(onsetDelay + target + totalAwakeCredit)
        return min(max(raw, floorDate), ceilingDate)
    }

    /// The sensing engine detected sleep onset. Ignored if it would move the
    /// onset before the start tap; the ceiling clamp bounds late detections.
    mutating func recordMeasuredOnset(_ date: Date) {
        guard date >= startedAt else { return }
        measuredOnsetAt = date
    }

    /// User reported being awake at `date` (e.g. opened the app mid-night).
    mutating func beginReportedWake(at date: Date = Date()) {
        guard currentWakeStartedAt == nil else { return }
        currentWakeStartedAt = date
    }

    /// The wake ended: credit the awake span, capped so the ceiling holds.
    /// `includeReOnsetAllowance` is true for manual reports ("back to sleep"
    /// tapped while still awake — re-onset must be estimated) and false for
    /// sensed events (the timestamp already IS the observed re-onset).
    mutating func endReportedWake(at date: Date = Date(), includeReOnsetAllowance: Bool = true) {
        guard let wakeStart = currentWakeStartedAt else { return }
        currentWakeStartedAt = nil
        var span = max(0, date.timeIntervalSince(wakeStart))
        if includeReOnsetAllowance {
            span += EstimatorBounds.reOnsetLatency.clamped(to: 0...EstimatorBounds.reOnsetLatencyCap)
        }
        reportedAwakeCredit = (reportedAwakeCredit + span)
            .clamped(to: 0...EstimatorBounds.totalAwakeCreditCap)
    }
}
