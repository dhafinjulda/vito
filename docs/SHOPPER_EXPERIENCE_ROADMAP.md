# Shopper experience roadmap

**16 October status:** local first-iteration software scope and verification are complete. Physical devices and a licensed retail sample are unavailable, as confirmed by the owner; shopper observations and budget/support ratification remain open. M15/M16 are not accepted. See the [iteration report](SHOPPER_SPRINT_REPORT.md) for exact evidence and next actions. Earlier planning text below is historical.


Prepared 14 October 2026 (Asia/Jakarta). Status: **planned; no new runtime features or device acceptance from this planning update**.

The primary audience is shoppers trying on glasses, as selected by the owner. The SDK remains the product; improvements to the reference integration demonstrate what any retailer can build with its public API. The intended outcome is a shopper who can start quickly, trust the appearance while moving, compare a few frames easily, and recover without technical help.

## 1. What to build on

The current SDK already provides local face tracking, perspective fitting, adaptive smoothing/quality, face/head depth masks, camera/lens compositing, guarded automatic hair masks, optional hand manipulation, GLB replacement, and lifecycle cleanup. The optional generator already exports portable fit metadata. These capabilities need qualification and focused improvements, rather than another tracking-stack replacement.

| Observed gap | Evidence in the repository | Shopper consequence |
|---|---|---|
| Physical-device qualification is incomplete | [Device acceptance](FINAL_DEVICE_ACCEPTANCE.md); M9–M12 in [implementation plan](../IMPLEMENTATION_PLAN.md) | Desktop synthetic checks do not establish phone recognition, visual fit or thermal reliability. |
| Startup hides the reason for waiting | `packages/sdk/src/index.ts` acquires the camera before `AssetReadiness.wait()`; that wait is cancellable but has no deadline | A slow initial GLB can leave a live camera waiting without an actionable asset stage. |
| Public loading/error signals are coarse | `packages/sdk/src/types.ts`: `SessionStatus`, generic `onError(Error)` | Hosts must infer resource progress and recovery actions from messages or native error names. |
| Comparison feels blocked during loading | `examples/vanilla/src/main.ts` disables all product buttons during a swap | A shopper cannot immediately choose the next pair while a request is slow. |
| The reference flow exposes engineering controls early | `examples/vanilla/index.html` places diagnostics, calibration and hand instructions before the collection | Especially on phones, browsing competes with technical controls. |
| Guidance can repeat unnecessarily | The reference fit callback writes the polite live region on every fit update | Frequent equivalent announcements can distract screen-reader users. |
| Product fidelity is unqualified | Bundled GLBs are demos/CC0 import fixtures; M12 results are template approximations | Appearance is useful, but it does not establish a particular retail SKU's size or comfort. |

Earlier test counts and soak results are historical evidence, not checks rerun for this roadmap. The device checklist has been reconciled with current public defaults; further documentation reconciliation is in the first iteration.

## 2. Product decisions

1. **First usable try-on comes first.** Start, useful loading feedback, stable face placement and product selection precede hand interaction, authoring, or new recognition technology.
2. **Keep shopping in the host.** Catalog, price, product IDs, shortlist, two-choice selection, product links and purchase actions belong to retailer applications. Core owns camera/tracking/rendering and small typed lifecycle/readiness contracts.
3. **Comparison stays live.** The first comparison feature switches between two selected frames on the same live preview. It requires no frozen camera image, snapshot, face profile or recording. A shortlist contains product IDs only and is session-local in the reference example.
4. **Default fitting should work without calibration homework.** Show a clear appearance approximation; product dimensions/provenance come from asset suppliers. FOV, eye-reference, yaw/distance readouts, shaders and runtime counters belong in developer diagnostics. A visual adjustment never becomes a physical fit claim.
5. **Graceful degradation is part of the experience.** Face-only tracking and DOM preview remain useful fallbacks. Optional models must respect first-fit and sustained face budgets. Hands stay opt-in with button alternatives.
6. **Preserve the privacy boundary.** Explicit `start()` is the only camera entry and always requests `audio: false`. Stop, failure, page hide and disposal release every track. No remote telemetry or upload/persistence of frames, landmarks, poses, masks, gesture histories or snapshots. Runtime timing/count aggregates may be inspected locally; diagnostics reset per session.
7. **Keep the stack and module boundaries.** TypeScript, MediaPipe in the existing worker, Three.js, GLB; framework-free core. Asset recipes/interpreters remain in the optional generator; bounded versioned fit metadata and explicit overrides remain the core contract. Estimated dimensions keep approximation provenance.
8. **Add APIs only for demonstrated host needs.** Names below are design candidates. Preserve `createVirtualTryOn`, `start`, `stop`, `setGlasses`, `setFit`, `setPlacement`, `dispose`, and current callbacks while designing additive contracts.

