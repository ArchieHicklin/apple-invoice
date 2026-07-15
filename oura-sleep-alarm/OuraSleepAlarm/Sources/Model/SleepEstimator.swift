import Foundation

/// Robust per-user statistics derived from Oura sleep history, used to
/// estimate tonight's sleep-onset latency and expected mid-night awake time.
///
/// All outputs are clamped to hard bounds so a bad estimate can never move
/// the alarm outside the guaranteed window (see `AlarmPlan`).
struct SleepStats: Codable, Equatable {
    /// Median seconds from bedtime start to sleep onset over the history window.
    var medianLatency: TimeInterval
    /// Interquartile range of latency (spread; wide spread → be conservative).
    var latencyIQR: TimeInterval
    /// Median total awake seconds during the night.
    var medianAwakeTime: TimeInterval
    /// Median bedtime as seconds-from-midnight (local), for late-bedtime adjustment.
    var medianBedtimeSecondsFromMidnight: TimeInterval
    /// Number of nights the stats were computed from.
    var sampleCount: Int
    /// When these stats were computed (stale stats are still usable — they degrade gracefully).
    var computedAt: Date

    /// Conservative defaults for a user with no Oura history yet.
    static let defaults = SleepStats(
        medianLatency: 15 * 60,
        latencyIQR: 10 * 60,
        medianAwakeTime: 0,
        medianBedtimeSecondsFromMidnight: -60 * 60, // 23:00
        sampleCount: 0,
        computedAt: .distantPast
    )
}

enum EstimatorBounds {
    /// Latency estimate is always clamped inside [floor, cap].
    static let latencyFloor: TimeInterval = 5 * 60
    static let latencyCap: TimeInterval = 45 * 60
    /// Up-front awake credit from history is deliberately small; live credit
    /// (user-reported wakes) is capped separately.
    static let priorAwakeCreditCap: TimeInterval = 20 * 60
    /// Total awake credit (prior + user-reported) can never exceed this.
    static let totalAwakeCreditCap: TimeInterval = 90 * 60
    /// Re-onset latency assumed after a reported mid-night wake.
    static let reOnsetLatency: TimeInterval = 8 * 60
    static let reOnsetLatencyCap: TimeInterval = 20 * 60
}

struct SleepEstimator {
    var stats: SleepStats

    /// Estimated time from "Start" tap to sleep onset, clamped to safe bounds.
    /// A bedtime much later than usual slightly reduces the estimate (people
    /// who go to bed late tend to be sleep-pressured), but never below floor.
    func onsetLatency(startingAt start: Date, calendar: Calendar = .current) -> TimeInterval {
        var estimate = stats.sampleCount >= 7 ? stats.medianLatency : SleepStats.defaults.medianLatency

        // Wide personal spread → shade the estimate down (earlier alarm is
        // bounded by the hard floor anyway; firing slightly early within
        // bounds is preferable to oversleeping the target).
        if stats.latencyIQR > 20 * 60 { estimate *= 0.85 }

        // Late-bedtime adjustment: >2h past usual bedtime → shorter latency.
        let midnight = calendar.startOfDay(for: start)
        var secondsFromMidnight = start.timeIntervalSince(midnight)
        if secondsFromMidnight > 12 * 3600 { secondsFromMidnight -= 24 * 3600 } // evening → negative
        let usual = stats.medianBedtimeSecondsFromMidnight
        if stats.sampleCount >= 7, secondsFromMidnight - usual > 2 * 3600 { estimate *= 0.7 }

        return estimate.clamped(to: EstimatorBounds.latencyFloor...EstimatorBounds.latencyCap)
    }

    /// Up-front awake credit baked into the initial alarm time. Only granted
    /// when history shows *consistent* night wakefulness, and heavily capped:
    /// over-crediting risks a late alarm, under-crediting is corrected live
    /// when the user reports a wake.
    func priorAwakeCredit() -> TimeInterval {
        guard stats.sampleCount >= 14, stats.medianAwakeTime > 10 * 60 else { return 0 }
        return (stats.medianAwakeTime * 0.5).clamped(to: 0...EstimatorBounds.priorAwakeCreditCap)
    }

    /// Recompute stats from raw Oura sleep sessions (long sleep only, no naps).
    static func computeStats(from sessions: [OuraSleepSession], calendar: Calendar = .current) -> SleepStats {
        let nights = sessions.filter { $0.type == "long_sleep" && $0.latency != nil }
        guard !nights.isEmpty else { return .defaults }

        let latencies = nights.compactMap { $0.latency }.sorted()
        let awakes = nights.compactMap { $0.awakeTime }.sorted()
        let bedtimes: [TimeInterval] = nights.compactMap { n in
            guard let start = n.bedtimeStart else { return nil }
            let midnight = calendar.startOfDay(for: start)
            var s = start.timeIntervalSince(midnight)
            if s > 12 * 3600 { s -= 24 * 3600 }
            return s
        }.sorted()

        return SleepStats(
            medianLatency: latencies.median() ?? SleepStats.defaults.medianLatency,
            latencyIQR: latencies.iqr() ?? SleepStats.defaults.latencyIQR,
            medianAwakeTime: awakes.median() ?? 0,
            medianBedtimeSecondsFromMidnight: bedtimes.median() ?? SleepStats.defaults.medianBedtimeSecondsFromMidnight,
            sampleCount: nights.count,
            computedAt: Date()
        )
    }
}

extension Array where Element == TimeInterval {
    /// Assumes the array is already sorted.
    func median() -> TimeInterval? {
        guard !isEmpty else { return nil }
        return count.isMultiple(of: 2) ? (self[count / 2 - 1] + self[count / 2]) / 2 : self[count / 2]
    }

    /// Assumes the array is already sorted.
    func iqr() -> TimeInterval? {
        guard count >= 4 else { return nil }
        return self[(count * 3) / 4] - self[count / 4]
    }
}

extension TimeInterval {
    func clamped(to range: ClosedRange<TimeInterval>) -> TimeInterval {
        Swift.min(Swift.max(self, range.lowerBound), range.upperBound)
    }
}
