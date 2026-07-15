# Oura Sleep Alarm — Initial Research (Stage 1)

**Date:** 2026-07-15
**Goal:** An app where the user taps "Start" when getting into bed, sets a target sleep duration (e.g. 7h), and is woken by an alarm ~7h of *actual sleep* after they fell asleep — automatically estimating sleep onset and deducting significant mid-night awake time. The alarm must never fire far too early, and must **always** fire (fail-safe: too late is bad, not firing at all is unacceptable).

---

## 1. What the Oura API can and cannot do

### 1.1 API basics
- **Oura API v2** (`https://api.ouraring.com/v2`), docs at `api.ouraring.com/v2/docs`.
- Auth: **Personal Access Token** (single user, perfect for a personal app) or **OAuth2** (multi-user). Rate limit ~5000 requests / 5 min — irrelevant for our volume.
- Relevant endpoints:
  - `GET /v2/usercollection/sleep` — per-session sleep records: `bedtime_start`, `bedtime_end`, `latency` (seconds from bedtime to sleep onset), `awake_time`, `total_sleep_duration`, `efficiency`, per-5-min `sleep_phase` string, HR/HRV time series.
  - `GET /v2/usercollection/daily_sleep` — daily score summary.
  - `GET /v2/usercollection/heartrate` — 5-min-interval HR samples (still post-sync).
  - **Webhooks** — server-side notifications ~30s after data *syncs from the mobile app*.

### 1.2 The critical limitation: no real-time data
This is the single most important finding and it drives the entire architecture:

- **The ring does not stream anything.** It stores data locally and syncs over BLE to the official Oura app; Oura's cloud then processes it. There is **no live endpoint** for "is the user asleep right now".
- **Sleep sessions generally only appear after the night ends** — typically when the user opens the Oura app in the morning; processing completes mid-morning. Even Oura's own Home Assistant integrations show stale data until a manual morning sync.
- Webhooks fire ~30s after sync — but sync doesn't happen mid-night, so webhooks can't detect sleep onset live either.
- Background sync exists for some data types (activity, stress) but **sleep sessions cannot be relied on during the night**, and a locked phone at 2am has essentially no chance of a fresh, processed sleep record.

**Conclusion:** live sleep-onset detection via the Oura API is impossible. Any design that "polls Oura until it says you're asleep" will silently fail every night.

### 1.3 What Oura *is* excellent for: personalization
Oura's historical data gives us a per-user statistical model that beats any hardcoded guess:

- **`latency`** per night → the user's personal distribution of "time from getting into bed to falling asleep". Median personal latency is a strong estimator of tonight's onset delay.
- **`awake_time`** per night → the user's typical mid-night wakefulness, usable as a prior for how much awake-credit to expect.
- **Contextual modifiers:** later-than-usual bedtime correlates with changed latency; day's activity/readiness can nudge the estimate.
- **Morning ground truth:** after the ring syncs, we can compare our estimate vs. Oura's actual `latency`/`awake_time` and continuously recalibrate (a feedback loop that improves the estimator over time).

### 1.4 Oura's own smart alarm
Oura Ring has **no alarm capability at all** — no vibration motor usable for alerts, no smart-wake feature. Community demand exists (widely requested), but the hardware can't do it. The phone must sound the alarm.

## 2. Platform choice for a reliable alarm

### 2.1 iOS with AlarmKit (chosen)
- **AlarmKit** (iOS 26, WWDC25) provides true system-level alarms for third-party apps: they fire when the app is killed, **break through Silent mode and Focus**, show full-screen on the Lock Screen/Dynamic Island, and behave like Clock-app alarms. This removes the historical iOS blocker (local notifications are droppable, muted by silent switch, and capped at 30s of sound).
- Requirements: `NSAlarmKitUsageDescription` in Info.plist, one-time user authorization via `AlarmManager.requestAuthorization()`.
- Alarms can be scheduled with a **fixed date** or a **countdown duration**, cancelled and rescheduled by ID whenever the app gets execution time.
- Verdict: **native Swift/SwiftUI iOS app with AlarmKit is the right build target.** Android (`AlarmManager.setAlarmClock`) is the fallback platform but the user's ecosystem is Apple.

