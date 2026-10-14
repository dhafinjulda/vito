# SDK comparison with Jeeliz Live Virtual Try-On

Reviewed 12 October 2026 (Asia/Jakarta). This is a source/code capability assessment, not a matched live-camera benchmark. No third-party camera session was started and no personal frames/landmarks were captured or transmitted.

## Scope and conclusion

The comparison targets the current Jeeliz Live Virtual Try-On product described in its Shopify listing and vendor site. The [public Jeeliz VTO widget repository](https://github.com/jeeliz/jeelizGlassesVTOWidget) explicitly labels itself legacy; its renderer feature list and demo size are not assumed to describe the current Shopify product.

Assessment: Jeeliz has a more complete documented commercial product workflow and a lighting-matching capability absent from this SDK. Our SDK has working perspective fitting, local processing and configurable GLB integration, but has not demonstrated equivalent visual quality, real-subject tracking or device performance. A numerical quality score or percentage gap is unsupported.

## Comparison

| Area | Current local SDK evidence | Current Jeeliz evidence | Supported conclusion |
|---|---|---|---|
| Lighting | Fixed key/fill directional lights and RoomEnvironment map in `GlassesRenderer.ts`; no face lighting reconstruction. | Vendor explicitly describes matching glasses lighting to face lighting in its [product listing](https://apps.shopify.com/jeeliz-live-virtual-try-on) and [website](https://jeeliz.com/). | Clear feature gap. Dynamic lighting is a strong candidate for improving visual integration; its measured visual benefit still requires a live comparison. |
| Product geometry/materials | Two procedural PBR demo GLBs. Metalness, roughness, clearcoat and transparent lens tint exist. No real SKU calibration, live-video lens refraction or contact-shadow compositing. | Automated 3D generation from product photos and material/pose editing, described in the [FAQ](https://jeeliz.com/shpApp/faq.html). FAQ acknowledges difficult rimless/visor frames and possible reconstruction artifacts. | Jeeliz has a more complete product asset workflow. Automatic generation alone does not prove dimensional accuracy or flawless geometry. |
| Pose stability | MediaPipe matrices, seven-span depth consensus, separate signed-derivative filters; synthetic regressions pass. | Live tracking and accurate positioning are advertised; no matched numerical pose-error/latency benchmark located in reviewed sources. | No measured winner. Our earlier 81.46% jitter reduction compares our own previous filter on one synthetic fixture, not Jeeliz. |
| Ear/hair occlusion | Dense face mask plus approximate skull/ear ellipsoids. Full-hook GPU probes at ±84° pass on generic fixtures; no ear/hair segmentation. | Reviewed current public descriptions do not establish the ear detection/segmentation method or ±90° acceptance. | Our anatomical gap is confirmed. Jeeliz full-profile superiority cannot be asserted from these sources. |
| Distance / physical size | Perspective scaling works in fixtures; centimeters assume canonical face proportions and approximate FOV. | Accurate positioning is advertised; reviewed descriptions do not establish calibrated physical distance/PD/size guarantees. | No basis to claim measurement-grade sizing for either implementation. |
| Performance/devices | Latest three-renderer synthetic motion run: 30.1 observed frames/sec, CPU fitting/submission mean 2.34 ms/p95 3.10 ms; excludes inference and GPU completion. Mobile/camera acceptance pending. | Vendor [FAQ](https://jeeliz.com/shpApp/faq.html) claims smooth desktop/mobile operation including older phones. No same-device total latency/FPS results obtained. | Jeeliz markets broader supported deployment. No fair performance ranking or transferable FPS claim. |
| Privacy | Camera-derived data stays local; no remote session telemetry implemented. Runtime/model/asset downloads remain possible. Live network audit pending. | [FAQ](https://jeeliz.com/shpApp/faq.html) states local video processing. [Privacy policy](https://jeeliz.com/shpApp/privacyPolicy.html) lists session duration, SKU, store ID and timestamp metrics, plus merchant/product data. | Both describe local video processing; this SDK has a stricter current no-telemetry scope. Vendor privacy statements have not been independently audited here. |

## Access limitations

- The Shopify listing's demo-store link redirected to a password-protected store during this review. No password was supplied or attempted.
- The vendor-site live-demo link returned the same page through the web reader; a live session was not evaluated.
- Marketing imagery, customer names, claims of lighter loading and star ratings are not quantitative evidence of tracker quality.
- No code changes or new acceptance runs were made for this comparison. Existing test/benchmark evidence is from the implementation log.

## Proposed priorities to close the quality gap

1. Local lighting/exposure estimation and believable material response, with evaluation under front/side/back lighting. Demonstrate integration with actual camera lighting before adding more smoothing.
2. One dimensioned, calibrated real product GLB with reference photos and material review. Keep any generation pipeline in the optional asset module; do not equate generation speed with fit quality.
3. Validate bridge/hinge placement, crop/mirror, camera intrinsics/FOV and face-size assumptions across subjects and distances.
4. Improve anatomical occlusion using a validated local ear/hair model or measured geometry, preserving front temples. Zero hook pixels from a larger generic mask alone is insufficient anatomical acceptance.
5. Run a matched comparison: same camera, lighting, equivalent product geometry/size, person and distances; frontal/±45°/±80°/full profile, slow/fast turns, approach/retreat and expression. Measure alignment error, stationary jitter, response lag, full-hook visibility, capture-to-result age and warm/thermal performance. Keep only aggregate notes/metrics, no personal recordings.

These are proposed next steps, not newly implemented features. The SDK remains framework-neutral, browser-first and local; no Jeeliz integration, subscription, dependency or publishing action was initiated.

## License and development paths

Checked upstream license files on 12 October 2026. Public repositories have different licenses; do not treat all Jeeliz-branded software as one reusable codebase.

| Component | License evidence | Implication for this SDK |
|---|---|---|
| Current Jeeliz Live Virtual Try-On | Current product is described as a commercial service/integration. The legacy repository directs users to supplied integration code for the new product. No open-source release/license for the full current product was located in this review. | No evidence authorizes forking the full commercial engine or photo-to-3D service into our redistributable SDK. |
| `jeeliz/jeelizGlassesVTOWidget` | [Commercial license](https://github.com/jeeliz/jeelizGlassesVTOWidget/blob/master/LICENSE) restricts reverse engineering and selling/sublicensing/distributing/transferring the software to third parties. Payment exemptions for some uses do not remove those restrictions. | The reviewed license does not authorize embedding/repackaging it as our independently distributed SDK. A specific vendor agreement would be needed for that path. |
| `jeeliz/jeelizFaceFilter` | [Apache 2.0 license](https://github.com/jeeliz/jeelizFaceFilter/blob/master/LICENSE); [README](https://github.com/jeeliz/jeelizFaceFilter) explicitly permits commercial/noncommercial use and documents minified core scripts plus demo/helper sources. | Reuse/adaptation is possible under the license, retaining applicable license/notices and marking modified files. It is a general face tracker, not a released copy of the current premium glasses product. Its documented pose/scale outputs are not interchangeable with the SDK's dense MediaPipe landmarks. |
| `WebAR-rocks/WebAR.rocks.face` | [MIT license](https://github.com/WebAR-rocks/WebAR.rocks.face/blob/master/LICENSE) explicitly covers core `dist`, `helpers`, `neuralNets` and specified other directories, with exceptions for separately licensed/third-party material. [VTOGlasses documentation](https://github.com/WebAR-rocks/WebAR.rocks.face/tree/master/demos/VTOGlasses) describes GLB/PBR integration, temple bending and fading around the ears. | Most relevant open-license candidate to evaluate for glasses-specific helpers/rendering. Retain copyright/license; check individual dependencies/assets and GLB conventions before reuse. Core is distributed minified; helper/demo source is a more practical extension point. Ear fading is a rendering effect, not proof of detected anatomical ears or accurate segmentation. |

Recommended next evaluation: start with the MIT glasses helpers and documented bending/fading approach, keeping the public SDK API and current MediaPipe worker baseline. Their asset coordinates/reference scale/material naming differ from ours, requiring explicit adaptation. A full alternative tracker needs a separate provider adapter and device/quality benchmarks before changing the baseline. No dependency, source vendoring, tracker swap or vendor contact was initiated by this license review.
