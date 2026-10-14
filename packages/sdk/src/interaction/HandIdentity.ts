/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import type { TrackedHand } from './HandGrip';

export interface IdentifiedHand { id: string; hand: TrackedHand }

interface Palm {
  x: number;
  y: number;
  span: number;
  width: number;
  acrossX: number;
  acrossY: number;
}

interface Track extends Palm {
  id: string;
  handedness: string;
  seenAt: number;
  vx: number;
  vy: number;
  moving: boolean;
}

const EXPIRES_MS = 450;
const PALM_INDICES = [0, 5, 9, 13, 17] as const;

function palm(hand: TrackedHand, aspect: number): Palm | null {
  const points = hand.landmarks;
  if (points.length !== 21 || !points.every(p => [p.x, p.y, p.z].every(Number.isFinite))) return null;
  let x = 0, y = 0;
  for (const index of PALM_INDICES) { x += points[index]!.x * aspect; y += points[index]!.y; }
  x /= PALM_INDICES.length; y /= PALM_INDICES.length;
  const span = Math.hypot((points[9]!.x - points[0]!.x) * aspect, points[9]!.y - points[0]!.y);
  const acrossX = (points[5]!.x - points[17]!.x) * aspect, acrossY = points[5]!.y - points[17]!.y;
  const width = Math.hypot(acrossX, acrossY);
  if (span < 0.015 || width < 0.01) return null;
  return { x, y, span, width, acrossX: acrossX / width, acrossY: acrossY / width };
}

function matchCost(track: Track, observation: Palm, handedness: string, time: number): number {
  const dt = time - track.seenAt;
  // Extrapolate only a short interval. Long occlusions must not send a predicted
  // palm across the image and capture a different person's or the other hand.
  const horizon = Math.min(dt, 120);
  const distance = Math.hypot(observation.x - track.x - track.vx * horizon, observation.y - track.y - track.vy * horizon);
  const size = Math.max(0.025, (track.span + observation.span) / 2);
  const gate = Math.max(0.12, size * 2.5) + Math.min(0.035, Math.max(0, dt - 100) * 0.0001);
  if (distance > gate) return Infinity;
  const scaleDifference = Math.abs(Math.log(observation.span / track.span));
  const shapeDifference = Math.abs(observation.width / observation.span - track.width / track.span);
  const orientationDifference = 1 - (observation.acrossX * track.acrossX + observation.acrossY * track.acrossY);
  // MediaPipe can reorder observations or flip labels during occlusion. Geometry
  // dominates; handedness is only a small tie breaker, never an identity key.
  const labelDifference = track.handedness && handedness && track.handedness !== handedness ? 0.16 : 0;
  return distance / size + Math.min(1, scaleDifference) * 0.3 + Math.min(1, shapeDifference) * 0.12
    + orientationDifference * 0.04 + labelDifference;
}

/**
 * Session-local identities for at most two observed palms. The tracker keeps
 * only the latest numeric palm descriptor and velocity, never landmark arrays.
 * Complete overlaps and long occlusions cannot be resolved from monocular
 * landmarks alone; unmatched palms receive a fresh identity instead.
 */
export class HandIdentity {
  private tracks: Track[] = [];
  private sequence = 0;
  private lastTime = -Infinity;
  private aspect: number | null = null;

  reset(): void { this.tracks = []; this.sequence = 0; this.lastTime = -Infinity; this.aspect = null; }

  update(hands: readonly TrackedHand[], timestampMs: number, aspect = 1): IdentifiedHand[] {
    if (!Number.isFinite(timestampMs) || timestampMs <= this.lastTime || !Number.isFinite(aspect) || aspect <= 0) return [];
    if (this.aspect !== null && Math.abs(this.aspect - aspect) > 1e-6) this.tracks = [];
    this.aspect = aspect;
    this.lastTime = timestampMs;
    this.tracks = this.tracks.filter(track => timestampMs - track.seenAt <= EXPIRES_MS);
    const observations: { hand: TrackedHand; palm: Palm }[] = [];
    for (const hand of hands.slice(0, 2)) {
      const value = palm(hand, aspect);
      if (value) observations.push({ hand, palm: value });
    }
    if (observations.length === 0) return [];

    // Exhaustive assignment is bounded to two palms. Include an unmatched option
    // so a remote new palm cannot inherit ownership simply because a slot exists.
    let best: number[] = [], bestCost = Infinity;
    const assign = (index: number, chosen: number[], cost: number): void => {
      if (index === observations.length) {
        if (cost < bestCost) { best = chosen.slice(); bestCost = cost; }
        return;
      }
      const observation = observations[index]!;
      for (let trackIndex = 0; trackIndex < this.tracks.length; trackIndex++) {
        if (chosen.includes(trackIndex)) continue;
        const score = matchCost(this.tracks[trackIndex]!, observation.palm, observation.hand.handedness, timestampMs);
        if (Number.isFinite(score)) assign(index + 1, [...chosen, trackIndex], cost + score);
      }
      assign(index + 1, [...chosen, -1], cost + 2.4);
    };
    assign(0, [], 0);

    const seen = new Set<string>(), nextTracks: Track[] = [];
    const result = observations.map((observation, index): IdentifiedHand => {
      const previous = best[index]! >= 0 ? this.tracks[best[index]!] : undefined;
      const dt = previous ? timestampMs - previous.seenAt : 0;
      let vx = previous ? (observation.palm.x - previous.x) / dt : 0;
      let vy = previous ? (observation.palm.y - previous.y) / dt : 0;
      if (previous?.moving) { vx = vx * 0.65 + previous.vx * 0.35; vy = vy * 0.65 + previous.vy * 0.35; }
      const speed = Math.hypot(vx, vy), limit = 0.0035;
      if (speed > limit) { vx *= limit / speed; vy *= limit / speed; }
      const track: Track = { ...observation.palm, id: previous?.id ?? `hand-${++this.sequence}`,
        handedness: observation.hand.handedness, seenAt: timestampMs, vx, vy, moving: !!previous };
      nextTracks.push(track);
      seen.add(track.id);
      return { id: track.id, hand: observation.hand };
    });
    // A new palm replaces the oldest absent palm when both slots were occupied.
    const absent = this.tracks.filter(track => !seen.has(track.id)).sort((a, b) => b.seenAt - a.seenAt);
    for (const track of absent) { if (nextTracks.length < 2) nextTracks.push(track); }
    this.tracks = nextTracks;
    return result;
  }
}
