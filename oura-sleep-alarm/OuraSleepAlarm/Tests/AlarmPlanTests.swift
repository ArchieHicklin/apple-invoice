import XCTest
@testable import OuraSleepAlarm

final class AlarmPlanTests: XCTestCase {
    private func makePlan(latency: TimeInterval = 15 * 60,
                          priorCredit: TimeInterval = 0,
                          target: TimeInterval = 7 * 3600) -> AlarmPlan {
        AlarmPlan(startedAt: Date(timeIntervalSince1970: 1_700_000_000),
                  target: target,
                  estimatedLatency: latency,
                  priorAwakeCredit: priorCredit)
    }

    func testFireDateNeverBeforeFloor() {
        var plan = makePlan(latency: 0)
        plan.estimatedLatency = -3600 // corrupt input
        XCTAssertGreaterThanOrEqual(plan.fireDate, plan.floorDate)
    }

    func testFireDateNeverAfterCeiling() {
        var plan = makePlan(latency: 999_999, priorCredit: 999_999)
        plan.reportedAwakeCredit = 999_999
        XCTAssertLessThanOrEqual(plan.fireDate, plan.ceilingDate)
    }

    func testNominalFireDate() {
        let plan = makePlan(latency: 15 * 60)
        XCTAssertEqual(plan.fireDate, plan.startedAt.addingTimeInterval(7 * 3600 + 15 * 60))
    }

    func testReportedWakePushesAlarmBack() {
        var plan = makePlan()
        let before = plan.fireDate
        let wakeStart = plan.startedAt.addingTimeInterval(3 * 3600)
        plan.beginReportedWake(at: wakeStart)
        plan.endReportedWake(at: wakeStart.addingTimeInterval(30 * 60))
        XCTAssertEqual(plan.fireDate.timeIntervalSince(before),
                       30 * 60 + EstimatorBounds.reOnsetLatency, accuracy: 1)
    }

    func testAwakeCreditIsCapped() {
        var plan = makePlan()
        for hour in 0..<5 {
            let start = plan.startedAt.addingTimeInterval(Double(hour) * 3600)
            plan.beginReportedWake(at: start)
            plan.endReportedWake(at: start.addingTimeInterval(45 * 60))
        }
        XCTAssertLessThanOrEqual(plan.totalAwakeCredit, EstimatorBounds.totalAwakeCreditCap)
        XCTAssertLessThanOrEqual(plan.fireDate, plan.ceilingDate)
    }

    func testDoubleBeginWakeIsIgnored() {
        var plan = makePlan()
        let t0 = plan.startedAt.addingTimeInterval(3600)
        plan.beginReportedWake(at: t0)
        plan.beginReportedWake(at: t0.addingTimeInterval(1800)) // ignored
        plan.endReportedWake(at: t0.addingTimeInterval(600))
        XCTAssertEqual(plan.reportedAwakeCredit, 600 + EstimatorBounds.reOnsetLatency, accuracy: 1)
    }
}

final class SleepEstimatorTests: XCTestCase {
    func testDefaultsWithNoHistory() {
        let estimator = SleepEstimator(stats: .defaults)
        let latency = estimator.onsetLatency(startingAt: Date())
        XCTAssertEqual(latency, 15 * 60, accuracy: 1)
        XCTAssertEqual(estimator.priorAwakeCredit(), 0)
    }

    func testLatencyClampedToCap() {
        var stats = SleepStats.defaults
        stats.medianLatency = 3 * 3600
        stats.sampleCount = 30
        let estimator = SleepEstimator(stats: stats)
        XCTAssertLessThanOrEqual(estimator.onsetLatency(startingAt: Date()), EstimatorBounds.latencyCap)
    }

    func testLatencyClampedToFloor() {
        var stats = SleepStats.defaults
        stats.medianLatency = 30
        stats.sampleCount = 30
        let estimator = SleepEstimator(stats: stats)
        XCTAssertGreaterThanOrEqual(estimator.onsetLatency(startingAt: Date()), EstimatorBounds.latencyFloor)
    }

    func testMedianAndIQR() {
        let values: [TimeInterval] = [1, 2, 3, 4, 5, 6, 7, 8].sorted()
        XCTAssertEqual(values.median(), 4.5)
        XCTAssertEqual(values.iqr(), 4) // q3 (index 6 → 7) - q1 (index 2 → 3)
    }
}
