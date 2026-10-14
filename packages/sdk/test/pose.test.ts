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
import { deriveGlassesPose, type FaceLandmark3D } from '../src/glasses/pose';

const WIDTH = 1000;
const HEIGHT = 1000;

function toLandmark(point: THREE.Vector3): FaceLandmark3D {
  return { x: point.x / WIDTH + 0.5, y: 0.5 - point.y / HEIGHT, z: -point.z / WIDTH };
}

function landmarksAtYaw(yaw: number): FaceLandmark3D[] {
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[33] = toLandmark(new THREE.Vector3(-100, 50, 0).applyQuaternion(turn));
  landmarks[263] = toLandmark(new THREE.Vector3(100, 50, 0).applyQuaternion(turn));
  landmarks[168] = toLandmark(new THREE.Vector3(0, -20, 0).applyQuaternion(turn));
  return landmarks;
}

describe('deriveGlassesPose', () => {
  it('places a frontal pose at the nose bridge with a camera-facing frame', () => {
    const pose = deriveGlassesPose(landmarksAtYaw(0), WIDTH, HEIGHT, WIDTH, HEIGHT);
    expect(pose).not.toBeNull();
    expect(pose!.position.x).toBeCloseTo(0);
    expect(pose!.position.y).toBeCloseTo(-20);
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(pose!.rotation).z).toBeCloseTo(1);
  });

  it('follows head yaw in 3D so the temples turn with the face', () => {
    const yaw = THREE.MathUtils.degToRad(55);
    const pose = deriveGlassesPose(landmarksAtYaw(yaw), WIDTH, HEIGHT, WIDTH, HEIGHT);
    expect(pose).not.toBeNull();
    const faceNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(pose!.rotation);
    expect(faceNormal.x).toBeCloseTo(Math.sin(yaw), 2);
    expect(faceNormal.z).toBeCloseTo(Math.cos(yaw), 2);
    // 3D width stays tied to the face; the camera projection causes the
    // glasses to narrow naturally instead of scaling them down a second time.
    expect(pose!.eyeSpan).toBeCloseTo(200);
  });

  it('rejects missing or degenerate landmarks', () => {
    expect(deriveGlassesPose([], WIDTH, HEIGHT, WIDTH, HEIGHT)).toBeNull();
    const points = landmarksAtYaw(0);
    points[263] = points[33];
    expect(deriveGlassesPose(points, WIDTH, HEIGHT, WIDTH, HEIGHT)).toBeNull();
  });
});