## 3. Milestones and ordering

Use five iterations, nominally two weeks each for one engineer with part-time UX/QA and access to physical devices and product assets. This is a capacity assumption, not a calendar commitment. Re-estimate after M15; device and supplier gates cannot be closed by elapsed time. Accessibility and privacy apply to every iteration.

| Milestone | Priority / dependency | Shopper result | Deliverables and exit gate |
|---|---|---|---|
| **M15 — Baseline and shopper discovery** | P0; first | We know what currently prevents a successful try-on | Frozen build/configuration, current-default device baseline, 6–8 observed shopper sessions, ranked friction list, agreed timing budgets and explicit supported/untested rows. See [first sprint](SHOPPER_FIRST_SPRINT.md). |
| **M16 — Fast start and helpful recovery** | P0; M15 baseline | A shopper knows what is happening and can start/cancel/retry safely | Stage-aware readiness, typed recovery reasons, bounded cancellable resources, capability guidance, explicit camera-free preparation proposal. Consent pending, offline/slow assets, model failure and context loss have usable outcomes. |
| **M17 — Trustworthy fit on supported phones** | P0; M15, candidate M16 build | Glasses stay believable through ordinary movement | Current defaults qualified on physical targets; at least one licensed retail SKU with verified geometry/dimensions; synthetic temporal/occlusion regression and live visual review. Calibration and optical/comfort limitations remain clear. |
| **M18 — Browse and compare without friction** | P1; M16, M17 assets/budgets | A shopper can try three frames and compare two without restarting | Bounded preloading and load-state feedback; responsive latest-choice selection; live two-choice toggle; session product shortlist; localized guidance and accessible mobile reference flow using public API only. |
| **M19 — Pilot and release qualification** | P1; M16–M18 | The complete flow works outside the development setup | Observed pilot, all advertised device rows passed, clean packaged host integration, licenses/provenance and privacy/lifecycle evidence, migration/release notes. npm publication requires a separate explicit request. |

M17 device work begins during M15 and continues alongside M16. A phone blocker overrides the next feature ticket. M18 may prototype interaction with demo assets, but retail claims and its final acceptance depend on M17. Do not defer accessible controls until M18.

## 4. Work packages

### M15 — Establish a useful baseline

- Freeze SDK/worker hashes, dependency versions, current defaults, asset hashes and self-hosted runtime configuration. Reuse existing synthetic, GPU, native-worker and resource harnesses.
- Measure the ordinary default path first: `presentation: auto`, adaptive quality on, camera compositing on, eligible automatic hair, hands off. Compare face-only/optional-disabled and CPU fallback paths separately.
- Use desktop Chromium, a physical iPhone/Safari, a midrange Android/Chrome and a higher-end Android/Chrome. Record exact browser/OS/device configuration; add other browsers only when there is a support goal.
- Observe 6–8 consenting shoppers attempting start, view a side angle, switch three frames, choose a preferred pair, stop, and recover from one safe failure. Retain anonymous task tallies and general usability notes only; no imagery, personal characteristics, coordinates or pose histories. These observations rank friction and are not a population-wide finding.
- Separate camera permission waiting, resource preparation, tracker readiness and the first usable overlay. Existing `startupMs` includes permission waiting and cannot alone evaluate start speed.
- Reconcile current-default/device instructions and package integration documentation. Preserve dated historical evidence and flag superseded assumptions instead of rewriting previous results.

### M16 — Make starting and recovering understandable

