/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyLocalAmbientEstimate, LocalAmbientEstimator } from '../src/rendering/LocalAmbientEstimator';

function fixture(border: [number, number, number], center: [number, number, number] = [220, 170, 145]) {
  const width = 64, height = 48;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const edge = x < 12 || x >= width - 12 || y < 9 || y >= height - 9;
    const color = edge ? border : center;
    const index = (y * width + x) * 4;
    rgba[index] = color[0]; rgba[index + 1] = color[1]; rgba[index + 2] = color[2]; rgba[index + 3] = 255;
  }
  return { rgba, width, height };
}

describe('local ambient estimator', () => {
  it('uses the border to estimate scene light instead of central face color', () => {
    const estimator = new LocalAmbientEstimator();
    const warm = fixture([190, 120, 64]);
    const estimate = estimator.update(warm.rgba, warm.width, warm.height, 1000)!;
    expect(estimate).not.toBeNull();
    expect(estimate.color[0]).toBeGreaterThan(estimate.color[2]);
    const cool = fixture([48, 92, 180]);
    const next = estimator.update(cool.rgba, cool.width, cool.height, 3000)!;
    expect(next.color[2]).toBeGreaterThan(next.color[0]);
    expect(next.confidence).toBe(1);
  });

  it('smooths valid lighting changes and rejects unusable samples', () => {
    const estimator = new LocalAmbientEstimator();
    const warm = fixture([180, 100, 40]);
    const dark = fixture([2, 2, 2]);
    const first = estimator.update(warm.rgba, warm.width, warm.height, 100)!;
    const stale = estimator.update(dark.rgba, dark.width, dark.height, 50);
    const afterStale = estimator.update(warm.rgba, warm.width, warm.height, 200)!;
    expect(stale).toBeNull();
    expect(afterStale.luminance).toBeGreaterThan(0);
    expect(first.luminance).toBeGreaterThan(0);
    expect(estimator.update(new Uint8Array(4), 1, 1, 300)).toBeNull();
    estimator.reset();
  });

  it('maps the local estimate into bounded Three.js ambient light', () => {
    const light = new THREE.HemisphereLight(0xffffff, 0, 1);
    applyLocalAmbientEstimate(light, { color: [0.7, 0.3, 0.1], luminance: 0.4, confidence: 1 });
    expect(light.intensity).toBeGreaterThanOrEqual(0.16);
    expect(light.intensity).toBeLessThanOrEqual(0.8);
    expect(light.color.r).toBeGreaterThan(light.color.b);
  });
});
