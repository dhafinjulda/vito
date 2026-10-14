/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { describe, expect, it } from 'vitest';
import { mapCoverPoint } from '../src/glasses/coordinates';

describe('mapCoverPoint', () => {
  it('maps the center of a matching aspect ratio to the viewport origin', () => {
    expect(mapCoverPoint(0.5, 0.5, 1280, 720, 1280, 720)).toEqual({ x: 0, y: 0 });
  });

  it('accounts for the horizontal crop when a portrait viewport uses cover', () => {
    const point = mapCoverPoint(0, 0.5, 1280, 720, 400, 700);
    expect(point.x).toBeCloseTo(-622.22, 1);
    expect(point.y).toBe(0);
  });
});
