# First iteration: shopper baseline and startup contract

**16 October status:** local first-iteration software scope and verification are complete. Physical devices and a licensed retail sample are unavailable, as confirmed by the owner; shopper observations and budget/support ratification remain open. M15/M16 are not accepted. See the [iteration report](SHOPPER_SPRINT_REPORT.md) for exact evidence and next actions. Earlier planning text below is historical.


Prepared 14 October 2026; updated 15 October (Asia/Jakarta). Status: **in progress: startup profiling and bounded loading/retry implemented; physical-device/shopper qualification open**. See [execution status](SHOPPER_SPRINT_PROGRESS.md). Parent plan: [shopper roadmap](SHOPPER_EXPERIENCE_ROADMAP.md). Milestones: M15 baseline and M16 startup/recovery. Nominal capacity: one engineer for two weeks with part-time UX/device support; re-estimate after baseline.

## Iteration outcome

Produce a repeatable account of the shopper's first try-on, a ranked list of actual friction, and an agreed minimal startup/recovery contract. Begin with physical-device baseline and a small production-shaped shopper flow. This iteration must expose phone blockers before investing in more optional features.

## Ordered tickets

| Ticket | Priority / role | Work and repository entry points | Acceptance / output | Dependency |
|---|---|---|---|---|
| **S01 — Freeze and reconcile baseline** | P0 / SDK engineer | Current `packages/sdk/src/index.ts`, public types, package/worker/assets; README and device/default docs | Source/build/worker hashes and config recorded; `/` correctly documented as auto/adaptive/compositing with guarded auto-hair, hands off. Historical evidence stays dated. A single current-default support checklist is linked. | None |
| **S02 — Startup timing definitions and harness** | P0 / SDK engineer | `RuntimeMetrics`, `TrackingHealth`, `AssetReadiness`, public start flow; reuse diagnostics/native/GPU harnesses | Measure full scenario-entry-to-first-usable wall time, reported camera API pending interval, resource preparation, tracker ready and first draw. Cold starts precede constructor loading with empty caches/no preload; warm runs disclose prior prepare cost. Known synthetic timing fixture verifies definitions. No persisted frame/pose data or telemetry. | S01 |
| **S03 — Physical default baseline** | P0 / device QA | Run [device checklist](FINAL_DEVICE_ACCEPTANCE.md) against frozen HTTPS build | Desktop, physical iPhone/Safari and two Android classes have explicit results or remain untested. Observe first-fit, turn/pitch/distance, resize, denied/busy camera, hide/stop/restart, asset failure and ten-minute use. Timings do not certify visual fit. | S01, S02 |
| **S04 — Observe shopper tasks** | P0 / UX + owner | Current public-API reference integration; 6–8 consenting participants | Anonymous counts for start, side view, three-frame browsing, choice, stop and one safe recovery; top five friction points with frequency/impact. No recording, biometric characteristics or participant profiles. | S01; can run alongside S03 |
| **S05 — Readiness and recovery design** | P0 / SDK engineer | `types.ts`, startup/teardown in `index.ts`, `assets/AssetReadiness.ts` | Proposed additive types and transition table cover consent pending, slow GLB, runtime failure, invalid asset, permission, stream ended, context loss, cancellation and retry. Camera-free preparation has explicit network/cache/cancel/dispose behavior; names remain proposals. | S02; refine with S03/S04 |
| **S06 — Qualify one asset sample** | P0 / asset contributor | Fit metadata reader, existing GLB validation/export tooling; supplier product sample | One licensed geometry sample reviewed for dimensions/provenance, axes/pivot, semantic names and provisional budgets. If unavailable, create a synthetic inspection fixture, record supplier dependency and keep retail gate open. | S01; parallel |
| **S07 — Shopper reference-flow specification** | P1 / UX + integration | `examples/vanilla/index.html`, `src/main.ts`, styles | Screen/flow spec centers camera, start/stop, current product and selection; technical controls in developer view; state-driven localizable copy and stable live-region announcements. Comparison uses live switching and product IDs only. Early keyboard/touch review. | S04, S05 |
| **S08 — Ratify and queue implementation** | P0 / owner + engineer | Roadmap targets, S03–S07 evidence and scope | Agreed support tiers, first-fit/switch/render budgets, minimum API changes, prioritized M16 tickets, estimates and external blockers. Record decision in `IMPLEMENTATION_PLAN.md`; no target accepted from a build alone. | S03–S07 or explicit open dependencies |

S03 and S06 depend on external hardware/product access. A missing device or licensed SKU does not prevent contract work, but the iteration report must call the corresponding qualification open. Do not substitute browser emulation or generic generated glasses for these gates.

## M16 tickets to refine after baseline

These are sequenced implementation candidates, not authorization to publish or proof that the design is final.

