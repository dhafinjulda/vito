# Third-party assets

The canonical face mesh in `scripts/assets/canonical_face_model.obj`, its generated triangle indices in `packages/sdk/src/glasses/face-topology.ts`, and its synthetic-test coordinates in `packages/sdk/test/canonical-face.ts` come from the MediaPipe project, Copyright The MediaPipe Authors, licensed under Apache License 2.0.

Source: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj

License: https://www.apache.org/licenses/LICENSE-2.0 (full copy in `scripts/assets/mediapipe-LICENSE.txt`). These are a generic canonical model, not camera data or a scan of a user.

The demonstration eyewear GLBs are original procedural geometry created in this repository. They are illustrative designs, not branded product replicas. The example's nominal dimensions describe the generated asset; camera fitting is not a physical measurement or prescription fitting service.

The optional asset generator's round, rectangle and cat-eye templates are also
original procedural geometry in this repository. Local generation downloads no
external 3D asset or model weights. Output metadata records the template/version,
recipe dimensions, provenance and `template-approximation` fidelity. The optional
application-owned LLM interpreter is not bundled with a provider, API key or
trained weights; applications must inventory their chosen provider and any
custom assets separately. Three.js/GLTFExporter retain the upstream MIT license.

`examples/vanilla/public/round-spectacles.glb` is built from the 1K glTF, binary geometry, and textures for [Round Spectacles by Poly Haven](https://polyhaven.com/a/round_spectacles). Poly Haven releases this asset under CC0: https://polyhaven.com/license. The source files used by the deterministic GLB builder are in `scripts/assets/polyhaven-round-spectacles/`. Attribution is not required by CC0; attribution is included here for provenance. This generic test model is not a retail SKU or a verified product specification. The example bundles its textures locally in the GLB; the model is not fetched at runtime.

The installed MediaPipe and Three.js packages retain their upstream licenses. Model/WASM downloads retain their respective upstream license and hosting terms.

## Optional hair segmentation model

The opt-in hair occlusion module downloads Google's version 1 float32 Hair
Segmenter from
`https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite`.
Weights are not vendored in this repository or included in the SDK package. The
SDK does not persist/cache this optional model or segmentation output. A host
can provide its own local `hairOcclusion.modelAssetPath`.

Google's [model guide](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter)
links the [Hair Segmentation model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20-%20Hair%20Segmentation.pdf),
which identifies Google researchers (2019-01-14) and declares Apache License 2.0.
The full Apache license is already retained in `scripts/assets/mediapipe-LICENSE.txt`.
Model card inspected on 2026-10-13. This is hair/background segmentation for a
single selfie subject; it does not supply anatomical ears or hair depth.
Custom models/redistributed weights require their own license inventory.

The SDK's `packages/sdk/src/rendering/TempleEffects.ts` adapts the glasses-temple bending and fading technique from WebAR.rocks.face. It is an independent TypeScript/Three.js r176 port, not a copy of the upstream helper. Reviewed source is pinned to commit `819cdbad4e87a43635d5f9724e30f277a7e7964d`; source mapping and SHA-256 inventory are recorded in `docs/VTOGLASSES_MIGRATION.md`. The upstream repository declares the MIT license for `/helpers`; its copyright and license text follow.

WebAR.rocks.face
Copyright (c) 2025 WebAR.rocks

MIT License

Copyright (c) 2020 WebAR.Rocks

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
