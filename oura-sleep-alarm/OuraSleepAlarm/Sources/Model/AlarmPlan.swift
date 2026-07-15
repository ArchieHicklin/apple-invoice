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
    var fireDate: Date {
        let raw = startedAt.addingTimeInterval(estimatedLatency + target + totalAwakeCredit)
        return min(max(raw, floorDate), ceilingDate)
    }

    /// User reported being awake at `date` (e.g. opened the app mid-night).
    mutating func beginReportedWake(at date: Date = Date()) {
        guard currentWakeStartedAt == nil else { return }
        currentWakeStartedAt = date
    }

    /// User is going back to sleep: credit the awake span plus a short
    /// re-onset latency, both capped so the ceiling still holds.
    mutating func endReportedWake(at date: Date = Date()) {
        guard let wakeStart = currentWakeStartedAt else { return }
        currentWakeStartedAt = nil
        let span = max(0, date.timeIntervalSince(wakeStart))
        let reOnset = EstimatorBounds.reOnsetLatency.clamped(to: 0...EstimatorBounds.reOnsetLatencyCap)
        reportedAwakeCredit = (reportedAwakeCredit + span + reOnset)
            .clamped(to: 0...EstimatorBounds.totalAwakeCreditCap)
    }
}
