/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
const out = new URL('../packages/asset-generator/dist/', import.meta.url);
mkdirSync(new URL('licenses/', out), { recursive: true });
copyFileSync(new URL('../node_modules/three/LICENSE', import.meta.url), new URL('licenses/Three.txt', out));
writeFileSync(new URL('THIRD_PARTY_NOTICES.md', out), '# Third-party notices\n\nThree.js GLTFExporter is included in the bundle; Three.js is also a runtime dependency. Copyright three.js authors, MIT. Full license: licenses/Three.txt.\n\nParametric templates are original repository geometry; outputs are template approximations, not branded product replicas. No external model weights are bundled. Project licensing is defined separately.\n');
