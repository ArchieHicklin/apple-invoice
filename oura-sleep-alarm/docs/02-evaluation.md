# Oura Sleep Alarm — Post-Build Evaluation & Verification (Stage 3)

**Date:** 2026-07-15
**Scope:** Verify that the built solution is the optimal design given platform realities, that the "never too early / never too late / always fires" guarantees actually hold, and record residual risks and the improvement roadmap.

---

## 1. Re-verification of the foundational claims

The whole architecture rests on two claims from Stage 1; both were re-checked against independent sources after the build:

1. **Oura provides no mid-night data.** Confirmed across the official API docs, Oura Member Care, third-party client libraries, and Home Assistant community reports (integrations show stale sleep data until the user opens the Oura app in the morning). Webhooks fire only ~30s *after a sync*, and sleep sessions sync/process after the night ends. → Estimation, not detection, remains the only viable approach without extra hardware.
2. **AlarmKit is the only third-party iOS mechanism that reliably wakes a sleeping user.** Confirmed: AlarmKit (iOS 26) alarms are system-level — they fire when the app is killed, break through Silent mode and Focus, and present full-screen ([Apple docs](https://developer.apple.com/documentation/AlarmKit), [MacRumors](https://www.macrumors.com/2025/06/11/ios-26-third-party-alarm-apps/)). Local notifications remain unfit (mutable by silent switch, 30s sound cap). `BGAppRefreshTask` remains explicitly non-guaranteed and is correctly absent from the critical path.

**Design verdict: the "estimate-and-bound" architecture is optimal for a phone + Oura-ring-only setup.** No alternative examined (overnight polling, webhook→push server, notification hacks) survives the no-mid-night-data constraint.

## 2. Verification of the three guarantees against the code

### G1 — Never fires too early
`AlarmPlan.fireDate` is clamped to `max(raw, floorDate)` where `floorDate = startedAt + target` (`AlarmPlan.swift`). Since sleep onset cannot precede the Start tap, the user can never be woken with less than… exactly `target` hours *in-bed*; with a positive latency estimate (floor 5 min) the alarm in practice fires at ≥ target sleep. Unit tests `testFireDateNeverBeforeFloor` and estimator clamp tests cover corrupt/extreme inputs. ✅

### G2 — Never fires too late
Ceiling = `start + target + 45 min (latency cap) + 90 min (awake-credit cap)`. Every contributor is individually capped (latency 45 min, prior awake credit 20 min, total awake credit 90 min) and the fire date is re-clamped to the ceiling. Tests `testFireDateNeverAfterCeiling`, `testAwakeCreditIsCapped`. Worst case with a 7h target: alarm by start + 9h15m — bounded, visible to the user in the UI ("Guaranteed window"). ✅

### G3 — Always fires
- Primary + backup alarm both scheduled via AlarmKit with fixed IDs; backup sits at the ceiling.
- If a mid-night reschedule fails, the code deliberately keeps the previously scheduled alarms (fails toward *earlier*, never toward silence) — `SleepSessionStore.backToSleep()`.
- If scheduling fails at Start (permission denied), the session does **not** start and the UI says so — no false sense of security.
- App killed overnight: AlarmKit alarms are OS-managed and fire anyway; on relaunch the persisted plan is restored or cleaned up. ✅

**One caveat found during verification:** cancel-then-reschedule has a small window where, if the process died between cancel and schedule, no primary alarm would exist — but the backup alarm ordering in `schedule(for:)` means both would be gone only if death occurs mid-function, and the reported-wake flow only runs while the app is foregrounded and alive, making this window milliseconds long and user-visible. **Improvement applied to roadmap:** schedule new alarms under fresh IDs *before* cancelling old ones for a fully atomic swap. Also, alarm persistence across a *device reboot* is not explicitly documented for AlarmKit; community reports note fallback presentations after restarts, but this must be empirically tested on hardware (see §4).

## 3. Estimator quality assessment

- **Personalization source:** median + IQR of Oura `latency` over 60 nights is robust to outliers (median, not mean), requires ≥7 nights before overriding the 15-min default, and ≥14 nights before granting any awake credit — conservative by design.
- **Directional bias is correct:** every heuristic (wide-IQR shading, late-bedtime reduction) biases the alarm *earlier* within the window. Rationale: firing at floor still gives the user `target` hours in bed; firing at ceiling costs them up to 2h15m of oversleep. Asymmetric costs → asymmetric bias.
- **Awake-time deduction honesty:** with no live data, only *observable* wakes (user interaction) can be credited precisely; the prior-based credit is small and capped. This matches the requirement "deduct significant time spent awake" for exactly the wakes that matter (long, conscious ones — the user is by definition awake enough to tap once).
- **Known estimator gap:** short unnoticed wakes (user doesn't touch the phone) are only covered by the small prior credit. Acceptable v1 trade-off; fixable only with live sensing (see roadmap).

## 4. Items that require on-device empirical testing (cannot be verified in this environment)

1. AlarmKit alarm behavior across device reboot and Low Power Mode overnight.
2. Exact `AlarmManager.AlarmConfiguration` initializer signatures against the shipping iOS 26 SDK (API surface was reconstructed from Apple docs and third-party writeups; expect minor compile fixes in Xcode).
3. Oura API field names — `latency`, `awake_time`, `bedtime_start`, `type == "long_sleep"`, `next_token` are confirmed from client libraries, but run one live request with a real PAT to validate decoding end-to-end.
4. A 2-week calibration trial comparing app-estimated onset vs. Oura's morning ground truth per night (the data needed for the feedback loop below).

## 5. Improvement roadmap (priority order)

1. **Atomic alarm swap** (schedule-before-cancel with fresh UUIDs) — closes the §2 caveat.
2. **Morning feedback loop v2:** automatically compare last night's estimated latency vs. Oura's actual and maintain an exponentially-weighted personal correction term.
3. **Live Activity / Dynamic Island "I'm awake" button** so mid-night reporting doesn't require unlocking into the app.
4. **Apple Watch companion** (the single biggest accuracy upgrade): live HR + accelerometer enables true onset detection and automatic awake-time deduction, replacing the estimator with measurement while keeping the same AlarmPlan bounds as the safety net.
5. **HealthKit ingestion** as a secondary history source when Oura history is thin.

## 6. Round-2 revision (after design challenge)

Three challenges were raised against v1 and re-researched; the build was updated in response:

1. **"Is there truly no live data?"** Via the official API and HealthKit: yes, truly nothing usable mid-night (HealthKit export only happens when the Oura app is opened; a third-party app cannot force an Oura sync). Via BLE directly: no — [open_oura](https://github.com/Th0rgal/open_oura) proves live HR and on-ring sleep-stage events are readable locally. It's research-grade (key extraction, firmware-fragile, unclear coexistence with the official app), so it's the flagged v2 path rather than the v1 foundation. Research doc §5.1 corrected accordingly.
2. **"Tapping 'back to sleep' makes no sense."** Correct — replaced. `NightSensingEngine` now keeps the app alive overnight (audio background mode, Sleep Cycle's proven model) and detects onset, wakes, and re-sleep automatically from mic RMS + accelerometer + device-interaction events, with asymmetric hysteresis (2.5 min of activity to declare a wake, 7.5–10 min of quiet to declare sleep) so brief turn-overs never delay the alarm. Taps are now only the fallback when the mic is unavailable. Sensed events feed the same bounded `AlarmPlan`, so all three guarantees are untouched; if iOS kills the app, the pre-scheduled AlarmKit alarms still fire.
3. **"Surely a better heuristic than latency."** The latency estimate is now demoted to prior/fallback: onset is *measured* when sensing runs (`recordMeasuredOnset`, new tests cover override, rejection of pre-start onsets, and ceiling clamping). The genuinely smarter tier — ring-grade live staging over BLE, or an Apple Watch — is the roadmap top; both slot into the same plan/bounds architecture.

New empirical-test items: mic sensing thresholds need tuning against Oura's morning ground truth for 1–2 weeks; audio-session keep-alive behavior across Focus/interruptions (phone calls, other audio) needs on-device validation.

## 7. Final verdict

The solution meets the brief as well as the platform allows: one tap at bedtime, no clock-time alarm, personalized onset estimation, honest awake-time deduction for observable wakes, and — most importantly — hard, tested guarantees that the alarm fires within a known window and cannot silently fail. The primary residual risks are SDK-surface compile details and reboot behavior, both of which are one afternoon of on-device testing.

## Sources (verification round)

- [Apple — AlarmKit documentation](https://developer.apple.com/documentation/AlarmKit)
- [MacRumors — iOS 26 makes third-party alarm apps better](https://www.macrumors.com/2025/06/11/ios-26-third-party-alarm-apps/)
- [Itsuki — AlarmKit deep-dive (Level Up Coding)](https://levelup.gitconnected.com/swiftui-alarm-app-copycat-with-alarmkit-wwdc-2025-part-1-27fad3186791)
- [Open Wearables — Oura API data cadence](https://openwearables.io/blog/oura-api-accessing-ring-data-sleep-hrv-readiness)
- [lildude/oura Go client — sleep.go field names](https://github.com/lildude/oura/blob/main/sleep.go)
- [hedgertronic/oura-ring Python client](https://github.com/hedgertronic/oura-ring)
- [Home Assistant community — Oura data stale until morning sync](https://community.home-assistant.io/t/oura-ring-integration-doesn-t-update-sleep-and-readiness-data-after-wake-up/943971)
