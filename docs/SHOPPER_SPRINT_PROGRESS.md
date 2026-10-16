# Shopper sprint execution

Started 14 October 2026 (Asia/Jakarta). M15 is in progress; physical qualification and shopper discovery remain open.

Current update: **15 October — startup profiling and bounded loading/retry are
implemented locally**. Dated sections below retain their original scope; this
update supersedes earlier lists of pending browser instrumentation work.

### 15 October continuation: actionable camera acquisition errors

Added exported `CameraAccessError`/`CameraErrorCode`: blocked access, not found,
unreadable, unsupported and other unavailable acquisition. It preserves native
name/message, records original rejection as cause, and exposes stage/retryability.
Classification is restricted to the media acquisition boundary; permission prompts
remain untimed and preparation remains camera-free. Blocked does not assert a user
denial; unreadable does not prove another app is responsible. Native-name handlers
remain usable, while original-object identity moves to `cause`.

Reference copy now explains a specific next step for each reason. **319 SDK tests**,
SDK build, full workspace typecheck and `git diff --check` pass. Tests cover native
context preservation, unknown failures, one callback, prepared-worker cleanup on
camera failure and explicit retry after corrected blocked access. The first run
exposed a brittle playback microtask expectation after an extra chained catch;
handling acquisition with direct try/await/catch preserves the existing ordering
and also handles synchronous rejection. Final tests pass without relaxing cleanup.

Five deliberate UI acquisition-failure cases pass at 390 px: correct copy, usable
Start/resync, audio false, no horizontal overflow; unavailable API makes zero media
calls. No hardware stream/native permission prompt or person data was used.
Candidate **4f2e1ff673a8**, frozen manifest plus `docs/evidence/camera-recovery-*`.
Real permission prompts, browser embedding policy and physical-device acceptance
remain open. No publication.

### 15 October continuation: optional preparation failure recovery

Preparation now retains progress after optional startup failure: once face readiness
is confirmed, it releases the failed worker and attempts one face-only CPU worker
with hands/hair suppressed. Explicit start adopts it without reinitializing and
preserves restart count/`optional-startup` diagnostics and unavailable optional
states. Success produces no error callback. Failed fallback rejects/reports once
and stops; cancellation, obsolete assets and protocol mismatch cannot trigger it.

**307 SDK tests**, SDK build, workspace typecheck and `git diff --check` pass.
New regressions cover optional timeout → prepared fallback → same-worker start,
protocol mismatch, and failure of the sole fallback with one final notification.
A controlled actual-MediaPipe browser run primes face resources then stalls the
hair-model request under a six-second test deadline: preparation creates two
workers sequentially, releases the first, requests no camera, and retains the
face-only CPU replacement. Start creates no third worker, acquires one audio-off
synthetic stream, advances 14 blank results and cleans up all resources. Zero SDK
errors; preparation duration 7,871.7 ms. No raw camera/face outputs persisted.

Candidate **b87922de3e9c**, frozen in
`smoothness-shopper-prepare-fallback-manifest.json`; evidence/reproduction:
`docs/evidence/prepare-fallback-*`, `scripts/browser-prepare-fallback.js`.
All four normal native preparation cases also pass again: prepared start,
portrait activation, concurrent start and warmup cancellation (`prepare-fallback-happy`).
This primed, deliberately failed desktop run is not a speedup, recognized-fit,
real hair-mask or device qualification. No publication. Shopper/SKU/device gates
remain open.

### 15 October continuation: prepared geometry activation

Prepared startup previously reused only a landscape scratch warmup even when the
camera opened in portrait. Start now warms changed normalized geometry on the
same worker before live dispatch, including enabled optional graphs. Scratch
timestamps advance from 0 to 1 before live frames. Bounded startup waits include
activation; opt-in preparation metrics report `activationWarmupMs`. Worker protocol
is **8**; old workers fail version validation. Oversized, repeated and post-live
warmup requests are rejected. Current browser fixtures use protocol 8; frozen
shopper baseline comparisons retain protocol 7. Historical preparation proof
harnesses now pair current controllers with the matching frozen protocol-8 worker.

