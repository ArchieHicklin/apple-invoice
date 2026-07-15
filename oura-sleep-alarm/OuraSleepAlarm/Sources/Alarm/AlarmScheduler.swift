import Foundation
import AlarmKit
import SwiftUI

nonisolated struct SleepAlarmMetadata: AlarmMetadata {}

/// Wraps AlarmKit. Two alarms are always kept in lockstep with an `AlarmPlan`:
///
///  - the PRIMARY alarm at `plan.fireDate` (the estimate, inside the window)
///  - the BACKUP alarm at `plan.ceilingDate` (guaranteed wake-up even if the
///    primary is cancelled/lost or every estimate was wrong)
///
/// AlarmKit alarms are system-level: they fire with the app killed and break
/// through Silent mode and Focus, so once scheduled the wake-up is guaranteed
/// without any background execution.
@MainActor
final class AlarmScheduler: ObservableObject {
    static let primaryID = UUID(uuidString: "7B0B45A0-0000-4000-8000-000000000001")!
    static let backupID = UUID(uuidString: "7B0B45A0-0000-4000-8000-000000000002")!

    @Published private(set) var authorized = false

    private let manager = AlarmManager.shared

    func requestAuthorization() async -> Bool {
        switch manager.authorizationState {
        case .authorized:
            authorized = true
        case .notDetermined:
            let state = (try? await manager.requestAuthorization()) ?? .denied
            authorized = state == .authorized
        default:
            authorized = false
        }
        return authorized
    }

    /// (Re)schedule both alarms for the plan. Called on Start and after every
    /// plan mutation (reported wake ends, settings change). Cancel-then-
    /// schedule with fixed IDs keeps exactly one primary and one backup.
    func schedule(for plan: AlarmPlan) async throws {
        guard await requestAuthorization() else { throw AlarmSchedulingError.notAuthorized }

        try? manager.cancel(id: Self.primaryID)
        try? manager.cancel(id: Self.backupID)

        _ = try await manager.schedule(
            id: Self.primaryID,
            configuration: alarmConfiguration(title: "Wake up", fireDate: plan.fireDate)
        )
        // Backup only needed if it's meaningfully after the primary.
        if plan.ceilingDate.timeIntervalSince(plan.fireDate) > 60 {
            _ = try await manager.schedule(
                id: Self.backupID,
                configuration: alarmConfiguration(title: "Wake up (backup)", fireDate: plan.ceilingDate)
            )
        }
    }

    func cancelAll() {
        try? manager.cancel(id: Self.primaryID)
        try? manager.cancel(id: Self.backupID)
    }

    /// After the primary fires and the user stops it, the backup must go too.
    func cancelBackup() {
        try? manager.cancel(id: Self.backupID)
    }

    private func alarmConfiguration(title: String, fireDate: Date)
        -> AlarmManager.AlarmConfiguration<SleepAlarmMetadata>
    {
        let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource(stringLiteral: title),
            stopButton: AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle"),
            secondaryButton: AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz"),
            secondaryButtonBehavior: .countdown
        )
        let attributes = AlarmAttributes<SleepAlarmMetadata>(
            presentation: AlarmPresentation(alert: alert),
            tintColor: Color.indigo
        )
        return AlarmManager.AlarmConfiguration(
            countdownDuration: .init(preAlert: nil, postAlert: 9 * 60), // 9-min snooze
            schedule: .fixed(fireDate),
            attributes: attributes
        )
    }
}

enum AlarmSchedulingError: Error {
    case notAuthorized
}
