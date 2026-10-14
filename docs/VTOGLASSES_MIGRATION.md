# Development shift using VTOGlasses

Prepared 12 October 2026 (Asia/Jakarta). Status: source audit, renderer port, shared calibration metadata, and local-light candidate evaluation are implemented. Synthetic desktop GPU checks pass for both original demo GLBs. Real-camera/device, human-fit and retail-asset acceptance remain open.

## Direction

Use the MIT WebAR.rocks.face VTOGlasses implementation as the starting reference for glasses-specific rendering. Port reusable mechanics into typed, instance-owned SDK modules, then evaluate the full upstream tracking pipeline as a separate candidate if needed. The SDK remains the product; camera lifecycle, framework independence and local-only processing are acceptance requirements throughout.

The current repository guidance requires MediaPipe in a worker. The initial migration therefore retains that tracker and adapts rendering/material helpers. Replacing the primary tracker would be an additional explicit architecture decision, with repository guidance updated at that time.

This is adaptation work, not a ready-made plugin install. No performance or quality improvement is assumed from using a different engine.

## Upstream findings

- [VTOGlasses main](https://github.com/WebAR-rocks/WebAR.rocks.face/blob/master/demos/VTOGlasses/main.js) selects `NN_GLASSES_9.json`, named image anchors and a pose solver, then configures branch bending/fading, an occluder, environment lighting and postprocessing. Its page-load startup must be adapted to explicit SDK `start()`.
- [Demo index](https://github.com/WebAR-rocks/WebAR.rocks.face/blob/master/demos/VTOGlasses/index.html) loads global scripts with Three.js r136 and two canvases. Our SDK uses r176 ESM and a video plus overlay; compatibility requires a port.
- [Mirror helper](https://github.com/WebAR-rocks/WebAR.rocks.face/blob/master/helpers/WebARRocksMirror.js) combines singleton state, asset transforms, shader changes and lifecycle delegation. Bending/fading can be extracted. Its cleanup/load handling needs review for repeated SDK instances and async races. Light reconstruction defaults to disabled; a configuration flag does not establish model support or quality.
- [Three helper](https://github.com/WebAR-rocks/WebAR.rocks.face/blob/master/helpers/WebARRocksFaceThreeHelper.js) handles the tracker callback and PnP/render bridge. An upstream tracker cannot be treated as a MediaPipe 468-point result. Model labels, camera mapping and optional light outputs require separate validation.
- [Asset specification](https://github.com/WebAR-rocks/WebAR.rocks.face/tree/master/demos/VTOGlasses) uses its own reference scale and eye alignment; material naming triggers branch processing. Our nose-bridge pivot/eye-span metadata need an explicit conversion. Never apply the upstream hard-coded scale/offset to our GLBs without calibration.

## Module boundary

Proposed internal responsibilities (names are planning labels, not shipped APIs):

| Responsibility | Migration work |
|---|---|
| Camera/session owner | Preserve one explicit permission request, `audio:false`, generation checks, page-hide stop and track cleanup. Rendering modules receive session-owned inputs and must not request another camera. |
| Pose provider | Keep MediaPipe worker initially. Normalize transforms in one place; retain canonical-size distance limitations. A future WebAR.rocks provider must expose its actual capabilities rather than inventing dense landmarks or centimeters. |
| Glasses material effects | Port branch bending/fading into Three.js r176 with per-instance uniforms, shader cache keys, normal handling and cleanup. Explicitly identify temples/hooks so rim, hinge and lens materials are not deformed accidentally. |
| Occlusion | Keep current dense face/head masks as the initial depth path. Fading is a visual supplement, not anatomical segmentation. Bending must also be represented in diagnostic probes; undeformed CPU geometry alone cannot verify a shader-deformed model. |
| Asset adapter | Normalize coordinate conventions and reference points at asset load. Describe geometry parts, temple contact/fade region and validated adjustment limits. Preserve existing GLB metadata and public `setGlasses` behavior. |
| Lighting/compositing | Evaluate local lighting estimation independently. Verify available outputs before adopting upstream light reconstruction. Review exposure/color, reflections and contact appearance under actual camera lighting. |
| Example UI | Vanilla integration continues to use only public SDK API. Comparison control stops/releases the active session before switching implementations. No simultaneous camera-owning engines. |

Keep experimental switches internal or in an optional package until the API is proven. Do not add a public `engine` option that has no working backend. Existing `start`, `stop`, `setGlasses`, `setFit` and `dispose` remain the integration contract.

## Milestones and acceptance

| Step | Deliverable | Acceptance gate | Progress |
|---|---|---|---|
| S0 — Map/pin upstream | Scope, license inventory and exact commit/dependency pin | MIT scope confirmed per copied file; third-party assets/models reviewed; upstream commit and checksums recorded before vendoring | Complete for adapted helper: commit and source checksums recorded below; no upstream runtime/assets/models vendored |
| S1 — Port glasses mechanics | Typed material effects for bending/fading, instance-owned state, r176 integration | Rim/lenses unaffected; continuous front temple retained; rear hooks hidden correctly at both profiles and tested distances; deformation normals and GLB part selection reviewed; disable/reset restores baseline; repeated asset swaps release resources | Implemented; both demo GLBs pass synthetic desktop GPU/readback matrix at 30/100 cm, ±84° plus 0°/45° views, tilted profile, and 20 swaps. Live/device and retail-SKU acceptance open |
| S2 — Asset calibration | Shared manifest, GLB fit metadata and named parts | One calibration source generates the demo GLBs; bridge/eye/temple reference and dimensions documented; crop/mirror/turn/distance behavior reviewed; licensed real SKU needed for product acceptance | Implemented for two original demo fixtures; generator embeds manifest metadata and validator checks both GLBs. Retail GLB/calibration remains open |
| S3 — Lighting evaluation | Local lighting reconstruction or validated estimator/compositing module | Actual model/output support demonstrated; visible material response follows tested light samples without flicker; no personal data upload/persistence; download/memory/device budget measured | Estimator now runs in the camera loop by default, sampling a 32×24 scratch canvas at most twice per second and discarding pixel buffers after reduction; `ambientLighting: false` opts out. Synthetic warm/cool GPU and unit checks pass. Live relighting, flicker, overhead scenes and device-cost gates await user testing |
| S4 — Full tracker candidate, if selected | Separate WebAR.rocks runtime/provider adapter behind SDK lifecycle | SDK-owned camera input works; output conventions and head-mask strategy documented; no fabricated MediaPipe mesh or physical measurements; worker feasibility evaluated independently; lifecycle/device/privacy acceptance passes; primary tracker change explicitly decided before guidance/defaults change | Evaluated at source/architecture level and not selected for migration: the reference library emits its own pose/landmark contract and VTO demo depends on upstream helper/runtime conventions. Replacing the mandated MediaPipe worker without matched-device evidence would add a second tracker/camera/asset adaptation surface. Retain MediaPipe; no upstream tracker/runtime/model vendored |
| S5 — Matched website review | Tryable baseline/candidate integration and aggregate evidence | Same camera, person, equivalent asset, lighting and distances; stationary jitter, response lag, profile occlusion, inference/result age, sustained performance and cleanup measured; promotion requires demonstrated benefit and regression acceptance | Synthetic local A/B is available in `/fit-check.html` for temple effects and ambient tint; hook, temple, GPU output and swap evidence is recorded. A true same-person/live-camera/device comparison remains open |

The feasible code migration is implemented without changing the framework-neutral public SDK or MediaPipe worker. S4 ended with an explicit no-go decision for tracker replacement. S3 is integrated as a subtle live local effect with an opt-out; real-scene quality remains to be checked. S5 has synthetic comparison; matched human/device review remains open.

Follow-up shader audit found that OFF had left vertex bending enabled while disabling fade. This is fixed: displacement, normal correction, and alpha fade now share the same uniform. A source regression test checks all three branches, and the synthetic GPU diagnostic confirms the enabled path renders. Recheck the disabled visual against the original baseline on target devices.

## S0 source pin and license inventory

- Repository: [WebAR.rocks.face](https://github.com/WebAR-rocks/WebAR.rocks.face), commit `819cdbad4e87a43635d5f9724e30f277a7e7964d` (HEAD observed during this review).
- Adapted reference: `helpers/WebARRocksMirror.js`, SHA-256 `9db39b6357be2133a1833c261ffd99aed631bc1a397ed60631ca6132f806d581`.
- License: repository LICENSE, SHA-256 `5d5b01b702f5a5efd1a69431781cfb06b82da78f40b423bc9bae76abca24e949`; MIT license scope includes `/helpers`. Required notice text is included in `THIRD_PARTY_NOTICES.md`.
- Reviewed but not ported: `demos/VTOGlasses/main.js`, SHA-256 `3e790c50cc9445d23352be84575a93f0ff8d9a175d4c6fdcfaedf20be72bb178`; demo README, SHA-256 `a7ce078fc93cf9caba2a269377554e146c2228a90b1a4e1065a5917f83778df0`.
- Third-party models, HDR, GLB, Three.js r136 runtime, neural net, and demo images were not added. Their licenses remain separate and are not implied by the MIT helper scope. Current demo GLBs remain original project assets.
- No upstream files were vendored. `TempleEffects.ts` is a per-instance r176 shader adaptation, targets only named temple/ear-tip meshes, adjusts vertex normals for the bend, and fades alpha smoothly. It does not bring in upstream globals, camera lifecycle, PnP, tracker, or postprocessing.

## Verification protocol for implementation

1. Use synthetic geometry for shader/pose fixtures; test frontal, both oblique and ±84° profiles, multiple distances, pitch/roll and asset adjustments. Inspect front rim/temple retention as well as the entire hook. A universal fade that deletes visible temple length is a failure even if hook pixels become zero.
2. Run build/typecheck and relevant lifecycle/material/geometry checks for changed code. Repeat start/stop and asset replacement checks, shader compilation, context loss, resize/crop and failure teardown. Read GPU-deformed output for rendering acceptance.
3. Review live users on desktop and target Android/iOS devices. Compare with the same baseline and record aggregate jitter/lag/occlusion/resource results. Never save personal frames, landmarks, poses or snapshots as test artifacts.
4. Verify no camera-derived network requests. Models/WASM/GLB/HDR downloads must be versioned and licensed; telemetry remains absent. Test CPU/capability failure paths where applicable.
5. Keep prototype evidence and targets distinct. No new real-device, photorealism, physical fit or speed claim is accepted from documentation or a build alone.

## Current work completed

- Read current SDK rendering/session/public API and upstream demo/helpers/asset documentation.
- Identified r136/r176, camera ownership, singleton/lifecycle, pose/mesh, shader deformation and asset conversion boundaries.
- Pinned/audited the WebAR.rocks.face helper source and MIT scope; recorded checksums and included the license notice.
- Added typed, instance-owned bending/fading shader effects for named GLB temples and ear tips; cloned only selected standard materials, adjusted vertex normals, and added an internal switch that restores transparency/depth-write state.
- Added a single JSON manifest for the demo GLBs' fit transform, dimensions, named parts and provenance. The builder embeds VTO metadata, and `validate-demo-glasses.mjs` checks GLB structure and manifest agreement before build/dev.
- Added a local-only border-pixel ambient estimator with temporal smoothing and a bounded HemisphereLight mapping. The camera loop samples a 32×24 scratch canvas at most twice per second; only smoothed aggregate color/luminance/confidence are retained in memory. Public `ambientLighting: false` disables it. Invalid/clipped/undersampled input is rejected.
- Added unit coverage for part selection, material isolation, effect disable/reset, and tuning validation.
- Added estimator tests for warm/cool chromaticity, smoothing/rejection and invalid inputs; the diagnostic reads back actual renderer pixels for synthetic warm/cool samples across frontal, oblique and profile views.
- Extended `/fit-check.html` to read back actual GLB GPU output with effects on/off, rasterize full rear hooks and near-side temples, and check frontal rim visibility.
- Verified Contour and Linea at 30/100 cm with selected profiles +84°/−84°; each run also checks frontal and 45° poses. The 12° pitch / 8° roll profile fixture passed.
- Repeated 20 alternating asset swaps on three renderers: latest browser run retained geometry/texture counts at 15/1 for each renderer.
- Rebuilt and validated both demo GLBs from the shared manifest. Full browser diagnostic passed with warm/cool sample luminances 0.2451/0.1767, confidence 1/1, and 231/418/90 changed GPU pixels at 0°/45°/84°. Values are deterministic desktop-fixture output, not a live light estimate quality metric.
- Evaluated the optional upstream tracker architecture and recorded a no-go: retain the current MediaPipe worker; the upstream pose/model/helper contract is a separate engine, not a drop-in glasses-rendering port.
- No dependency installed, upstream source vendored, camera opened, or tracker/runtime replaced. No npm publication or commercial Jeeliz integration.

Detailed synthetic pixel counts and acceptance boundaries: `docs/evidence/vtoglasses-temple-effects.json` and `docs/evidence/vtoglasses-local-lighting.json`. Code migration milestones S1–S5 have an outcome recorded; camera/device review, real-user fit, production lighting qualification, and retail GLB calibration remain explicit release gates.