- Design camera-free capability inspection: secure-context/media API, worker, ImageBitmap and WebGL checks with disposed probe resources. Report unknown permission/model/GPU outcomes honestly; a capability probe does not certify a device or request permission.
- Evaluate explicit `prepare()` for asset/model work without camera access. Reuse constructor asset work rather than loading twice. Specify network activity, optional cache use, cancellation, repeat calls, changed assets, prepared-worker ownership, stop/page-hide policy and disposal. Preparation is application-requested; a working `start()` must not require it. No surprise background model downloads or automatic camera access.
- Separate consent/resource/worker/asset readiness from session tracking. Use phase labels and indeterminate loading when bytes are unknown; do not invent percentages.
- Add a small error/recovery contract for permission denied/policy blocked, absent/busy camera, unavailable runtime, invalid/slow asset, incompatible worker, interrupted startup and WebGL failure. Keep the native cause for developer debugging; hosts own translated text and buttons.
- Bound asset and runtime waits with documented, configurable deadlines. Distinguish resource timeout from an unanswered permission prompt. Permit cancellation throughout; stop late-acquired tracks and discard late responses.
- Preserve existing safe worker recovery and failed-swap continuity. Offer retry or a static product view when retry cannot work. A WebGL retry may require an explicit stop/recreate/start; do not promise automatic restoration before qualifying it.
- Measure optional graph prewarm cost. If it violates first-fit budgets, evaluate preparing optional resources separately or disabling an optional feature for that session. Native graph compilation in the shared worker must not stall an already-mounted face without a guarded fallback.

### M17 — Make the appearance credible

- Qualify one representative licensed supplier SKU before expanding to at least three different frame shapes/materials. Confirm bridge pivot, metre coordinates, axes, semantic lens/temple names, explicit dimensions and provenance. Untagged legacy assets and explicit overrides continue to work.
- Put asset inspection, size/material reports and authoring recipes outside the core. Begin with provisional asset budgets: GLB transfer ≤2 MB, ≤30,000 triangles and estimated decoded textures ≤32 MiB per asset. Validate these on actual product geometry/devices and record exceptions before adopting limits.
- Tune the existing pose freshness, smoothing and quality policy using baseline comparisons. Use stored synthetic ground truth for numerical jitter/lag/bridge error; use live qualitative pass/fail for recognized-face alignment, distance response, near/far temples, the whole rear hook, hair and lens appearance.
- Review ordinary indoor, bright, dim and backlit conditions; slow/fast turns, stops, reversals, pitch, portrait/landscape, cover cropping and reacquisition. Include varied appearances through live review without retaining biometric attributes.
- Run ten-minute physical-device sessions and repeated stop/start/swaps. Track software timings, counts, resource bounds and qualitative slowdown; synthetic blank-stream soaks do not accept live recognition or thermal behavior.
- Keep canonical-face depth, generic head/ear envelopes, lens optics and hand depth labeled approximations. Calibrated PnP/distortion or anatomical segmentation becomes a bounded research spike only if a recorded failure justifies it; compare against the existing stack before adopting it.

### M18 — Help shoppers choose

- Keep the current frame visible while its replacement loads. Expose selected, loading, displayed and failed asset states separately; a failed load must not change the displayed product label.
- Reuse existing latest-request installation semantics. Allow rapid A → B → C selection, cancel/discard superseded work, install only C, and keep stop/navigation usable.
- Add bounded, application-requested preloading only after measuring need. Initial cache budget: active asset plus one prepared candidate, at most two parsed assets and ≤64 MiB estimated decoded textures. Define eviction, ownership, invalidation and disposal; retain no camera data or caller-owned blob URLs beyond their documented use.
- Put a compact catalog beside/below the camera and a two-choice toggle near the preview. Keep the same live view, camera session and per-product calibration during comparison. Reset visual adjustments appropriately when changing calibrated products.
- Shortlist IDs and product-link/cart callbacks are example/host state. Do not add commerce, face-shape profiling, ratings storage or a remote analytics service to core.
- Use plain one-action guidance with stable reason-based announcements. Announce meaningful changes, not every fit callback. Keep diagnostic values and advanced calibration in development controls. Preserve readable Vito attribution.
- Qualify keyboard, screen reader, visible focus, contrast, zoom, touch, portrait/landscape and reduced motion. Offer English/Indonesian copy dictionaries in the example and document how hosts supply their own language. Hands and head placement stay optional extras.

### M19 — Prove the complete flow

