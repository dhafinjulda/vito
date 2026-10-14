# M12 — Description to SDK-ready glasses

13 October 2026. The optional generator is an SDK module. Asset Studio is its
browser-local reference integration; no camera/face/hand data leaves the device.
No npm publication.

## User flow

1. Enter a product description or choose an example; press **Buat kacamata**.
2. See the generated model and resolved dimensions immediately.
3. **Coba di kamera** or **Unduh GLB**. Camera still requires its own explicit
   start. Optional details expose dimensions/provenance, shapes and materials.

No SKU/name wizard is required. Identity and defaults are generated; unsupported
or conflicting descriptions produce actionable errors. Dimensions without
measurement evidence remain estimates.

## Decisions / acceptance

| Area | Decision | Acceptance |
| --- | --- | --- |
| Interpretation | Deterministic local Indonesian/English descriptions for supported templates; optional injected LLM callback, bounded/cancellable, strict validated JSON | Description/size-code/color/style, unknown/conflicting input, cancellation and provider failures |
| Geometry | Semantic lens/temple nodes, connected temples/ear tips, actual centreline length, bridge pivot/axes in metres, finite geometry/bounds/materials | All templates/materials, exact dimensional tolerances, connected parts and structural report |
| Portable GLB | Embed a versioned SDK fit/physical-size contract; no dependency from SDK core to generator | GLB round-trip, auto-fit from a single URL, explicit overrides and malformed metadata cleanup |
| Generated bundle | Blob, recipe, fit, physicalFit, report and portable manifest/files; caller owns blob URLs | Binary export, validation/disposal, no camera/model data in interpreter input |
| Studio | Single generation action, live 3D/result, advanced controls, atomic SDK asset replacement, no stale exports, local camera and cleanup | Desktop/mobile flow, errors/cancellation/latest-wins, downloads and public SDK rendering |

“SDK-ready” means the asset conforms to and renders through the SDK contract.
Template geometry cannot certify a manufacturer SKU or unknown physical details.
LLM interpretation cannot turn guessed dimensions into verified measurements.

## Progress

- Code/integration complete for the supported templates; qualification gates
  remain below. Five-step wizard consolidated to one generation action.
- Corrected lens semantic names, connected rear tips/front hinges/pad supports,
  actual temple centreline length, bridge pivot and exported resource cleanup.
- Latest-wins/cancellation, storage failure tolerance, serialized asset swaps,
  explicit camera lifecycle and BFCache reload handling are implemented.

### Recorded checks — 13 October 2026

| Check | Actual result / evidence |
| --- | --- |
| `pnpm build` | Exit 0. [Log](evidence/m12-build.txt). SDK 127.49 kB / 36.72 gzip; generator 92.15 kB / 26.60 gzip; worker unchanged 179.52 kB/protocol 7. Three.js example vendor chunks retain >500 kB warnings. |
| `pnpm typecheck` | Exit 0, all four workspace packages. [Log](evidence/m12-typecheck.txt). Initial Studio implicit-type error corrected before final checks. |
| `pnpm test` | Exit 0: **370 tests = 262 SDK + 108 generator**, plus offline policy. [Log](evidence/m12-tests.txt). |
| Geometry/round-trip | All templates/materials; 48 connectivity combinations across temple styles/boundary dimensions; exact dimensional tolerances, centreline, native SDK shader selectors, actual GLTFLoader metadata and deterministic binary export. |
| Public SDK WebGL | [JSON](evidence/m12-generated-sdk.json), `pass:true`. Bare URL/explicit descriptor identical 6,644 pixels / 176 px width; second asset 7,109 pixels / 206 px; rejected metadata preserves model/restart. Temple/transmission shader compilation and compositor pass, GL errors 0. |
| Studio flow | [JSON](evidence/m12-studio-flow.json), `pass:true`. Three examples generated in **141/144/114 ms** on this test machine, three files, invalid dimensions/descriptions, cancelled/latest-wins exports, restored draft and one live asset swap. Timing includes UI/test dispatch and is not a device guarantee. |
| Studio camera lifecycle | Local synthetic canvas/face fixture: zero camera calls before explicit click, one acquisition, nonzero canvas height, **12/12 advancing tracking samples**, stopped tracks and empty mount after stop. |
| Layout / UI | [Desktop](evidence/m12-studio-desktop.png), [mobile](evidence/m12-studio-mobile.png), 1360×900 and 390×844; no horizontal overflow. Batched screenshot review and one confirmation round. Impeccable detector exit 1 with only an Arial font warning; retained existing local/system body font with Georgia headings. |
| Privacy | Both browser runs: page errors 0 / write requests 0, synthetic data only, no real-person recordings. Default generation/interpreter tests require no network. |

### Failures found and corrected

- GLTFExporter Group extras initially landed on a node. Exporting a real scene
  now puts the contract at the active glTF scene root; actual loader test passes.
- [Initial public SDK failure](evidence/m12-generated-sdk-initial-failure.json):
  Vanilla CSP blocked `blob:` GLB fetch. Dev/preview/deployment CSP corrected;
  fresh browser run passed without bypassing the policy.