**304 SDK tests**, full workspace build/typecheck and `git diff --check` pass.
Build retains existing Three.js chunk-size warnings. Added session tests for
portrait same-worker activation and timeout cleanup, plus worker tests for all
graph shapes/timestamps, scratch bitmap closure and invalid/post-live requests.
Seven fitted/loading synthetic browser cases pass. Four actual MediaPipe public
preparation cases pass, including portrait: **140.3 ms** activation warmup within
**274.9 ms** start-to-ready, one worker/init and one audio-disabled synthetic
stream, advancing blank results, zero SDK errors and clean disposal. Cancellation
still requests no camera. No raw imagery/derived output persisted.

Candidate **96bd701bde40**; frozen manifest and `docs/evidence/prepare-geometry-*`
record validation. These uncontrolled desktop samples do not establish a speedup,
physical portrait appearance, recognized first fit or live hair-mask acceptance.
No publication. Physical phone/browser and licensed-SKU/shopper gates remain open.

### 15 October continuation: public camera-free preparation implemented

Added typed `session.prepare()` and readiness `prepared`. It explicitly waits for
the selected asset and warms the owned worker with blank input, with no camera
request. Repeated calls share a promise; concurrent explicit start acquires media
through the existing path and waits for the same preparation. Start adopts a valid
worker/ready response without another init, preserving normal fallback/recovery.
Stop, page hide and disposal cancel preparation and release ownership. Asset
revision and feature eligibility guard reuse. Prepared status remains idle; no
frame pump runs before start. Failures/cancellation reject, with one failure
notification where appropriate. The reference integration handles the new copy.

Opt-in `health.preparation` records earlier duration/reuse separately from start
timing, with API usage/cleanup/limitations in the package README. Preparation is
not automatic. The default example continues to start on an explicit camera action.

**300 SDK tests**, SDK build, full workspace typecheck and `git diff --check` pass.
Nine session regressions cover reuse, shared calls/concurrent start, no media,
asset revision, reentrant disposal, early stop, page hide, timeout/retry, late
camera cleanup and one asset error notification. The first workspace typecheck
identified missing `prepared` reference copy; the corrected full rerun passes.
Seven public-SDK synthetic fitted/loading cases pass, including prepared startup with GPU-visible eyewear and one worker. Three public-API
actual-MediaPipe checks pass: prepare/start, concurrent prepare/start, warmup cancel.
Prepared starts each use one worker/init and one audio-disabled synthetic stream,
advance results and clean up. Cancellation acquires no camera and releases its
worker. First fitted submission remains null on blank input.

One sample moves **11,452.3 ms** into explicit preparation, followed by **79.9 ms**
start-to-tracker-ready; a concurrent sample spends 1,563.7 ms preparing. Different
cache histories mean these are not matched speedups. Include preparation in total
work; physical/portrait input, first actual hair-mask, recognized fit and shopper
acceptance remain open. Candidate **bcd003660b61**, frozen in
`smoothness-shopper-public-prepare-manifest.json`; `docs/evidence/public-prepare-*`
contains tests/build/typecheck and browser/regression JSON/TXT. No publication.

### 15 October continuation: camera-independent connection and handoff

Added internal `TrackerConnection`, integrated with the existing session startup
and recovery flow. It owns initialization transport, sends init once, permits
explicit callback handoff on one owned worker, guards stale callbacks/handoffs,
and reports worker message-decoding failure. It keeps no packet queue or derived
camera data. Synchronous init transport failure rejects through startup cleanup.

**291 SDK tests**, SDK build, full workspace typecheck and `git diff --check` pass.
New tests cover one-init handoff, obsolete queued callbacks, release rejection,
transport failure and decoding failure. Six public-SDK synthetic loading/rendering
browser cases pass. A source-controller/built-native-worker proof passes **3/3**:
handoff, loading cancellation, prepared disposal. Each owns exactly one worker,
releases it, and makes zero camera calls. First blank completion after handoff is
36.3 ms; preparation took 8,227.9 ms in that attempt. These are uncontrolled
software timings, not a speedup or physical-fit result. Blank face input skips
activated hair sampling. No actual person/camera or raw output persistence.

Candidate **6e75f2da0b5a**, frozen in
`smoothness-shopper-tracker-connection-manifest.json`. Logs/JSON:
`docs/evidence/tracker-connection-*`; reproduce the controller proof with
`scripts/browser-tracker-connection.js` against the local Vite reference server.
Public `prepare()` is still pending: integrate session preparation state and
camera attachment, concurrent prepare/start and cancellation semantics using this
same connection. Normal camera permission/start behavior remains unchanged. No npm
publication or device acceptance.

