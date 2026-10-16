# Vito SDK

**3D glasses virtual try-on for the browser.** A framework-independent JavaScript/TypeScript SDK with local face tracking, Three.js rendering, and optional hand interaction.

[![npm version](https://img.shields.io/npm/v/vito-sdk)](https://www.npmjs.com/package/vito-sdk)
[![License: CPAL-1.0](https://img.shields.io/badge/license-CPAL--1.0-blue)](https://github.com/dhafinjulda/vito/blob/main/LICENSE)

[Source](https://github.com/dhafinjulda/vito) · [Vanilla example](https://github.com/dhafinjulda/vito/tree/main/examples/vanilla) · [Asset Studio](https://github.com/dhafinjulda/vito/tree/main/examples/asset-studio) · [Report an issue](https://github.com/dhafinjulda/vito/issues)

## Features

- Fits a GLB glasses model to face position, rotation, and apparent size as the user moves.
- Face/head occlusion, temporal smoothing, local lighting estimation, and semantic lens/temple effects.
- Opt-in hand tracking for grabbing, moving, and placing glasses on the face or head.
- Typed lifecycle methods and status callbacks. No React dependency.
- On-device processing: the SDK does not upload or persist camera frames, landmarks, poses, or snapshots.

This is visual try-on, not a prescription, face measurement, or guaranteed physical fit. Distance estimates depend on camera and face-size assumptions. Device performance, extreme poses, hand contact, and each retail SKU need qualification.

## Install

```sh
npm install vito-sdk
# or
pnpm add vito-sdk
```

The package is ESM and includes TypeScript declarations and the tracking worker. Use a browser bundler such as Vite. Node.js 20.19+ is the package tooling requirement; camera tracking runs in the browser.

## Quick start

Opt-in `onTrackingHealthChange` also receives `health.startup`: camera API waiting,
post-playback asset waiting, initial tracker readiness, and first fresh fitted CPU
render submission, in milliseconds. Unreached stages are `null`; stop/dispose clear
the snapshot. Camera waiting includes permission and hardware acquisition. Asset
waiting excludes any constructor loading already completed. These software timings
do not measure GPU completion, physical display latency or visual fit quality.
Keep diagnostics transient and local; do not persist camera or face-derived data.

`health.workerStartup` separates worker-clock WASM file resolution, runtime cache
preparation, native face creation, blank first-inference warmup, and combined
optional graph preparation. With caching off or custom URLs, creation may include
model/WASM downloads; warmup includes native compilation. These durations are
not isolated GPU timings and are never added to main-thread timestamps.

`onReadinessChange(stage)` provides local, indeterminate startup transitions:
`requesting-camera`, `loading-asset`, `loading-runtime`, `initializing-tracker`,
`warming-tracker`, `ready`, `cancelled`, and `error`. `ready` means the tracker is
prepared, not that a face or fitted frame has been found. Hosts own translated
copy; the Vanilla example demonstrates cancellation and retry.

`resourceTimeoutMs` accepts 100–120000 ms. Defaults are 20000 ms for a GLB load
and 20000 ms for tracker startup (40000 ms with optional graphs). It does not time
out an unanswered camera permission request. Timed-out or superseded GLB fetches
are aborted; parsed scenes arriving after invalidation are disposed without
installation. GLB-embedded resources are recommended: parsing may fetch referenced
textures separately, whose loader does not expose abort support. Those scenes
still cannot install after cancellation. Keep caller-owned blob URLs valid until
loading finishes and revoke them after releasing the asset.

Import `ResourceTimeoutError` to inspect typed `stage`, `code` (`asset-timeout` or
`tracker-timeout`) and `retryable`. On asset failure, choose/reload with
`await tryOn.setGlasses(asset)` before `await tryOn.start()`, or dispose/recreate
the instance; retrying a failed descriptor requires an explicit reload. A failed
replacement preserves the current valid model. `stop()` cancels startup waiting
and camera processing; an independent GLB authoring load retains its own bounded
lifetime. `dispose()` aborts its owned fetch and invalidates pending installation.

Give the camera host an explicit size. Serve a compatible glasses GLB at `/assets/glasses.glb` (see [Assets and fitting](#assets-and-fitting)); the SDK does not bundle a retail glasses catalog.

```html
<div id="try-on" style="position:relative;width:100%;height:480px"></div>
<button id="start" type="button">Start camera</button>
<button id="stop" type="button">Stop camera</button>
<p id="status" role="status">Camera is off</p>
```

```ts
import { createVirtualTryOn } from 'vito-sdk';

const container = document.querySelector<HTMLElement>('#try-on');
const startButton = document.querySelector<HTMLButtonElement>('#start');
const stopButton = document.querySelector<HTMLButtonElement>('#stop');
const status = document.querySelector<HTMLElement>('#status');
if (!container || !startButton || !stopButton || !status) {
  throw new Error('Missing try-on elements');
}

const tryOn = createVirtualTryOn({
  container,
  glassesUrl: '/assets/glasses.glb',
  onStatusChange(state, message) { status.textContent = message || state; },
  onError(error) { status.textContent = error.message; },
});

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  try {
    await tryOn.start();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Camera failed';
  } finally {
    startButton.disabled = false;
  }
});
stopButton.addEventListener('click', () => tryOn.stop());

// When removing this integration (for example, on a route unmount):
// tryOn.dispose();
```

Creating the instance loads the glasses asset but does not request camera access. Only `start()` requests the camera, with `audio: false`. The SDK stops camera tracks when the page becomes hidden; returning to the page requires another `start()`.

## Assets and fitting

For automatic fitting, use a GLB generated by the optional [vito-asset-generator](https://github.com/dhafinjulda/vito/tree/main/packages/asset-generator). Its embedded, versioned fit contract is read by the SDK. The core SDK does not depend on the generator.

```sh
pnpm add vito-asset-generator
```

```ts
import { generateGlassesAsset } from 'vito-asset-generator';

const asset = await generateGlassesAsset({
  description: 'Kacamata bulat acetate hitam, lensa bening, 52-18-140',
});
const assetUrl = URL.createObjectURL(asset.blob);
try {
  await tryOn.setGlasses(assetUrl);
} catch (error) {
  URL.revokeObjectURL(assetUrl);
  throw error;
}
// Keep the URL alive while the SDK uses it. At integration teardown:
// tryOn.dispose();
// URL.revokeObjectURL(assetUrl);
```

Generation runs locally by default. Generated designs and dimensions are approximations, not supplier measurements. Save the GLB and host it as a static asset if you do not need runtime generation.

An ordinary GLB needs asset-specific calibration:

```ts
await tryOn.setGlasses({
  url: '/assets/calibrated-glasses.glb',
  fit: {
    referenceEyeSpan: 0.09, // EXAMPLE only: outer-eye span in this GLB's units
    scale: 1,
    offset: [0, 0, 0],
    rotation: [0, 0, 0], // radians
  },
});
```

Use a nose-bridge pivot and model axes `+X` right, `+Y` up, `+Z` toward the viewer. `referenceEyeSpan` is the intended outer-eye span, **not** total frame width or pupillary distance. The value above is illustrative; determine it for your asset. Explicit fit overrides take precedence over embedded metadata. Semantic lens/temple meshes are required for their corresponding effects.

See the [asset generation contract](https://github.com/dhafinjulda/vito/blob/main/docs/ASSET_GENERATION_PLAN.md) and [reference asset integration](https://github.com/dhafinjulda/vito/tree/main/examples/vanilla/src).

## API

| Method / property | Purpose |
| --- | --- |
| `createVirtualTryOn(options)` | Create the host, renderer, and initial asset load. |
| `start(): Promise<void>` | Start camera and tracker from a user action; handle rejection. |
| `stop(): void` | Release camera tracks; the instance can be restarted. |
| `setGlasses(urlOrAsset): Promise<void>` | Load another GLB; await completion and handle errors. |
| `setFit(partialFit): void` | Adjust asset fitting. |
| `setPlacement('face' \| 'head'): void` | Choose where glasses are worn. |
| `dispose(): void` | Release tracks, worker, renderer, listeners, and SDK DOM. Do not reuse the instance. |
| `status`, `video`, `canvas` | Current status and SDK-owned rendering elements. |

Status values: `idle`, `requesting-camera`, `loading-tracker`, `searching`, `tracking`, `paused`, `error`, `disposed`.

### Selected options

| Option | Default / meaning |
| --- | --- |
| `container`, `glassesUrl` | Required host element and initial GLB URL. |
| `mirror` | `true`; mirrors the camera preview. |
| `fit` | Partial asset calibration override. |
| `faceOcclusion`, `smoothing`, `ambientLighting` | Enabled by default. |
| `presentation` | `'auto'`; also `'direct'`, `'interpolated'`, `'predicted'`. |
| `adaptiveQuality` | `true`; adjusts input/rendering cost. |
| `handInteraction` | Omitted by default; pass `{}` to enable local hand tracking. |
| `hairOcclusion` | Automatic on eligible devices/assets; `false` disables it. |
| `lensOptics` | Semantic lens rendering with camera compositing; `false` disables it. Not prescription simulation. |
| `wasmRoot`, `modelAssetPath` | Override face runtime/model locations. |
| `cacheRuntimeAssets` | `false`; optional approved runtime/model cache, never camera data. |
| `cameraCalibration` | Optional calibrated source-video intrinsics. |
| `onStatusChange`, `onError` | Lifecycle and failure feedback. |
| `onFitStateChange`, `onInteractionChange`, `onTrackingHealthChange` | Transient fit, interaction, and diagnostic updates. |

The package exports `VirtualTryOnOptions`, `GlassesAsset`, `GlassesFit`, and other public types. See the [typed API](https://github.com/dhafinjulda/vito/blob/main/packages/sdk/src/types.ts) for complete fields.

### Optional hand interaction

```ts
const tryOn = createVirtualTryOn({
  container,
  glassesUrl: '/assets/glasses.glb',
  handInteraction: {},
  onInteractionChange(state) {
    console.log(state.phase, state.grippingHands);
  },
});
```

Hands share the existing camera and worker, adding model download and inference cost. Contact/depth are inferred from a single camera, not physical force sensing. Read the [interaction guide](https://github.com/dhafinjulda/vito/blob/main/docs/HAND_INTERACTION.md).

## Browser requirements and deployment

- HTTPS or `localhost`, camera permission, WebGL2, Web Workers, and `ImageBitmap`.
- A visible host with nonzero width/height and accessible GLB URLs.
- A bundler/deployment that preserves the emitted worker in `dist/assets` beside the SDK bundle.
- CORS permission for externally hosted GLBs and models.

Pinned MediaPipe WASM files and models download from jsDelivr and Google storage by default. These are resource downloads; the SDK sends no camera frames to those services. To self-host:

```ts
const tryOn = createVirtualTryOn({
  container,
  glassesUrl: '/assets/glasses.glb',
  wasmRoot: '/mediapipe/wasm',
  modelAssetPath: '/mediapipe/face_landmarker.task',
  handInteraction: { modelAssetPath: '/mediapipe/hand_landmarker.task' },
  hairOcclusion: false,
});
```

Copy the WASM directory from `@mediapipe/tasks-vision@0.10.22-rc.20250304`, including loader scripts. Obtain the corresponding models and check their licenses before redistribution. The [runtime source](https://github.com/dhafinjulda/vito/blob/main/packages/sdk/src/tracking/runtime-assets.ts) records pinned face URLs. Self-hosting optional hair segmentation requires its own model override.

Configure CSP for the worker, WASM execution, resource fetches, and actual hosting origins. Blob GLBs also need `blob:` in `connect-src`. Verify the production CSP and deployment path; the [Vanilla example](https://github.com/dhafinjulda/vito/tree/main/examples/vanilla) provides a reference.

## Run the examples locally

```sh
git clone https://github.com/dhafinjulda/vito.git
cd vito
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Run `pnpm dev:studio` for the description-to-GLB authoring example (normally port `5174`). These are local examples, not a hosted public demo.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Camera does not start | Secure context, permission, another app using camera; inspect `onError`. |
| Video but no glasses | GLB fetch errors, host size, model pivot/units/calibration, and `searching` versus `tracking` status. |
| First start takes time | Model downloads and initialization; show `loading-tracker` feedback. |
| Incorrect fit | Use the generator contract or calibrate that GLB; do not reuse example dimensions blindly. |
| Camera stopped after switching tabs | Call `start()` again from a user action. Page-hide cleanup is intentional. |
| Worker/WASM fails in production | Worker output paths, CORS, CSP, and model URLs. |

Dispose before removing the host or replacing the integration. Revoke caller-owned blob URLs after replacement/disposal. For issues, include browser/device, version, status, and error text; do not send personal frames or landmark recordings.

## License and attribution

Original Vito code is licensed under **[CPAL-1.0](https://github.com/dhafinjulda/vito/blob/main/LICENSE)**, copyright Dhafin Julda Riyanto. CPAL includes attribution and covered-source obligations for distribution/network use. Read the full license, including Exhibit B, before integrating or modifying the SDK.

The SDK shows a small **vito** wordmark at the bottom-right of the camera host while the camera is active. No branding-disable option is provided. The mark is a local DOM element and makes no branding network request.

Third-party code/models retain their licenses. Notices and bundled license texts are included in `dist/THIRD_PARTY_NOTICES.md` and `dist/licenses/`; see the [project notices](https://github.com/dhafinjulda/vito/blob/main/THIRD_PARTY_NOTICES.md).

### Hair startup phase diagnostics

`TrackingHealth.workerStartup` optionally includes `hairCreationMs` (native creation, including model download and delegate fallback) and `hairWarmupMs` (first blank inference, including compilation). Fields are present when optional hair prewarming is requested; null means that phase was not reached/completed. They overlap the aggregate `optionalWarmupMs` and must not be added to it. These local software durations do not measure GPU completion or recognized-face readiness and retain no image or mask data.

### Explicit camera-free preparation

`await session.prepare()` downloads/waits for the selected GLB and initializes and
warms one local tracker worker using blank scratch images. It never requests the
camera. Call it deliberately when a shopper expresses try-on intent: it consumes
network, GPU work and memory. Construction does not invoke it automatically.

```ts
// Optional preparation: display loading feedback and handle rejection.
await session.prepare();
// Later, from the shopper's Start button:
await session.start();
// On close/page teardown:
session.dispose();
```

Repeated preparation calls share the in-flight promise. Concurrent explicit
`start()` requests media immediately, then shares pending preparation. A valid
prepared worker is reused without sending init again. Normal `start()` still works
without preparation. `prepare()` during startup shares that start promise; during
an active session it is a no-op. The camera is always acquired only by `start()`,
with audio disabled. Permission waiting remains untimed.

`onReadinessChange('prepared')` means camera-free warmup finished, not a visible
fit. Session status stays `idle` while prepared. `stop()`, page hide and `dispose()`
release prepared workers and cancel pending preparation; cancellation rejects the
preparation promise. Handle that rejection when closing a preparing view. Replacing
the asset invalidates reuse; an asset change during preparation rejects that
attempt. Retry with `prepare()` or explicit `start()` after correcting a failure.
Normal start can retry failed preparation and retains its bounded optional-feature
fallback. Failed/disposed instances never retain a usable prepared worker.

If optional startup fails after face readiness, preparation releases that worker
and makes one bounded face-only CPU attempt with hands/hair suppressed. Start
reuses this fallback and reports `featureFallback: 'optional-startup'` plus the
restart count. Successful fallback does not emit `onError`; a failed face-only
attempt rejects once. Cancellation and protocol mismatch do not trigger this
fallback. Models and camera-derived data are not uploaded by recovery.

Opt-in health reports `preparation: {durationMs, reused: true}` when start adopts
preparation, separately from start-to-ready/fit metrics. Count both the earlier
preparation and start when assessing total latency. Initial blank warmup uses
640×360 without camera geometry. If Start finds a different normalized input shape,
the same worker warms face and enabled optional graphs at that shape before live
frame dispatch. This bounded activation step is included in start-to-ready and
reported separately as `preparation.activationWarmupMs`; it uses no camera pixels.
Physical portrait appearance and first actual hair-mask cost still need device
qualification. Preparation moves compilation earlier and does
not guarantee a reduction in total work or recognized-fit time. No frames, masks
or face outputs are persisted or uploaded by this API.

### Camera error recovery

`start()` rejects with `CameraAccessError` when media acquisition fails. The same
error reaches `onError` once. It extends `Error` and provides `stage: 'camera'`,
typed `code` and `retryable`. Native name/message are preserved; `cause` holds the
original rejection. Existing native-name checks still work, but identity checks
against the original browser error must use `error.cause`.

| Code | Meaning and next action |
|---|---|
| `camera-access-blocked` | Permission or browser/security policy blocked acquisition. Check site permissions and embedding policy; this does not prove the shopper denied a prompt. |
| `camera-not-found` | No matching camera found. Connect/enable a camera and retry explicitly. |
| `camera-unreadable` | Browser could not read the camera. Check hardware/system access and other applications; another app is not a proven cause. |
| `camera-unsupported` | Media acquisition API unavailable in this context. Use HTTPS/localhost and a supported browser. |
| `camera-unavailable` | Other acquisition failure; inspect native cause and offer explicit retry or a static catalog. |

`retryable` means another explicit start may succeed after the issue is corrected,
not that the SDK retries permission automatically. Unsupported acquisition reports
false because the context must change. Unanswered camera prompts remain untimed;
`prepare()` never requests media. Asset, playback and worker failures do not get
misclassified as camera acquisition failures. The reference integration supplies
localized shopper instructions and keeps the static catalog available.
