import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: SleepSessionStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage("ouraToken") private var ouraToken = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Oura") {
                    SecureField("Personal access token", text: $ouraToken)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Text("Create one at cloud.ouraring.com → Personal Access Tokens. Used only to read your sleep history for personalisation.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Refresh sleep stats now") {
                        Task { await store.refreshStats() }
                    }
                    if store.stats.sampleCount > 0 {
                        LabeledContent("Nights analysed", value: "\(store.stats.sampleCount)")
                        LabeledContent("Median fall-asleep time", value: "\(Int(store.stats.medianLatency / 60)) min")
                        LabeledContent("Median awake time", value: "\(Int(store.stats.medianAwakeTime / 60)) min")
                    }
                    if let error = store.lastStatsError {
                        Text(error).font(.footnote).foregroundStyle(.orange)
                    }
                }

                Section("How the alarm works") {
                    Text("""
                    When you tap Start Sleep, the alarm is set to your target duration plus your personal estimated time to fall asleep. It will never fire before start + target, and a backup alarm guarantees it fires no later than start + target + 2¼ hours even if everything else fails. If you wake in the night, tap "I'm awake" and then "Back to sleep" — the awake time is added to your alarm.
                    """)
                    .font(.footnote)
                }
            }
            .navigationTitle("Settings")
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}
