# SDK-first implementation plan

Updated 15 October 2026 (Asia/Jakarta). Product direction: browser SDK first; web/PWA is an SDK consumer example.

## Decisions

1. **Product boundary:** publishable JavaScript/TypeScript browser SDK, no React dependency. The first public entry is `createVirtualTryOn()` with typed status/error callbacks and explicit `start`, `stop`, `setGlasses`, and `dispose` lifecycle.
2. **Runtime:** TypeScript, MediaPipe Face Landmarker in a dedicated classic Web Worker (its WASM loader uses `importScripts`), Three.js `WebGLRenderer`, and GLB input. Worker attempts GPU and falls back to CPU during initialization.
3. **Privacy:** camera starts only after `start()`; microphone is always disabled. Frames are transferred only to the local worker and closed there. No frame, landmark, pose, or snapshot upload/persistence is implemented. Model/WASM may download from configured versioned URLs; these are runtime assets, not camera data.
4. **Examples and optional authoring:** `examples/vanilla` is the small framework-free SDK integration. `packages/asset-generator` is a separate optional workspace package and is not imported by `@vto/sdk`; `examples/asset-studio` is an authoring example built on that package and the public SDK. Its local camera preview starts only from a direct user click. Generated templates are marked draft approximations, not retail-verified SKU assets.
5. **Assets and fitting:** SDK expects GLB with a nose-bridge pivot and local axes +X along the eye line, +Y up, +Z toward camera. The worker returns MediaPipe facial matrices for rotation; the solver unprojects bridge 168 using perspective and relative landmark depth. Depth now uses median consensus across seven canonical upper-face spans; the 8.891718 cm outer-eye span remains the GLB calibration gauge. Model size stays stable while its projection shrinks as the face moves away. Source-camera FOV is adjusted for cover cropping. Each asset has reference-eye-span, scale, local offset and rotation calibration. Dense face depth occlusion, approximate head/ear envelopes and separate speed-adaptive position/rotation filtering are enabled by default. All masks and asset share one filtered head transform. `FitState.estimatedDistanceCm` is an estimate, not a calibrated physical measurement.
6. **Distribution:** no npm publication without a later explicit request. Dependency and model versions are pinned; users can override model and WASM URLs to self-host.
7. **Further tracking stack:** retain the pinned MediaPipe worker/Three.js baseline. Recognition weights remain unchanged. M8 adds optional source intrinsics/physical asset scaling and Hair ImageSegmenter in the same worker, with no ONNX dependency. Calibrated PnP, distortion and anatomical ear segmentation remain research gates. See `docs/TRACKING_ROADMAP.md` and `docs/PREMIUM_FITTING_PLAN.md`. Native ARKit is a separate potential adapter, not the browser core.
8. **VTOGlasses migration:** port MIT glasses-specific bending/fading into typed instance-owned materials on current Three.js r176, retain MediaPipe, use shared demo calibration, and sample local border lighting at low resolution in the camera loop (default on, can be disabled with `ambientLighting: false`). Upstream tracker/PnP/camera/helpers are not a drop-in replacement; tracker evaluation ended with a no-go. Live camera/device, real SKU and production-lighting gates remain open. See `docs/VTOGLASSES_MIGRATION.md`.

9. **Hand manipulation:** face fitting/rendering takes priority. Opt-in `handInteraction` prewarms Hand Landmarker in the same worker and shares one local bitmap/camera. All ten fingertips participate in proximity checks; each thumb supports four finger-pair grasps. Two geometric palm identities support rigid two-hand movement and contact-gated no-jump transfer. Fixed scale, two depth masks and current-pose rebasing preserve visual continuity; `setPlacement()` remains the button alternative. Separate face/hand/completion packets and sustained optional-budget fallback remain. Grip depth, skin masks, crown fit and physical forces remain approximate/unqualified; live/device acceptance is open. See `docs/HAND_INTERACTION.md`.
10. **Runtime continuity and delivery:** content-address the emitted worker filename and validate protocol version 7 before sending frames. Associate results with the latest capture's source geometry revision and invalidate old mounts/masks on camera dimension changes. Normalize input on a transient 2D canvas (maximum width 640), keep independent capture/inference watchdogs and a bounded backup pump, and force CPU on inference recovery. Startup follows the latest requested asset; a failed swap preserves a valid model and restart. Optional `onTrackingHealthChange` exposes transient counters and feature fallback reasons.
11. **Asset generation:** optional `generateGlassesAsset()` accepts a supported local description or explicit recipe and returns semantic GLB, fit/physicalFit, report and files. An application-owned interpreter is optional, validated and cancellable; no provider/network/key is built in. Portable scene-root metadata lets the core load generated GLBs from a single URL without importing the generator. Studio uses one generation action with advanced details; product fidelity remains template approximation.
12. **Next development priority — shoppers:** the owner selected shoppers trying on glasses as the primary audience on 14 October. Prioritize a fast understandable first fit, actionable recovery, qualified product appearance on physical phones, and responsive live frame comparison. Developer APIs enable this experience; catalog/shortlist/commerce remain host-owned. Keep current worker/Three.js/GLB architecture and optional generator/hands boundaries. No new camera-derived persistence, uploads or remote telemetry. See [shopper experience roadmap](docs/SHOPPER_EXPERIENCE_ROADMAP.md) and [first iteration tickets](docs/SHOPPER_FIRST_SPRINT.md).
13. **Startup readiness and resource ownership — 15 October:** add local typed readiness stages, per-resource deadlines and `ResourceTimeoutError`, preserving existing lifecycle/callbacks. GLB fetches are instance-owned and abortable; late parsing is invalidated/disposed, failed swaps retain valid models. Camera permission remains untimed; acquired media always stops on session failure/cancel/dispose. Worker timing separates preparation, native creation, blank warmup and optional work without persisting face data. Default effects remain guarded as before; evaluate optional hair startup cost from measured evidence rather than shifting compilation into live fitting.

## Repository and implementation boundaries

- `packages/sdk`: browser lifecycle, MediaPipe worker, eyewear mapping, Three.js/GLB, public API.
- `examples/vanilla`: framework-free consumer with camera controls and status guidance.
- `packages/asset-generator`: optional recipe validation, parametric template geometry, and GLB export.
- `examples/asset-studio`: description generation, interactive model view, local authoring draft, GLB/recipe/manifest export, and opt-in try-on through `@vto/sdk`.
- `virtual-try-on-technical-plan.md`: detailed product/engineering reference. Its earlier React-app assumptions are superseded by the SDK-first decisions in this plan and the updated sections 1, 2, 8, and 10.

## Milestones and acceptance criteria

**16 October GitHub/npm automation:** owner requested pushing current work and
automated npm release infrastructure. Added stable package-tag GitHub Release
publishing with OIDC/provenance, full validation/build/typecheck/tests, exact
tarball publication and duplicate-version guards. Ordinary pushes remain CI only.
Registry confirms SDK 0.1.1 and generator 0.1.0 already exist; no version bump/tag
or publication is performed by setup. Local npm whoami returns E401, so per-package
trusted-publisher configuration remains an external account step. See
[release workflow](docs/NPM_RELEASE_WORKFLOW.md). GitHub delivery/check results
are recorded after the push; no device-acceptance claims change.

### Next program — M15–M19: shopper experience (in progress)

**16 October iteration handoff:** feasible local software work is complete: 319 SDK and 108 generator tests, offline policy, workspace build/typecheck, responsive latest-choice reference browsing and final start/stop/retry UI checks pass. SDK candidate `4f2e1ff673a8`; configuration/source/asset inventory in `docs/evidence/shopper-final-candidate.json`. Owner confirms no physical target devices or licensed retail sample. Shopper observations and budget ratification remain open; M15/M16 are not accepted. See [iteration report](docs/SHOPPER_SPRINT_REPORT.md), [reference flow](docs/SHOPPER_REFERENCE_FLOW.md) and [recovery contract](docs/SDK_RECOVERY_CONTRACT.md). No publication.

**15 October camera recovery:** typed `CameraAccessError`/`CameraErrorCode` now
classifies acquisition-only blocked/not-found/unreadable/unsupported/unavailable
failures, preserving native name/message and original cause. Reference copy offers
specific recovery actions without claiming user denial or a proven busy-camera
cause. Prompts remain untimed; no automatic permission retry or prepare acquisition.
319 SDK tests, SDK build, workspace typecheck and five 390px controlled UI failures
pass, including once-only errors, explicit retry and prepared-worker cleanup.
Candidate `4f2e1ff673a8`; evidence `docs/evidence/camera-recovery-*` and frozen
manifest. Initial playback scheduling regression was corrected with direct
try/await/catch; final checks pass. Native prompts/embedding policy/physical devices
remain unqualified. No publication.

**15 October preparation fallback:** after face readiness, failed optional startup
can prepare one face-only CPU replacement, releasing the failed worker first.
Start adopts it and preserves `optional-startup`/restart state; no third init.
Cancellation/protocol mismatch/obsolete assets do not trigger retry; failed
fallback reports once and releases ownership. 307 SDK tests, SDK build/typecheck,
and actual-MediaPipe stalled-hair browser recovery pass: no camera until start,
one audio-off synthetic stream, advancing blank results, complete cleanup, no SDK
error callbacks. Candidate `b87922de3e9c`; evidence `prepare-fallback-*` and frozen
manifest. Four normal native prepare/portrait/concurrent/cancel cases also pass.
No speedup, physical/recognized-fit or publication claim; acceptance
gates remain open.

**15 October geometry activation:** changed camera shape now receives same-worker
blank face/optional warmup before live dispatch, bounded by startup waits and
reported as preparation.activationWarmupMs inside start-to-ready. Protocol **8**
requires this handshake; invalid/repeated/post-live warmup requests fail. 304 SDK
tests, workspace build/typecheck, seven fitted/loading browser and four actual
native preparation cases pass. Portrait sample: 140.3 ms activation, 274.9 ms
start-to-ready, one worker/stream, audio false, advancing blank results and cleanup.
Candidate `96bd701bde40`; evidence `docs/evidence/prepare-geometry-*` and frozen
manifest. Synthetic desktop portrait is not physical-device/recognized-fit/live
hair-mask qualification. No speedup or publication claimed; device/SKU/shopper
acceptance remains open.

**15 October public preparation implementation:** typed `prepare()` explicitly
warms assets/one tracker without camera access; shared calls and concurrent start
reuse one worker/init. Explicit start alone acquires media. Stop/page hide/dispose
cancel and release; asset revision/feature eligibility guard reuse. Readiness
`prepared` coexists with idle status; separate preparation timing discloses moved
work. 300 SDK tests, SDK build, full workspace typecheck, seven fitted/loading cases
and three public-API native prepare/concurrent/cancel browser cases pass. Native
starts use one worker/stream, audio false, advancing blank results and cleanup;
cancel uses no camera. Candidate `bcd003660b61`; evidence `public-prepare-*` and
frozen manifest. One sample: 11,452.3 ms preparation, then 79.9 ms start-to-ready;
no matched speedup/recognized-fit/device claim. README and reference stage copy
updated; initial missing-stage typecheck was corrected. Physical/portrait/first
hair-mask and shopper/SKU gates remain. No npm publication. Earlier proposed-only
preparation notes below are historical and superseded by this update.

**15 October connection handoff:** internal `TrackerConnection` now sends init once,
routes worker/decode errors and supports guarded callback handoff without a second
worker or packet queue. Normal SDK startup/recovery uses it. 291 SDK tests, SDK
build, workspace typecheck and six fitted/loading SDK browser cases pass. Actual
native-worker/controller proof passes handoff, loading cancel and prepared dispose:
one owned/released worker per case, zero camera calls, 36.3 ms first blank face
completion after handoff. Candidate `6e75f2da0b5a`; evidence
`docs/evidence/tracker-connection-*` and frozen manifest. This is not public session
preparation or physical acceptance. Next integrate session state, camera attachment
and concurrent prepare/start/cancellation before exporting `prepare()`. No publish.

