# Shopper sprint report — 15 October 2026

Local engineering is complete for this iteration's feasible software scope.
M15/M16 acceptance remains open. The owner confirmed that physical target phones
and a licensed retail sample are unavailable. There are zero observed shopper
sessions; no participant outreach or retail/device qualification was performed.

## Delivered and checked

- Typed readiness, bounded resource waits and cancellation; permission prompts
  remain untimed. Owned GLB fetches abort superseded work, late parse results are
  disposed, and failed replacements retain a valid model.
- Public explicit camera-free `prepare()`, one-worker adoption, concurrent start,
  changed-geometry activation warmup and one face-only optional-startup fallback.
  Stop/page hide/disposal release workers/tracks. Camera access requires `start()`
  and always requests audio false.
- Local startup/worker/preparation software timings and typed camera/timeout
  reasons. No remote telemetry or frame/face/hand/mask persistence added.
- Reference flow centers preview, Start/Stop, current choice and collection.
  Advanced controls remain available below the collection in a native disclosure.
  Rapid choices remain enabled, latest selection wins, failed replacement retains
  the active choice, stale work cannot overwrite recreated sessions, and loading
  announcements remain stable. No catalog/commerce state moved into the SDK.
- [Recovery contract](SDK_RECOVERY_CONTRACT.md), [reference flow](SHOPPER_REFERENCE_FLOW.md),
  [preparation lifecycle](CAMERA_FREE_PREPARATION.md), public README and evidence.

## Final local evidence

SDK candidate **4f2e1ff673a8**, worker protocol **8**, local package source version
0.1.1. This is an unpublished local build; the existing npm release was not changed.
SDK/source/worker hashes are in
`docs/evidence/smoothness-shopper-sprint-final-manifest.json`. Reference source,
defaults and asset hashes/provenance are in `docs/evidence/shopper-final-candidate.json`.

| Check | Result / scope |
|---|---|
| `pnpm test` | 319 SDK + 108 generator tests pass; offline-cache policy passes. `shopper-final-tests.txt`. |
| `pnpm build` | All workspace builds and demo GLB checks pass. Existing Three.js >500 kB chunk warnings remain. `shopper-final-build.txt`. |
| `pnpm typecheck` | All workspace packages/examples pass. `shopper-final-typecheck.txt`. |
| SDK loading/rendering | Seven synthetic-recognition/real-GLB/GPU cases pass, including prepared visible eyewear; `public-prepare-regression.json`. Later SDK tests/native fault checks cover geometry, fallback and camera errors. |
| Native preparation | Landscape, portrait, concurrent start and cancel pass; `prepare-fallback-happy.json`. One-worker handoff and bounded geometry/fallback have separate raw evidence. Blank input does not qualify recognized fitting. |
| Native optional failure | Deliberately stalled hair model recovers once to prepared face-only CPU, starts without another worker, cleans up; `prepare-fallback-browser.json`. |
| Camera failure UI | Five deliberate acquisition failures at 390 px pass actionable copy and retry controls; `camera-recovery-browser.json`. No native permission prompt. |
| Product browsing | Blocked A→B→C, failed replacement retention, keyboard focus, recreated-session race, zero stable-state mutations and desktop/mobile overflow checks pass; `shopper-flow-browser.json`. |
| Final reference lifecycle | Idle error→retry, Stop while loading, restart, audio false and complete cleanup pass; `shopper-final-loading.json`. |
| Visual inspection | Desktop/390px synthetic or camera-off screenshots inspected; `shopper-flow-{desktop,mobile}.png`. No actual person images. |

Evidence files above are under `docs/evidence`. `git diff --check` passes. Browser
viewports are not physical phones; assertions are scoped to their recorded input.

## Timing interpretation

Current work does not establish population p95 or a matched SDK speedup. A recorded
native sample moved 11,452.3 ms into explicit preparation and reached tracker ready
79.9 ms after subsequent Start; include both costs. Portrait activation added
140.3 ms in a separate sample. Cache/network/GPU histories differ. Earlier nearest-rank
cohorts contain only three cold/five warm attempts and are descriptive, not SLA
evidence. First fitted CPU submission is not GPU completion or visual acceptance.

## S06 synthetic inspection fallback

Use Contour as the available synthetic fixture: original repository procedural
geometry, 256,740 bytes, 10,076 mesh-definition triangles, no texture images,
named rims/lenses/temples/rear tips/bridge, bridge-contact convention and explicit
fit/nominal dimensions. Metadata consistency passes the existing GLB validator.
Its 146 mm width/136 mm temple numbers are authoring values, not supplier measurements.
See `THIRD_PARTY_NOTICES.md` and `shopper-final-candidate.json`. The original demo
coordinate convention uses model units and reference eye span, not measured optics.

Linea is 274,468 bytes/10,652 mesh triangles. The Poly Haven CC0 sample is
3,292,684 bytes/11,810 mesh triangles with four images: transfer exceeds the proposed
2 MB limit; decoded texture bytes are unmeasured in this inventory. Keep it a test
asset and the exception open. Inventory counts do not certify retail appearance,
physical scale, manifold connectivity or device memory consumption.

## Support and acceptance

| Target / evidence | Current disposition |
|---|---|
| Desktop Chromium synthetic/native blank streams | Evaluation checks pass as listed; current recognized-face/visual acceptance untested. |
| Physical iPhone/Safari | Untested; hardware unavailable. |
| Physical midrange Android/Chrome | Untested; hardware unavailable. |
| Physical higher-end Android/Chrome | Untested; hardware unavailable. |
| Retail geometry and supplier dimensions/license | Unavailable; no SKU qualified. Synthetic inspection fallback complete. |
| Shopper task observations | 0 sessions; completion/help rates and top-five observed friction cannot be computed. Protocol ready in sprint progress. |
| Production support tiers and budgets | Unratified; no production device tier declared. |

Keep proposed targets unchanged pending evidence: warm software-controlled first
usable p95 ≤3 s, cold ≤8 s at controlled 20 Mbps/100 ms, ≥20 face results/s and
capture-to-CPU-submission p95 ≤150 ms for the proposed standard tier. Existing small
desktop samples do not accept these targets. Do not lower targets to close tickets.

## Current ticket disposition and next three actions

S01 and the local portion of S02 are complete. S05 contract/software and S07 local
reference specification/implementation are complete with unobserved assumptions.
S06 uses its explicit synthetic fallback; retail qualification stays open. S03/S04
and S08 physical evidence/budget ratification are blocked by unavailable external
inputs. No actual-shopper friction ranking is claimed from engineering review.

1. When phones are available, run the exact frozen candidate through
   [device acceptance](FINAL_DEVICE_ACCEPTANCE.md), including recognized ten-minute
   use, portrait, permissions, network privacy and repeated lifecycle tasks.
   Estimate: 2–3 engineering/QA days, excluding acquiring devices and fixing failures.
2. Obtain one licensed retail GLB and supplier dimensions; inspect provenance,
   semantic geometry/materials and fit against the same candidate. Estimate:
   1–2 asset/engineering days after delivery, plus supplier review.
3. Run 6–8 consenting shopper sessions using the existing no-recording protocol;
   rank anonymous task friction and ratify support tiers/budgets before M17/M18
   expansion. Estimate: 2–3 UX/owner days excluding recruitment and remediation.

Estimates are planning ranges, not staffing commitments. M17–M19 remain gated;
preloading caches, two-choice shortlist, additional locales and packed-framework
qualification remain later roadmap work. No deployment, outreach, purchase,
commit/push or npm publication was performed by this iteration.
