# Poly Haven Round Spectacles test source

- Asset page: https://polyhaven.com/a/round_spectacles
- License: CC0, https://polyhaven.com/license
- Download variant: 1K glTF geometry with PBR JPEG maps
- `round_spectacles_1k.gltf` references `round_spectacles.bin` and the three files in `textures/`.
- Generated public artifact: `examples/vanilla/public/round-spectacles.glb`.
- Rebuild with `node scripts/build-polyhaven-glasses.mjs` (included in `pnpm build` and `pnpm dev`).
- This is a generic authored test model. Its mesh bounds are used as a visual fit calibration starting point; Poly Haven's page width and our mesh bounds are not a verified SKU specification.
- The generated GLB embeds the textures so the example makes no asset-host request at runtime.

This is bundled as a development/reference-example test asset only. Before commercial redistribution, retain this record and recheck the asset page and CC0 statement.
