/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(root, 'examples/vanilla/src/glasses-manifest.json'), 'utf8'));
const allIds = new Set();
const allFiles = new Set();

function fail(message) { throw new Error(`Demo GLB validation failed: ${message}`); }
function parseGlb(path) {
  const bytes = readFileSync(path);
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) fail(`${path} has an invalid GLB header.`);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + length > bytes.length) fail(`${path} has an invalid chunk length.`);
    if (type === 0x4e4f534a) return JSON.parse(bytes.toString('utf8', start, start + length));
    offset = start + length;
  }
  fail(`${path} has no JSON chunk.`);
}

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets) || manifest.assets.length < 1) fail('manifest schema or asset list is invalid.');
for (const asset of manifest.assets) {
  if (allIds.has(asset.id) || allFiles.has(asset.file)) fail(`duplicate asset id/file for ${asset.id}.`);
  allIds.add(asset.id); allFiles.add(asset.file);
  const fit = asset.fit;
  if (!fit || !(fit.referenceEyeSpan > 0) || !(fit.scale > 0) || fit.offset?.length !== 3 || fit.rotation?.length !== 3) fail(`${asset.id} has invalid fitting calibration.`);
  if (!(asset.nominalDimensionsMm?.frameWidth > 0) || !(asset.nominalDimensionsMm?.templeLength > 0)) fail(`${asset.id} has no positive nominal dimensions.`);
  if (!asset.assetProvenance || (asset.license !== 'CC0' && !asset.assetProvenance.includes('demonstration geometry'))) fail(`${asset.id} is missing its demo provenance or recognized license.`);
  const path = resolve(root, 'examples/vanilla/public', asset.file);
  if (!path.startsWith(resolve(root, 'examples/vanilla/public'))) fail(`${asset.id} escapes the public asset directory.`);
  const gltf = parseGlb(path);
  const scene = gltf.scenes?.[0];
  const extras = scene?.extras ?? scene?.nodes?.map(index => gltf.nodes?.[index]?.extras).find(value => value?.vtoGlasses);
  const metadata = extras?.vtoGlasses;
  if (!metadata) fail(`${asset.file} is missing embedded vtoGlasses metadata.`);
  if (metadata.schemaVersion !== manifest.schemaVersion || metadata.id !== asset.id) fail(`${asset.file} metadata identity/schema does not match the manifest.`);
  if (JSON.stringify(metadata.fit) !== JSON.stringify(asset.fit)) fail(`${asset.file} fit calibration differs from the manifest.`);
  if (JSON.stringify(metadata.nominalDimensionsMm) !== JSON.stringify(asset.nominalDimensionsMm)) fail(`${asset.file} dimensions differ from the manifest.`);
  const names = new Set((gltf.nodes ?? []).map(node => node.name).filter(Boolean));
  for (const partList of Object.values(asset.partNames ?? {})) for (const partName of partList) if (!names.has(partName)) fail(`${asset.file} is missing named part ${partName}.`);
  for (const name of asset.partNames?.temples ?? []) if (!/(^|[-_ ])temple([-_ ]|$)/i.test(name)) fail(`${asset.id} temple ${name} is not selected by the SDK temple shader.`);
  for (const name of asset.partNames?.rearTips ?? []) if (!/(^|[-_ ])ear[-_ ]?tip([-_ ]|$)/i.test(name)) fail(`${asset.id} rear tip ${name} is not selected by the SDK temple shader.`);
  if (asset.license === 'CC0') {
    if (!asset.sourceUrl?.startsWith('https://') || metadata.license !== 'CC0' || (gltf.images ?? []).some((image) => !image.uri?.startsWith('data:'))) fail(`${asset.id} is missing its source/license metadata or has a remote texture dependency.`);
  }
  console.log(`PASS ${asset.id}: metadata, fit, dimensions, and ${names.size} named GLB nodes`);
}
console.log(`Validated ${manifest.assets.length} demo/test GLBs against the shared calibration manifest.`);