**15 October startup controller:** `TrackerStartup` now owns readiness, protocol
validation, total/once-per-optional-stage deadlines and settlement cleanup.
Worker release/replacement cancels its owned wait; session-global ready resolvers
and raw initialization timers are removed. 288 SDK tests, SDK build, full workspace
typecheck, six fitted/loading browser cases and four native startup runs pass
with native cleanup and zero errors/restarts. Candidate `4dcd79095a62`; evidence:
`docs/evidence/tracker-startup-*` and frozen manifest. Optional fallback/live recovery
policy and active message loop remain session-owned. Public preparation remains
unimplemented; next separate initialization and callback handoff from camera
acquisition. No speedup, physical acceptance or npm publication claimed.

**15 October worker ownership implementation:** internal `TrackerWorkerOwner`
now owns construction/replacement/release for session startup, stop, failure,
optional fallback and recovery. Callbacks detach before termination; obsolete
release cannot kill a replacement. 284 SDK tests, SDK build and post-build full
workspace typecheck pass. Six synthetic public-SDK cases and four actual native
startup runs pass, with cleanup and zero native restarts. Candidate `a0032cf57f19`;
evidence `docs/evidence/worker-ownership-*`, frozen manifest and
[sprint progress](docs/SHOPPER_SPRINT_PROGRESS.md). Initial concurrent typecheck
hit declaration regeneration; sequential rerun passes. Public preparation remains
unimplemented: next extract readiness/deadline/recovery policy behind ownership.
No performance/device acceptance or npm publication claimed.

**15 October preparation lifecycle:** proposed contract is documented in
[camera-free preparation](docs/CAMERA_FREE_PREPARATION.md). Actual built-worker
proof passes three camera-free prepare/activate/cancel/dispose cases, zero camera
calls and terminated owned workers. First ready 16,901.1 ms; following blank face
completion 66.0 ms; later prepared disposal ready 1,518.6 ms. Cache histories differ;
no speedup, first hair-mask, recognized-fit or device qualification. Evidence:
`docs/evidence/camera-free-preparation.json` / `.txt`. No exported `prepare()` yet.
Next extract a single session-owned initialization/recovery controller, then test
concurrent preparation/start, callback reentrancy, failure and cancellation before
public integration. No production behavior or package publication changed.

**15 October warmup-size decision:** source-level hair experiment passes eight
initializations and 24 subsequent normal-size synthetic inferences across two
reversed-order browsers. First-in-browser warmup is 4,764.1 ms at 640×360 and
4,969.1 ms at 256×256; later either-size warmups are 384.5–445.7 ms. No size-based
speedup established; retain production dimensions. Evidence, source/bundle hashes
and reproduction: `docs/evidence/hair-warmup-experiment.json` and
[sprint progress](docs/SHOPPER_SPRINT_PROGRESS.md). No production change or device
acceptance. Next evaluate explicit camera-free preparation with cancellation and
consent semantics; compilation remains outside live fitted-frame work.

**15 October hair-phase continuation:** additive local hair creation/warmup diagnostics
identify 504.5 ms creation versus 9,078.4 ms blank inference warmup in one
11,161.8 ms default-policy attempt. Four actual-worker synthetic browser runs pass,
with clean shutdown and zero SDK errors/restarts. 282 SDK tests, SDK build and
workspace typecheck pass. Candidate `7e443207d837`; evidence and initial assertion
correction: [sprint progress](docs/SHOPPER_SPRINT_PROGRESS.md), `shopper-hair-phases-*`
in `docs/evidence`. No scheduling change, speedup or device acceptance claimed.
Next investigate warmup cost with matched runs; prefetch alone cannot remove this
measured first-inference delay.

**15 October execution update:** phase profiling identifies 4,342.0 ms resource
preparation and 3,714.2 ms first-inference warmup within an 8,533.3 ms initial cold
face-only sample. A later resolved-default run spends 5,230.3 ms on optional hair
preparation within 6,180.1 ms overall. Cache/network/GPU conditions differ; these
samples do not demonstrate a speedup or close p95/phone/recognized-fit budgets.
Raw phases and scopes: `docs/evidence/shopper-worker-profile*.json` / `.txt`.

Repeated final-candidate desktop cohort: **9/9 pass**, zero SDK errors/restarts and
complete synthetic stream/worker cleanup. Three cleared-runtime-cache face-only
attempts: median 1,914.3 ms, sample p95 7,042.4 ms; five retained-cache attempts:
median 1,262.2 ms, sample p95 1,317.8 ms. One resolved-default attempt: 12,319.1 ms,
including 10,702.0 ms optional graph work. Next investigate optional initialization.
Evidence/reproduction: `docs/evidence/shopper-startup-cohort.json` / `.txt` and
`scripts/browser-shopper-native-startup.js` at `/?cohort=1`. Quantiles describe these
successful samples only; cache clears do not reset GPU/shader caches or control
network. No first-fit, population p95, device acceptance or speedup is established.

Readiness stages, typed timeout reasons, bounded playback/asset/tracker waits,
owned abortable GLB fetches, late-parse disposal and explicit retry are implemented.
Vanilla shows actionable loading/error copy, supports retry without reload and
does not repeatedly announce unchanged guidance. Camera permission remains
untimed. External referenced texture parsing lacks abort support; embedded GLBs
are recommended and late scene installation is prevented.

Final SDK candidate `e18a506cf45d`: **281 SDK tests** pass; **108 generator tests**
and offline cache policy passed separately. Full workspace build/typecheck pass
(existing Three.js chunk warnings remain). Six synthetic public-SDK loading/GPU
cases, generated-GLB compatibility/shaders, and UI retry/cancel/mobile-width checks
pass; screenshots contain only synthetic video. Evidence: `shopper-loading-*` in
`docs/evidence`, frozen final manifest, and [sprint progress](docs/SHOPPER_SPRINT_PROGRESS.md).
The initial fixed-delay GPU/cancellation fixture failures and corrections are
documented there. Physical phones, observed shoppers, licensed SKU and standardized
repeated acceptance cohorts remain open; M15/M16 are not fully accepted. No npm
publication occurred.

**M15 execution started — 14 October:** workspace build and typecheck exit 0;
local SDK baseline `7f7f707130a9` frozen immediately after build. Manifest:
`docs/evidence/smoothness-shopper-sprint-manifest.json`; bundled GLB hashes:
`docs/evidence/shopper-sprint-assets.json`. Logs: `shopper-sprint-build.txt` and
`shopper-sprint-typecheck.txt` in `docs/evidence`. Initial restricted build could
not launch (exit -4048); approved retry passed. No core runtime behavior changed.
Added a camera-free single-attempt startup timing utility with passing Node
synthetic assertions for constructor costs, camera pending, reset, invalid marks
and readiness prerequisites. Browser timing integration/cold-warm runs remain
open. See [sprint progress](docs/SHOPPER_SPRINT_PROGRESS.md) for drafted recovery,
observation and reference-flow contracts. Physical phones, shopper observations,
licensed supplier SKU and budget ratification are not accepted. No publication.

**M15 browser continuation — 14 October:** four public-SDK synthetic Chromium
cases pass: initial/repeated GLB startup with actual rendered eyewear pixels,
explicitly blocked asset cancellation and 404 asset cleanup. Each uses one local
synthetic stream with audio disabled; all tracks/workers/host elements clean up.
Evidence: `docs/evidence/shopper-browser-startup.json` / `.txt`.
Recognition is mocked and optional hair/compositing disabled; no cold/warm actual
MediaPipe, default-feature, real camera, p95 or device qualification is claimed.
Asset/tracker timestamps are public-start completion upper bounds. The 404 case
exposes duplicate `onError` notifications from initial asset rejection and startup
failure; record this as an open recovery-contract defect. Browser/server sandbox
launch failures were followed by approved successful retries. `git diff --check`
passes. Core runtime behavior remains unchanged.

**M15 recovery defect fixed — 14 October:** active startup now owns reporting an
initial asset rejection; idle load failures still notify and disposed consumers
receive no late notification. Separate failed retries each report once. Three
new lifecycle regressions pass; SDK suite **265/265**, SDK build and workspace
typecheck exit 0. Four synthetic browser cases pass with exactly one missing-GLB
error callback and complete cleanup. Evidence: `docs/evidence/shopper-error-*.txt`
and `shopper-error-browser.json`; frozen candidate `3157024f16e2` in
`smoothness-shopper-error-fix-manifest.json`. Previous duplicate-error evidence
remains historical. No actual MediaPipe cold/warm or physical-device acceptance,
new public API or publication is claimed.

**M15 startup instrumentation — 14 October:** additive typed opt-in
`TrackingHealth.startup` reports camera pending, post-playback asset wait, initial
tracker readiness and first fresh fitted CPU submission; null unreached fields
reset on stop/dispose. No raw history or face measurements; constructor loading,
GPU completion and physical first-usable latency remain separate. SDK build,
workspace typecheck and **269/269 SDK tests** pass. Four synthetic fitted-browser
cases pass on final frozen SDK `2f6e6b49b42e`. Actual MediaPipe face/GPU smoke on
`9cded6ada2cf`: one cleared-cache startup 7,585.9 ms, two retained-cache startups
664.9/763.8 ms (constructor-to-tracker); each 15 blank-frame results, zero restarts,
one synthetic stream, complete cleanup and null first-fit submission. Evidence:
`docs/evidence/shopper-timing-*.txt`, `shopper-timing-browser.json`,
`shopper-native-startup.json` / `.txt` and its build manifest. This is three
unthrottled desktop initialization samples with optional effects off, not p95,
recognized-face first fit, current-default/network budgets or phone acceptance.
S02 remains partial; no publication or real-person recording.

**Planning update — 14 October:** repository/public API/reference-flow and existing
evidence reviewed; shopper-first roadmap, sequenced tickets and proposed success
criteria created. The current device checklist is reconciled with implemented
defaults. This update changes documentation only. No new runtime feature, build,
test, camera session, physical-device result or npm publication is claimed.

Documentation validation: 41 local Markdown links resolve, no trailing whitespace
in the five touched documents, and `git diff --check` exits 0. The existing
14 October registry-confirmation note is preserved. Independent roadmap review
checked ordering, contract ownership, privacy and evidence boundaries; startup
clock definitions and full-category network inspection were clarified.

| Milestone | Status / dependency | Acceptance to close |
|---|---|---|
| M15 — Baseline and shopper discovery | In progress; profiling and synthetic/native evidence captured | Freeze build/worker/assets/defaults, define cold/warm and first-usable timing, observe 6–8 shoppers, baseline physical targets, rank friction and ratify budgets. |
| M16 — Fast start and helpful recovery | In progress; readiness/deadlines/retry implemented, qualification open | Small additive readiness/reason contracts, bounded cancellable resources, camera-free preparation if justified, permission/asset/model/WebGL recovery and correct teardown. |
| M17 — Trustworthy fit on phones | Planned; starts with M15, closes on candidate build | Qualify current defaults, one licensed calibrated SKU, synthetic alignment/occlusion regressions and recognized-face physical iOS/Android/desktop review. |
| M18 — Browse and compare | Planned; M16 + M17 assets/budgets | Responsive latest-choice swaps, bounded preloading, live two-choice comparison and session product-ID shortlist in host/reference flow; localized accessible operation. |
| M19 — Pilot and release qualification | Planned; M16–M18 | Repeat shopper pilot, every advertised device row accepted, clean packaged host integration, privacy/lifecycle/thermal checks and license/known-limit evidence. Publication remains separately authorized. |

