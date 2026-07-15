# Oura Sleep Alarm

An iOS app that wakes you after a chosen amount of **actual sleep**, without you setting a clock time. Get into bed, tap **Start Sleep**, and the app:

1. Estimates when you'll fall asleep using your personal Oura Ring history (median sleep-onset latency, adjusted for late bedtimes).
2. Schedules a system-level **AlarmKit** alarm at *estimated onset + target duration (+ any awake-time credit)*.
3. If you wake in the night, tap **I'm awake** / **Back to sleep** and the awake span is added to your alarm.
4. Hard safety bounds: the alarm can **never fire before `start + target`**, and a backup alarm **guarantees** it fires no later than `start + target + 2h15m`, even if the app is killed or every estimate is wrong.

## Why it works this way

The Oura API has **no real-time data** — sleep sessions only appear after the ring syncs with the phone (typically next morning), so live "you just fell asleep" detection is impossible. Instead, the app personalizes an *estimate* from your history and wraps it in guaranteed bounds. See [`docs/01-initial-research.md`](docs/01-initial-research.md) for the full research and [`docs/02-evaluation.md`](docs/02-evaluation.md) for the post-build verification.

## Project layout

```
OuraSleepAlarm/
  Sources/
    App/OuraSleepAlarmApp.swift      — SwiftUI entry point
    Model/AlarmPlan.swift            — the safety contract (floor/ceiling window)
    Model/SleepEstimator.swift       — personal stats + onset-latency estimation
    Model/SleepSessionStore.swift    — state machine + persistence
    Oura/OuraClient.swift            — minimal Oura API v2 client (PAT auth)
    Alarm/AlarmScheduler.swift       — AlarmKit wrapper (primary + backup alarm)
    Views/                           — Home / Night / Settings screens
  Tests/AlarmPlanTests.swift         — unit tests for bounds & estimator
```

## Building

Requires **Xcode 26+ / iOS 26+** (AlarmKit) and a physical device or simulator on iOS 26.

1. Create a new iOS App project in Xcode named `OuraSleepAlarm` (SwiftUI, Swift), minimum deployment target iOS 26, and drag `Sources/` and `Tests/` in (or use XcodeGen/Tuist with these sources).
2. Add to **Info.plist**:
   ```xml
   <key>NSAlarmKitUsageDescription</key>
   <string>Schedules your wake-up alarm based on your target sleep duration.</string>
   ```
3. Run on device. On first Start Sleep, iOS will prompt for alarm permission.
4. In Settings (gear icon), paste an Oura **Personal Access Token** from <https://cloud.ouraring.com/personal-access-tokens>. Without one the app still works with conservative defaults (15 min assumed latency).

## Guarantees (the crucial part)

| Rule | Mechanism |
|---|---|
| Never fires early | `AlarmPlan.fireDate` is clamped to ≥ `start + target` — you can't have slept `T` hours sooner than `T` after getting into bed |
| Never fires unboundedly late | Latency estimate capped at 45 min, awake credit capped at 90 min; fire date clamped to ceiling |
| Always fires | AlarmKit alarms are system-level (fire when app is killed, break through Silent/Focus); a second backup alarm sits at the ceiling; reschedules that fail leave the previous alarms in place |
| Works offline | Oura stats are cached; the Start → alarm path makes no network calls |
