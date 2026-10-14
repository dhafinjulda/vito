# Tracking and realistic fitting

Reviewed 13 October 2026. The browser SDK remains the product; all camera-derived data remains local. Optional hair segmentation uses the existing pinned MediaPipe dependency; no new ONNX runtime is added.

## Next implementation priority

M9 now ships guarded defaults: auto presentation, recognition-protected adaptive
quality, camera/lens compositing with fallback, and capacity/asset-qualified hair.
Opted-in hands and eligible hair warm before live dispatch. Current policy and
evidence supersede earlier default-off notes: [default readiness](DEFAULT_FEATURES_PLAN.md).
Production live/mobile/real SKU qualification remains open.

The [smoothness and runtime budgets](SMOOTHNESS_OPTIMIZATION_PLAN.md) implementation O0–O4 is complete with synthetic/native runtime checks; O5 live/device/default promotion remains open. The subsequent [premium fitting plan](PREMIUM_FITTING_PLAN.md) implements decoded-frame freshness, optional intrinsics/physical scale, camera transmission, optional hair masks and remount settling. P1–P6 code checks pass. Calibrated PnP/distortion, anatomical ears, native adapters and physical/live acceptance remain open.

## Implemented now

- Seven independent canonical upper-face spans estimate depth by median consensus. One damaged outer-eye anchor no longer changes the depth estimate in deterministic canonical fixtures at yaw −84°/−45°/0°/45°/84°. Canonical proportions can still introduce person-specific bias; consensus is not a confidence score from the neural model.
- Translation axes and shortest-arc quaternion rotation use separate speed-adaptive cutoffs inspired by the [1 Euro filter](https://gery.casiez.net/1euro/). Derivatives are filtered and signed so alternating noise does not become apparent sustained motion. Width adapts more slowly. Current parameters are provisional pending subject/device review.
- GLB, approximate head/ears and dense face mesh share one filtered head transform. The dense mesh gets a rigid correction instead of independent world-coordinate averaging. Facial deformation remains the latest model output.
- Sheared/nonorthogonal matrices fall back to the existing landmark orientation path. Smoothing clears on face loss, long gaps, timestamp discontinuities or large position jumps.
- The underlying Face Landmarker model is unchanged. These changes improve pose estimation/registration, not a proven increase in detector accuracy, low-light recognition or profile recall.

## Stack choices

| Path | Use in this product | Tradeoff / status |
|---|---|---|
| MediaPipe Face Landmarker + worker + Three.js | Keep as baseline. VIDEO mode, one face, matrix output, GPU initialization with CPU fallback. [Official guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) documents built-in smoothing for one face and synchronous inference, making a worker appropriate. | Already implemented. Measure combined internal/external smoothing latency on live devices before further tuning. |
| Calibrated perspective pose / PnP | Next geometry spike: actual source-camera intrinsics, distortion handling and stable multiple 2D/3D correspondences with reprojection residuals. [OpenCV PnP reference](https://docs.opencv.org/4.x/d5/d1f/calib3d_solvePnP.html). | Proposed optional calibration/pose module. Camera calibration and reliable correspondences are prerequisites. PnP with a generic face still does not establish physical sizing. Avoid shipping the full OpenCV bundle before proving accuracy/runtime benefit. |
| Local ear/hair segmentation + ONNX Runtime Web | Best candidate for replacing guessed ear envelopes and handling hair/hand foreground occlusion. [ONNX Runtime WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html) supplies inference execution, not a ready-made face/ear segmentation model. | Proposed optional module. Select a licensed model with actual ear/hair classes; benchmark accuracy, operator coverage, download/memory budget, worker support and GPU contention. Feature-detect WebGPU; validate a WASM fallback. No speed or accuracy improvement assumed merely from changing runtime. |
| Native iOS ARKit adapter | A separate future integration for apps targeting supported Apple devices; [ARFaceAnchor](https://developer.apple.com/documentation/arkit/arfaceanchor) provides face geometry and pose, and [ARFaceTrackingConfiguration](https://developer.apple.com/documentation/arkit/arfacetrackingconfiguration) exposes capability checks. | Native platform option, not a drop-in implementation for this browser SDK. Do not redirect the current project to native. TrueDepth/device availability and ear occlusion require their own evaluation. |

### M8 shipped scope versus research

Explicit `cameraCalibration` supplies source intrinsics to the existing
unprojection/camera/mask/contact path; manual outer-eye reference and GLB
front-width calibration are supported. These do not solve calibrated PnP or
distortion, and MediaPipe's existing canonical rotation is unchanged.

Hair-only ImageSegmenter is now opt-in in the same worker, cadence 300–1,000 ms.
Face results publish first; confidence bytes stay local. The rear-part shader
uses temporal/motion/owner guards. Its official model card declares Apache-2.0;
native blank-stream and synthetic GPU checks pass. This replaces the proposed
ONNX hair runtime spike for the present implementation. Actual ear class/depth,
cross-subject hair accuracy, mobile budgets and hand segmentation remain open.

Camera compositing/lens transmission and aligned-release settling are optional
or bounded rendering/interaction improvements. They do not establish
prescription optics, physical contact, calibrated hand depth or retail fit.

## Acceptance gates for the next optimization

1. **Stability:** measure bridge/rim jitter and pose lag quantitatively with synthetic ground truth. Compare live baseline/candidate on the same devices/conditions through qualitative slow/fast yaw, approach/retreat, roll and expression checks; retain only runtime timing/count aggregates and pass/fail notes, never personal frames, coordinates, poses or face-derived measurement histories.
2. **Occlusion:** review full hooks and retained front temples at frontal/±45°/±80° with different ear sizes, hair and product sizes. Synthetic masks cannot prove segmentation or actual ear placement.
3. **Performance:** measure capture-to-result age and p50/p95 inference/render time separately, including CPU fallback, memory, and 10-minute thermal behavior. The existing synthetic renderer benchmark excludes inference and GPU execution.
4. **Capabilities:** desktop Chrome, target Android Chrome and iOS Safari; camera denial, hide/resume, teardown and model loading must still work. Baseline tracker remains available if the optional module cannot initialize.
5. **Calibration:** document source FOV or intrinsics and face-size assumptions. Compare estimates with known test distances across subjects; report error rather than presenting estimated centimeters as measured ranging.
6. **Privacy/distribution:** no upload or persistence of camera-derived data; licenses and model/runtime sizes reviewed before bundling. No npm publication without user instruction.

Real-person accuracy, inference latency, ear segmentation and calibrated measurement remain unverified. Detailed actual check results are recorded in `IMPLEMENTATION_PLAN.md`.