- Freeze the release candidate and run the complete device checklist against its exact package/worker/assets. A fix reopens only the affected checks plus lifecycle/privacy regressions.
- Observe a second 6–8 shopper pilot against the same tasks; compare anonymous completion/timing tallies with M15. Ask whether appearance feels credible and whether choosing between pairs is easy. Do not translate a small pilot into a conversion claim.
- Verify clean packed-package consumers for a plain browser/Vite flow and one retailer-relevant client framework/SSR host. Expand the host matrix when adopter demand justifies it; framework dependencies stay out of core.
- Verify emitted worker delivery, base paths, self-hosted versioned models/WASM, CSP, generated blob assets, route/modal cleanup and static fallback. The example may own its service worker; SDK must not register a site-wide service worker.
- Publish an evidence-based support matrix, known limits, concise host integration recipe and recovery copy map. Prepare local release artifacts and notes; publication is a separate owner-authorized action.

## 5. Proposed success criteria and measurement

These are **initial targets**, not measured performance or supported-device promises. M15 must ratify budgets against the actual device/network classes before implementation acceptance. Any changed target requires a rationale in `IMPLEMENTATION_PLAN.md`; do not silently lower a target to close a milestone.

| Outcome | Initial target | Measurement and privacy boundary |
|---|---|---|
| Understand and begin | At least 80% of observed pilot participants start an unassisted usable try-on within 60 seconds | Anonymous task tallies, round percentages with sample size; permission refusal remains a separate outcome. |
| Warm first usable overlay | Software-controlled startup p95 ≤3 seconds with runtime/asset already prepared | Begin at Try-on action; report prior preparation cost, total wall time and the camera API pending interval separately. Verify preview and usable overlay qualitatively. |
| Cold first usable overlay | Software-controlled startup p95 ≤8 seconds, empty runtime/asset cache, hands off, controlled 20 Mbps / 100 ms RTT | Begin before SDK construction/resource preparation and call start immediately in the harness. No previous prepare/preload. Include GLB download, runtime download/compile and first draw; report total wall time and camera API pending interval separately. |
| Responsive appearance | Standard-tier target ≥20 face results/second and capture-to-render-submission p95 ≤150 ms | Existing software clocks/counters; never label this physical sensor-to-display latency or GPU time. Ratify a degraded tier or mark a device unsupported if needed. |
| Stable synthetic fitting | Stationary p95 bridge jitter ≤2 px at a 960 px fixture viewport; candidate moving p95 alignment no worse than frozen baseline | Synthetic ground truth only; report pose/cadence/viewport and lag separately. Live alignment stays qualitative. |
| Continuity and reacquisition | No unexplained disappearance in ordinary supported turns; returning to a clear centered face restores a usable fit without another camera request | Synthetic freshness/loss/reacquisition fixtures plus live qualitative pass/fail; do not save face-loss/pose histories. |
| Easy switching | Prepared asset choice to first correct draw p95 ≤500 ms; no new camera acquisition | Repeated switches with synthetic timing probes plus live visual review; failed/slow loads retain previous frame and usable controls. |
| Compare and choose | At least 80% complete three-frame browse, two-choice comparison and return to their preferred frame without help | Anonymous pilot task tally; no snapshot or camera history. Satisfaction target median ≥4/5, with n and comments summarized. |
| Lifecycle/recovery | No surviving tracks, workers, timers or retained camera textures after teardown; bounded retry path for every accepted failure case | Synthetic fault injection and physical permission/hide/restart review. A pending permission choice has no artificial failure deadline. |
| Accessible operation | Complete start/stop/select/compare/retry by keyboard and assistive technology; meaningful announcements only | Manual review on target platforms; ≥44 CSS px primary touch targets, 200% zoom, visible focus and WCAG AA contrast in the reference flow. |
| Sustained use | Ten-minute physical sessions plus 20 swaps and 10 start/stop cycles pass without uncontrolled resource growth or unusable slowdown | Local non-biometric software timing/count aggregates and qualitative pass/fail. Exact resource counts must settle to the bounded cache policy. |

Define software-controlled startup as the full scenario-entry-to-first-usable interval minus the explicitly reported `getUserMedia()` pending interval. That excluded interval can include hardware acquisition as well as a user's permission decision; do not label it pure human decision time. Always report full wall time alongside it. Cold scenarios begin before constructor asset loading, with no prior preparation/preloading; warm scenarios report when preparation occurred and its cost. Post-camera-acquisition time remains a diagnostic, so moving resource work earlier cannot hide waiting or claim a cold-start improvement. Record constructor/prepare/start ordering and cache history in every scenario.

