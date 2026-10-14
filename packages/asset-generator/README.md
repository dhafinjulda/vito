# VTO asset generator

Optional framework-independent module. The core SDK does not import it.
Creates round, rectangle and cat-eye glasses GLBs locally from a description
or recipe; supports solid acetate/metal presets. Geometry is an approximation.

```sh
pnpm add /absolute/path/vto-asset-generator-0.1.0.tgz
```

Not yet published. Final registry scope remains pending ownership. Original code
is licensed CPAL-1.0; LICENSE and NOTICE are included. Preserve the attribution
and source/network obligations defined there; upstream code retains its license.

```ts
import { generateGlassesAsset } from '@vto/asset-generator';
const asset = await generateGlassesAsset({
  description: 'Kacamata bulat acetate hitam, lensa bening, 52-18-140',
});
const url = URL.createObjectURL(asset.blob);
await tryOn.setGlasses(url); // calibration embedded in GLB
// Revoke the URL after the SDK releases the asset.
```

Results include recipe, fit, physicalFit, structural report, manifest and
downloadable GLB/recipe/manifest files. Generation never starts a camera or
makes network requests by default. Optional application-owned interpreter
receives product text and AbortSignal only; its output is validated. Unknown
styles/conflicting dimensions fail. Description dimensions remain estimated.
AbortSignal/deadline suppress delivery; started export finishes before cleanup.
Caller-owned preview scenes require disposeGeneratedGlasses().
Browser generation requires Blob/FileReader; this is not a server mesh API.
Three.js license is included in dist/licenses/Three.txt.
