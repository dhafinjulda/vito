/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FIT, fitFace, resolveFit, writeFaceVertices, type FacePose } from '../src/glasses/fitting';
import { PoseSmoother } from '../src/glasses/PoseSmoother';
import { syntheticFrame } from './synthetic-frame';

const projection = { width: 640, height: 400, videoWidth: 1280, videoHeight: 720, fov: 63 };
function poseAt(yaw = 0, distance = 60): FacePose {
  const frame = syntheticFrame(yaw, 0, 0, 1280, 720, distance);
  return fitFace(frame.landmarks, frame.matrix, projection, DEFAULT_FIT)!;
}
function translated(pose: FacePose, x: number, z = 0): FacePose {
  const offset = new THREE.Vector3(x, 0, z);
  return { ...pose, headPosition: pose.headPosition.clone().add(offset), position: pose.position.clone().add(offset), faceDepth: pose.faceDepth - z };
}

describe('tracking refinement', () => {
  it.each([-84, -45, 0, 45, 84])('rejects one corrupted eye or depth anchor at yaw %s without changing distance', yaw => {
    const frame = syntheticFrame(yaw, 0, 0, 1280, 720, 60);
    const clean = fitFace(frame.landmarks, frame.matrix, projection, DEFAULT_FIT)!;
    for (const index of [33, 263, 133, 70, 54, 21, 10, 151]) {
      const noisy = frame.landmarks.map(p => ({ ...p }));
      noisy[index]!.x += 0.04; noisy[index]!.z += 0.025;
      const pose = fitFace(noisy, frame.matrix, projection, DEFAULT_FIT)!;
      expect(pose.faceDepth).toBeCloseTo(clean.faceDepth, 5);
      expect(pose.rotation.angleTo(clean.rotation)).toBeCloseTo(0, 6);
    }
  });

  it('uses landmark rotation rather than accepting a sheared matrix', () => {
    const frame = syntheticFrame(45);
    const matrix = [...frame.matrix]; matrix[4]! += 0.6;
    const pose = fitFace(frame.landmarks, matrix, projection, DEFAULT_FIT)!;
    const fallback = fitFace(frame.landmarks, null, projection, DEFAULT_FIT)!;
    expect(pose.state.source).toBe('landmarks');
    expect(pose.rotation.angleTo(fallback.rotation)).toBeCloseTo(0, 6);
  });

  it('attenuates alternating translation noise by at least 65% after settling', () => {
    const base = poseAt(); const smoother = new PoseSmoother();
    smoother.update(base, 1000);
    let squaredError = 0;
    for (let i = 1; i <= 120; i++) {
      const result = smoother.update(translated(base, i % 2 ? 0.12 : -0.12), 1000 + i * 1000 / 30);
      if (i > 30) squaredError += (result.pose.headPosition.x - base.headPosition.x) ** 2;
    }
    expect(Math.sqrt(squaredError / 90)).toBeLessThan(0.12 * 0.35);
  });

  it('does not let fast yaw increase the depth-noise response', () => {
    const base = poseAt(); const still = new PoseSmoother(); const turning = new PoseSmoother();
    still.update(base, 1000); turning.update(base, 1000);
    const noisy = translated(base, 0, -0.2);
    const rotated = { ...noisy, headRotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.2) };
    const a = still.update(noisy, 1033).pose;
    const b = turning.update(rotated, 1033).pose;
    expect(b.faceDepth).toBeCloseTo(a.faceDepth, 8);
  });

  it('follows deliberate motion faster than a fixed low-pass cutoff', () => {
    const base = poseAt(); const smoother = new PoseSmoother(); smoother.update(base, 1000);
    let fixedX = base.headPosition.x; let result = base;
    const fixedAlpha = 1 / (1 + 1 / (2 * Math.PI * 1.5 / 30));
    for (let i = 1; i <= 20; i++) {
      const target = translated(base, i * 0.15);
      fixedX += (target.headPosition.x - fixedX) * fixedAlpha;
      result = smoother.update(target, 1000 + i * 1000 / 30).pose;
    }
    expect(Math.abs(result.headPosition.x - 3)).toBeLessThan(Math.abs(fixedX - 3) * 0.6);
  });

  it('keeps bridge mesh and calibrated asset registered through a combined turn/retreat', () => {
    const initial = syntheticFrame(0, 0, 0, 1280, 720, 60); const frame = syntheticFrame(55, 20, -10, 1280, 720, 62);
    const fit = resolveFit({ offset: [0.07, -0.02, 0.087], rotation: [0.1, 0.05, 0] });
    const smoother = new PoseSmoother();
    smoother.update(fitFace(initial.landmarks, initial.matrix, projection, fit)!, 1000);
    const raw = fitFace(frame.landmarks, frame.matrix, projection, fit)!;
    const filtered = smoother.update(raw, 1033);
    expect(filtered.alpha).toBeLessThan(1);
    const pose = filtered.pose;
    const unit = new THREE.Vector3(1, 1, 1);
    const correction = new THREE.Matrix4().compose(pose.headPosition, pose.headRotation, unit)
      .multiply(new THREE.Matrix4().compose(raw.headPosition, raw.headRotation, unit).invert());
    const vertices = new Float32Array(468 * 3);
    writeFaceVertices(vertices, frame.landmarks, raw.faceDepth, projection, 1, correction);
    expect(new THREE.Vector3().fromArray(vertices, 168 * 3).distanceTo(pose.headPosition)).toBeLessThan(0.00001);
    const offset = new THREE.Vector3(...fit.offset).multiplyScalar(pose.scale).applyQuaternion(pose.headRotation);
    expect(pose.position.clone().sub(pose.headPosition).distanceTo(offset)).toBeLessThan(0.00001);
    expect(pose.faceDepth).toBeCloseTo(-pose.headPosition.z, 7);
  });

  it('passes through on pause, reacquisition, disabled smoothing and nonmonotonic time', () => {
    const base = poseAt(); const moved = translated(base, 1);
    for (const [time, enabled] of [[1500, true], [1000, true], [1033, false]] as const) {
      const smoother = new PoseSmoother(); smoother.update(base, 1000);
      expect(smoother.update(moved, time, enabled).alpha).toBe(1);
    }
    const smoother = new PoseSmoother(); smoother.update(base, 1000); smoother.reset();
    expect(smoother.update(moved, 1033).alpha).toBe(1);
  });
});