- [x] Shopper audience confirmed; roadmap and first-iteration tickets saved.
- [x] Current-default device instructions corrected; earlier results remain dated.
- [ ] M15 baseline, shopper observations and timing budgets accepted.
- [ ] M16–M18 runtime/host improvements implemented and qualified.
- [ ] M19 pilot and release gates completed for the frozen candidate.

Proposed software-controlled warm first usable overlay p95 ≤3 s, cold ≤8 s on a controlled network,
prepared frame switch p95 ≤500 ms, and software capture-to-submission p95 ≤150 ms
are planning targets. Definitions/sample requirements are in the roadmap; they
include constructor/preparation history, report total wall time and camera API
pending time separately, and are not measured results or supported-device promises. Re-estimate nominal
two-week iterations after M15. Physical phone access, shopper participation and a
licensed supplier SKU are external dependencies; those gates remain open while
independent contract/synthetic work proceeds.

The roadmap is authoritative for next priorities. Existing feature plans remain
implementation/evidence references; their historical default assumptions do not
override the current SDK options or reconciled device checklist.

### M14 — npm package page documentation

- [x] Inspect the live npm page and public registry metadata.
- [x] Replace the SDK's local-release stub with installation, complete camera quick start, asset generation/calibration, typed API, options, self-hosting, troubleshooting, privacy and CPAL attribution guidance.
- [x] Prepare SDK version0.1.1 with package-specific homepage and discovery keywords.
- [x] Workspace typecheck and SDK prepack/build/publish dry-run pass (exit0).
- [ ] Publish version0.1.1 after explicit owner authorization and verify the live README.

**Later registry confirmation — 14 October:** public npm metadata now reports
vito-sdk latest0.1.1, README heading “Vito SDK”, and no “not yet published”
sentence. Publication was performed outside this agent turn. The registry has
the corrected README; npm frontend cache/version selection was not verified
in this confirmation. Do not republish the existing0.1.1 version.

14 October observation: registry latest is0.1.0 for both vito-sdk and
vito-asset-generator. The SDK registry README still said “not yet published”.
The npm browser page showed0.0.0-stage / “Temporary Holding Version” even
after reload. This registry/frontend discrepancy is recorded without assuming
its cause or claiming stage approval is complete. Evidence:
`docs/evidence/npm-page-audit.json`.

Prepared README is included in the0.1.1 dry-run tarball (11.7kB;46files,
289.6kB compressed). Logs: `docs/evidence/npm-page-sdk-dry-run.txt` and
`docs/evidence/npm-page-typecheck.txt`. No runtime algorithms changed, local
test suite or camera/device check ran, or npm publication was performed by
the agent in this update. npm updates its displayed README on a new version
publication: https://docs.npmjs.com/about-package-readme-files/.
For the displayed staging placeholder, see
https://docs.npmjs.com/staged-publishing/; publishing/approval remains an owner action.

### M13 — Public repository / pnpm package preparation

- [x] Package metadata/readmes, fresh prepack builds, typed ESM exports.
- [x] SDK worker/declarations and dependency licenses in distribution; generator notices.
- [x] CI check/pack artifact workflow, contributing/security guidance and ignores.
- [x] Two tarballs packed and installed via pnpm; public imports pass.
- [x] Owner-approved CPAL-1.0 / Dhafin Julda Riyanto attribution and repository URL.
- [x] Public repository created: https://github.com/dhafinjulda/vito.
- [x] Initial source pushed to main and confirmed: `76684a19ec7cd064694535ed9e3ae6894742c210`.
- [x] Publisher account: dhafin-julda; owner selected unscoped vito-sdk / vito-asset-generator.
- [ ] Explicitly authorized npm registry publication.

See [PUBLIC_RELEASE_PLAN.md](docs/PUBLIC_RELEASE_PLAN.md). Packages remain
CPAL-1.0 package metadata adopted on 14 October; owner selected unscoped
vito-sdk / vito-asset-generator with publisher account dhafin-julda. Packages are publishable (private:false);
root/examples stay private. Actual npm publication requires explicit request. Initial push
is complete; personal portrait/env/build artifacts are excluded.

14 October release checks: workspace build/typecheck exited0; both fresh pnpm
tarballs packed with CPAL LICENSE/NOTICE, SDK worker and public declaration type
dependencies. Logs: `docs/evidence/github-public-*.txt`. First restricted pnpm
attempt hit sandbox EPERM; approved retry succeeded. No npm publication or new
real-camera/device acceptance. GitHub CI will verify the pushed source separately.

Initial Git push rejected missing OAuth workflow scope. GitHub integration created
the CI workflow successfully; its commit was merged before the source push.
First source CI run `38526219434` failed at build on clean Ubuntu: root asset
scripts imported Three.js without a root dependency (Windows had an incidental
local symlink). Added pinned root devDependency and refreshed lockfile. CI result
for the correction remains pending; no false remote acceptance is claimed.

**Remote acceptance — 14 October:** source commit
`b37e102ee382c301a78d206ba4f15022a6e5de54` passed Ubuntu CI run
`38526776394`: frozen install, build, all workspace typechecks, tests, two
package builds and uploaded tarball artifact. A second clean-checkout issue
required direct @types/three devDependencies in both examples; fixed before
this successful run. Evidence: `docs/evidence/github-public-ci.json`.
Working source is public under approved CPAL-1.0. npm was unpublished at that checkpoint (later registry observation is in M14);
real-camera/device/SKU qualification is separate from CI.

**npm account scope — 14 October:** owner supplied `npm whoami: dhafin-julda`.
Renamed SDK/generator to `@dhafin-julda/sdk` and
`@dhafin-julda/asset-generator`, updated workspace dependencies/imports/filters,
lockfile and current readmes. Vito branding and CPAL are preserved. Both packages
are private:false with public publishConfig; root/examples remain private.
Workspace install/build/typecheck and both npm publish **dry-runs** exited0
(`docs/evidence/npm-scope-*.txt`); no actual npm publication occurred. No local
test suite or new live-camera/device check was run for this namespace change.

**Unscoped package names — 14 October (supersedes the scoped choice):** owner
requested **vito-sdk** and **vito-asset-generator**. Both anonymous public npm
lookups returned404; this does not reserve names. Updated manifests, workspace
dependencies/imports, pnpm filters, lockfile and current README/package guides.
Vito brand, CPAL and version0.1.0 are unchanged. Frozen install, build/typecheck
and both npm publish **dry-runs** exited0 (`docs/evidence/npm-unscoped-*.txt`).
No actual npm publication or new local test/camera/device acceptance.

Owner requires Vito brand retention and requested @vito/sdk / @vito/asset-generator.
13 October anonymous registry checks returned404 for both packages; @vito scope
ownership could not be verified (user endpoint401 / npm website403); owner has
confirmed they do not yet own it. Owner chose a small visible Vito camera mark
at bottom-right. SDK-managed local wordmark implemented with explicit camera
lifecycle visibility and disposal; no disable option, no remote asset or camera
frame modification. Branding alone is not tamper-proof or a final license. No project
MIT/Apache license was assigned and workspace names were not changed prematurely.

Vito wordmark check: SDK build and all-workspace typecheck exited0; logs
`docs/evidence/vito-brandmark-build.txt` / `vito-brandmark-typecheck.txt`.
Desktop/mobile visual inspection used a plain background without camera access
(`vito-wordmark-desktop.png`, `vito-wordmark-mobile.png`). No test suite or new
live-camera/device acceptance was run for this branding change. Original 370
test result is M12 evidence, not a rerun of the modified SDK.

### M12 — Description to SDK-ready glasses

User requested the shortest generation flow and assets usable in the SDK. See
[ASSET_GENERATION_PLAN.md](docs/ASSET_GENERATION_PLAN.md).

- [x] Local description parsing and optional validated/cancellable interpreter.
- [x] Correct semantic geometry, connected front/temples/pad supports, dimensional/structural report; 48 connectivity combinations.
- [x] Embedded fit metadata and single-GLB SDK integration with explicit overrides.
- [x] Single-action Asset Studio, local preview/try-on, export and advanced controls.
- [x] Build/typecheck/tests, GLB round-trip/SDK GPU and desktop/mobile flow checks.
- [ ] Physical SKU and real-camera/device qualification.

**Evidence:** 370 tests (262 SDK + 108 generator), offline policy, actual browser
GLB/SDK GPU checks and Studio flow pass. Generated URL matches explicit fit
(6,644 pixels / 176 px width); second asset renders at 206 px. Studio checks
three examples, invalid/cancelled/latest-wins drafts, three downloadable files,
one synthetic camera acquisition, 12/12 advancing tracking samples and cleanup.
No page errors/write requests or horizontal overflow at 1360/390 px. CSP blob
loading and a zero-height camera overlay found during testing were fixed; failed
evidence is retained. See M12 plan for actual command logs and remaining scope.
No npm publication or real-person recording. LLM callback/provider integration
is available; a hosted LLM endpoint is not shipped.

### M11 — Ten-finger contact and two-hand manipulation

User requested two-hand/finger manipulation and transferring glasses between
hands. See [TWO_HAND_INTERACTION_PLAN.md](docs/TWO_HAND_INTERACTION_PLAN.md).

- [x] Grasp using any thumb/finger pair on either hand, actual GLB contact gates.
- [x] Stable transient identity, two-hand rigid hold and no-jump handoff.
- [x] Two-hand depth occlusion and independent cleanup.
- [x] Public state and Vanilla instructions for the expanded opt-in controller.
- [x] Build/typecheck exit 0, **239 tests (233 SDK + 6 generator)**,
  eight public thumb/finger cases, zero-jump join/handoff, both GPU masks,
  face-loss carry/remount/cleanup and **64/64 visibility cases** pass.
- [x] Actual native models on blank stream: **200 completions / 59 hand packets
  / 0 restarts**, native resize/one-camera/cleanup/privacy checks pass. Startup
  19,472.2 ms; native recognition/real gesture accuracy is not accepted by this.
- [ ] Live gesture/depth/occlusion and mobile qualification.

SDK `26ff1f6c86d8`, 125.58 kB / 36.16 kB gzip, same worker/protocol 7.
Hand contact is monocular approximation; no anatomical segmentation, physical
forces/gravity/folding claim. Failed initial observation/readback fixtures are
retained in the M11 plan. No personal recordings/uploads or npm publication.

### M10 — Tracking and interaction continuity

User requested further improvement and execution on 13 October. See
[CONTINUITY_IMPROVEMENT_PLAN.md](docs/CONTINUITY_IMPROVEMENT_PLAN.md).

- [x] Capture geometry revisions and stale face/hand/hair rejection on camera resize.
- [x] Sustained optional hand budget, face priority, and local fallback diagnostics.
- [x] Angular prediction consistency and age/cadence regression coverage.
- [x] Latest-asset startup readiness and restart after a failed replacement;
  generation-safe permission cancellation and abortable asset wait.
- [x] Live reference-unit changes update temple/hair uniforms, clear old mask,
  preserve shader programs and match initial calibration pixels.
- [x] Final build/typecheck exit 0, **188 tests (182 SDK + 6 generator)**;
  64/64 visibility cases, public resize/fallback/asset checks, default/GPU/UI
  checks. Native blank stream: **213 completions, 74 hand packets, 0 restarts**,
  one camera acquisition; native portrait/landscape resize and cleanup pass.
- [ ] User camera/mobile and calibrated SKU qualification (separate device gate).

