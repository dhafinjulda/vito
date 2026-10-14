# M9 — Default feature readiness, 13 October 2026

User requests maturation of all experimental features. The browser SDK remains
the product. All camera/pose/mask/hand data is transient on-device; no publish.

## Decisions and implementation gates

| Area | Default policy / deliverable | Code acceptance | Device gate |
|---|---|---|---|
| Motion | Auto uses bounded prediction only on consistent matrix motion, otherwise direct. Interpolation remains an explicit alternative, never automatically adds latency. | Jitter/jerk/reversal/stall/reset and shared mount/mask/contact fixtures | Live lag/alignment A/B |
| Quality | Adaptive DPR/input enabled, preserve 640 on unknown/small/lost face; hysteresis and immediate recognition restoration | Large-face pressure, small/profile/loss/reacquisition and CPU fallback | Mobile recognition/thermal |
| Camera/lenses | Local compositing and semantic transmission enabled; restore original materials + DOM preview on shader/draw/budget failure | GPU video/crop/mirror/transmission and fault injection/cleanup | Safari/Android/live optics |
| Hair | Auto only for semantic assets/capable device/GPU, prepared before frames; bounded inference and failure fallback to existing head occlusion | No graph for incompatible/disabled assets, native startup, mask guards, budget/failure/cleanup | Subject accuracy/anatomical ears |
| Hands | Standard opt-in controller in the shared worker, prewarmed before frames. Acquisition remains contact/dwell gated; aligned and cancelled returns settle rather than jump | Cold start cannot suspend already-visible tracking, identity/contact/loss/remount fixtures | Live gesture/depth/crown |
| Calibration | Typed explicit calibration/physical assets supported; no invented face/camera measurements | Source projection/contact/units and invalid-data checks | Actual intrinsics/SKU |
| Consumer | Normal `/` uses SDK defaults; accessible controls allow disabling effects, no “experimental” marketing claim | Public SDK/default regression, offline/privacy/lifecycle | User device review |

Optional prewarm must not make face tracking fail: timeouts/crashes after face
initialization retry once without optional graphs. No endless warmup/watchdog
extensions. Explicit feature failure is reported in local runtime health.
No camera/data is recorded for qualification. Tests use synthetic fixtures.

## Progress / evidence

- Code implementation and default promotion complete. M8 baseline is historical;
  the evidence below exercises the new default policies.
- Cross-device/live acceptance cannot be inferred from unit/build checks. A
  guarded default shipping policy is distinct from verified visual quality on
  every device. Record actual results here and in IMPLEMENTATION_PLAN.md.

### Implemented policy

- `presentation` defaults to `auto`; matrix-only, consistent velocity/rate,
  decoded-media mapping, 30 ms cap, noise/stop/reversal/age/ownership guards.
  Ineligible samples use the latest fit. Interpolation is an explicit alternative,
  not an automatic latency addition. Existing masks/contact share the sampler.
- `adaptiveQuality` defaults true. Input remains 640 for unknown/lost/small and
  foreshortened profile eyes. Actual 2D eye support (not inferred Z) must be at
  least 80 px at 640 to permit a pressure-based reduction; below 60 px restores
  640 immediately. DPR adapts independently with hysteresis.
- Compositing defaults on, as does semantic lens transmission. Original lens
  materials remain owned and can be restored. Shader/draw/video-upload failures
  or sustained CPU submission >12 ms at DPR <=1 for 3 seconds restore the DOM
  preview. A local texImage2D exception flag captures failures swallowed by
  Three.js; no GPU pixel readback or camera copies are added to this guard.
- Hair defaults auto for named temple/ear-tip assets, >=4 cores, >=4 GB memory
  when reported, and face GPU delegate. Explicit `false` prevents graph/model
  initialization. CPU face fallback skips automatic hair. Repeated hair EWMA
  >75 ms after four samples closes the graph. Missing-face/held/crown states
  skip inference. Mask smoothing uses one compatible near-stationary previous
  sample; temporal/motion/ownership guards and buffer clearing remain.
- Default lens/temple/hair coordinates use the asset's reference units. One-mesh
  assets without semantic parts retain their imported appearance/geometric head
  mask; no part segmentation or manufacturer rig is invented. Asset changes that
  would newly require a graph wait until the next explicit camera session.
- Requested graphs are prepared before `ready` and live dispatch: face, opted-in
  hands, eligible hair. Warmup uses local synthetic ImageBitmap matching the
  tracking width/aspect, closes every bitmap/scratch canvas, and compiles scene
  materials during startup. Optional creation has an 8 s bound and each warmup
  a non-renewable 12 s deadline; overall init is bounded. Optional startup hang
  after face initialization retries once with face-only CPU. Recovery suppresses
  optional graphs for the remainder of that session.
