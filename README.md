# Virtual Try-On Browser SDK

**Vito** · [GitHub repository](https://github.com/dhafinjulda/vito) ·
[CPAL-1.0 license](LICENSE) · [attribution and upstream notices](NOTICE).
Original code is open source under CPAL-1.0. Preserve Vito UI attribution and
make covered modifications available as required for distribution/network use.
Third-party material retains its own license. See LICENSE/NOTICE for full terms.

This repository builds a framework-agnostic JavaScript/TypeScript SDK for browser glasses try-on. The Vanilla JS app in `examples/vanilla` is a reference integration. Camera video and face landmarks are processed locally in a dedicated worker; the SDK does not upload frames, landmarks, poses, or snapshots.

## Requirements

- Node.js 20.19+ (workspace currently developed with Node 22.15.1)
- pnpm 10.11.0
- A secure context for camera access (`localhost` or HTTPS)
- A browser with `getUserMedia`, Web Workers, ImageBitmap, and WebGL2

The first run fetches the pinned MediaPipe WASM runtime and Face Landmarker model from their configured URLs. Set `wasmRoot` and `modelAssetPath` to same-origin, versioned resources when self-hosting. These downloads contain runtime/model assets only; the camera stream is not sent with them.

## Workspace commands

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm dev
```

Open the local Vite URL, press **Mulai kamera**, and grant camera permission. Use **Hentikan** to stop all camera tracks. These commands do not publish packages.

The main example is available at `http://localhost:5173/`. The runtime diagnostic at `http://localhost:5173/diagnostics.html` loads the actual bundled MediaPipe worker and runs one synthetic blank frame without opening the camera. It downloads the configured model and WASM runtime.

The production example registers its own versioned service worker (the SDK does not register one). It precaches the built example pages/chunks and bundled glasses assets. The Vanilla integration opts into `cacheRuntimeAssets: true`, which stores only the exact pinned MediaPipe model and WASM files in CacheStorage from inside the tracking worker. This is opt-in in the SDK and custom model/WASM URLs are never persisted by that option. Warmed resources allow the worker to initialize offline. Video frames, landmarks, poses, and snapshots are never cached or uploaded. Development uses Vite's security headers; static deployments using Netlify or Cloudflare Pages can apply `examples/vanilla/public/_headers`. Camera requires HTTPS on deployed origins (localhost is treated as secure by browsers).

The renderer check at `http://localhost:5173/fit-check.html` uses a generic canonical head at 0°, 45°, and a selectable full profile at +84°/−84°. Its distance slider shows perspective scaling from 30 to 100 cm. It verifies the actual GLB temple shader changes GPU readback when enabled, keeps near-side temple/rim pixels visible, and masks both full rear hooks. Endpoint-only checks previously missed a leak in the upper/middle hook during profile turns. It checks duplicate-draw suppression, can run 20 asset swaps while comparing GPU resource counts, and measures 180 moving frames with adaptive smoothing. Probe readbacks run only in this development harness, which imports renderer internals; the main Vanilla consumer uses only the SDK's public API. It does not open a camera or contain recorded face data.

## Optional parametric asset generator

`@vto/asset-generator` is a separate optional package; the core SDK does not import it. It interprets supported Indonesian/English descriptions locally, validates recipes, and generates round/rectangle/cat-eye GLBs. Generated files include semantic lens/temple nodes, bridge pivot, metre coordinates and embedded SDK fit/physical-size calibration. A single exported GLB works through `glassesUrl` or `setGlasses(url)` without manually copying calibration.

Start **Asset Studio** with `pnpm dev:studio` at `http://localhost:5174/`. The flow is **description → Buat kacamata → Coba di kamera / Unduh GLB**. Examples generate in one click; advanced dimensions/materials/provenance are optional. It stores only the authoring description and recipe in localStorage. The camera starts only from its explicit button, and generation performs no network requests. Invalid/cancelled drafts preserve the previous model and cannot be downloaded as a new result.

```ts
import { generateGlassesAsset } from '@vto/asset-generator';
import { createVirtualTryOn } from '@vto/sdk';

const asset = await generateGlassesAsset({
  description: 'Kacamata bulat acetate hitam, lensa bening, 52-18-140',
});
const url = URL.createObjectURL(asset.blob);
const tryOn = createVirtualTryOn({ container, glassesUrl: url });
await tryOn.start(); // explicit user action
// Later: await tryOn.setGlasses(otherGeneratedUrl);
tryOn.dispose();
URL.revokeObjectURL(url); // after the consumer releases the asset
```

The result also supplies `recipe`, `fit`, `physicalFit`, a validation `report`, and `files.glb`, `files.recipe`, `files.manifest`. Callers own download/object URL lifetimes. Consumers using a CSP must allow `blob:` in `connect-src` for locally generated GLBs. [Generation contract and optional LLM integration](docs/ASSET_GENERATION_PLAN.md) explain validation, cancellation and cleanup. LLM support is an injected application-owned interpreter; no provider, API key or remote request is built into this SDK.

Results remain `template-approximation`. Descriptions resolve to the supported templates and estimated dimensions; they cannot reproduce arbitrary product geometry or certify a physical SKU. Patterns, unsupported shapes/materials and conflicting values fail clearly. Measured/supplier provenance can be supplied through an explicit recipe, and still requires product verification. No package is published to npm.

## Public API

The Vanilla example offers opt-in hand control. Enable **Aktifkan kontrol tangan lokal** before camera start. Wait for the glasses to appear, pinch at the rendered frame briefly, then move or rotate the hand to carry it. Bring it near the face/crown and release to remount. Holding can continue while the palm hides the face; placement buttons are available as fallback. Use `handInteraction: {}` and `onInteractionChange`; `setPlacement('face' | 'head')` provides the button alternative. Requested graphs share the worker/camera and warm before live dispatch, so startup may take longer but compilation does not suspend an already-fitted face. Depth/finger/crown geometry remains approximate. Automatic hair masks apply only while face-mounted. See [controller contract and evidence](./docs/HAND_INTERACTION.md).

M11 adds four thumb/finger grip combinations per hand, reading all ten fingertip
locations. A second contacting hand can join, translate and rotate the rigid
model without stretching it. Keep the receiving hand pinched and open the donor
to transfer; the grip rebases without a position jump. Both hands have transient
depth masks, including mounted first-touch. Public state exposes `grippingHands`
and `contactFingers` counts with `held-two-hands`/`handoff` feedback. See
[two-hand decisions and evidence](docs/TWO_HAND_INTERACTION_PLAN.md). Real hand
depth/skin geometry and physical contact forces remain approximations.

```ts
import { createVirtualTryOn } from '@vto/sdk';

const tryOn = createVirtualTryOn({
  container: document.querySelector('#try-on')!,
  glassesUrl: '/assets/glasses.glb',
  fit: { referenceEyeSpan: 1.45, offset: [0, 0, 0.087] },
  onStatusChange(status) { console.log(status); },
});

await tryOn.start(); // call from a user gesture
await tryOn.setGlasses({
  url: '/assets/another-pair.glb',
  fit: { referenceEyeSpan: 1.4, offset: [0, -0.02, 0.08] },
});
tryOn.setFit({ scale: 1.03 });
tryOn.stop();
tryOn.dispose();
```

The container receives an SDK-managed video and transparent canvas. Give it a size/aspect ratio. GLB assets must place their pivot at the nose bridge, use local +X along the eyes, +Y up, and +Z toward the camera.

Active camera sessions also display a small **Vito** wordmark at the bottom-right
of that container. It stays readable during tracking/loading, does not mirror
with the video or block pointer input, and is hidden on stop/failure/page hide
and removed on disposal. The mark is local DOM attribution, not burned into
camera frames or rendered snapshots. CPAL-1.0 Exhibit B records the attribution.

The worker enables MediaPipe facial transformation matrices for head rotation. A perspective camera and relative landmark depth align the bridge to the video. Bridge depth now uses median consensus across seven independent canonical upper-face spans, avoiding reliance on a single noisy eye corner. The outer-eye reference remains 8.891718 cm for GLB calibration; physical model size stays steady while perspective shrinks the frame as the face moves away. The projection adjusts for cover cropping without changing the distance estimate. A 468-vertex / 898-triangle depth-only face mesh and three low-resolution head/ear envelopes hide rear temples. Head width follows cheek anchors; the head mask remains independent of asset fit adjustments. An original 1 Euro-inspired filter smooths translation axes and quaternion rotation independently, with slower head-width adaptation. Eyewear and all masks share one filtered head transform, including a rigid correction for the dense mesh; filters reset on face loss or a discontinuity. PBR materials use an environment map and tone mapping. Unchanged tracking frames do not trigger duplicate GPU draws.

`fit.referenceEyeSpan` is the model-space distance that corresponds to the outer-eye anchors (33/263), **not the total GLB width**. Calibrate it for each asset. `offset` and `rotation` apply in asset-local space; `scale` adjusts appearance. Generated GLBs declare their own calibration; an ordinary untagged string URL retains the current fit. Explicit descriptor fields override embedded metadata. `setFit()` updates the current fit without loading the GLB again. `faceOcclusion`, `smoothing`, and local `ambientLighting` default to true. Ambient lighting samples a 32×24 downscaled frame border at most twice per second, reduces it to temporary aggregate color values in memory, and resets at stop; set `ambientLighting: false` to disable it. `cameraFov` is the **uncropped source video's vertical FOV**, defaulting to an approximate 63°; it is not a measured lens calibration. `onFitStateChange` reports local fit guidance, angles and `estimatedDistanceCm`, at most roughly ten times per second; it does not transmit or persist data. Distance means camera-to-nose-bridge depth along the optical axis. It assumes canonical face size and the supplied FOV; different face proportions, lenses, zoom and weak-perspective landmark depth introduce error. The demo rounds this estimate to 5 cm. It is not a rangefinder or physical sizing guarantee.

This provides visual fitting, not physical face measurement. Ear and rear-head occlusion use approximate geometry; actual ears and hands are not segmented. Optional hair-only segmentation and camera/lens compositing are described below. Licensed product geometry, reference anchors, camera calibration, and cross-subject/device review remain necessary for product-specific fit claims. `stop()` is safe to repeat; `dispose()` also removes SDK elements, event listeners, GPU resources, and pending loads. A worker crash or stalled inference triggers up to two local worker restarts during the camera session; if recovery is exhausted, the SDK reports an error and stops all camera tracks. A lost WebGL context also stops the camera and reports an error.

Worker assets use content hashes and a checked protocol version, so a stale worker fails clearly before frame dispatch. Inference recovery requests CPU instead of retrying the same GPU configuration. Input is normalized to a transient 640-pixel maximum-width canvas while the preview retains camera resolution. The example includes **Sambungkan ulang** and a local diagnostic panel showing sent/received frame counts, confirmed delegate and restart count. SDK consumers can opt into `onTrackingHealthChange`; these counters contain no face/hand coordinates and histories should not be persisted.

Resolution/orientation changes invalidate the old face mount, grip and hair mask.
Live `setFit({referenceEyeSpan})` also updates temple/hair boundaries in-place
and clears the old hair confidence sample.
Results must match the latest capture and source geometry revision; tracking
resumes on a fresh decoded frame with the same camera and worker. `start()` waits
for the latest requested GLB. A failed `setGlasses()` still rejects its caller,
but preserves an already loaded model for display and subsequent restart.
`stop()` cancels asset-readiness waits; a new `start()` can proceed independently
of an older pending camera permission request.

Hands remain opt-in. Sustained optional hand overload falls back to button
placement and reports `hand-budget` in local health; inference failures report
`hand-failure`. A single slow pass or blank warmup cannot trigger the budget.
See [the continuity plan](docs/CONTINUITY_IMPROVEMENT_PLAN.md) for thresholds,
actual checks and device limitations.

For regression checks through the built public SDK on the Vite dev page, use Playwright CLI with `scripts/browser-tracking-continuity.js` (actual MediaPipe, blank canvas video), `scripts/browser-tracker-recovery.js` (intentional one-frame stall followed by actual CPU recovery), and `scripts/browser-visibility-regression.js` (synthetic recognition packets and actual GLB/WebGL pixels). These checks complement live camera/device review; they do not measure face-recognition accuracy or physical fit.

Looking up or down can expose the underside/top of the frame. Valid full-face matrix poses are no longer gated by the eye-pair fallback or hidden solely at pitch beyond 65°. Forehead/chin and cheek anchors provide the anatomical rotation fallback, and visual resolution uses multiple whole-face spans. `turn-slightly` is advisory while a usable forward-facing pose is still visible. True detector loss clears the overlay. The synthetic pitch slider in `/fit-check.html` and 24 GLB/GPU pitch samples pass; live extreme-pitch recognition still requires user/device testing.

The included Contour and Linea GLBs contain rims, lenses, hinges, temples and ear tips, using original demo geometry. The Vanilla example also includes Round Spectacles from Poly Haven as a generic CC0 PBR test model; its source files and build path are recorded under `scripts/assets/polyhaven-round-spectacles/`. It is not a retail SKU and its nominal bounds are not a product specification. The SDK's renderer applies bending/fading only to GLB meshes named `temple-*` or `ear-tip-*`; the CC0 source mesh does not expose those semantic parts and is included to test material/GLB import. Calibrate semantic names and local axes for real product assets. Rebuild demo models with `node scripts/build-demo-glasses.mjs` and the bundled CC0 model with `node scripts/build-polyhaven-glasses.mjs`; these utilities are not the optional asset-generator SDK module. Topology, third-party assets and licenses are recorded in `THIRD_PARTY_NOTICES.md` and `docs/VTOGLASSES_MIGRATION.md`.

## Milestone status

See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for decisions, milestone criteria, real command results, and remaining camera/device acceptance work. The two original GLBs are synthetic geometry fixtures; the Poly Haven model is generic and CC0, not a retail SKU. Do not present any of them as calibrated commercial product models.

## Tracking optimization

The current work is recorded in [the smoothness plan](./docs/SMOOTHNESS_OPTIMIZATION_PLAN.md) and the M7 log. `onTrackingHealthChange` includes bounded 5-second software timing distributions (`p50Ms`/`p95Ms`), face/hand/draw/rAF rates, and camera rate when supported. CPU submission timing excludes asynchronous GPU execution and physical camera/display latency. Blank input has no valid fitting work; renderer fixtures and live device checks are separate evidence.

Defaults now use `presentation: 'auto'` and `adaptiveQuality: true`. Auto predicts at most 30 ms toward decoded media only on consistent matrix motion; missing mapping, noise, acceleration, stops, reversal, age or ownership changes fall back to the latest pose. Masks/contact use the same head transform. Explicit `interpolated` retains up to three transient poses and adds up to 50 ms delay; it is not automatically selected because the earlier alignment-error gate failed. Explicit `direct` and `predicted` remain available for integration tuning and A/B.

Adaptive input changes 640→480 only under sustained pressure with sufficient visible 2D eye support. Unknown/lost/small/profile faces retain or immediately restore 640. DPR 1.5→1 adapts independently. This protects recognition input; it does not prove model accuracy on every device. Grip filtering uses elapsed time at either setting.

Open `/` for the current defaults. A baseline override is `/?presentation=direct&adaptiveQuality=0&compositing=0&hairOcclusion=0`. Camera starts only from **Mulai kamera**. Check bridge alignment while moving alongside smoothness.

For native runtime measurement, build then run `node scripts/freeze-sdk-baseline.mjs my-label`. Open `/performance-check.html?sdk=/@fs/C:/Projects/VTO/.benchmarks/sdk-<reported-id>/vto-sdk.js` on the dev server and press the benchmark button. It runs three 60-second face-only and three hand-enabled repetitions after warmup, using blank canvas video and actual worker/models. Frozen builds are local and ignored. Hand activation is explicit harness behavior for no-face input. Output contains software duration/count windows and errors; it establishes runtime cost/continuity only. Keep failed runs and hash/configuration with results. Source/build provenance requires building immediately before freezing.

`node scripts/benchmark-presentation.mjs` saves the analytic same-clock A/B. `scripts/browser-presentation-regression.js` checks experimental mask/asset coherence with three GLBs. `scripts/browser-privacy-regression.js` records HTTP methods/URLs/body sizes during a synthetic native-worker session. These checks do not store user imagery or recognition geometry.

Run `node scripts/benchmark-fitting.mjs` for a reproducible local synthetic jitter comparison. It saves aggregate results to `docs/evidence/tracking-refinement.json`; it never opens a camera. The measured improvement applies to that fixture, not recognition accuracy or device FPS. The face detection model and worker inference settings are unchanged.

See [`docs/TRACKING_ROADMAP.md`](./docs/TRACKING_ROADMAP.md) for browser stack decisions and remaining acceptance gates.

## Default features and calibration

Current policies/evidence are in [default feature readiness](./docs/DEFAULT_FEATURES_PLAN.md).
The [premium fitting plan](./docs/PREMIUM_FITTING_PLAN.md) records the previous M8 stage.
Open `/`, then press **Mulai kamera**. Compositing and semantic lens transmission
are enabled. Hair is automatic for semantic assets, at least four CPU cores,
at least 4 GB device memory when reported, and a working GPU delegate. Controls
under **Realisme & kalibrasi lokal** can disable effects before starting.
Calibration values stay in session memory and never enter a URL or storage.
Hands require explicit opt-in; no additional camera or microphone is used.

Shader/draw/video-upload exceptions and sustained render pressure can restore
the DOM preview and original lens materials without stopping face tracking.
Optional graph download/warmup failure falls back to face-only startup. A hung
native startup after face initialization is retried once without optional
graphs. Worker recovery suppresses optional graphs for that session. Failures
and active modes are reported through `onTrackingHealthChange`.

SDK options (all independent of UI frameworks):

```ts
const session = createVirtualTryOn({
  container, glassesUrl: '/glasses.glb',
  cameraCompositing: true,
  lensOptics: { ior: 1.5, thicknessMm: 2, transmission: 0.95 },
  // hairOcclusion: false, // disable automatic hair
  // hairOcclusion: { modelAssetPath: '/hair.tflite' }, // explicit model override
  // cameraCalibration: { imageWidth, imageHeight, fx, fy, cx, cy },
  // faceReferenceEyeSpanCm: knownOuterEyeSpanCm, // not pupillary distance
});
await session.start(); // only after the host's explicit camera action
// session.stop(); session.dispose(); // release local camera/GPU resources
```

`cameraCalibration` overrides the generic vertical FOV with source-camera
intrinsics. Same-aspect resizing scales the intrinsics; a different crop/aspect
is rejected. `cameraCalibrationFromReference()` computes square-pixel,
centred intrinsics from a known frontal planar span/distance; it does not measure
a user's face, solve PnP or estimate distortion. The optional outer-eye span
changes the canonical scale assumption; reported distance remains an estimate.

An explicitly dimensioned GLB can be loaded before starting:

```ts
await session.setGlasses({
  url: '/supplier-frame.glb', fit: calibratedAnchors,
  physicalFit: { frontWidthMm: 140, modelFrontWidth: 2.8, source: 'supplier' },
});
```

The numbers above are examples; use the actual front width and the same front
span in local GLB units. Physical asset scale stays independent of canonical
face size. This metadata does not certify sizing or a retail SKU.

Compositing uses one local VideoTexture with the same cover/mirror transform as
the DOM preview. Optics affect semantic `lens-*` meshes and sample the camera
background through Three.js transmission. This is an approximate rendering
effect, not prescription-lens simulation. Stop restores the DOM preview and
disposes the texture.

Requested face/hand/hair graphs warm during explicit camera startup before live
frames are dispatched. Warmup uses a discarded synthetic ImageBitmap matching
the tracking input shape, never a captured camera frame. This avoids compiling
optional graphs after the first fitted face. It uses the existing worker/bitmap;
face results are posted first. Cadence is bounded to 300–1,000 ms, confidence
output is copied into a transient local texture, and `hairInference` timing is
included in diagnostics/adaptive tracking cost. Repeated hair cost above 75 ms
after four samples closes the graph and restores geometric head occlusion.
Hair inference is skipped without a face and while held/crown placed. Compatible
mask samples blend only for a near-stationary head; motion invalidates history.
Masks apply only to semantic
rear temples while face-mounted; age, motion, loss, head-placement and held
ownership guards disable them. It does not detect ears or hair depth. The CC0
Round Spectacles model lacks semantic lens/temple parts, so these adaptations
do not apply to that single mesh. Model provenance/license is in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

Aligned near-face/head releases settle toward the moving mount over 200 ms.
Ineligible releases also settle back to the original mount without teleporting;
free-body physics, anatomical hand depth and folding are not
implemented. These are supported controller/rendering features with guarded
defaults, not physical hand/ear reconstruction or measured product fit. Live
contact/optics, calibrated supplier assets and iOS/Android acceptance remain
required before a production release. No npm publication is performed.

Open `/fit-check.html` in the local example to run the synthetic GPU checks and compare temple effects, occlusion, asset, distance, profile side, and warm/cool ambient-light candidate. This diagnostic uses synthetic faces and pixel samples; it does not request the camera and is not evidence of live-user/device fit or lighting quality. Migration outcomes and remaining gates are in [`docs/VTOGLASSES_MIGRATION.md`](./docs/VTOGLASSES_MIGRATION.md).
