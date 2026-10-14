# M10 — Tracking and interaction continuity

13 October 2026. The SDK remains the product; the Vanilla website uses its public
API. Processing stays transient and on-device. No npm publication.

## Decisions and acceptance

| Improvement | Decision | Code acceptance |
| --- | --- | --- |
| Camera geometry | Associate each in-flight capture with the source dimensions and a geometry revision. Invalidate face/hand/hair state on resolution or orientation change; discard mismatched results and resume on the next decoded frame without reacquiring the camera. | Landscape/portrait, change-and-return, delayed bitmap/result, mask clearing, next-frame recovery and cleanup |
| Hand budget | Face tracking has priority. Adapt hand cadence, then suppress hands only after repeated sustained expensive live inference. Warmup and single spikes cannot disable hands. Expose the local fallback reason. | Spike/recovery/reset fixtures and worker face/result/frame completion after optional shutdown |
| Motion prediction | Compare angular velocity in a common coordinate system, including direction and changing sample cadence. Fall back to the latest fit when motion becomes inconsistent or data ages. | Axis changes, uneven intervals, stationary/noisy/reversal and expiry fixtures |
| Asset readiness | Startup follows the latest pending asset. A failed replacement preserves a previously usable model and restart; the replacement caller still receives the error. | Concurrent loads, initial failure, replacement failure, cleanup/start cancellation |
| Live fit units | `setFit(referenceEyeSpan)` updates temple fade and hair rear boundaries in-place, clearing incompatible hair confidence. | Shared compiled uniforms/material versions and live-render equivalence to initial calibration |

## Progress

- Code implementation complete. M9 checks remain historical evidence; the new
  evidence below targets this build.
- Live camera, mobile browsers, anatomical ear/hair accuracy, physical hand
  depth, and calibrated retail SKU qualification remain user/device checks.

### Implemented

- One latest capture token retains numeric source/input dimensions and a
  revision, including after frame completion. Changed dimensions clear the
  mount, prediction, grip, mask and ambient sample. In-flight stale results are
  ignored; stale hair buffers are zeroed. A bitmap made obsolete before transfer
  is closed locally. Change-and-return is detected by revision, not dimensions
  alone. Frozen-camera expiry still runs before packet rejection.
- Hand cadence targets one-third occupancy (50–250 ms). Budget fallback requires
  eight consecutive live calls >100 ms, EWMA >100 ms and three seconds pressure;
  adaptive cadence reaches its cap first. Warmup/spikes/recovered latency do not
  disable hands. Genuine capture pauses reset pressure; native calls >1 second
  count as occupancy rather than continually resetting dwell. Only the hand
  graph closes; face/result/completion and button placement continue. This guard
  also applies when quality adaptation is disabled. Calls cannot be preempted.
- Auto prediction checks world-coordinate angular velocity vectors, covering
  direction and speed. Stop gating uses speed rather than raw quaternion delta
  so differing inference intervals do not suppress a constant turn. Three
  matrix-source samples are required. Repeated media cannot preserve prediction
  after the 100 ms age bound; 30 ms horizon and 8° cap remain.
- Asset startup follows the latest load even if a superseded download stalls.
  Only a current successful request establishes installed readiness. Failed
  swaps preserve an existing valid model while rejecting their callers. Initial
  constructor/load failures retain their real error. Cancellation removes wait
  listeners; a stopped generation does not share or clear a newer start promise.
- Live reference-unit changes now update shared temple/hair uniforms without
  replacing materials or recompiling shaders. An incompatible old hair sample
  is cleared. The same boundaries apply on asset load and later `setFit()`.

### Actual checks

- `pnpm build`: exit 0; SDK, asset generator, Vanilla and Studio. Three GLB
  validators and offline production cache verification pass. Three.js chunks
  >500 kB remain warnings. SDK 111.89 kB / 32.46 kB gzip; worker 179.52 kB.
- Four-workspace `pnpm typecheck`: exit 0. `pnpm test`: **182 SDK + 6 generator =
  188 tests**, all pass; offline policy passes. Includes geometry, lifecycle,
  nine asset-readiness tests, seven cadence tests, 13 worker tests and 22
  presentation tests.