### 15 October continuation: owned startup readiness and deadlines

Added internal `TrackerStartup` and integrated it with `TrackerWorkerOwner`.
Readiness promises, protocol validation, the total initialization deadline,
once-per-stage optional deadlines and timer cleanup now share one bounded wait.
Release/replacement rejects only its owned startup; late settlement is ignored.
Session-global ready resolvers and manual initialization timer cleanup are removed.
Synchronous init-message errors now also pass through the existing failure cleanup.
The active message loop and bounded optional/live recovery policy remain in the
session; `prepare()` is not exported yet.

**288 SDK tests**, SDK build, full workspace typecheck and `git diff --check`
pass. Added targeted total/optional deadline, duplicate loading-message, protocol,
success cleanup and replacement-cancellation regressions. Six synthetic public-SDK
render/loading cases pass. Four actual MediaPipe startup runs pass with zero
restarts/errors, audio disabled, advancing blank results and complete worker/track/
DOM cleanup; native first-fit timing stays null. These are lifecycle regressions,
not speedup or physical acceptance evidence. Candidate **4dcd79095a62**, frozen in
`smoothness-shopper-tracker-startup-manifest.json`. Logs/JSON:
`docs/evidence/tracker-startup-*`. Next separate initialization and callback handoff
from camera acquisition so prepare/start can share the controller. No publication.

### 15 October continuation: shared worker ownership integrated

Added internal `TrackerWorkerOwner` and routed SDK startup, stop, failure,
optional fallback and recovery through it. Replacement releases the previous
worker, detaches message/error callbacks before termination and clears ownership;
obsolete cleanup cannot terminate a newer worker. A failed constructor leaves no
stale ownership. No extra worker, public API or media acquisition was introduced.

**284 SDK tests**, SDK build and sequential full workspace typecheck pass.
The initial typecheck overlapped dist regeneration and saw temporarily absent
declarations; the post-build rerun passes. Six public-SDK synthetic GLB/render,
cancel/timeout/retry/error browser cases pass. Four actual native worker startup
runs pass, with one audio-disabled synthetic stream per attempt, zero restarts,
advancing results and complete track/worker/DOM cleanup. First fit remains null
on blank native input. These are regression checks, not speedup/device claims.

Candidate `a0032cf57f19`, frozen in
`smoothness-shopper-worker-ownership-manifest.json`. Evidence:
`worker-ownership-{tests,build,typecheck,browser,native}.txt`, browser/native JSON.
`git diff --check` passes. No publication. Next move initialization readiness,
bounded deadlines and recovery policy behind the owned-worker boundary before
implementing concurrent public preparation/start. `prepare()` remains proposed.

### 15 October continuation: camera-free preparation lifecycle

Defined the proposed additive API, concurrency, callback/ownership, cancellation,
asset-dependent feature selection, geometry and metrics rules in
[camera-free preparation contract](CAMERA_FREE_PREPARATION.md). The public SDK
does **not** expose `prepare()` yet. Integration requires extracting initialization
and bounded recovery from the camera-bound `start()` closure into one shared
session-owned worker controller; a second warmed worker is not the design.

The actual built worker proof passes **3/3 cases**: prepare then send a synthetic
frame, cancel loading, dispose prepared. Camera calls remain zero and all owned
workers terminate. First ready took 16,901.1 ms; first post-ready blank face
completion took 66.0 ms. Later prepared disposal reached ready in 1,518.6 ms with
different cache history. No speedup or hair-after-activation acceptance claimed:
blank faces skip hair sampling. No camera/person data or raw result persistence.
Evidence: `docs/evidence/camera-free-preparation.json` / `.txt`; candidate
`7e443207d837`. Browser verification and `git diff --check` pass. No production
code changed in this continuation. Next implement controller ownership and unit
coverage before adding the public API; physical-device/recognized-fit gates remain.

### 15 October continuation: smaller hair warmup experiment

Tested source-level `HairTracker` in isolated classic workers with synthetic blank
images, alternating 640×360 / 256×256 / 256×256 / 640×360 warmups, then reversing
that order in a fresh browser. All **8 initializations and 24 subsequent 640×360
inferences** completed with bounded output dimensions; workers, tasks and scratch
bitmaps were released. No camera or person data was used or saved.

