import SwiftUI

@main
struct OuraSleepAlarmApp: App {
    @StateObject private var store = SleepSessionStore()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(store)
                .task {
                    // Opportunistic: refresh personalization stats whenever the
                    // app comes to the foreground. Never blocks the alarm path.
                    await store.refreshStats()
                }
        }
    }
}