- Frozen final SDK `fe73cca3afb7`, worker `face-worker-CZkKssiX.js`, protocol 7.
  [Build/source manifest](evidence/smoothness-continuity-final-manifest.json).
  Freeze followed the successful build; no SDK source edits followed it.
- [Public SDK continuity](evidence/continuity-public.json): actual GLB/WebGL and
  canvas video with synthetic recognition. Landscape→portrait→landscape clears
  old fits and ignores old results; new fits render. One camera acquisition,
  zero restarts during both changes. Injected hand budget preserves tracking
  and head-placement buttons (2,535 pixels visible). Failed asset replacement
  rejects and retains 9,194 pixels; stop/start returns to tracking. A latest
  successful asset unblocks startup while the older download remains stalled;
  its eventual completion preserves the current model. All tracks ended,
  elements removed, error callbacks zero. Injected budget validates consumer
  fallback; worker tests separately validate the cost decision.
- [Live fit units](evidence/continuity-fit-units.json): four compiled temple/hair
  bindings update to the new reference. Old mask zeroed; `setFit` material
  versions unchanged. Control and fit draw have identical version deltas;
  program count stays six. Live-adjusted and initially calibrated GLB produce
  identical pixels (mean byte difference 0), WebGL errors 0. Internal renderer
  integration, synthetic pose, no camera.
- [Native final startup](evidence/continuity-native.json): actual Face/Hand/Hair
  graphs prewarm before dispatch. Final run startup 3,100.5 ms; 213 frame
  completions, 74 hand packets, zero restarts, one camera acquisition,
  HTTP writes/body zero, tracks/elements cleaned. Native landscape→portrait→
  landscape produces 26/27 additional completions at the new dimensions without
  restarting the worker.
  Blank input deliberately produces no recognized face/hair mask. Earlier
  intermediate startup took 14,265.7 ms; these are not a matched performance A/B.
- [Visibility](evidence/continuity-visibility.json): **64/64** public SDK cases
  across four motion modes, hands on/off, delayed results, loss, reacquisition,
  expiry and stop. Final build, synthetic recognition/actual GLB/WebGL.
- [Defaults](evidence/continuity-defaults.json): default visible frame 8,848
  pixels; large-face pressure 640→480, profile/small face restore 640. Injected
  video upload failure restores DOM/original optics, keeps tracking and 623 frame
  pixels; zero error callbacks, cleanup passes.
- [GPU](evidence/continuity-gpu.json): three GLBs, cover/calibrated projection,
  transmission, rear hair-mask ownership/Y/expiry, shader/WebGL errors zero.
- [Vanilla](evidence/continuity-example.json): default controls, invalid
  calibration and recreation/cleanup pass; zero camera calls or uncaught page
  errors. The reference website is running at http://127.0.0.1:5173/.

### Failures and qualification limits

- Sandboxed `pnpm` initially failed EPERM resolving the repository. Local
  verification succeeded through auto-reviewed escalated execution.
- First integrated run had four failures: abort reason normalization, exact
  initial renderer-error retention, frozen-camera expiry when rejecting an
  unmatched packet, and a fixture using callback time rather than the submitted
  capture timestamp. Production paths were corrected; the fixture now checks
  that an unmatched packet is rejected before accepting the actual capture.
  The same acceptance assertions pass in the full suite.
- [Initial fit GPU failure](evidence/continuity-fit-units-initial-failure.json)
  required stable material versions across every draw. Diagnostic showed no
  version change during `setFit`, followed by a lens version delta of four.
  A control draw measured the same delta. The final test compares those deltas
  and retains uniform correctness, mask clearing, stable shader-program count
  and exact pixel equivalence requirements. No production workaround was added
  for this per-draw behavior. [Diagnostic](evidence/continuity-fit-units-diagnostic.json).
- Six motion cases failed against the earlier sampler before correction;
  seven new cases cover changed axes, cadence, matrix-source transitions,
  expiry and quaternion sign changes. These are synthetic behavior checks.
- Native blank-stream timing and synthetic geometry/recognition checks do not
  establish recognized-face FPS, real hand/hair accuracy, physical depth,
  mobile thermal behavior or calibrated retail fit. No personal frames or
  derived camera data were recorded. No npm publication.
