# Camera-free preparation contract

Status: public `prepare()` implemented locally, 15 October 2026; not published.
The implementation update below supersedes the earlier proposed-contract notes.

Optional reliability: preparation now makes one face-only CPU fallback after
confirmed face readiness and optional startup failure. It releases the failed
worker first and suppresses hands/hair on the replacement. Adoption preserves
fallback state and restart count, without another init. Abort, asset changes and
protocol mismatch do not qualify. If fallback fails, preparation rejects/reports
once and releases all workers. 307 SDK tests, SDK build/typecheck and controlled
actual-MediaPipe stalled-hair recovery pass. Candidate `b87922de3e9c`; evidence
`docs/evidence/prepare-fallback-*`. This is synthetic reliability evidence, not
physical-device or first recognized-fit acceptance.

Geometry hardening: when normalized camera shape differs from the initial
640×360 scratch shape, Start warms face/enabled optional graphs on the same worker
before live dispatch. It is bounded by startup deadlines, uses blank scratch
images and increasing pre-live timestamps, and reports activationWarmupMs inside
start-to-ready. Worker protocol 8 requires this handshake; outdated workers fail
validation. Repeated/oversized/post-live warmup requests are rejected. 304 SDK tests,
workspace build/typecheck, seven fitted/loading and four actual native preparation
cases pass, including portrait activation. One portrait sample: 140.3 ms activation
warmup, 274.9 ms start-to-ready, one worker/stream, advancing blank results and clean
release. Candidate `96bd701bde40`; `docs/evidence/prepare-geometry-*`. Desktop synthetic
portrait does not establish physical-device/appearance or live hair-mask acceptance.

Public integration: `prepare()` shares the current asset wait and warms a single
owned worker without media acquisition. Explicit start requests the camera from
the existing start path and adopts a valid prepared connection/ready response
without a second init. Concurrent calls share pending work; stop/page hide/dispose
cancel preparation and release ownership. Changed assets invalidate reuse; changes
during preparation reject the attempt. Start can retry a failed preparation through
the normal bounded startup/fallback path. Prepared status is `idle` plus readiness
`prepared`; no visible fit is implied. Preparation timing is reported separately
on adoption and reset on stop, so moved work is not hidden in a speedup claim.

Validation: 300 SDK tests, SDK build and full workspace typecheck pass. Seven synthetic fitted/loading cases (including prepared GPU-visible eyewear) and three public-API actual-native-worker cases
pass. Each native prepared/concurrent start uses one worker and one audio-disabled
synthetic stream; warmup cancellation uses no camera, rejects and releases the
worker. First native fit stays null. Candidate `bcd003660b61`; evidence
`docs/evidence/public-prepare-*`. Initial typecheck found the new readiness stage
missing from reference copy; adding that state resolved it. Physical portrait,
recognized-face/first hair-mask acceptance and total-work comparisons remain open.

Earlier design and extraction history follows.

Implementation progress: session worker construction/replacement/release now uses
`TrackerWorkerOwner`. It detaches callbacks before termination, clears ownership
before release, and ignores obsolete release requests. Stop, startup failure,
optional fallback and recovery share this owner. Readiness/deadline and active
message handling still live in `start()`; public preparation is not implemented.
Ownership regressions and existing session recovery checks pass (284 SDK tests),
as do six synthetic fitted/loading and four actual native startup browser runs.
Candidate `a0032cf57f19`; evidence is `docs/evidence/worker-ownership-*`.

Further progress: `TrackerStartup` now owns the readiness promise, protocol
validation, total deadline, once-per-optional-stage deadline and settlement cleanup.
`TrackerWorkerOwner` cancels its startup wait on release/replacement. Session-wide
ready resolvers and raw initialization timers have been removed. The existing
optional fallback and live recovery policy remain session-owned; moving worker
initialization/message handoff outside `start()` is still required for preparation.
288 SDK tests, build/typecheck, six fitted/loading browser cases and four native
startup runs pass. Candidate `4dcd79095a62`; `docs/evidence/tracker-startup-*`.

