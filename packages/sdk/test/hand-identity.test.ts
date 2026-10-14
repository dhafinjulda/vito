/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { describe, expect, it } from 'vitest';
import { HandIdentity } from '../src/interaction/HandIdentity';
import type { TrackedHand } from '../src/interaction/HandGrip';

function hand(x: number, label = 'Right', y = 0.5, scale = 1): TrackedHand {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  landmarks[0] = { x, y: y + 0.08 * scale, z: 0 };
  landmarks[5] = { x: x - 0.045 * scale, y: y + 0.02 * scale, z: 0 };
  landmarks[9] = { x, y, z: 0 };
  landmarks[13] = { x: x + 0.02 * scale, y: y + 0.01 * scale, z: 0 };
  landmarks[17] = { x: x + 0.045 * scale, y: y + 0.02 * scale, z: 0 };
  return { landmarks, handedness: label };
}

describe('bounded palm identity', () => {
  it('preserves original observations and identity across array reordering and duplicate labels', () => {
    const tracker = new HandIdentity(), a = hand(0.25), b = hand(0.75);
    const first = tracker.update([a, b], 100);
    expect(first.map(value => value.hand)).toEqual([a, b]);
    const reordered = tracker.update([hand(0.74), hand(0.26)], 150);
    expect(reordered.map(value => value.id)).toEqual([first[1]!.id, first[0]!.id]);
  });

  it('uses palm motion through a visible crossing even when handedness flips', () => {
    const tracker = new HandIdentity();
    const first = tracker.update([hand(0.3, 'Left'), hand(0.7, 'Right')], 0);
    const next = tracker.update([hand(0.4, 'Left'), hand(0.6, 'Right')], 50);
    expect(next.map(value => value.id)).toEqual(first.map(value => value.id));
    tracker.update([hand(0.46, 'Left'), hand(0.54, 'Right')], 80);
    const crossing = tracker.update([hand(0.46, 'Left'), hand(0.54, 'Right')], 120);
    // Input order is descending trajectory first, ascending second; labels now
    // oppose their original identities. Bounded prediction follows each motion.
    expect(crossing.map(value => value.id)).toEqual([first[1]!.id, first[0]!.id]);
    const beyond = tracker.update([hand(0.36, 'Left'), hand(0.64, 'Right')], 170);
    expect(beyond.map(value => value.id)).toEqual([first[1]!.id, first[0]!.id]);
  });

  it('reacquires a nearby missing palm briefly, expires it and refuses a remote substitute', () => {
    const tracker = new HandIdentity();
    const id = tracker.update([hand(0.3)], 0)[0]!.id;
    expect(tracker.update([], 100)).toEqual([]);
    expect(tracker.update([hand(0.32, 'Left')], 200)[0]!.id).toBe(id);
    expect(tracker.update([hand(0.85, 'Left')], 250)[0]!.id).not.toBe(id);
    tracker.update([], 750);
    expect(tracker.update([hand(0.32)], 800)[0]!.id).not.toBe(id);
  });

  it('retains the visible palm when the other disappears and comes back', () => {
    const tracker = new HandIdentity();
    const first = tracker.update([hand(0.25, 'Left'), hand(0.75)], 0);
    expect(tracker.update([hand(0.76)], 50)[0]!.id).toBe(first[1]!.id);
    expect(tracker.update([hand(0.77), hand(0.26, 'Left')], 150).map(value => value.id))
      .toEqual([first[1]!.id, first[0]!.id]);
  });

  it('does not let a remote opposite-label palm take a missing owner at the video aspect ratio', () => {
    const tracker = new HandIdentity();
    const first = tracker.update([hand(0.5, 'Right')], 1000, 1280 / 720)[0]!.id;
    expect(tracker.update([hand(0.7, 'Left')], 1080, 1280 / 720)[0]!.id).not.toBe(first);
  });

  it('treats handedness as a soft hint for nearby geometry instead of making labels an identity', () => {
    const tracker = new HandIdentity();
    const first = tracker.update([hand(0.4, 'Right')], 0)[0]!.id;
    expect(tracker.update([hand(0.42, 'Left')], 50)[0]!.id).toBe(first);
    expect(tracker.update([hand(0.44, '')], 100)[0]!.id).toBe(first);
  });

  it('releases identity after the same 450ms hand-loss window used by interaction', () => {
    const tracker = new HandIdentity();
    const first = tracker.update([hand(0.4)], 0)[0]!.id;
    expect(tracker.update([hand(0.4)], 450)[0]!.id).toBe(first);
    expect(tracker.update([hand(0.4)], 901)[0]!.id).not.toBe(first);
  });

  it('rejects invalid/duplicate/reversed observations without overwriting a healthy identity', () => {
    const tracker = new HandIdentity();
    const id = tracker.update([hand(0.4)], 100)[0]!.id;
    expect(tracker.update([hand(0.9)], 100)).toEqual([]);
    expect(tracker.update([hand(0.9)], 50)).toEqual([]);
    expect(tracker.update([hand(0.9)], NaN)).toEqual([]);
    expect(tracker.update([hand(0.9)], 120, Infinity)).toEqual([]);
    const malformed = hand(0.4); malformed.landmarks[8]!.x = NaN;
    expect(tracker.update([malformed], 130)).toEqual([]);
    expect(tracker.update([hand(0.41)], 150)[0]!.id).toBe(id);
  });

  it('does not retain mutable landmark references, limits tracking to two palms, and resets geometry on aspect changes', () => {
    const tracker = new HandIdentity(), observation = hand(0.4);
    const id = tracker.update([observation, hand(0.7), hand(0.9)], 0)[0]!.id;
    observation.landmarks.forEach(point => { point.x = 0.99; });
    expect(tracker.update([hand(0.41)], 50)[0]!.id).toBe(id);
    expect(tracker.update([hand(0.41)], 100, 2)[0]!.id).not.toBe(id);
    tracker.reset();
    expect(tracker.update([hand(0.4)], 0)[0]!.id).toBe('hand-1');
  });

  it('handles depth-related palm size changes and finger flex without a new identity', () => {
    const tracker = new HandIdentity();
    const id = tracker.update([hand(0.5)], 0)[0]!.id;
    const closer = hand(0.51, 'Right', 0.5, 1.3);
    closer.landmarks[4] = { x: 0.7, y: 0.3, z: -0.1 };
    closer.landmarks[8] = { x: 0.2, y: 0.6, z: 0.1 };
    expect(tracker.update([closer], 50)[0]!.id).toBe(id);
  });
});