For timing acceptance collect at least 20 repeats per advertised device class and cold/warm scenario, report n/p50/p95 and failures, and include fail/timeout cases rather than dropping them. Live diagnostics are aggregated locally without raw event traces. Save only permitted runtime timing/count summaries, environment/configuration and pass/fail observations. Numerical face/pose accuracy artifacts must use synthetic inputs.

## 6. Public contract design candidates

No symbols in this section exist as a result of this plan. M16 must settle precise types and lifecycle before code changes.

| Candidate | Needed behavior | Boundary |
|---|---|---|
| `checkCapabilities()` | Camera-free capability report with supported/unsupported/unknown reasons | No permission request, camera, network, fingerprint history or guarantee that a model will run. |
| `prepare({ signal })` | Optional resource readiness before the explicit start gesture; idempotent/cancellable | Define downloads/cache/worker ownership; preserve direct `start()` compatibility and dispose all prepared resources. |
| `onReadinessChange` | Distinguish consent, resources, worker and asset readiness; identify first usable presentation | Small reason/phase data; not a camera/face measurement stream. Unknown byte counts remain indeterminate. |
| Typed error/recovery reason | Stable codes, stage, recoverability and retry/static-view actions with native cause | Additive to generic `Error`; hosts translate copy. Do not expose raw private worker messages. |
| `onAssetStateChange` and optional `preloadGlasses` | Selected/loading/displayed/failure state, abort/eviction semantics and latest-choice behavior | GLB resources only, strict cache budget, caller URL ownership, no host catalog or commerce model. |

Prefer existing callbacks and documented recipes when they can deliver these outcomes cleanly. Avoid a second redundant state machine or a large preset/configuration API. Review failures, stop/dispose races, concurrent starts and prepared resources before accepting new contracts.

## 7. Gates, ownership and deferred work

- **SDK engineer:** readiness/recovery, bounded asset work, timing definitions, lifecycle and public contracts.
- **UX/integration contributor:** shopper reference flow, copy, keyboard/screen-reader work and observed task protocol.
- **Device QA / product owner:** physical target access, supported rows and shopper acceptance.
- **Asset supplier / asset contributor:** licensed geometry, dimensions/provenance and product visual review.

These are role assignments, not named people or staffed commitments. If one engineer holds multiple roles, schedule them explicitly rather than assuming parallel capacity.

The immediate external dependencies are physical iOS/Android access and a licensed representative SKU. Baseline and synthetic preparation can proceed while these are arranged, but corresponding acceptance remains open. Implemented code, synthetic/GPU checks, native blank-stream results, physical-device checks and shopper observations must remain separate evidence categories.

Defer more hand gestures, physics/folding, native adapters, new trackers, arbitrary photo-to-SKU generation, face-derived recommendations and recording/share-image flows. Reconsider additional capabilities only after shopper evidence and the privacy/product boundary support them. Generator usability has its own [optional module plan](ASSET_GENERATION_PLAN.md).

## 8. References and maintenance

- [Implementation status and historical evidence](../IMPLEMENTATION_PLAN.md), [first iteration tickets](SHOPPER_FIRST_SPRINT.md), [device qualification](FINAL_DEVICE_ACCEPTANCE.md).
- [Existing tracking decisions](TRACKING_ROADMAP.md), [premium fitting](PREMIUM_FITTING_PLAN.md), [default policies](DEFAULT_FEATURES_PLAN.md), [continuity work](CONTINUITY_IMPROVEMENT_PLAN.md). Dated implementation logs remain historical; this roadmap sets the next shopper priorities.
- Google's [Face Landmarker web guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) describes synchronous detection and recommends workers to avoid blocking UI. Retain the worker baseline while measuring optional graph costs.
- [MDN camera guidance](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) documents secure-context/permission-policy constraints and an ignored permission prompt that may remain pending. This informs distinct readiness and cancellation states.
- [MDN WebGL context-loss simulation](https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context) supports controlled recovery fault checks; it does not establish real phone GPU behavior.

Primary technical references checked 14 October 2026. Update this roadmap and `IMPLEMENTATION_PLAN.md` when priorities, contracts, budgets, milestones, evidence or external blockers change.
