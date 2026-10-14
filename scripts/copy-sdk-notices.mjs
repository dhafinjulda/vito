/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
const out = new URL('../packages/sdk/dist/', import.meta.url);
mkdirSync(new URL('licenses/', out), { recursive: true });
copyFileSync(new URL('./assets/mediapipe-LICENSE.txt', import.meta.url), new URL('licenses/MediaPipe.txt', out));
copyFileSync(new URL('../node_modules/three/LICENSE', import.meta.url), new URL('licenses/Three.txt', out));
writeFileSync(new URL('licenses/WebAR.rocks.face-MIT.txt', out), `MIT License\n\nCopyright (c) 2020 WebAR.Rocks\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`);
writeFileSync(new URL('THIRD_PARTY_NOTICES.md', out), `# Third-party notices\n\nMediaPipe Tasks Vision (in the worker) and the canonical face triangle topology: Copyright The MediaPipe Authors, Apache License 2.0. Full license: licenses/MediaPipe.txt. Canonical source: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj\n\nThree.js RoomEnvironment source is included in the SDK bundle. Three.js: Copyright © 2010–2025 three.js authors, MIT License. Full license: licenses/Three.txt. Source: https://github.com/mrdoob/three.js\n\nThe SDK's temple shader adaptation is based on glasses bending/fading mechanics from WebAR.rocks.face helpers/WebARRocksMirror.js at commit 819cdbad4e87a43635d5f9724e30f277a7e7964d. The source repository declares MIT for /helpers. Full license: licenses/WebAR.rocks.face-MIT.txt.\n\nRuntime/model downloads and GLB assets retain their own upstream or author licenses. No project-wide license is assigned by this notice.\n`);
console.log('Included third-party notices and license texts in SDK distribution.');