Final SDK `fe73cca3afb7`, worker `face-worker-CZkKssiX.js`/protocol 7,
111.89 kB / 32.46 kB gzip. Failed initial assertions and GPU fixture diagnostic
are recorded in the M10 plan. Native input is synthetic and blank; recognition,
physical grasp/hair accuracy, mobile thermal behavior and supplier fit remain
unverified. No camera-derived data recorded, no npm publication.

### M9 — Default feature readiness

User authorized maturation of experimental features on 13 October. See
[DEFAULT_FEATURES_PLAN.md](docs/DEFAULT_FEATURES_PLAN.md) for default policies,
startup/fallback/recognition guards, acceptance and progress.

- [x] Default `presentation: auto`, guarded media-clock prediction/direct fallback.
- [x] Default adaptive quality with actual 2D eye-support protection: 640 for
  unknown/small/profile/lost face; pressure-based 480 for sufficient support;
  independent DPR hysteresis.
- [x] Default camera/lens compositing with original-material/DOM fallback on
  shader/draw/upload/budget failure. Captures upload exceptions that Three.js
  otherwise swallows, without GPU readback. Owned callbacks/textures disposed.
- [x] Default auto hair gated by semantic asset/device/GPU; confidence buffers
  bounded/cleared, stable-head temporal blending, actual-unit coordinates,
  absent-face/held/crown inference skip and sustained-cost fallback.
- [x] Opted-in hand model and eligible hair prewarm before live dispatch;
  matched ImageBitmap format/shape warmup and startup material compilation.
  Bounded optional startup failure retries face-only CPU; recovery suppresses
  optional tasks for the remainder of the session. Hands still require opt-in.
- [x] Aligned and cancelled remounts settle over 200 ms, preserving current
  head-relative target. Repeated material toggles no longer invalidate shaders.
- [x] Vanilla normal `/` uses public defaults; disable/calibration controls and
  local feature/fallback diagnostics replace the experiment entry flow.
- [x] Final workspace build/typecheck: exit 0. **151 tests (145 SDK + 6 generator)**,
  offline policy, three GLBs, **64 public visibility cases**, GPU/default-path
  fault injection, profile/small-face resolution and native startup/recovery pass.
- [x] Frozen final native soak **600,470.2 ms / 16,443 completion / 0 restarts**;
  10 advancing checkpoints, stopped tracks/terminated worker/removed elements.
  Actual native models with blank canvas input; no recognition/device claim.
- [ ] Live camera, iOS/Android, actual hair/contact/optics, cold network/resource
  variability and calibrated supplier SKU release qualification. Guarded defaults
  are implemented; universal real-device or physical fit acceptance is not claimed.

Final SDK `c20b88e840d8`, protocol 7, worker `face-worker-D_-InCxR.js` 178.47 kB,
SDK 107.04 kB / 31.24 kB gzip. Failed initial upload-injection/soak runs and their
fixes are retained in the M9 plan. All camera-derived data is transient/local.
No npm publication. Calibration remains explicit; no anatomical ear segmentation,
calibrated physical hand depth, collision/folding/two-handed or PnP claim.

### M8 — Premium fitting improvements, 13 October

User authorized planning and execution. The detailed decisions, acceptance and
evidence are in [`docs/PREMIUM_FITTING_PLAN.md`](docs/PREMIUM_FITTING_PLAN.md).

- [x] P1: unique decoded frame dispatch, frozen-picture expiry and resume,
  rVFC backup gated by actual decoded counts, media-clock prediction velocity.
  A playing clock alone no longer sends duplicate frozen pictures.
- [x] P2: typed source intrinsics, calibrated cover projection/contact/mask,
  transient outer-eye reference, public reference-calibration helper, explicit
  GLB front-width physical scale. Invalid parameters/crops rejected.
- [x] P3: optional local VideoTexture compositing and semantic lens transmission,
  physical thickness conversion, cover/mirror alignment, preview fallback and
  owned texture/context teardown. Fixed first-frame transparent upload.
- [x] P4: optional Hair ImageSegmenter in existing worker/bitmap after face and
  optional hand initialization. Confidence output bounded/transferred locally;
  rear semantic part mask has age/motion/ownership/loss guards. Model license
  and 781,618-byte/hash provenance recorded; no weights vendored/persisted.
- [x] P5: distance/orientation eligibility and 200 ms settling following the
  current face/head mount. Invalid releases retain original-mount cancellation;
  no free-body/folding or anatomical hand-depth claim.
- [x] P6 implementation checks: four-workspace build/typecheck, **139 tests
  (133 SDK + 6 generator)**, offline policy and three GLB validation pass.
  **48/48** public SDK visibility cases; native continuity/recovery; GPU colour,
  transmission, cover, rear-mask/expiry/held, three actual GLB shader checks;
  calibrated camera projection and prediction/mask/contact coherence pass.
  Actual Face/Hand/Hair combined inference + camera compositing on synthetic
  blank input passes with no restarts, HTTP writes/body, track/element leaks.
  Vanilla configuration/recreation requires no camera and uses public APIs.
- [ ] Release qualification: user camera, iOS/Android, live hair/contact/optics,
  calibrated supplier SKU, anatomical ears, distortion/PnP and M8 long-duration
  performance remain unverified. Previous M7 soak is historical.

Candidate website:
`http://127.0.0.1:5173/?compositing=1&hairOcclusion=1&presentation=predicted&adaptiveQuality=1`.
Defaults remain direct/no adaptive/no hair/no compositing/no hands. Frame,
landmark, mask and calibration values remain transient on-device. No npm publish.
Final entry hash `8458afc74cbd`, SDK 98.38 kB / 29.08 kB gzip,
worker `face-worker-DepdZ35-.js` 176.83 kB/protocol 6. Three.js >500 kB chunk
warnings remain. Failed intermediate harness runs and fixes are documented in
the linked plan, with retained initial failure evidence.

### Original milestone acceptance

| Milestone | Deliverables | Acceptance criteria | Status |
|---|---|---|---|
| M0 — SDK foundation | Workspace, public typed API, explicit camera lifecycle, worker face tracking, Three.js GLB render path, Vanilla JS consumer | Build/typecheck/tests pass; camera start requires user action and audio is off; stop/dispose release camera and worker; one face pose drives a loaded GLB; example uses only public SDK API; no face data leaves device | Code and automated checks pass; camera/tracking/device acceptance open |
| M1 — Tracking and fitting validation | Coordinate fixtures, 3D pose and temporal smoothing/face-loss behavior, worker watchdog/recovery/backpressure hardening, camera capability/error matrix | Eye/bridge alignment and cover crop verified against fixtures and real subjects; yaw/pitch/roll follow head pose; distance/scale regression verified; stale sessions rejected; tracking results stay within age budget; no resource leak across 20 start/stop or asset swaps | Matrix validation, seven-span depth consensus, crop-correct perspective, independent speed-adaptive position/rotation filters, coherent rigid mask correction, source-pixel thresholds, mocked 20-camera-cycle checks, 3-second result watchdog, and up to two local worker restarts per session implemented. GPU resource soak and synthetic moving-render checks have evidence. Live subjects and device validation remain open |
| M2 — Catalog and glasses | Versioned SKU manifest, asset validation, five calibrated GLBs, asset race/cache management, basic occlusion and local capture | Five assets pass schema/GLB/license/budget checks; three-pose and cross-subject review; capture matches live crop/mirror and no upload | Dense face plus approximate head/ear occlusion, two original PBR demo GLBs, and one bundled Poly Haven CC0 PBR test model. All three pass GLB/metadata/fit validation; the CC0 model renders in three synthetic poses and participates in the asset-swap soak. Full retail SKU catalog, product review and local capture remain unimplemented |
| M3 — Browser delivery hardening | Optional offline-capable consumer, explicit cache/update strategy, diagnostics without face data, deployment security headers and regression automation | Built shell and glasses assets precache; only pinned MediaPipe resources may enter runtime cache; stale cache replacement verified; security headers applied; network inspection shows zero face-data requests | Shell/runtime allowlist, content-derived cache version, one-release-old chunk fallback, static-host headers and Vite dev/preview headers implemented. Production Chromium verified service-worker control, an online synthetic MediaPipe run, an offline shell reload and offline worker/model initialization. Active-camera network capture remains unverified |
| M4 — Pilot readiness | Real-device matrix, soak, support policy, release evidence and rollback | Target devices complete camera/performance/privacy acceptance; no P0 bugs; release evidence documented; explicit release authorization | Automated qualification and manual acceptance procedure documented; device and release gates open |
| M5 — Optional asset authoring | Framework-free asset-generator module and Asset Studio example | Recipe validation rejects inconsistent inputs; three parameterized templates produce inspectable geometry and valid GLB; local camera preview uses public SDK and updates when recipe changes; export metadata preserves draft status and measurement sources; no recipe or camera-derived data is uploaded | Generator tests/build pass. Studio recipe/preview/export and opt-in SDK camera code implemented. Browser-tested GLB export and wizard; camera permission flow intentionally not exercised in this pass. Worker-backed geometry generation, project library/import, packaged export bundle/thumbnail and usability/device acceptance remain open |
| M7 — Smooth motion and runtime budgets | Baseline timing, temporal presentation, time-based grip filtering, face-priority scheduling, adaptive quality and resource optimization | Matched synthetic/live A/B proves smoother motion within stated latency bounds; coherent asset/masks/contact, actual SDK-worker continuity/recovery, privacy/lifecycle and target-device gates remain passing | Implementation in progress 13 Oct 2026: bounded metrics, frozen build harness, optional interpolation and time-based grip implemented. Cold hand initialization exposed a watchdog restart; bounded initialization handling added. Final qualification and live/device acceptance remain open. |

### M5 implementation and acceptance record

- [x] Created optional `@vto/asset-generator` with typed recipe validation, round/rectangle/cat-eye templates, dimensional metadata, semantic part names, and GLB export.
- [x] Created Asset Studio wizard with dimension source attribution, template/material/temple controls, interactive Three.js preview, local IndexedDB draft, and independent GLB/JSON downloads.
- [x] Connected the Studio's explicit camera button to `createVirtualTryOn()` from `@vto/sdk`; it prepares a local GLB draft first, starts capture only from the click, uses the generated fit descriptor, updates the current session on valid recipe changes, and stops/releases through the SDK lifecycle. Camera remains opt-in.
- [x] Verified invalid dimensional combinations are rejected; all three templates build geometry; exported GLB is binary glTF 2.0 with recipe/fidelity metadata; browser preview initializes WebGL2; wizard navigation and IndexedDB draft path run; console had zero errors/warnings. Evidence: `docs/evidence/asset-studio-browser-smoke.json`.
- [ ] Exercise the explicit Studio camera start/stop and recipe-swap path on the user's browser/device. Not requested or run as part of the non-camera browser smoke; do not count source wiring as live camera acceptance.
- [ ] Improve authoring beyond a single locally saved draft: worker-based model generation, multiple draft projects, import/version migration, bundle export with preview image, and accessibility/usability review.

## M6 — Experimental hand manipulation

Acceptance: pinch at the actual frame acquires without jumping; translation/rotation follow the hand independently of head motion; the object remains held through palm-induced face loss; release near current face/crown remounts; ordinary/remote gestures do not grab; fingers can occlude the frame; one bitmap remains in flight; no camera-derived data upload/persistence. Live gesture accuracy and anatomical/depth acceptance remain required. The earlier bounded lift prototype and single-slow-inference disable policy are superseded below.