First-in-browser warmup took **4,764.1 ms** at normal size and **4,969.1 ms** at
small size. Later warmups at either size took **384.5–445.7 ms**. First subsequent
640×360 calls took **49.3–61.4 ms**, including confidence-copy work. These results
do not establish a dimension-based speedup: initial compilation/cache history
dominates this small desktop experiment. Keep production warmup dimensions.
No appearance, GPU-completion, full-SDK, portrait or physical-device acceptance
is established; existing CPU fallback remains possible and driver/network caches
were uncontrolled. Next evaluate an explicit camera-free preparation lifecycle,
with cancellation/disposal and camera-consent behavior before any implementation.

Reproduce: `node scripts/build-hair-warmup-experiment.mjs`, then in dedicated
Playwright browsers run `scripts/browser-hair-warmup.js` at `/` and `/?reverse`.
Evidence: `docs/evidence/hair-warmup-experiment.json`, browser/reverse CLI logs and
build log. The JSON records source and built-worker hashes. Build and browser
checks pass; `git diff --check` passes. Production SDK code/defaults are unchanged
in this continuation, so its preceding 282-test result was not rerun. No publication.


### 15 October continuation: isolate optional hair compilation

Added additive hair creation/warmup fields to the existing local worker startup snapshot; no scheduling or default-effect change. Actual MediaPipe GPU browser smoke passed all four attempts with cleanup, zero SDK errors/restarts and no fitted submission on blank synthetic input. Default-policy startup took **11,161.8 ms**: optional work **9,583.4 ms**, hair creation **504.5 ms**, and first blank hair inference **9,078.4 ms**. This sample locates the principal delay in warmup rather than native creation/download; it does not demonstrate a speedup. Next investigate graph warmup cost and supported input dimensions with matched before/after runs, without compiling against a live fitted face.

**282 SDK tests**, SDK build and workspace typecheck pass. New deterministic test distinguishes creation from warmup and verifies unreached-phase reset; worker profile assertion includes both fields. The initial test run failed because its exact timing-object assertion predated the additive fields; corrected assertion passes. Candidate `7e443207d837`, frozen in `smoothness-shopper-hair-phases-manifest.json`. Evidence: `shopper-hair-phases-{tests,build,typecheck,browser}.txt` and `shopper-hair-phases-browser.json`. Browser/network/GPU limitations and physical-device gates above remain open. No publication.

## 15 October: measured startup costs and loading implementation

Repeated desktop cohort on final SDK candidate `e18a506cf45d`: **9/9 attempts
passed**, zero SDK errors/restarts, one audio-disabled synthetic stream per attempt,
and complete worker/track/DOM cleanup. Three cleared-runtime-cache face-only
attempts measured median **1,914.3 ms**, sample nearest-rank p95 **7,042.4 ms**;
five retained-cache attempts measured median **1,262.2 ms**, sample p95 **1,317.8 ms**.
The single resolved-default run measured **12,319.1 ms**, including **10,702.0 ms**
optional graph preparation/creation/warmup. Automatic hair was ready and compositing
active. This reinforces optional initialization as the next investigation target.

Reproduce with a fresh dedicated browser at `/?cohort=1`, then run
`scripts/browser-shopper-native-startup.js` using playwright-cli. Evidence:
`docs/evidence/shopper-startup-cohort.json` / `.txt`. The JSON clarifies scope
wording retained in the raw log. Sample quantiles use successful attempts only;
failures and sample counts are separate. HTTP cache and pinned CacheStorage clear
before each cold attempt; GPU/shader caches and network conditions remain uncontrolled.
These small samples do not establish population p95 or a speedup. Blank input keeps
first-fit submission null. Native XNNPACK INFO messages appear at console error
level; no SDK error callback fired. Physical/recognized-fit acceptance remains open.

The instrumented worker separates file resolution, cached resource preparation,
native face creation, first blank inference warmup, and optional graph work.
In one initial cold face-only sample (8,533.3 ms constructor-to-ready), resource
preparation took **4,342.0 ms**, native face creation **236.1 ms**, and first blank
inference warmup **3,714.2 ms**. Warm samples took 769.0/748.2 ms overall.
Evidence: `docs/evidence/shopper-worker-profile.json` / `.txt`.

