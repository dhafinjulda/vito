/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';

export interface LocalAmbientEstimate {
  /** Linear-light RGB chromaticity sampled from the outer image border. */
  color: [number, number, number];
  /** Rec.709 relative luminance in linear light. */
  luminance: number;
  /** Fraction of sampled pixels that were not clipped or nearly black. */
  confidence: number;
}

/**
 * Experimental, local-only ambient estimate from a downsampled camera image.
 * It samples only border pixels to reduce direct face-color bias. This is an
 * appearance cue, not a calibrated environment-light reconstruction.
 */
export class LocalAmbientEstimator {
  private filtered: LocalAmbientEstimate | null = null;
  private previousTime: number | null = null;

  update(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, timestampMs: number): LocalAmbientEstimate | null {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 || rgba.length < width * height * 4 || !Number.isFinite(timestampMs)) return null;
    const marginX = Math.max(1, Math.floor(width * 0.18));
    const marginY = Math.max(1, Math.floor(height * 0.18));
    let red = 0, green = 0, blue = 0, total = 0, valid = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x >= marginX && x < width - marginX && y >= marginY && y < height - marginY) continue;
        const index = (y * width + x) * 4;
        const r8 = rgba[index]!, g8 = rgba[index + 1]!, b8 = rgba[index + 2]!;
        const luminance8 = 0.2126 * r8 + 0.7152 * g8 + 0.0722 * b8;
        total++;
        if (luminance8 < 3 || luminance8 > 252) continue;
        red += srgbToLinear(r8 / 255);
        green += srgbToLinear(g8 / 255);
        blue += srgbToLinear(b8 / 255);
        valid++;
      }
    }
    if (valid < Math.max(12, Math.floor(total * 0.1))) return null;
    const raw: LocalAmbientEstimate = {
      color: [red / valid, green / valid, blue / valid],
      luminance: (0.2126 * red + 0.7152 * green + 0.0722 * blue) / valid,
      confidence: valid / total,
    };
    if (!this.filtered || this.previousTime === null || timestampMs <= this.previousTime || timestampMs - this.previousTime > 2_000) {
      this.filtered = raw;
    } else {
      const alpha = 1 - Math.exp(-(timestampMs - this.previousTime) / 650);
      this.filtered = {
        color: raw.color.map((value, index) => lerp(this.filtered!.color[index]!, value, alpha)) as LocalAmbientEstimate['color'],
        luminance: lerp(this.filtered.luminance, raw.luminance, alpha),
        confidence: lerp(this.filtered.confidence, raw.confidence, alpha),
      };
    }
    this.previousTime = timestampMs;
    return { color: [...this.filtered.color], luminance: this.filtered.luminance, confidence: this.filtered.confidence };
  }

  reset(): void { this.filtered = null; this.previousTime = null; }
}

function srgbToLinear(value: number): number { return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }
function lerp(from: number, to: number, alpha: number): number { return from + (to - from) * alpha; }

/** Apply a restrained ambient tint to the glasses scene for internal evaluation. */
export function applyLocalAmbientEstimate(light: THREE.HemisphereLight, estimate: LocalAmbientEstimate): void {
  const peak = Math.max(...estimate.color, 0.015);
  const normalized = estimate.color.map(value => THREE.MathUtils.clamp(value / peak, 0.12, 1));
  light.color.setRGB(normalized[0]!, normalized[1]!, normalized[2]!);
  light.groundColor.setRGB(normalized[0]! * 0.16, normalized[1]! * 0.15, normalized[2]! * 0.14);
  light.intensity = THREE.MathUtils.clamp(0.12 + estimate.luminance * 1.1, 0.16, 0.8) * THREE.MathUtils.clamp(estimate.confidence, 0.25, 1);
}
