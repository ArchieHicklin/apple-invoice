import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: SleepSessionStore
    @State private var startError: String?
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            Group {
                switch store.phase {
                case .idle: idleView
                case .sleeping, .reportedAwake: NightView()
                }
            }
            .navigationTitle("Oura Sleep Alarm")
            .toolbar {
                Button { showSettings = true } label: { Image(systemName: "gear") }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }

    private var idleView: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                Text("Target sleep")
                    .font(.headline)
                Text(String(format: "%.1f hours", store.targetHours))
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                Slider(value: $store.targetHours, in: 4...10, step: 0.25)
                    .padding(.horizontal)
            }

            if store.stats.sampleCount > 0 {
                Label(
                    "Personalised from \(store.stats.sampleCount) nights — you usually fall asleep in ~\(Int(store.stats.medianLatency / 60)) min",
                    systemImage: "chart.line.uptrend.xyaxis"
                )
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
            } else if let error = store.lastStatsError {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .padding(.horizontal)
            }

            Spacer()

            Button {
                Task {
                    do {
                        try await store.startSleep()
                        startError = nil
                    } catch {
                        startError = "Couldn't schedule the alarm — check alarm permission in Settings. The session was NOT started."
                    }
                }
            } label: {
                Label("Start Sleep", systemImage: "moon.zzz.fill")
                    .font(.title2.bold())
                    .frame(maxWidth: .infinity)
                    .padding()
            }
            .buttonStyle(.borderedProminent)
            .tint(.indigo)
            .padding(.horizontal)

            if let startError {
                Text(startError)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
            }

            Spacer().frame(height: 24)
        }
    }
}