- [x] Implemented opt-in typed SDK options, transient availability/phase/placement/progress callback and public `setPlacement('face' | 'head')`.
- [x] Replaced the nose-area/vertical rail with GLB ray/proximity contact and a rigid hand grip: 80 ms dwell, 0.45/0.70 palm-normalized pinch thresholds, contact offset preservation, palm-driven rotation, free movement and constant object scale. Releasing near face/crown remounts; releasing elsewhere returns to prior mount. A hand can carry eyewear while the face is absent; hand loss after 450 ms cancels. Hand depth uses acquisition depth plus palm-size change and remains an estimate.
- [x] Two-hand detection with one acquired handedness controlling the object; short face obstruction during acquisition tolerated; availability, hand-visible and feedback callbacks added. Stop/recovery/asset selection resets interaction. Arbitrary gestures, two-handed manipulation and physical collisions are not implemented.
- [x] Split face/hand/completion packets: face results post before hand inference; `frame-done` closes the bitmap and frees backpressure. Hand cadence adapts 50–250 ms; one slow inference no longer disables hands. Face capture-age budget is now 1,000 ms and mounted-pose silence expiry 750 ms; hands retain 450 ms; whole-frame watchdog 3 seconds. Face starts first; hand initialization waits for the first visible fit and a render opportunity, with optional async creation bounded to 8 seconds, GPU/CPU fallback and synthetic warmup. Actual hand errors preserve face/buttons.
- [x] Added depth-only instanced finger joints/bones and palm geometry anchored to grip depth. Masks remain in camera/head coordinates independently of the held frame, and sample data is cleared on release/stop. Temple fading/bending is suspended while held so ear hooks stay intact. Finger volumes are approximations, not segmentation.
- [x] Earlier free-grip verification: workspace build/typecheck and 85 tests passed at that iteration. Both demo GLBs passed free grip GPU checks at 30/100 cm: acquisition with no jump; lateral motion 4.84–16.00 cm; rotation 0.702 rad; held object survived deliberately absent face; finger masks reduced frame pixels without hiding the entire frame (Contour 3085→2821 / 275→206, Linea 2942→2738 / 265→203). Existing fitting/hook/pitch checks also passed. GPU console errors/warnings 0. Evidence: `docs/evidence/free-hand-grip-gpu.json`. Latest visibility regression results are recorded below. These are synthetic inputs, not real hand acceptance.
- [x] Actual emitted classic worker initialized both models, warmed and inferred a transferred blank bitmap in Chromium; no face/no hand returned, no camera requested, zero uncaught page exceptions. Runtime emitted four native warnings and one `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.` line at console error level. These logs are recorded rather than reported as an empty console. Evidence: `docs/evidence/hand-runtime-browser-smoke.json`, `docs/evidence/hand-placement-gpu.json`.
- [ ] Live qualification: deliberate grab/lift/release/regrab, false grabs with ordinary motion, hand occluding the face, combined head movement, crown alignment, low light, mobile inference cost, stop/restart and failure fallback. No real camera or hand data was used in this iteration.
- [ ] Premium follow-up: actual finger/hair segmentation, calibrated hand depth, SKU-specific crown fit, two-handed manipulation, contact/physics and richer gesture vocabulary. The carried object is free; mounted crown still uses canonical proportions and a 65-degree tilt endpoint.
- [ ] Verify exact hand-model redistribution terms before bundling/self-hosting; remote model is not vendored and is outside the existing face runtime cache allowlist. No npm publication.

## M7 — Next optimization plan

- [x] Prepared [smoothness optimization plan](docs/SMOOTHNESS_OPTIMIZATION_PLAN.md) after reviewing actual SDK tracking/rendering and current evidence.
- [x] O0 implementation: capture/inference/render definitions, bounded diagnostics, frozen build harness and three 60-second repetitions per face/hand configuration. Quiet alternating A/B, physical camera and cold/warm qualification remain open.
- [x] O1 implementation: bounded media-aware sampler, shared masks/mount/contact, opt-in interpolation and separately gated 30 ms prediction. Synthetic/GPU acceptance recorded below; default promotion still requires live/device A/B.
- [x] O2 implementation: time-based grip with reference response preserved, duplicate/reversal/expiry/reset checks. Existing face cutoffs retained; live filter/noise/lag tuning remains open.
- [x] O3 implementation: face-first shared worker, presence-aware hand cadence and optional measured input/DPR policy with hysteresis. Device recognition/rim quality and active-hand budgets remain open.
- [x] O4 implementation: shared rigid mask correction, projection caching and reusable contact scratch/local bounds; counter/microbenchmark evidence below. Whole-pipeline CPU/GPU budget acceptance remains open.
- [ ] O5 qualification: synthetic/actual-worker/GPU/privacy checks and final native 10-minute soak passed. Mobile/live A/B and default promotion remain open.
- Product remains client-side, framework-neutral and SDK-first. No new model/runtime dependency or npm publication. The earlier 94-test/build/live-continuity evidence is historical. Synthetic/native runtime results do not establish camera or mobile acceptance.
- Start with O0 then O1. Proposed targets are explicitly provisional: completed face rate ≥25 Hz desktop / ≥20 Hz mobile, active hand rate ≥10 Hz, capture-to-CPU-submission p95 ≤100/150 ms, and added temporal lag ≤one tracking interval capped at 50 ms. Actual support requires device evidence and visual alignment alongside timing.

### M7 implementation log — 13 October 2026

- Runtime diagnostics report separate capture, inference, fitting, CPU submission, draw/rAF/camera rates over bounded 5-second windows. Native inference durations use the worker clock. No GPU execution or physical sensor/display latency is claimed. Diagnostic buffers are allocated only for a health subscriber.
- Frozen direct build `b6cce7e5f380` is the instrumented control. The earlier `smoothness-pre-instrumentation-manifest.json` freezes dist, but its source hashes were captured after instrumentation edits began; those source hashes are **not** build provenance. The instrumented control was built immediately before its snapshot.
- Public-API runtime harness uses actual hashed workers/models and a blank synthetic stream. It retains duration/count aggregates over the full run (1-second snapshots of 5-second windows), never frames or coordinates. Hand activation is explicit harness behavior because blank input has no visible fit.
- First baseline attempt: three face-only 60-second runs completed, then cold hand initialization triggered CPU recovery and the harness timed out waiting for the replaced worker's hand task. Retained as failed evidence. The retry harness activates the graph after recovery; restarts are recorded, not masked.
- Presentation retains at most three transient samples and reconstructs bridge/face/skull from a common head transform. Repeated media time stops animation; clock reversal/loss/recovery/resize/asset changes clear history. Interpolation remains opt-in (`presentation: 'interpolated'`), adds up to 50 ms delay, never predicts, and failed the moving alignment gate.
- Grip filters use elapsed milliseconds with the former 20 Hz response as reference. Duplicate/reversed timestamps do not advance a grip; expired grip is cancelled before a new update. Face filter cutoffs stay unchanged pending A/B evidence.
- Protocol 5 distinguishes `hand-loading`. Native graph compilation receives one absolute 12-second inference deadline; duplicate loading packets cannot renew it. Ready/unavailable restores the normal 3-second watchdog. Face freshness/750 ms silence expiry are unchanged; cold synchronous compilation may still briefly interrupt results.
- Decision after interpolation A/B: separately implement `presentation: 'predicted'` rather than promote delayed interpolation. This revises the proposed order “prediction after interpolation acceptance”; the modes have independent gates. Prediction maps each accepted result to its captured `video.currentTime` and targets the currently displayed media frame, capped at 30 ms. Missing mapping, old samples, low motion, reversal, observed stop, large relocation/rotation or ownership reset disable extrapolation. No video buffering or filter-cutoff change. Default remains direct, adaptive quality defaults false.
- Baseline `b6cce7e5f380`: face-only 28.11/23.94/23.72 completed packets/s; hand-enabled 22.36/23.22/21.84 packets/s. Candidate `47c2261955e1` (interpolation/adaptive options): 24.05/23.38/23.73 and 22.99/22.89/22.03 packets/s, all six sessions zero restarts. These are **blank-input whole-run completion rates**, including no-face packets, not recognized-face FPS. P95 values in each health snapshot describe overlapping 5-second windows, not pooled full-run percentiles. The runs share one headless browser profile but were sequential, with some concurrent unit/GPU work; no statistically controlled speedup is claimed. Several rates are below the provisional 25 Hz desktop target.
- On the candidate absent-hand path, final windows reported 7.6–8.0 hand packets/s; presence-aware idle cadence is 100 ms. This does **not** establish the ≥10 Hz active-hand target. One pressured run reduced input to 480; small-face recognition after this change is still untested.
- Analytic same-clock sampler A/B (no camera/GPU/SDK filter): interpolation reduced frame steps but worsened p95 alignment error. Separate prediction reduced p95 bridge error by approximately 59% at 20 Hz→60 Hz and 87% at 30 Hz→60 Hz in this sinusoidal fixture. An ideal continuously advancing media clock is assumed; real media clocks advance in steps. Seeded low-motion noise, observed stop/reversal, bounded horizon/media stall and owner resets are covered separately. These figures do not establish live accuracy or stationary noise bounds for arbitrary inputs.
- GPU sampler checks passed on Contour, Linea and CC0 GLBs: mask bridge/head discrepancy under 0.000002 cm in synthetic geometry, asset/contact/mask rotation coherence, repeated-media hold, no extrapolation in interpolation, loss/reacquisition, and predictive owner transfer. All WebGL error codes 0. The 48 public-SDK visibility checks passed in direct/interpolated/predicted modes with hands off/on, 40/250/500 ms result cadence, no-face/reacquisition/750 ms expiry and stopped tracks. This fixture injects synthetic recognition results; it is not native face recognition evidence.
- Contact microbenchmark uses actual GLBs on one synthetic scene and a transcribed former fallback. Contact differences were 0 on all tested points. Mean batch-normalized CPU contact cost was 0.166→0.152 ms Contour, 0.149→0.145 ms Linea, 0.0040→0.0021 ms CC0; p95 was unchanged for the first two. No whole-frame FPS gain is claimed. Cached bounds are only used for rigid leaf meshes; nested/skinned/morph meshes retain the dynamic fallback.
- First cold resource check found texture count 1→2 after visiting the transmissive CC0 material. Local Three.js source confirms a lazily allocated renderer-owned transmission target. The harness now retains cold counts and warms all material paths before the disposal baseline. **20 swaps on three renderers passed:** 16/2, 13/2, 13/2 geometry/texture counts after warmup and after returning to the initial asset. This is counter evidence, not a heap-leak proof. Cold failure evidence is retained.
- Native continuity and intentional dropped-frame CPU recovery passed with actual protocol-5 hashed worker. Network check passed: 110 blank-input results, stopped tracks/removed SDK elements, no observed non-read HTTP requests or request bodies. This covers the synthetic session, not arbitrary hosting/integration code.
- Final code verification: `pnpm build`, `pnpm typecheck`, `pnpm test` passed; **114 SDK + 6 generator tests (120 total)** plus offline cache-policy harness and three asset-validation checks. Vite warns about the existing >500 kB Three.js chunk. SDK 81.96 kB / 24.77 kB gzip, worker 173.55 kB (`face-worker-qKTLBMGK.js`), production Vanilla cache `d19cdef95c1e`. Final frozen SDK `db5ca25981bf` includes media-mapped prediction and conservative contact fallback.
- Long soak attempt on the earlier candidate was interrupted by Vite HMR during development, not counted as a pass or an SDK crash. The repeat on final frozen SDK `db5ca25981bf` **passed 600,506.9 ms**, with **13,555 completions**, ten minute checkpoints advancing, **0 restarts**, one terminated worker, every synthetic track stopped, and SDK elements removed. Actual native face/hand models, blank input, adaptive quality and predictive mode; hand activation is explicit harness behavior. HMR was disabled in that isolated test tab only. No physical camera, face recognition, valid-fit rendering, or heap-leak acceptance is established by this soak. See `docs/evidence/smoothness-native-soak.json`.
- The first visibility attempt's fixed 300 ms startup sample found one empty frame; later lifecycle/cadence checks passed. The harness now polls for actual first visible WebGL pixels up to 2 seconds, rather than assuming camera/decode/GPU startup completes at an exact timer boundary. The accepted four-mode startup observations before adding prediction were 211–288 ms. The 48-case final regression retains every freshness/expiry assertion; no SDK timeout was widened for this harness correction.
- Remaining acceptance: controlled live alignment/noise/lag A/B with actual stepped video; active grasp under occlusion and rapid turns; camera format/mobile browser compatibility; 480-input small-face recognition and DPR-1 thin rims; actual fitting CPU submission/physical latency/device budgets. No camera test requested from the user during implementation, and no default experiment or npm release was promoted.

