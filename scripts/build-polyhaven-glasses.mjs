/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(root, 'examples/vanilla/src/glasses-manifest.json'), 'utf8'));
const asset = manifest.assets.find((entry) => entry.id === 'round-spectacles-cc0');
if (!asset) throw new Error('round-spectacles-cc0 is missing from the glasses manifest.');

const sourceRoot = resolve(root, 'scripts/assets/polyhaven-round-spectacles');
const gltf = JSON.parse(readFileSync(resolve(sourceRoot, 'round_spectacles_1k.gltf'), 'utf8'));
const binary = readFileSync(resolve(sourceRoot, 'round_spectacles.bin'));
const expectedBinaryLength = gltf.buffers?.[0]?.byteLength;
if (!expectedBinaryLength || expectedBinaryLength !== binary.byteLength) throw new Error('Poly Haven source binary length does not match its glTF descriptor.');

gltf.asset.extras = {
  vtoGlasses: {
    schemaVersion: manifest.schemaVersion,
    id: asset.id,
    label: asset.label,
    coordinateSystem: manifest.coordinateSystem,
    fit: asset.fit,
    nominalDimensionsMm: asset.nominalDimensionsMm,
    license: asset.license,
    assetProvenance: asset.assetProvenance,
  },
};
gltf.scenes[gltf.scene ?? 0].extras = { vtoGlasses: gltf.asset.extras.vtoGlasses };
gltf.buffers = [{ byteLength: binary.byteLength }];

for (const image of gltf.images ?? []) {
  if (!image.uri || image.uri.startsWith('data:')) continue;
  const filename = image.uri.split('/').at(-1);
  if (!filename) throw new Error(`Invalid image URI in Poly Haven glTF: ${image.uri}`);
  const bytes = readFileSync(resolve(sourceRoot, 'textures', filename));
  image.uri = `data:${image.mimeType ?? 'image/jpeg'};base64,${bytes.toString('base64')}`;
}

const align4 = (buffer, fill = 0) => {
  const padding = (4 - (buffer.byteLength % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, fill)]) : buffer;
};
const jsonChunk = align4(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20);
const binaryChunk = align4(binary);
const totalLength = 12 + 8 + jsonChunk.byteLength + 8 + binaryChunk.byteLength;
const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.byteLength, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(binaryChunk.byteLength, 0);
binaryHeader.writeUInt32LE(0x004e4942, 4);
const output = resolve(root, 'examples/vanilla/public', asset.file);
writeFileSync(output, Buffer.concat([header, jsonHeader, jsonChunk, binaryHeader, binaryChunk]));
console.log(`${asset.id}: wrote ${totalLength} byte GLB with embedded 1K PBR textures`);