1. **R01 — Stage-aware readiness and typed reasons.** Preserve existing lifecycle/callback compatibility, represent indeterminate progress, and distinguish selected/loading/displayed assets. SDK supplies reasons; the host supplies readable language and actions.
2. **R02 — Bound/cancel resource work.** Add configurable GLB/runtime deadlines, cancellable asset fetch where feasible, latest-request ownership, late-result disposal and stop/dispose races. Cover an unresolved initial GLB after camera acquisition without an indefinite live-camera wait. Never impose a resource deadline on an unanswered user permission prompt.
3. **R03 — Explicit camera-free preparation.** Add only if S05 demonstrates a simpler host flow and measurable first-fit benefit. Share existing constructor asset work. Resolve prepared-worker lifetime, stop/page-hide policy, cache allowlist, changed asset, abort/retry and cleanup. Direct `start()` remains complete without prepare.
4. **R04 — First-fit budget and optional work.** Compare defaults and face-only on actual devices; adjust optional prewarm/scheduling or session fallback when justified. Shared worker compilation must not freeze a mounted overlay. Preserve face-priority/backpressure, geometry revisions and stale-result rejection.
5. **R05 — Recovery reference integration.** Use reason-based retry/static product view, cancellation during loading/permission wait, foreground restart via explicit action, and clear asset-load feedback. Preserve current frame on replacement failure and keep Stop reachable.

Keep R01–R05 focused on initial usability. Bounded preloading/live comparison follow once startup/resource ownership and asset budgets are stable. Technical diagnostics remain available for development without becoming required shopper decisions.

## State scenarios for contract review

| Trigger | Shopper-facing state / action | Required resource behavior |
|---|---|---|
| Page shown, no start | Product view and explicit Start | No camera or microphone request. Explicit prepare may fetch documented resources; capability inspection does not. |
| Permission unanswered | Waiting for browser permission; Cancel remains available | Do not claim permission was denied or repeatedly prompt. Ignore late session results and stop late-acquired tracks after cancellation. |
| Permission denied / policy blocked | Guidance and static product view; retry after user fixes permission | Release acquired resources; separate known policy failures from unknown native denial causes. |
| GLB/runtime slow or offline | Correct resource stage, Cancel/Retry/static-view actions | Bounded documented resource timeout; no indefinite live-camera/resource wait. Clear obsolete request state. |
| Face not yet found | One plain positioning instruction | Keep recognition active; no diagnostic calibration requirement or implied physical measurement. |
| Tracking temporarily lost | Brief stable guidance then safe reacquisition | Preserve current expiry/no-face guards; avoid frozen stale eyewear. Do not cover failure with an unbounded grace period. |
| A → B → C quickly selected | Selection feedback remains responsive; show loading C and the currently displayed pair accurately | Only latest candidate installs; failures retain valid current asset; superseded work is cancelled/disposed within bounds. |
| Worker recovery / optional model failure | Brief reconnecting or supported lower-cost path | Existing bounded CPU/optional fallback retained; no duplicate streams/workers or historic poses. |
| Context loss | Actionable recovery/static-view path | Stop safely. Recreate renderer/session before explicit restart if required; no unqualified auto-restore claim. |
| Stop / hidden / dispose | Preview stops and the choice remains meaningful in host state | Every track/worker/timer/texture released according to lifecycle; no automatic foreground camera restart. |

## Definition of done for M15

- [x] Frozen configuration and authoritative current-default checklist recorded.
- [x] Timing definitions validated with synthetic input and cold/warm baseline attempts captured using permitted aggregates.
- [ ] All physical target rows are passed, failed or untested with precise evidence; no hidden qualification gaps.
- [ ] Shopper findings summarized with sample size and prioritized actionable friction.
- [ ] Licensed SKU sample qualified or external dependency recorded explicitly.
- [ ] Minimal contract, compatibility/race cases and reference-flow specification reviewed.
- [ ] Proposed budgets accepted or revised with measured rationale and M16 estimates.
- [x] `IMPLEMENTATION_PLAN.md` updated with actual results and remaining dependencies.

## Evidence and verification rules

For code changes, choose checks tied to the changed behavior: workspace build/typecheck, targeted SDK/generator tests, synthetic public-API/GPU/fault checks, then affected physical-device tasks. Reuse existing checks; avoid duplicate tests that merely mirror code. Record actual commands/exits, build identity and result scope. The original planning pass ran no runtime checks; subsequent execution evidence is recorded in [sprint progress](SHOPPER_SPRINT_PROGRESS.md).

Future timing results must state n, p50/p95, timeout/failure counts, resource/cache state, configuration and clock definitions. Keep local aggregate durations/counts and pass/fail observations only. Do not commit real-person fixtures, screenshots, video, landmarks, pose traces, face-derived measurements or memory/trace dumps from real camera sessions. Numerical fit/accuracy evidence uses synthetic input.

The end-of-iteration report should state the top shopper blockers, observed baseline, selected contract, supported versus untested devices, asset dependency and next three engineering tickets. Publication and external participant outreach are separate actions; this plan does not initiate either.