- Geometry review exposed a 5.31 mm cat-eye hinge gap and floating metal pads.
  Shared contour attachment and bridge-to-pad arms added, with interior/joint
  tests and runtime structural rejection of detached supporting parts.
- [Initial Studio failure](evidence/m12-studio-initial-failure.json): SDK host
  positioning collapsed the CSS overlay to zero height. Explicit overlay
  positioning fixed it; fresh run tracks continuously and cleans resources.
- First UI script used a stale example-button label; fixture corrected. Early
  camera check captured a startup watchdog message; the final check waits for
  recovery and samples continuity before accepting the flow.

### Remaining qualification / scope

- Supported template geometry is a procedural approximation. Supplier/physical
  SKU fidelity, prescription optics, live-person fitting/ear/hand/hair behavior,
  iOS/Android camera permissions, GPU/thermal behavior and cross-subject/device
  acceptance require real product/device review.
- Optional interpreter is ready for an application-owned provider; no hosted
  LLM endpoint is shipped or provider behavior certified. It produces a bounded
  recipe, not arbitrary reconstructed 3D geometry.
- Photo/CAD reconstruction, textured patterns, extra shapes, import/catalog
  workflow, ZIP/thumbnail and preemptible worker generation remain later scope.
  Drafts use the new versioned localStorage record; older wizard IndexedDB
  drafts are not imported automatically.
- Camera frames/landmarks/poses/snapshots never persisted or uploaded. Only
  authoring text/recipe is saved locally. No package published to npm.

## Public module contract

```ts
const result = await generateGlassesAsset({
  description: 'Kacamata bulat acetate hitam, lensa bening, 52-18-140',
  signal: controller.signal,
});
// Or: generateGlassesAsset({ recipe: validatedAuthoringRecipe }).
// Exactly one input is required.
const url = URL.createObjectURL(result.blob);
await tryOn.setGlasses(url); // embedded fit is adopted atomically
```

`result` supplies the binary GLB, resolved recipe, fit, physicalFit, structural
report, manifest and three downloadable files. `manifest.asset.url` is the GLB
filename; host both files in the same directory or resolve this URL yourself.
Neither generator nor manifest owns object URLs or starts the camera.

Supported design fields: round/bulat, rectangle/kotak, cat-eye/mata kucing;
acetate/asetat or metal/logam; named solid colors or six-digit hex; clear/tinted
lens appearance; lens width/height, bridge width, frame width, temple centreline
length, thickness and straight/curved temples. Size codes use millimetres.
Individually labelled dimensions accept mm/cm/inches. Defaults and derived
endpiece/frame dimensions are recorded in `report.assumptions`; they are not
supplier measurements. Unsupported patterns, transparent frame materials,
special shapes and conflicting values fail with field-level issues.

`buildParametricGlasses()` returns a caller-owned scene: call
`disposeGeneratedGlasses()` after preview use. `exportGeneratedGlassesGlb()`
preserves caller ownership; `exportGlassesGlb()` and `generateGlassesAsset()`
dispose their own temporary geometry. Abort/deadline reject delivery; the
Three.js exporter cannot be interrupted mid-export, so an already-started
export finishes internally and disposes its temporary scene when it settles.

### Optional application-owned LLM interpreter

The shortest supported flow does not need an LLM. An application may inject
one when it has a provider/backend, without changing the core SDK:

```ts
const result = await generateGlassesAsset({
  description: productText,
  interpreter: async (description, { signal }) => {
    const response = await fetch('/api/interpret-glasses', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    if (!response.ok) throw new Error('Product interpretation failed');
    return response.json(); // documented recipe, or { recipe, assumptions }
  },
  signal: controller.signal,
  timeoutMs: 20_000,
});
```

This endpoint is an integration example, not a shipped service. Provider keys
belong in the host backend. The callback receives only product text and an
AbortSignal. All fields are validated; unknown properties, unsupported recipes,
contradictions of explicit description fields and invented measured/supplier
provenance are rejected. Descriptions cannot request arbitrary LLM mesh code.
There is no silent provider fallback or remote request in the local path.

### Embedded GLB contract

The active glTF scene's `extras.vtoGlasses.sdk` carries
`{version:1, units:'meters', pivot:'nose-bridge', fit, physicalFit}`. All mesh
transforms are baked in the same bridge frame (+X right, +Y up, +Z front).
The SDK validates bounded finite values before replacing a loaded model.

- First successful load: embedded fit, then explicit constructor fields, then
  per-asset descriptor fields.
- Later generated URL: that asset's embedded fit, then descriptor overrides.
- Untagged ordinary GLB: existing string-URL behavior and descriptor defaults.
- Malformed declared contract: reject, dispose candidate, preserve current model.

Consumers' CSP `connect-src` must allow `blob:` for in-memory GLBs. The Vanilla
dev/preview/deployment headers now include it. Keep each URL alive through its
consumer lifecycle; revoke after replacement/disposal. No asset metadata is used
to fetch arbitrary linked URLs or execute code.
