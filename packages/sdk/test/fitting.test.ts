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
import { coverCameraFov, DEFAULT_FIT, fitFace, projectFacePoint, resolveFit, writeFaceVertices, type Projection } from '../src/glasses/fitting';
import { PoseSmoother } from '../src/glasses/PoseSmoother';
import { FACE_TRIANGLES } from '../src/glasses/face-topology';
import { syntheticFrame } from './synthetic-frame';
import { mapCoverPoint } from '../src/glasses/coordinates';
import { HeadOccluder } from '../src/rendering/HeadOccluder';

const projection: Projection = { width: 640, height: 400, videoWidth: 1280, videoHeight: 720, fov: 63 };

describe('perspective eyewear fitting', () => {
  it.each([-80, -70, -45, 45, 70, 80])('keeps a tracked face visible at pitch %s for underside/top inspection', pitch => {
    for (const yaw of [0, -45, 45]) {
      const frame = syntheticFrame(yaw, pitch, 8, 1280, 720, 60);
      for (const matrix of [frame.matrix, null]) {
        const pose = fitFace(frame.landmarks, matrix, projection, resolveFit({ offset: [0, 0, 0] }))!;
        expect(pose).not.toBeNull();
        expect(pose.state.visible).toBe(true);
        expect(pose.headPosition.distanceTo(frame.worldPoints[168]!)).toBeLessThan(0.00001);
        if (matrix) expect(pose.headRotation.angleTo(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().fromArray(frame.matrix)))).toBeLessThan(0.00001);
      }
    }
  });

  it('uses the full face matrix and anatomical fallback when the eye pair collapses', () => {
    const frame = syntheticFrame(25, -70, 0, 1280, 720, 60);
    const partial = frame.landmarks.map(p => ({ ...p }));
    partial[33] = { ...partial[168]! }; partial[263] = { ...partial[168]! };
    for (const matrix of [frame.matrix, null]) {
      const pose = fitFace(partial, matrix, projection, DEFAULT_FIT)!;
      expect(pose.state.visible).toBe(true);
      expect(pose.faceDepth).toBeCloseTo(-frame.worldPoints[168]!.z, 5);
      expect(pose.state.source).toBe(matrix ? 'face-matrix' : 'landmarks');
    }
  });

  it('does not keep a rear-facing or completely collapsed face visible', () => {
    const rear = syntheticFrame(0, 110);
    expect(fitFace(rear.landmarks, rear.matrix, projection, DEFAULT_FIT)!.state.visible).toBe(false);
    expect(fitFace(Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 })), rear.matrix, projection, DEFAULT_FIT)).toBeNull();
  });
  it('uses the column-major face matrix for simultaneous yaw, pitch, and roll', () => {
    const frame = syntheticFrame(60, 20, 12);
    const pose = fitFace(frame.landmarks, frame.matrix, projection, resolveFit({ offset: [0, 0, 0] }));
    expect(pose!.state.source).toBe('face-matrix');
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(20), THREE.MathUtils.degToRad(60), THREE.MathUtils.degToRad(12), 'YXZ'));
    expect(pose!.rotation.angleTo(expected)).toBeCloseTo(0, 6);
    expect(pose!.position.distanceTo(frame.worldPoints[168]!)).toBeLessThan(0.0001);
  });

  it('keeps bridge and occlusion vertices on their source pixels after portrait cover cropping', () => {
    const frame = syntheticFrame(-55, -10);
    const portrait = { ...projection, width: 400, height: 600 };
    const pose = fitFace(frame.landmarks, frame.matrix, portrait, DEFAULT_FIT)!;
    const camera = new THREE.PerspectiveCamera(portrait.fov, portrait.width / portrait.height, 0.1, 500);
    const vertices = new Float32Array(468 * 3);
    writeFaceVertices(vertices, frame.landmarks, pose.faceDepth, portrait);
    for (const index of [4, 33, 168, 263, 152, 10]) {
      const projected = new THREE.Vector3().fromArray(vertices, index * 3).project(camera);
      const source = mapCoverPoint(frame.landmarks[index]!.x, frame.landmarks[index]!.y, 1280, 720, 400, 600);
      expect(projected.x * 200).toBeCloseTo(source.x, 3);
      expect(projected.y * 300).toBeCloseTo(source.y, 3);
    }
    expect(FACE_TRIANGLES.length / 3).toBe(898);
    expect(Math.max(...FACE_TRIANGLES)).toBeLessThan(468);
  });

  it('applies fitting offsets in head-local coordinates and validates asset metadata', () => {
    const frame = syntheticFrame(60);
    const a = fitFace(frame.landmarks, frame.matrix, projection, resolveFit({ offset: [0, 0, 0] }))!;
    const b = fitFace(frame.landmarks, frame.matrix, projection, resolveFit({ offset: [0, 0, 0.1] }))!;
    const expected = new THREE.Vector3(0, 0, 0.1).multiplyScalar(a.scale).applyQuaternion(a.rotation);
    expect(b.position.clone().sub(a.position).distanceTo(expected)).toBeLessThan(0.00001);
    expect(() => resolveFit({ referenceEyeSpan: 0 })).toThrow();
    expect(() => resolveFit({ offset: [0, NaN, 0] })).toThrow();
    const broken = frame.landmarks.map(p => ({ ...p })); broken[33]!.z = Infinity;
    expect(fitFace(broken, frame.matrix, projection, DEFAULT_FIT)).toBeNull();
  });

  it('preserves the model scale when the same face turns, without double foreshortening', () => {
    const scales = [0, 45, 75].map(yaw => {
      const frame = syntheticFrame(yaw);
      return fitFace(frame.landmarks, frame.matrix, projection, DEFAULT_FIT)!.scale;
    });
    expect(scales[1]).toBeCloseTo(scales[0]!, 5);
    expect(scales[2]).toBeCloseTo(scales[0]!, 5);
  });

  it('treats normalized landmark Z as relative depth, not an absolute camera coordinate', () => {
    const frame = syntheticFrame(45);
    const shifted = frame.landmarks.map(p => ({ ...p, z: p.z + 0.8 }));
    const pointA = projectFacePoint(frame.landmarks[4]!, frame.landmarks[168]!.z, 50, projection);
    const pointB = projectFacePoint(shifted[4]!, shifted[168]!.z, 50, projection);
    expect(pointA.distanceTo(pointB)).toBeLessThan(0.00001);
  });

  it('solves distance from apparent face size and shrinks the projected frame when moving away', () => {
    const widths: number[] = [];
    const sizes: number[] = [];
    for (const distance of [30, 60, 90]) {
      const frame = syntheticFrame(0, 0, 0, 1280, 720, distance);
      // A stale/noisy matrix translation must not inflate the physical GLB.
      const noisyMatrix = [...frame.matrix]; noisyMatrix[14] = -20;
      const pose = fitFace(frame.landmarks, noisyMatrix, projection, DEFAULT_FIT)!;
      expect(pose.state.estimatedDistanceCm).toBeCloseTo(-frame.worldPoints[168]!.z, 5);
      sizes.push(pose.scale);
      const camera = new THREE.PerspectiveCamera(63, projection.width / projection.height, 0.1, 500);
      const left = new THREE.Vector3(-1, 0, 0).multiplyScalar(pose.scale).applyQuaternion(pose.rotation).add(pose.position).project(camera);
      const right = new THREE.Vector3(1, 0, 0).multiplyScalar(pose.scale).applyQuaternion(pose.rotation).add(pose.position).project(camera);
      widths.push(right.x - left.x);
    }
    expect(sizes[1]).toBeCloseTo(sizes[0]!, 6);
    expect(sizes[2]).toBeCloseTo(sizes[0]!, 6);
    expect(widths[1]!).toBeLessThan(widths[0]! * 0.5);
    expect(widths[2]!).toBeLessThan(widths[1]!);
  });

  it('keeps distance unchanged across cover crops, yaw and landmark-only fallback', () => {
    for (const yaw of [-75, -45, 0, 45, 75]) {
      const frame = syntheticFrame(yaw, 0, 0, 1280, 720, 60);
      for (const [width, height] of [[640, 400], [390, 488], [900, 300]]) {
        const cropped = { ...projection, width: width!, height: height!, fov: coverCameraFov(63, 1280, 720, width!, height!) };
        for (const matrix of [frame.matrix, null]) {
          const pose = fitFace(frame.landmarks, matrix, cropped, DEFAULT_FIT)!;
          expect(pose.state.estimatedDistanceCm).toBeCloseTo(-frame.worldPoints[168]!.z, 4);
          expect(pose.state.visible).toBe(true);
        }
      }
    }
  });

  it('keeps a distant tracked face visible in a small preview and warns before hiding', () => {
    const small = { ...projection, width: 220, height: 220 };
    const distant = syntheticFrame(0, 0, 0, 1280, 720, 170);
    const pose = fitFace(distant.landmarks, distant.matrix, small, DEFAULT_FIT)!;
    expect(pose.state.guidance).toBe('move-closer');
    expect(pose.state.visible).toBe(true);
    const tooDistant = syntheticFrame(0, 0, 0, 1280, 720, 400);
    expect(fitFace(tooDistant.landmarks, tooDistant.matrix, small, DEFAULT_FIT)!.state.visible).toBe(false);
  });

  it('attaches head/ear occlusion to the face independently of asset adjustments', () => {
    const frame = syntheticFrame(65, 10, -8);
    const base = fitFace(frame.landmarks, frame.matrix, projection, DEFAULT_FIT)!;
    const adjusted = fitFace(frame.landmarks, frame.matrix, projection, resolveFit({ scale: 1.15, offset: [0.1, 0.2, 0.3], rotation: [0.1, 0, 0] }))!;
    const material = new THREE.MeshBasicMaterial({ colorWrite: false });
    const mask = new HeadOccluder(material);
    mask.update(adjusted);
    expect(mask.position.distanceTo(base.headPosition)).toBeLessThan(0.00001);
    expect(mask.quaternion.angleTo(base.headRotation)).toBeCloseTo(0, 6);
    expect(mask.children).toHaveLength(3);
    mask.dispose(); material.dispose();
  });

  it('smooths small jitter, responds faster to a large turn, and resets after face loss', () => {
    const base = syntheticFrame();
    const steadyPose = fitFace(base.landmarks, base.matrix, projection, DEFAULT_FIT)!;
    const smoother = new PoseSmoother();
    smoother.update(steadyPose, 1000);
    const jitter = { ...steadyPose, position: steadyPose.position.clone().add(new THREE.Vector3(0.01, 0, 0)), headPosition: steadyPose.headPosition.clone().add(new THREE.Vector3(0.01, 0, 0)) };
    const slow = smoother.update(jitter, 1033);
    expect(slow.pose.position.distanceTo(steadyPose.position)).toBeLessThan(0.01);
    const farther = { ...steadyPose, position: steadyPose.position.clone().add(new THREE.Vector3(0, 0, -0.1)), headPosition: steadyPose.headPosition.clone().add(new THREE.Vector3(0, 0, -0.1)), faceDepth: steadyPose.faceDepth + 0.1 };
    const distance = smoother.update(farther, 1049);
    expect(distance.pose.state.estimatedDistanceCm).toBe(distance.pose.faceDepth);
    expect(distance.pose.headPosition.z).toBeCloseTo(-distance.pose.faceDepth, 5);
    const turned = syntheticFrame(50);
    const fast = smoother.update(fitFace(turned.landmarks, turned.matrix, projection, DEFAULT_FIT)!, 1066);
    expect(fast.alpha).toBeGreaterThan(slow.alpha);
    smoother.reset();
    expect(smoother.update(jitter, 1100).alpha).toBe(1);
  });
});