## M0 progress and evidence

- [x] Created repository guidance and SDK-first architecture decisions.
- [x] Added `@vto/sdk` public API with framework-neutral DOM integration.
- [x] Implemented explicit camera request (`audio: false`), repeatable stop, pending permission cancellation cleanup, page visibility/pagehide stop, worker initialization timeout, GPU-to-CPU delegate fallback, one-in-flight frame scheduling, and bitmap close in worker.
- [x] Implemented Three.js transparent overlay, GLB loading/disposal, resize handling, and latest-load-wins asset loading.
- [x] Replaced screen-plane-only placement with a 3D basis from the eye line and bridge; GLB yaw/pitch/roll now follows face geometry. Added frontal, 55-degree yaw, and degenerate-landmark unit fixtures.
- [x] Replaced box-like fixture GLBs with two original PBR demo assets: rounded rims, lenses, hinges, temples, ear tips; approximately 256/274 kB. Vanilla consumer imports only public SDK APIs.
- [x] Added the Poly Haven Round Spectacles CC0 PBR model as an explicitly generic test asset. A pinned source folder and deterministic builder embed its 1K textures in a 3.29 MB GLB; the manifest records CC0 provenance and approximate bounds, the example exposes it as a third public-SDK selection, and the synthetic harness has a separate load/render probe because this source mesh does not have the SDK's semantic temple part names.
- [x] Added `GlassesAsset`/`GlassesFit`, public `setFit()`, quality guidance, defaults for depth occlusion and adaptive smoothing, and asset-specific fit descriptors.
- [x] Added perspective unprojection, column-major face matrix rotation, relative-depth face occlusion (468 vertices/898 triangles), environment lighting and tone mapping.
- [x] Solved apparent-size distance from 3D outer-eye anchors and canonical span, added public estimated distance, and verified projected glasses shrink with distance while model size stays stable. Corrected FOV for cover cropping and moved quality thresholds into source-camera pixels.
- [x] Added low-resolution depth-only rear-head and ear envelopes anchored to cheek width and smoothed head pose. Asset size/offset/rotation controls do not move the head mask. One shared sphere geometry is disposed with the renderer.
- [x] Fixed landmark-only rotation fallback to use forehead/chin for anatomical up; the bridge can sit above the eyes and previously invert the fallback basis.
- [x] Removed per-frame array allocations in landmark validation and skipped duplicate WebGL draws between tracking updates. Added synthetic distance slider, rear-tip/front-temple GPU probes, draw-suppression checks, and 180-frame motion benchmark.
- [x] Reproduced the remaining profile ear-hook leak with whole-mesh GPU checks: the previous endpoint probes passed despite 271 visible hook pixels at 45° and 1,337 at 84° (Contour, 30 cm). Moved the ear envelope posteriorly, raised/enlarged its upper coverage, and widened the skull slightly to close the inward-hook seam. Full hook surfaces now have zero visible pixels at tested poses; added full-profile ±84° and tilted ray regressions.
- [x] Refined fitting stability: replaced the two-eye depth solve with seven-span median consensus, rejected sheared matrix rotations, introduced original 1 Euro-inspired signed-derivative filters with separate translation/rotation cutoffs and slow width adaptation, and rigidly corrected the dense face mesh to the same filtered head pose. Public API and detection model remain unchanged. Added 11 regressions and a reproducible aggregate-only synthetic comparison script.
- [x] Hardened concurrent start, stop during video playback initialization, startup asset readiness, stale async callbacks, in-flight asset disposal, and WebGL-loss cleanup.
- [x] Added mock-camera/worker tests for local frame handoff, fresh results, permission denial, cancelled permission requests, resource cleanup, bounded inference-timeout recovery, and recovery after a worker crash.
- [x] Added a 3-second inference watchdog; the former 200 ms result cutoff is superseded by a 1,000 ms capture-age budget and 750 ms mounted-pose silence expiry (visibility regression below).
- [x] Verified actual MediaPipe Face Landmarker WASM/model initialization inside the emitted classic Web Worker; it processed one synthetic blank frame and correctly returned no face.
- [x] Run build, typecheck and tests; exact results recorded below.
- [x] Serve the rebuilt production example on localhost; visible UI loaded and the alternate-glasses control completed without browser console errors.
- [x] Serve local runtime diagnostic and run the actual worker without camera permission.
- [x] Expose transient estimated distance, yaw, and pitch in the example during tracking so the final hands-on check can confirm that turning and moving affect the fit readout; values are not stored or transmitted.
- [ ] Verify the newest fitting, distance response and head/ear envelopes through live turns and distance changes. Desktop smoke confirmed camera acquisition, tracking, asset changes during tracking, and teardown. The user reports completing left/right turns; no landmarks, pose, frames, or distance samples were recorded, so instrumented side-profile/occlusion and distance-response acceptance remains open.
- [ ] Verify iOS Safari and at least two Android Chrome devices; check hidden/resume, denied permission, unplugged camera, and resource cleanup.
- [ ] Inspect browser network traffic to confirm only model/WASM/assets are fetched and no frames/landmarks/poses/snapshots are sent.

### Verification log