A subsequent cleared-cache face-only run took 2,689.8 ms, with resource preparation
1,506.4 ms and warmup 725.1 ms; warm runs took 736.1/761.9 ms. The resolved default
policy run took 6,180.1 ms with automatic hair ready and camera compositing active;
optional (hair) preparation/creation/warmup accounted for **5,230.3 ms**. Each used
one synthetic stream, produced advancing actual native results, had zero restarts
and cleaned up. Evidence: `shopper-worker-profile-defaults.json` / `.txt` and
profiling build `86e61c150ec9` in `shopper-worker-profile-build.json`.

These are unthrottled desktop samples, not p95, physical-camera recognition,
optical fit or mobile acceptance. Clearing HTTP/CacheStorage does not reset GPU
driver/shader caches or remote CDN/network conditions. The lower later cold
sample is **not a demonstrated SDK speedup**. Warmup includes first inference and
native compilation, not isolated GPU execution. With custom URLs/caching off,
resource downloads can be charged to native creation rather than preparation.

Implemented:

- Typed `onReadinessChange` startup stages with indeterminate, host-owned copy.
- `resourceTimeoutMs` deadlines (100–120000 ms, per resource wait), typed exported
  `ResourceTimeoutError` with stage/code/retryability, and bounded video playback,
  asset and tracker startup. Camera permission itself remains untimed.
- Owned abortable GLB fetches on supersession, timeout and disposal; late parsed
  scenes cannot install and are disposed. Existing valid models survive failed
  replacements. Referenced external textures lack loader abort support; embedded
  GLBs are recommended and late installation is still prevented.
- Explicit replacement/recreate retry, including the Vanilla **Sambungkan ulang**
  flow. Stop remains available during startup. Cancel/ready callbacks honor
  generation checks; disposal announces cancellation after releasing resources.
- Obsolete initial failures cannot overwrite a newer successful selection.
- Local diagnostic snapshots expose worker phases without face-derived data or
  event histories. API/lifecycle details are documented in the SDK README.
- Shopper-facing loading/recovery messages, stable guidance announcements, and
  space for attribution alongside the privacy note at phone widths.

Validation: final **281 SDK tests**, prior **108 generator tests**, offline cache
policy, full workspace build and typecheck pass. Logs: `shopper-loading-sdk-tests.txt`,
`shopper-loading-tests.txt`, `shopper-loading-build.txt`, `shopper-loading-typecheck.txt`.
Build retains existing Three.js chunk-size warnings. Six public-SDK synthetic
browser cases pass: initial/repeated startup, generated blob swap, blocked-load
cancel, timeout followed by replacement/restart, and 404 cleanup. Full generated
GLB calibration/shader/rejection checks also pass. Evidence: `shopper-loading-browser`
and `shopper-loading-generated` JSON/TXT files.

Reference UI checks pass error-to-retry, Stop during loading, subsequent startup,
audio disabled, cleanup, zero repeated guidance mutations over a 500 ms stable
window, and no horizontal overflow at 390 px. Desktop/mobile synthetic screenshots
were inspected, including attribution/privacy spacing. Evidence: `shopper-loading-ui`
JSON/TXT/PNGs. The scoped copy detector returned no findings.

The first generated-swap probe sampled at a fixed 350 ms and failed; frozen/current
comparison and an observable-render wait pass. The cancellation regression also
needed to synchronize on `loading-asset` rather than two microtasks after playback
became bounded. Its initial failure is retained in
`shopper-loading-cancellation-fixture-failure.txt`. Neither change relaxes the
cleanup or actual-render assertions.

Final candidate **e18a506cf45d** is frozen in
`smoothness-shopper-loading-final-manifest.json`. No package publication occurred.
Next optimization: evaluate optional hair preparation and explicit camera-free
preparation without moving blocking compilation onto an already fitted face.
Standardized repeated cohorts, actual phone/recognition qualification, shopper
observations and a licensed SKU remain open. Existing default effects were kept.

## Completed foundation work