- Hands remain opt-in per AGENTS privacy guidance. Contact/dwell/identity/depth
  filtering and masks remain supported; both aligned releases and cancelled
  returns settle for 200 ms to the current mount. No physical grasp/depth,
  free-fall, collision, folding or two-handed claim is made.
- Normal Vanilla `/` consumes the public defaults and offers local disable
  controls. Config changes require a stopped session, never start camera by
  themselves. Calibration stays transient and requires known inputs. Local
  health reports compositing mode and fallback reason. Baseline query:
  `/?presentation=direct&adaptiveQuality=0&compositing=0&hairOcclusion=0`.

### Actual checks

- `pnpm build`, four-workspace `pnpm typecheck`, `pnpm test` passed.
  **145 SDK + 6 generator = 151 tests**. Worker bitmap shape/closure and CPU
  automatic-hair guard are covered. Offline policy and all three GLBs passed.
- SDK entry frozen after successful build: `c20b88e840d8`, protocol 7,
  worker `face-worker-D_-InCxR.js` 178.47 kB, SDK 107.04 kB / 31.24 kB gzip.
  [Source/build manifest](evidence/smoothness-defaults-final-manifest.json).
  Three.js chunks >500 kB remain a build warning, not an error.
- [Public defaults](evidence/defaults-public.json): synthetic video/face through
  actual SDK/GLB/WebGL. Visible frame 8,848 pixels; adaptive/prewarm true,
  hands absent, hair requested on this capable semantic fixture. Sustained
  pressure reduces 640→480; small and 84° profile restore 640 and tracking.
  Injected video upload failure restores DOM/original lenses, keeps tracking,
  leaves 623 visible frame pixels, error callback 0, all tracks/elements cleaned.
- [Visibility](evidence/defaults-visibility.json): 64 cases across auto/direct/
  interpolated/predicted × hands on/off, 40/250/500 ms result ages, loss,
  reacquisition, expiry, stop. Explicit non-compositing overlay pixel checks.
- [GPU](evidence/defaults-gpu.json): video/transmission colour, cover/quadrants,
  hair rear-only/expiry/owner/top-down sampling, calibrated projection and
  three actual GLBs passed with shader/WebGL errors 0. Synthetic inputs.
- [Native startup](evidence/defaults-native.json): actual Face/Hand/Hair tasks,
  matched ImageBitmap warmup, hand/hair readiness before `ready` and first face
  result. Latest run startup 4,339 ms; 178 frame-done, 49 hand packets, restart
  0, HTTP writes/body 0, preview/mirror/track/element cleanup pass. Hair packets
  0 as intended on no-face input; this does not prove segmentation accuracy.
- [Vanilla](evidence/defaults-example.json): normal `/` defaults checked,
  invalid calibration/recreation handled, one video/canvas, camera calls 0,
  uncaught page errors 0, reference value not in URL.
- [Native stall/CPU recovery](evidence/defaults-recovery.json) passed: deliberate
  lost first bitmap, one bounded CPU restart, continued results/completions.
- [Ten-minute soak](evidence/defaults-soak.json) passed on frozen final build:
  **600,470.2 ms, 16,443 frame-done, 10 advancing checkpoints, 0 restarts**;
  all tracks ended, one worker terminated, SDK elements removed. Default auto,
  adaptive, compositing, hair capability policy and opted-in hands were used.
  Actual models warmed; blank stream intentionally skips face-dependent hair
  inference and has no valid fit. No physical camera or recognized-face/active
  gesture/thermal/heap-snapshot acceptance. Other synthetic checks ran during
  part of the soak; rates are not a quiet matched A/B performance claim.

### Failures preserved and limits

- [Initial public failure](evidence/defaults-public-initial.json): Three.js
  swallowed the injected upload exception. Added owned upload guard, preserved
  the same injection and visibility requirements; retest passes.
- First pre-final soak was interrupted at 157.8 s to correct profile resolution
  support from 3D span to image-only support; no 10-minute acceptance claimed.
- [Initial final-soak failure](evidence/defaults-soak-initial-failure.json): hand
  startup did not become ready, followed by CPU recovery. Not counted as pass.
  Warmup was moved from 256-square canvas to ImageBitmap at the live input shape.
  Cause is not proven by a controlled A/B. The harness also now respects explicit
  hand-unavailable/disabled readiness instead of waiting for a second compilation
  request that the SDK correctly rejects. Fresh native startup passed; a new
  frozen build is used for the full soak.
- No personal camera images, landmarks, poses or measurements were captured or
  stored. Blank-stream timing is not face recognition/active-hand performance.
  Device/Safari/Android, live accuracy/optics/grasp, cold network variability and
  calibrated SKU qualification remain release gates. This code implements a
  guarded default policy, not universal real-device acceptance.