| Check | Result | Evidence / limitation |
|---|---|---|
| `pnpm build` | Pass (exit 0), 12 Oct 2026, continuity correction | All three asset manifests passed validation. SDK bundle 64.44 kB / 20.66 kB gzip, hashed worker 172.50 kB (`face-worker-dLHRjCyF.js`). Vanilla built 18 offline resources (`3b342284e9a9`). Asset Generator bundle 62.79 kB / 17.06 kB gzip. Asset Studio built successfully. Vite retains advisory chunks >500 kB: Vanilla Three core 523.58 kB / 132.10 kB gzip and Studio Three core 555.85 kB / 141.89 kB gzip. Third-party notices included in SDK dist. |
| `pnpm typecheck` | Pass (exit 0), 12 Oct 2026 | SDK, generator, Vanilla example, and Asset Studio TypeScript checks all passed. |
| `pnpm test` | Pass (exit 0), 12 Oct 2026, continuity correction | 12 files / 94 tests passed (88 SDK + 6 generator). Adds protocol mismatch cleanup, normalized camera input, backup frame pump, correlated completion, late bitmap cleanup after capture-timeout recovery, and CPU delegate recovery. Existing visibility, grip, fitting and one-bitmap backpressure regressions pass. Offline cache harness also passed. |
| Actual SDK/worker continuity and recovery | Pass, synthetic blank stream | `docs/evidence/tracking-continuity-regression.json`: fixed dev URL served an older worker without completion packets, reproducing 3 results over 3 worker starts. Hashed URL plus protocol check processes 203 actual MediaPipe results/completions over 7 seconds with zero restarts. A deliberately dropped first GPU bitmap then triggers one actual CPU restart; 161 CPU results/completions follow. Camera substituted with a blank canvas stream; no real hardware GPU stall or face-recognition claim. Reusable scripts in `scripts/browser-tracking-continuity.js` and `scripts/browser-tracker-recovery.js`. |
| Latest local live-camera continuity | Pass, limited | Same evidence records qualitative status only. On the user's existing localhost tab, face-only tracking persisted with increasing counters and zero restarts. With hands enabled and the user confirming facing the camera, tracking returned/persisted with hand runtime ready. Manual reconnect returned to tracking and counters kept increasing; Stop returned to idle. No images, landmarks, poses or person-derived histories recorded. Main-page error/warning inspection was empty; this does not establish worker-native logs, visual fit, grasp accuracy or mobile acceptance. |
| Public SDK visibility regression | Pass; original failure reproduced | `docs/evidence/glasses-visibility-regression.json`: actual built API, native local synthetic worker, canvas video stream, video-frame callbacks, GLB and WebGL readback. Before: both hand modes discarded 250 ms face results and rendered zero alpha pixels. After: 40/250/500 ms samples render 3,593 alpha pixels in both modes; face appears while hands remain loading; no-face and silence expiry clear pixels; reacquisition and stream stop pass. 16 assertions pass, no synthetic pipeline console warnings/errors. Does not exercise physical camera or MediaPipe recognition of a person. |
| Emitted MediaPipe face-first worker | Pass, blank input only | Same evidence: actual face model initializes and infers a blank bitmap while hands are loading; explicit optional activation then initializes the real hand model and returns separate no-face/no-hand/completion packets. No uncaught page exception. Four native warnings plus the XNNPACK INFO line emitted at console error level are recorded. A first attempt was interrupted by Vite reload during a build; the stable post-build rerun passed. |
| Production Asset Studio Chromium smoke | Pass, camera not requested | `docs/evidence/asset-studio-browser-smoke.json`: production page loaded under HeadlessChrome 154; WebGL2 canvas initialized at 534×330; recipe wizard navigated; incompatible 112 mm frame width was rejected with an actionable error; idle preview generated an actual 233,756-byte glTF 2.0 GLB with 13 meshes and preserved draft, fidelity, dimension source and semantic part metadata; browser console errors/warnings 0. Page had no `<video>`, no MediaPipe/model/WASM request, and idle camera copy. Does not exercise camera permission or live tracking. |
| Production Chromium offline smoke | Pass, camera not requested | `docs/evidence/offline-browser-smoke.json`: HeadlessChrome 154 controlled the page; the built sample initialized a canvas, completed the synthetic blank-frame MediaPipe diagnostic online, then reloaded the shell and completed the same worker/model diagnostic with browser networking disabled. Zero uncaught page errors. This is desktop Chromium browser-context emulation, not a physical network or mobile/device acceptance test. |
| Production Three.js split smoke | Pass, camera not requested | `docs/evidence/three-chunk-browser-smoke.json`: HeadlessChrome 154 controlled the built page, loaded both Three.js chunks, and the 3D fitting harness reported synthetic GPU PASS. Rear hook was occluded and the front rim/near temple stayed visible; console errors/warnings 0; no camera stream attached. Confirms manual chunk split did not break the renderer. |
| Final device acceptance procedure | Prepared; not executed | `docs/FINAL_DEVICE_ACCEPTANCE.md` covers permission denial/recovery, turn and distance checks, asset switching, lifecycle, lighting, and allowed network traffic. It explicitly prohibits retaining face imagery or face-derived histories. Physical device results remain open. |
| Production response headers | Pass | `HEAD /` returned CSP without `script-src blob:`, `Permissions-Policy: camera=(self), microphone=()`, and `X-Content-Type-Options: nosniff`; `_headers` also configures referrer/frame/HSTS policy. |
| CC0 model build and manifest validation | Pass (exit 0) | `scripts/build-polyhaven-glasses.mjs` packages the Poly Haven 1K glTF, binary, and local PBR maps into a standalone 3,292,684-byte GLB. `scripts/validate-demo-glasses.mjs` validates all 3 assets, their metadata/calibration and dimensions, and verifies that CC0 textures are embedded (no runtime texture host dependency). |
| CC0 browser render probe | Pass | On localhost, the production Vite app selected `Round Spectacles · CC0`; the synthetic three-pose GPU harness rendered its 2 meshes and 5 GPU textures on all 3 renderers with no WebGL errors. Browser console had no errors or warnings. This validates GLB/PBR loading and synthetic rendering, not fit against a human or retail product. |
| Three-asset GPU swap soak | Pass | The browser harness completed 20 model swaps across all 3 assets and restored the starting CC0 model. Per-renderer GPU counters returned to the baseline of 4 geometries / 5 textures. No camera was opened. |
| `node scripts/benchmark-fitting.mjs` | Measured (exit 0) | Deterministic canonical fixture, 30 samples/sec, alternating ±0.12 cm position noise, 30 warmup + 90 measured samples: former filter RMS 0.11733 cm; refined RMS 0.02175 cm (81.46% lower for this fixture). Corrupting eye 33 by +0.04 normalized X / +0.025 Z caused depth error <4e−14 cm at yaw −84°/−45°/0°/45°/84°. `docs/evidence/tracking-refinement.json` contains aggregate synthetic results. Excludes recognition, inference, camera accuracy and real-device performance. |
| Tracking-refinement GPU regression | Pass | Rebuilt production harness: both assets, 30/100 cm, profile ±84°, with frontal and 45° in each state (16 unique combinations). Whole-hook masked pixels remain zero, unmasked counts nonzero, front rim/near temple visible, duplicate draw suppression passes. Warning/error logs empty. Saved eight-state counters in `docs/evidence/tracking-refinement-gpu.json` and synthetic visual in `tracking-refinement-render.jpg`. No camera opened. |
| Tracking-refinement motion benchmark | Measured | Latest production Linea at 100 cm starting control, 180 moving synthetic frames on 3 renderers: 30.1 observed frames/sec; CPU fitting + render submission mean 2.34 ms, p95 3.10 ms for all 3 combined. Excludes inference, fixture generation and asynchronous GPU execution. This run is not a matched hardware/timing comparison against the earlier 60.1 fps run; no FPS improvement claim. Text also saved in `tracking-refinement-gpu.json`. |
| Earlier production browser smoke | Pass | Previous iteration's public-API consumer selected Linea, adjusted width to 115% and height to +1%, and reset successfully with no warning/error logs. Desktop and 390px mobile layout inspected; mobile body/shell/scroll widths were 390/354/390px (no horizontal overflow). No camera permission was requested. |
| Earlier GPU endpoint checks | Pass, insufficient coverage | Previous iteration tested 0°, 45°, 75° at bridge depths 30 and 100 cm for both demo assets. Endpoint pixels, front rim/temple and face depth passed, but those probes did not detect a visible upper/middle hook. Whole-mesh regression below supersedes that acceptance evidence. |
| Full-profile hook regression | Pass | New production checks cover 0°/45°/+84°/−84°, both assets and 30/100 cm (16 unique combinations). Full actual GLB hook meshes are colored magenta temporarily; 1024² GPU readbacks require **zero** visible hook fragments with masks and nonzero fragments without masks. All passed. At 30 cm unmasked counts were 702/1,032/2,291 for frontal/45°/84°; at 100 cm 92/134/192. With masks every count was zero. Front rim and near-side front temple remain visible; duplicate-draw checks pass. No camera was opened. |
| Duplicate draw suppression | Pass | GPU diagnostics observed no increment in render-frame counters during ten unchanged render calls on each of three renderers, after a forced diagnostic draw. |
| Earlier synthetic motion benchmark | Measured | Before the full-profile mask correction, adaptive smoothing enabled, Linea GLB: 180 frames on 3 renderers, 60.1 observed frames/sec; CPU fitting + render submission averaged 1.91 ms, p95 2.50 ms for all 3 combined. Synthetic frame generation is outside the timed CPU section. This excludes MediaPipe inference and asynchronous GPU execution; it is not a live-camera or mobile FPS claim. Not rerun for the mask correction. |
| Earlier GPU asset soak | Pass | Previous head geometry iteration: 20 alternating asset swaps on each of 3 renderers; initial and final geometry/texture counts stayed 13/1 for all three (Contour starting/ending asset). This correction adjusts transforms of the same three meshes; no extra runtime geometry/material resources were added. The previous soak does not prove full browser heap or device thermal behavior. |
| Earlier UI mechanical scan | Pass | Previous UI iteration's Impeccable detector returned `[]`; visual and interaction checks were also performed. New distance badge/note and synthetic controls were inspected in browser in this iteration. |
| Saved visual evidence | Available | New `docs/evidence/head-occlusion-30cm.jpg` and `head-occlusion-100cm.jpg` show the same generic Linea head at 0°/45°/75° and shrinking perspective size. Earlier face-only proof remains in `fitting-three-poses.jpg`. No camera image or person scan was captured. |
| Full-profile visual evidence | Available | `docs/evidence/profile-hook-occlusion-84.jpg` shows corrected Linea hook occlusion at 0°/45°/84°. `docs/evidence/profile-hook-gpu-checks.json` contains the eight checked asset/distance/profile configurations and synthetic GPU counts/booleans. Checks clear their old result while running so browser verification cannot accidentally accept an earlier pass. Browser warning/error logs were empty. No person data is included. |
| Updated website smoke | Pass | Reloaded the public-API demo at port 5173, expanded fitting controls, confirmed the distance explanation and idle camera state. No warning/error logs. Production GPU harness logs also empty. No camera permission requested. |
| Real worker/model smoke | Pass | Production `/diagnostics.html` loaded the version-pinned WASM and 3.76 MB model; the emitted classic worker initialized and returned a valid no-face result for a synthetic blank frame. The page visibly reported “Runtime dan inferensi worker berhasil”. No camera permission was requested. |
| Local desktop live-camera smoke | Pass, limited | With user authorization, localhost acquired the camera, reported the video stream ready at 1280×720, reached `tracking` on a live face, and retained tracking while switching Contour → Linea → Contour. Stop returned the app to idle, disabled Stop, re-enabled Start, hid the distance label, and cleared `video.srcObject`; browser error/warning log was empty. No video, snapshot, landmark, pose, or distance value was saved. This confirms the local pipeline and cleanup only; side-turn fit, distance response, live occlusion quality, and sustained performance were not accepted. |
| User-reported live bilateral turn | Reported complete, not instrumented | User confirmed turning left and right about 45° for 2–3 seconds in the live example. No face-derived samples or snapshots were retained, and no pose history is exposed in the UI to independently verify yaw/occlusion from that pass. Treat as qualitative feedback, not a measured acceptance result. |
| Camera / real device matrix | Partial | Desktop smoke above passed. iOS Safari and Android Chrome devices were not available/tested. |
| Privacy network inspection | Source audit pass; active-camera capture remains open | SDK source has no explicit `fetch`, XHR, beacon, WebSocket, or telemetry sink for camera-derived data. Frames transfer only through `createImageBitmap` → dedicated worker `postMessage`; worker returns landmarks/pose to the renderer. Explicit remote resources are versioned MediaPipe WASM/model assets. Browser network capture during an active camera session is still required before release. |
| Jeeliz Live comparison | Source/code review only | On 12 October, reviewed current vendor site, Shopify listing, FAQ/privacy policy and public repository. The repository labels its widget legacy. Current product documents face-lighting matching and photo-to-3D asset workflow; our fixed lights/procedural demo assets lack those capabilities. Tracking, anatomical ear occlusion, physical sizing and full pipeline speed have no matched comparative evidence. Shopify demo store redirected to a password page; no third-party live camera session started. See `docs/JEELIZ_COMPARISON.md`. Proposed priorities are lighting, a calibrated real SKU, anatomical occlusion and matched live/device acceptance; no new implementation/benchmark completed in this review. |
| Jeeliz reuse/license review | Source review only | On 12 October, read upstream LICENSE/README files. Legacy VTO widget has a commercial license restricting redistribution; its payment exemptions do not authorize distributing it inside our SDK. FaceFilter has Apache 2.0; WebAR.rocks.face has MIT covering listed core/helper/model directories with separate-license exceptions. Its glasses demo documents temple bending/ear fading and GLB conventions, making helpers a relevant candidate for optional evaluation while retaining the MediaPipe baseline. No open-source release for the complete current Live VTO service was found. No code copied, packages installed, tracker replaced or runtime tests run for this review. Details/links in `docs/JEELIZ_COMPARISON.md`. |
| VTOGlasses migration mapping | Audit complete; implementation tracked below | Inspected upstream demo/main, Mirror/Three helpers and asset specification against current SDK. Recorded commit/checksums, MIT notice, r136/global-script vs r176/ESM, camera ownership, PnP/mesh, shader, asset and light-reconstruction boundaries. No upstream files/assets were vendored; first material-effect port is recorded in the next row. |
| VTOGlasses S0–S5 migration outcomes | Code/evaluation work recorded; live product acceptance open | S0 source/license audit; S1 named-temple GPU effect with all three shader branches gated; S2 shared calibration JSON/build/GLB validator; S3 local border lighting integrated into camera loop; S4 tracker no-go; S5 synthetic A/B controls. Browser diagnostic passed both demo assets, 30/100 cm and ±84°; each run checks 0°/45°, frontal rim and near temple. Latest GPU run after shader fix: effect output changed 312/572/1,298 pixels at 0°/45°/84°, tilted-profile hook mask zero; local warm/cool output changed 231/418/91 pixels. The candidate samples a 32×24 canvas twice per second maximum, clears scratch pixels after each estimate, and resets on stop. User live tests are still needed for visual relighting and device cost. Evidence: `docs/evidence/vtoglasses-temple-effects.json`, `docs/evidence/vtoglasses-local-lighting.json`, and `docs/VTOGLASSES_MIGRATION.md`. |
| Optional generator + Asset Studio | MVP implemented; camera-device acceptance open | `@vto/asset-generator` is separate from the core SDK and validates recipes, builds three parameterized templates and exports GLB metadata. Studio consumes the generator, SDK public API, and Three.js preview; supports dimension sources, local draft persistence, and GLB/JSON download. Browser smoke validated wizard, dimensional guardrail, WebGL2 preview, and an actual glTF 2.0 GLB with draft/source metadata. The SDK camera button is wired but was deliberately not clicked in this browser test. Evidence: `docs/evidence/asset-studio-browser-smoke.json`. |

## VTOGlasses migration progress

- [x] S0 upstream commit, source hash, MIT scope, and notice recorded; no runtime/assets vendored.
- [x] S1 selected-mesh material clones, temple bend with analytic normal correction, smooth rear alpha fade, per-instance enable/reset, unit tests, GPU output readback, both assets, ±84°, 30/100 cm, 0°/45°, tilted profile, and 20-swap soak.
- [x] S2 shared demo calibration manifest, GLB metadata embedding, stable part names, and build-time validator; two original demo fixtures pass.
- [x] S3 bounded local-only ambient estimator integrated into the camera loop (32×24, at most 2 Hz, scratch pixels cleared after reduction and stop); synthetic warm/cool GPU output and estimator tests pass; opt-out via `ambientLighting: false`.
- [x] S4 optional tracker candidate evaluated; no-go recorded, MediaPipe remains primary, no replacement/runtime vendored.
- [x] S5 synthetic A/B controls for temple shader and warm/cool light, pose/distance/asset controls, GPU probes, swap soak and motion run recorded.
- [ ] External qualification: live desktop camera and cross-subject review; licensed SKU calibration; real lighting/flicker and target-device performance; iOS/Android camera lifecycle; live privacy-network inspection; matched same-camera tracker/device comparison only if a second tracker is reconsidered.

## Full-face fitting and upward inspection correction