- Reused `scripts/freeze-sdk-baseline.mjs`; replaced its hardcoded date with the Jakarta date and restricted labels to safe filename characters.
- Built the full workspace immediately before capturing `docs/evidence/smoothness-shopper-sprint-manifest.json`. Frozen SDK distribution is in the ignored `.benchmarks` directory. The manifest records source and worker hashes and package/dependency metadata.
- Added `scripts/shopper-startup-timing.mjs`, a camera-free benchmark utility accepting stage names and monotonic numeric times only. It retains one attempt in memory and resets explicitly. It makes no network requests and stores no imagery, coordinates or poses.
- Synthetic checks exercise constructor work before permission, unanswered consent, invalid/repeated/out-of-order marks, reset, readiness prerequisites and zero-duration acquisition.

This utility is not wired into the live SDK yet. First usable means a harness-confirmed successful fitted render, not merely tracker ready or a blank-frame completion. A live harness must mark it only after successful rendering. S02 remains partial until browser integration and cold/warm attempts exist.

### Browser harness continuation — 14 October

`scripts/browser-shopper-startup.js` now imports the timing utility and built
public SDK in Chromium. Four cases pass: initial and repeated startup with
GPU-observed eyewear pixels, cancellation after an explicitly blocked GLB request,
and a 404 initial asset. Each case acquires one synthetic stream, requests
`audio: false`, and ends all tracks/worker/host elements on disposal. Evidence:
`docs/evidence/shopper-browser-startup.json` and the CLI log with the same basename.
Browser launch/server required approved retries after sandbox failures.

These runs use real GLB/video/WebGL but mocked recognition, disabled optional
hair/compositing, and no physical camera. They are not the default-feature/device
baseline or cache-cleared cold/warm MediaPipe measurements. One attempt per case
does not establish p95. Public `start()` completion supplies an upper bound for
asset and tracker readiness; exact resource phase instrumentation remains open.
GPU readback is confined to this synthetic development harness.

The missing GLB reports the same error twice: the initial asset rejection callback
and startup failure callback both notify `onError`. Cleanup succeeds, but duplicate
notification is an open R01 recovery defect. Future recovery acceptance should
require one actionable notification per failure; this harness currently verifies
failure settlement and cleanup only. No core runtime change was made in this step.

### Duplicate startup error corrected — 14 October

The subsequent SDK change assigns initial-asset error reporting to an active
`start()` attempt. Idle initial loads still notify; disposal suppresses late
notifications. A later failed retry reports once again rather than suppressing
errors by object identity. This closes the duplicate-notification defect above.

All 265 SDK tests pass, including three added lifecycle regressions for active
start/retry, idle reporting and disposal. SDK build and workspace typecheck exit 0.
The four synthetic browser cases pass again; a missing GLB now requires and
produces exactly one callback with stopped tracks and cleared worker/elements.
Logs and summary: `docs/evidence/shopper-error-tests.txt`,
`shopper-error-build.txt`, `shopper-error-typecheck.txt`,
`shopper-error-browser.txt` and `shopper-error-browser.json`.
Candidate SDK `3157024f16e2` is frozen separately in
`smoothness-shopper-error-fix-manifest.json`; the original baseline is preserved.
Actual-worker cold/warm, optional-default and physical-device gates remain open.

### Startup diagnostics and actual-worker smoke — 14 October

Added typed opt-in `TrackingHealth.startup` with camera API pending duration,
post-playback asset wait, initial tracker readiness and first fresh fitted CPU
render submission. Null means unreached; stop/dispose reset all fields. It stores
four software durations only, with no raw events or face measurements. Asset wait
does not represent total constructor download/parse; first submission is not GPU
completion, first usable appearance or physical display latency. Package README
documents the semantics. Recovery preserves the original readiness timestamp.

SDK build, workspace typecheck and **269 SDK tests** pass, including timing/reset
and blank-frame lifecycle checks. The synthetic browser harness confirms fitted
draws establish submission timing and still passes all four startup/error cases.
Evidence: `docs/evidence/shopper-timing-{tests,build,typecheck,browser}.txt` and
`shopper-timing-browser.json`. Final candidate: `2f6e6b49b42e`, frozen separately.

The actual MediaPipe GPU face worker also passes one cleared-cache and two retained
cache runs on blank synthetic video: constructor-to-tracker readiness **7,585.9 ms,
664.9 ms and 763.8 ms**. Each produced 15 results, zero restarts, one synthetic
stream and complete cleanup. First fitted submission remained null as expected.
Evidence: `shopper-native-startup.json` / `.txt`; smoke build `9cded6ada2cf` is
identified in `shopper-native-startup-build.json`. The final candidate adds an
extra visible-face guard; its fitted browser checks pass separately.

