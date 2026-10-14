/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import manifest from './glasses-manifest.json';
import type { GlassesAsset, GlassesFit } from 'vito-sdk';

export const demoGlassesManifest = manifest;

export function getDemoFit(index = 0): GlassesFit {
  const fit = manifest.assets[index]!.fit;
  return {
    referenceEyeSpan: fit.referenceEyeSpan,
    scale: fit.scale,
    offset: [fit.offset[0]!, fit.offset[1]!, fit.offset[2]!],
    rotation: [fit.rotation[0]!, fit.rotation[1]!, fit.rotation[2]!],
  };
}

export function getDemoGlassesAssets(): GlassesAsset[] {
  return manifest.assets.map((asset, index) => ({ url: `/${asset.file}`, fit: getDemoFit(index) }));
}
