import SwiftUI

/// Shown while a sleep session is active. Deliberately dark and minimal.
struct NightView: View {
    @EnvironmentObject private var store: SleepSessionStore

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            if let plan = store.plan {
                VStack(spacing: 8) {
                    Text(store.phase == .reportedAwake ? "You're awake" : "Sleeping")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    Text(plan.fireDate, style: .time)
                        .font(.system(size: 56, weight: .bold, design: .rounded))
                    Text("alarm (estimate)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    Text("Guaranteed window: \(plan.floorDate, style: .time) – \(plan.ceilingDate, style: .time)")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                        .padding(.top, 4)

                    if plan.totalAwakeCredit > 0 {
                        Text("+\(Int(plan.totalAwakeCredit / 60)) min credited for awake time")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            if store.phase == .sleeping {
                Button {
                    store.reportAwake()
                } label: {
                    Label("I'm awake", systemImage: "eye")
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.bordered)
                .padding(.horizontal)
            } else {
                Button {
                    Task { await store.backToSleep() }
                } label: {
                    Label("Back to sleep", systemImage: "moon.zzz.fill")
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.borderedProminent)
                .tint(.indigo)
                .padding(.horizontal)
            }

            Button(role: .destructive) {
                store.endSession()
            } label: {
                Text("End session & cancel alarms")
                    .font(.footnote)
            }
            .padding(.bottom, 24)
        }
        .preferredColorScheme(.dark)
    }
}