Transport progress: `TrackerConnection` is camera-independent and now used by
normal SDK startup/recovery. It sends the typed init request once, routes worker
errors/deserialization failures, and supports callback handoff without a new worker
or packet queue. Ownership checks suppress queued obsolete callbacks and reject
obsolete handoff. The actual-worker controller proof passes handoff/loading cancel/
prepared disposal with zero camera calls and one terminated worker per case.
291 SDK tests, build/typecheck and six fitted/loading SDK cases pass. Candidate
`6e75f2da0b5a`; evidence `docs/evidence/tracker-connection-*`. Session preparation
state, camera attachment, concurrent prepare/start and public API remain pending.

The worker can compile face and optional graphs without camera access using blank
scratch images. A shopper integration could explicitly prepare while displaying
the product, then request the camera from the Start action. This moves work earlier;
it does not reduce total compilation work or guarantee faster recognized fitting.

Proposed additive API: `session.prepare(): Promise<void>`. Construction keeps its
current asset-loading behavior. Preparation is explicit because it can download
models, consume GPU memory and compile graphs. It must not run automatically when
the SDK is imported or constructed. Existing `start()` remains sufficient.

| Operation/state | Required behavior |
|---|---|
| prepare while idle | Share current asset load, resolve guarded effects, warm renderer and one classic worker with blank input; never request media or submit camera frames. |
| repeated prepare | Share the in-flight promise; prepared calls resolve without a second worker. |
| start while preparing | Request camera only from explicit start; share preparation and attach the stream only to the current generation. Preserve normal start's permission timing. |
| start after prepared | Reuse worker; install active handlers before the first bitmap. Camera acquisition and playback remain independently validated. |
| prepare while running | Resolve without restarting camera or worker. |
| stop/page hide/dispose | Cancel pending preparation, terminate worker, invalidate late callbacks, clear bounded waits and release acquired tracks. No hidden prepared resource retention. |
| failure | Reject once, release resources; retry creates a fresh generation. Optional startup failure retains the existing bounded face-only fallback. |
| asset replacement | Keep normal valid-model retention; recompute asset-dependent feature eligibility before activation. A changed eligibility may require re-preparation. |
| dimensions change | Preparation has no camera geometry; use documented bounded scratch dimensions. Activation must validate portrait/landscape first-frame cost, rather than claiming all shapes are precompiled. |

Keep `SessionStatus` behavior compatible. Add an explicit preparation state only
after defining callback ordering; tracker ready must never imply a visible fit.
Preparation diagnostics must stay separate from start-to-fit durations and identify
reused work. No raw frames, face outputs or masks may enter diagnostics/storage.
Keep CacheStorage restricted to the existing pinned static runtime allowlist;
preparation must not broaden persistence or upload policies.

Implementation seam: move worker initialization, optional deadlines, protocol
validation and ownership out of the nested `start()` closure into a session-owned
controller. It must support a single handoff from preparation to active callbacks,
with generation checks on every asynchronous completion. Preserve bounded recovery
and optional fallback in that controller before exposing `prepare()` publicly.
Do not keep a second warmed worker beside the active one.

Required verification: camera calls remain zero for prepare alone; concurrent
prepare/start uses one worker and stream; cancellation during downloads/native
initialization/prepared state leaves no owned resources; callbacks may reenter
stop/dispose; late camera acquisition stops every track; failures notify once;
changed assets/geometry cannot apply obsolete results. Actual worker checks must
include post-handoff first inference, while physical portrait/landscape devices
remain an acceptance gate. Compare equal total work and disclose pre-start cost.

Proof harness: `scripts/browser-camera-free-preparation.js` exercises the existing
built worker's readiness, first synthetic completion, cancellation and disposal.
It is not evidence that the public SDK session already implements this contract.

Measured proof: three cases pass with zero camera calls, terminated worker
ownership and no raw result persistence. Preparation/activation took 16,901.1 ms
to ready, followed by 66.0 ms to the first blank face completion; a later prepared
disposal reached ready in 1,518.6 ms. These unthrottled samples have different
cache histories and do not establish a speedup. Blank input skips face-gated hair
sampling, so it does not qualify the first activated hair mask. Host termination
confirms owned-worker cleanup, not native GPU memory reclamation. Evidence:
`docs/evidence/camera-free-preparation.json` / `.txt`, built SDK `7e443207d837`.