### 2.2 Background execution reality on iOS
- `BGAppRefreshTask` is **explicitly unreliable** — Apple gives no guarantees; at night with a locked, still phone it will often never run. It can be used only as an *opportunistic bonus* (e.g. refine the alarm if we happen to get woken), never as the mechanism the alarm depends on.
- Silent push (APNs background notifications) could wake the app if we ran a server bridging Oura webhooks — but webhooks don't fire mid-night anyway (see 1.2), so a server adds nothing for the core loop.
- **Consequence: the alarm time must be fully determined (with safe bounds) at the moment the user taps Start**, and only *improved* by optional signals afterwards (user interaction, foreground events).

## 3. Resulting architecture (what Stage 2 builds)

**"Estimate-and-bound" design** — since live detection is impossible, we estimate onset from personal Oura history and wrap it in hard safety bounds:

1. **Nightly baseline (personalization):** each day the app pulls the last ~60 nights of `sleep` records and computes robust statistics: median & IQR of `latency`, median `awake_time`, bedtime-deviation adjustment. Cached locally so tonight works even with no connectivity.
2. **Start:** user taps *Start Sleep* with target duration `T` (e.g. 7h).
   - Estimated onset = `now + clamp(personalLatencyEstimate, 5 min … 45 min)`.
   - Alarm scheduled via AlarmKit at `onset + T + expectedAwakeCredit(prior-based, capped)`.
3. **Guaranteed bounds (the "can't fire too early / too late" rules):**
   - **Never earlier than `start + T`** — the user cannot possibly have slept `T` hours sooner than `T` after getting into bed (onset ≥ start). Hard floor.
   - **Never later than `start + T + latencyCap + awakeCreditCap`** (defaults: 45 min + 90 min). Hard ceiling; a backup AlarmKit alarm at the ceiling guarantees firing even if all refinement logic fails.
4. **Mid-night awake handling:** live detection is impossible, so awake time is credited from *observable* signals:
   - **User interaction:** if the user wakes and unlocks/opens the app (or taps an "I'm awake" Live Activity button), the app timestamps the wake, and when they tap "back to sleep" it pushes the alarm back by that awake span **plus** a fresh (shorter) re-onset latency — capped by the ceiling.
   - **Prior-based credit:** a small expected-awake allowance from their Oura history is baked in up front (capped, and only if their history shows consistent night wakefulness).
   - Opportunistic `BGAppRefresh`/foreground moments re-check nothing Oura-wise at night (no data), but recompute bounds if the user changed settings.
5. **Morning feedback loop:** when Oura's actual sleep record arrives (after morning sync), the app compares estimated vs. actual onset latency and awake time, and updates the estimator (exponentially weighted) — the alarm gets more accurate every week.
6. **Failure modes covered:** no network at bedtime → cached stats; no Oura history → conservative default (15 min latency, no awake credit); AlarmKit denied → block Start with explanation; app killed overnight → AlarmKit alarms fire anyway.

## 4. Alternatives considered and rejected
| Option | Why rejected |
|---|---|
| Poll Oura API overnight to detect onset | No mid-night data exists; iOS background polling unreliable anyway |
| Oura webhooks → push server → silent push | Webhooks only fire on app sync, which doesn't happen mid-night; adds server for no signal |
| Apple Watch live HR/motion detection | Viable but requires a second device the user must wear; out of scope v1 — noted as best future upgrade for live awake detection |
| Local notifications instead of AlarmKit | Muted by silent/Focus, 30s max sound — fails the "must wake you" requirement |
| Android first | AlarmManager is equally capable, but user is on iOS; AlarmKit now closes the gap |

