/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';

const url='https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite';
const response=await fetch(url);
if(!response.ok)throw new Error(`Model inventory HTTP ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());
const inventory={checkedAt:new Date().toISOString(),url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
  license:'Apache-2.0 as declared by the official Hair Segmentation model card',modelCard:'https://storage.googleapis.com/mediapipe-assets/Model%20Card%20-%20Hair%20Segmentation.pdf',
  vendored:false,outputContainsWeights:false,runtimeIntegrityEnforced:false};
bytes.fill(0);
await writeFile(new URL('../docs/evidence/hair-model-inventory.json',import.meta.url),JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify(inventory));