The dedicated browser HTTP cache and pinned runtime CacheStorage were cleared
before the first run. SDK imports were already loaded; optional hair, hands and
compositing were disabled. These three unthrottled desktop samples measure native
initialization/continuity, not recognized-face first fit, standard network budgets,
p95, current optional defaults or phone acceptance. Repeated standardized runs
and physical qualification remain open. No personal camera or data was used.

## Baseline configuration

Use `/`: auto presentation, adaptive quality on, camera/lens compositing on, guarded eligible auto-hair, hands off. The example opts into pinned runtime caching; cold attempts clear those resource caches while warm attempts disclose preparation history. Assets remain demonstration/import fixtures, not retail SKUs. The CC0 asset rebuilt at 3,292,684 bytes exceeds the proposed 2 MB budget; treat this as a measured exception pending asset optimization and device review.

The timing utility reports wall time, camera API pending duration, software-controlled time, asset readiness, tracker readiness and post-camera duration separately. Camera pending can include acquisition as well as user decision time. Cold scenario entry precedes SDK construction and preload; do not hide constructor work before the measurement clock. Counts/timings alone do not certify visual fitting.

## Readiness/recovery contract draft (S05)

Preserve current lifecycle and callbacks. Prefer one additive readiness snapshot with separate resource phases over changing `SessionStatus` values. Candidate fields are asset/runtime readiness and current stage; use indeterminate progress unless actual byte totals exist. Error reasons should identify permission, camera unavailable/busy, asset, runtime, worker protocol, cancellation and renderer failure, with stage and a recoverable action. These are draft contracts, not exported APIs.

`prepare()` needs an evidence-based decision after browser timing. It must share constructor asset loading, avoid permission/camera access, document downloads/cache ownership and settle cancellation. Stop/page hide cancels active startup; disposal releases prepared workers and asset resources. A resource timeout must not classify an unanswered permission prompt as denial. Retry after context loss may require session reconstruction. Failed replacement retains the current model and displayed product identity.

## Shopper observation protocol (S04 preparation)

Observe 6–8 consenting participants live. Ask them to start, inspect a side view, select three pairs, choose a preferred pair, stop, then recover from one safe loading failure. Record anonymous task completion/help counts and general friction themes only. Do not record video, screenshots, personal appearance attributes, names, landmarks, measurements or pose histories. Recruitment/outreach has not been initiated.

## Reference-flow specification (S07 draft)

Order the shopper flow as preview → start/stop and one guidance message → current product and catalog. Show loading choice separately from displayed choice. Keep Stop reachable during loading. Retry/static product view replaces generic reload instructions. Developer diagnostics/calibration remain available in a separate developer view. Announce changed guidance reasons once, with keyboard/button equivalents and clear focus. Live comparison stores two product IDs in host session state, without snapshots. Refine this specification after actual observations; no UX acceptance is claimed.

## Ticket status and next steps

| Ticket | Status | Remaining work |
|---|---|---|
| S01 | Baseline captured | Attach configuration/asset hash supplement and retain frozen artifacts for device runs. |
| S02 | Main/worker phase diagnostics, cold/warm and resolved-default native smoke, and six fitted/loading browser cases pass | Repeated standardized cohorts, physical first-fit and default-feature device acceptance remain open. |
| S03 | Open | Physical iPhone and two Android classes plus current-build desktop review; exact devices not yet supplied. |
| S04 | Protocol ready; observations open | 6–8 shopper sessions and ranked findings. |
| S05 | Readiness/deadlines, typed timeouts and camera acquisition reasons implemented and checked | Wider asset/renderer reason taxonomy and physical permission/embedding/CSP observations remain open. |
| S06 | Open | Licensed supplier SKU needed; demo validation is not supplier qualification. |
| S07 | Draft ready | Observations, accessibility review and final flow specification. |
| S08 | Open | Ratify support tiers/budgets after physical/browser baseline. |

Next engineering work: evaluate optional hair initialization cost and camera-free preparation; collect standardized repeated cohorts and qualify the complete flow on physical phones. Device, shopper and licensed-SKU gates remain explicit external dependencies.