## 5. Round-2 corrections and additions (post-challenge research)

The first version of this document overstated two things; a second research pass corrected them:

### 5.1 "No live data from the ring" needs nuance
- **Via the official API: confirmed, truly nothing mid-night.** Sleep sessions are processed cloud-side after sync; Oura→Apple Health export also only happens **when the Oura app is opened**, so HealthKit is not a live side-channel either. A third-party app cannot force the Oura app to sync (no URL scheme/intent for it, and iOS apps can't wake other apps).
- **Via Bluetooth directly: live data DOES exist.** The [open_oura](https://github.com/Th0rgal/open_oura) project (Rust, Gen 3/4/5) has reverse-engineered the ring's BLE protocol: live heart rate (beat-to-beat IBI), latest SpO2, and the ring's **on-device sleep-stage events** from its history stream — completely locally, no cloud. Caveats that keep it out of v1: research-stage with no releases; requires extracting the 16-byte pairing key; unclear coexistence with the official Oura app's BLE connection; per-connection encrypted protocol that Oura can change at any firmware update. It is the correct **v2 path to true, tap-free, ring-grade wake detection** and is now the top item on the roadmap.

### 5.2 Mid-night wake detection must not require taps
Requiring a sleepy user to tap "I'm awake / back to sleep" was a design error. The corrected design keeps the app alive overnight the way Sleep Cycle does (audio background mode, phone charging) and senses wakes automatically by fusing three phone-side signals per 30s epoch: microphone RMS (movement/rustling), accelerometer, and unambiguous interaction events (device unlock, app foregrounding). Sustained quiet → onset (also replacing the latency *estimate* with a *measurement*); sustained activity or any device interaction → wake; sustained quiet again → back to sleep, crediting the exact span. Sleep Cycle has shipped this model at scale for a decade, and touchscreen-interaction research ([npj Digital Medicine](https://www.nature.com/articles/s41746-019-0147-4)) confirms phone interactions are a strong sleep/wake boundary signal. The taps remain only as a manual fallback when the mic permission is denied.

### 5.3 Estimation still matters, but as prior + fallback
With sensing in place the personalized Oura latency estimate becomes (a) the initial alarm position before onset is measured, (b) the whole mechanism when sensing is unavailable, and (c) part of the morning recalibration loop against Oura's ground truth. The floor/ceiling guarantees are unchanged and still bound everything.

## 6. Sources
- [Oura API v2 documentation](https://api.ouraring.com/v2/docs)
- [Oura Member Care — The Oura API](https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API)
- [Open Wearables — Oura API: Accessing Ring Data, Sleep, HRV and Readiness](https://openwearables.io/blog/oura-api-accessing-ring-data-sleep-hrv-readiness) (data cadence, webhook ~30s-after-sync, morning availability)
- [Home Assistant community — Oura integration doesn't update until morning sync](https://community.home-assistant.io/t/oura-ring-integration-doesn-t-update-sleep-and-readiness-data-after-wake-up/943971)
- [Apple — AlarmKit](https://developer.apple.com/documentation/AlarmKit) and [Scheduling an alarm with AlarmKit](https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit)
- [WWDC25 — Wake up to the AlarmKit API](https://wwdcnotes.com/documentation/wwdc25-230-wake-up-to-the-alarmkit-api/)
- [Nil Coalescing — Countdown timer with AlarmKit](https://nilcoalescing.com/blog/CountdownTimerWithAlarmKit/) (exact API shapes)
- [Mert Bulan — Don't rely on BGAppRefreshTask for business logic](https://mertbulan.com/programming/dont-rely-on-bgapprefreshtask-for-your-apps-business-logic)
- [Gadgets & Wearables — A smart alarm feels like the obvious next step for Oura](https://gadgetsandwearables.com/2026/03/06/oura-smart-alarm/) (no native Oura alarm)