- Root cause found in code: `fitFace()` discarded valid matrix poses when the legacy eye-line pose was degenerate and made pitch beyond 65 degrees invisible through the `turn-slightly` guidance state. MediaPipe already returns a full face mesh; the model itself was not configured for eye-only detection.
- Matrix pose validation now runs independently of the eye-pair fallback. When the matrix is unusable, forehead/chin and cheek anchors form an anatomical fallback before the older eye-based fallback.
- Visual resolution uses median equivalent eye-span resolution across seven upper-face and three whole-head spans. The bridge remains the eyewear attachment point and the existing seven-span depth consensus is retained.
- Guidance and visibility are independent. Steep pitch remains renderable while the bridge is onscreen, source resolution is sufficient, and the face normal is forward-facing (`normal.z > 0.02`). No-face, nonfinite, collapsed, tiny, offscreen or rear-facing data still clears/hides the overlay; there is no stale-pose hold.
- Acceptance evidence: unit fixtures at pitch ±45/±70/±80 with yaw 0/±45 and roll, matrix and full-face fallback, collapsed eye corners, and rejected rear-facing/fully collapsed data pass. Production HeadlessChrome 154 rendered both demo GLBs at all six pitch angles at 30 and 100 cm (24 GPU samples, all nonzero visible asset pixels). Existing hook/shader/lighting GPU checks also passed in each of the four asset/distance runs. Console errors/warnings 0. Evidence: `docs/evidence/upward-pitch-gpu.json`.
- `/fit-check.html` now has a synthetic pitch slider (-80 to +80 degrees) for inspecting underside/top views without camera access. Rerunning GPU checks resets pitch to the standard baseline.
- Live acceptance remains open: ask the user to test gradual look-up/look-down, combined turn/tilt, bridge alignment and face reacquisition. Tests demonstrate the fitting/renderer no longer rejects these synthetic poses, not that MediaPipe recognizes every real extreme pitch. Recognition model and inference settings are unchanged. Genuine detector loss still hides the glasses.

## Glasses visibility regression — face rendering before hands

- User reported complete invisibility after the grip work and requested that glasses appear before interaction. The actual physical-camera cause has not been observed in this pass. A reproducible code failure was found: the fixed 200 ms capture-age cutoff discarded every valid synthetic 250 ms result in the full public SDK pipeline, with both hands enabled and disabled.
- Replaced that cutoff with a bounded 1,000 ms capture-age rejection limit. The mounted overlay expires after 750 ms without an accepted visible result, independently of capture latency. An initial correction expired by capture time and flickered at 500 ms cadence; the browser regression caught it, and the receipt-based expiry now passes. No-face/invisible results still hide immediately and invalid timestamps are rejected. Hand freshness stays 450 ms.
- Warm the face graph on a discarded blank canvas for both default and hand-enabled starts. Face initialization announces readiness without downloading/creating the hand graph. SDK sends `enable-hands` only after a visible fit and an animation-frame render opportunity. Availability is `loading` until `hand-ready`; optional failure leaves face tracking and buttons operational. The runtime diagnostic explicitly enables hands itself because its blank image has no visible fit.
- Acceptance criteria: actual GLB pixels are nonzero at 40/250/500 ms result latency with hands on/off; face is visible before hand-ready; no-face/silence clear the mounted model; reacquisition restores it; stop ends synthetic stream tracks; actual emitted MediaPipe still processes blank inputs before/after hand activation. All 16 public SDK browser assertions and real-worker blank smoke pass. Reproduction script: `scripts/browser-visibility-regression.js` with Playwright CLI against port 5173. Evidence: `docs/evidence/glasses-visibility-regression.json`.
- Build and four-project typecheck pass; 90 tests pass plus offline harness. Source and dist rebuilt; example remains available at `http://127.0.0.1:5173/`. Camera permission was never requested in this correction. No real-person data was recorded. Physical-camera confirmation, actual inference cadence and mobile behavior remain for the user/device acceptance pass. Nothing published to npm.

## Continuous tracking regression — incompatible cached dev worker

- The earlier visibility checks used mock recognition packets; actual MediaPipe was tested through a separate static worker URL with blank input. They did not verify the real SDK's worker delivery path or sustained camera inference. The 200 ms cutoff was a reproducible additional fault, not proof of the user's actual cause. This limitation is now explicit.
- Actual user camera initially produced one face result per worker start and then timed out. The same behavior reproduced with a blank canvas stream through the built public SDK: 3 `ready`, 3 `result`, zero `frame-done` packets over 2 restarts. Fetching the SDK's fixed `/@fs/.../dist/assets/face-worker.js` URL with no-store still returned source without `frame-done`, while the newly built file on disk contained it. This is a confirmed stale development-server response/SDK-worker protocol mismatch. The CPU label before the handshake fix was inferred from the requested delegate, not confirmed by the older worker; health now reports only the actual ready delegate.
- Worker filenames now include their content hash; initialization validates protocol version 3 and fails clearly before any frame dispatch if incompatible. `copy-worker.mjs` resolves the current hashed asset and generates the diagnostic import so that the diagnostic uses the same SDK runtime. Existing public static copy is retained for older offline shells. No dev-server restart was needed to restore the user's pipeline after changing the worker URL.
- Hardening added while diagnosing: 640-pixel maximum-width transient RGBA processing canvas, preserved aspect ratio/normalized landmark mapping, 2-second capture watchdog separate from 3-second inference watchdog, frames withheld until the replacement tracker is ready, correlated completion timestamps, late bitmap cleanup without unlocking a new frame, CPU recovery delegate, and an independent 100 ms pump that captures only when primary video callbacks have been absent for 250 ms. Bitmaps close in the worker, and scratch dimensions clear on stop/dispose. The active processing canvas remains transient in memory. These changes support continuity but are not evidence that native camera format/GPU inference caused this reported regression.
- Acceptance criteria: actual SDK worker source is current and versioned; continued actual MediaPipe result/completion packets from a synthetic stream; intentional completion loss triggers automatic CPU recovery and resumes results; incompatible worker fails with cleanup; real user camera maintains face tracking with hands disabled/enabled; manual reconnect and stop work. All passed in this iteration. Renderer regression additionally retains nonzero GLB pixels at 40/250/500 ms synthetic recognition latency in both hand modes.
- Live inspection only read transient status, hand availability and runtime counters. The user confirmed facing the camera; both face-only and hand-enabled sessions reached sustained `tracking`, and reconnect returned to tracking. Camera was stopped at the end. No camera screenshot, raw coordinate, pose or gesture history was collected. Visual alignment/occlusion, real hand grasp and iOS/Android remain open. SDK still never uploads camera-derived data and nothing was published to npm.

## Remaining validation and product-readiness gaps

- **Shader A/B toggle:** Fixed to gate vertex displacement, normal correction, and alpha fade with the same uniform. A regression test verifies the generated shader source; synthetic GPU readback confirms enabled effects render. Recheck OFF against the original visual baseline on the target devices.
- **Ambient lighting:** Implemented in the live path using a 32×24 scratch canvas sampled at most twice per second; aggregate estimates are smoothed in memory and reset on stop. It defaults on and can be disabled with `ambientLighting: false`. No camera frame/pixel buffer is retained after reduction; real-scene visual quality and device cost await user testing.
- Controlled live profile/distance and cross-subject acceptance is still needed. A desktop camera smoke reached tracking and passed asset-switch/stop checks, and the user reported completing bilateral turns. Those checks do not yet establish quantified alignment, jitter, lag, anatomical occlusion or distance-response accuracy.
- The tracker uses one in-flight frame, a 3-second timeout, a 1,000 ms capture-age rejection limit, a 750 ms silence expiry for the mounted overlay, and at most two local worker restarts per camera session. A displayed accepted pose can therefore reach about 1,750 ms capture age before silence expiry in the worst case; genuine no-face/invisible results hide immediately. These are fallback bounds, not real-time performance targets. Recovery behavior is mocked/unit tested but not exercised against real device-specific MediaPipe stalls; target-specific inference budgets, recovery time, and repeated sessions still need device qualification.
- Rotation uses MediaPipe's canonical-face transform; seven-span perspective fitting, crop/mirror, separate pose filters, local per-asset adjustments and face/head/ear depth occlusion are implemented. `estimatedDistanceCm` is optical-axis depth to bridge 168 based on canonical upper-face proportions (outer-eye GLB gauge 8.891718 cm), relative landmark Z and approximate 63° source FOV. It is not Euclidean ranging or a calibrated measurement. Camera intrinsics, face-size variation, lens/zoom error and SKU-specific fit envelopes need real-subject validation. Median consensus tolerates a minority of corrupted spans but not correlated errors across most anchors; bridge translation, facial deformations and landmark fallback still depend on model output. The latest filter cutoffs need live lag/jitter tuning; model detection accuracy and inference speed are unchanged and unmeasured here.
- Ear and rear-head volumes are geometric estimates, not detected segmentation. They can over/under-occlude on unusual head shapes, ears, extreme poses or oversized assets. M9 adds guarded automatic hair masks; M11 adds opt-in two-hand contact/masks, with depth/anatomy still approximate. Camera/lens compositing and transmission are implemented with DOM/original-material fallback; actual appearance, optional-feature cost and recognized-face occlusion remain unqualified on physical phones. Validate the **entire rear hook**, not only its endpoint, and retained near-side temple segments on real users. The newer synthetic ray/GPU evidence does not close that live visual gate.
- Two reference GLBs are synthetic demonstrations. The third model is a bundled generic Poly Haven CC0 asset for PBR/import testing; it is not a real SKU and its visual scale has not been calibrated against a person. Retail try-on requires licensed/calibrated product geometry, seller-provided dimensions, and product review.
- iOS worker/WASM/WebGL compatibility, target performance, thermal behavior, and camera lifecycle remain unmeasured.
- The offline cache allowlist and warm-cache behavior pass a Node service-worker harness. Production Chromium registration/control, synthetic worker inference, and a network-disabled shell reload plus worker/model inference are verified in `docs/evidence/offline-browser-smoke.json`. This does not verify active-camera network traffic; a network-panel inspection during a user camera session remains an explicit release gate.
- The model default points at a versioned MediaPipe model hosting URL but should be self-hosted for a controlled production release; verify model license and delivery policy before redistribution.

## Working rules

- Update this file as decisions or evidence change. Never mark a milestone accepted based only on scaffolding or a successful build.
- Keep actual observed results distinct from proposed targets.
- Do not publish to npm unless explicitly requested.

## Implementation references

- MediaPipe's [Face Landmarker web source](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/face_landmarker/face_landmarker.ts) exposes canonical-to-face matrices when `outputFacialTransformationMatrixes` is enabled. The pinned local package's API types were also inspected.
- Matrix storage was verified against [MatrixData](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/framework/formats/matrix_data.proto) and [serialization implementation](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/framework/formats/matrix.cc): column-major by default, matching Three.js `Matrix4.fromArray()`.
- Canonical topology attribution and license copies are in `THIRD_PARTY_NOTICES.md` and `scripts/assets`.
- MediaPipe's official [Face Geometry documentation](https://chuoling.github.io/mediapipe/solutions/face_mesh.html#face-geometry-module) documents relative weak-perspective landmark Z, canonical centimeters and the need to match virtual camera parameters to the physical camera. Our distance estimate assumes that canonical face size; it does not establish real ranging accuracy.

## 16 October release automation verification

`pnpm test` passes 319 SDK + 108 generator tests, offline policy and two npm release-guard tests. Workflow YAML parses, tag identity checks pass, and a live registry preflight rejects existing SDK 0.1.1 as intended. Logs: `docs/evidence/github-release-tests.txt` and `npm-duplicate-version-guard.txt`. Newly added text evidence has trailing whitespace/blank EOF normalized only; results are unchanged. npm account configuration remains unavailable (local E401). No package version bump or publication.
