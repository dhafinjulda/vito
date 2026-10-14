/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import { CANONICAL_FACE } from './canonical-face';
import type { FaceLandmark3D } from '../src/glasses/pose';

/** Projects a generic canonical face; contains no recorded-person data. */
export function syntheticFrame(yawDegrees = 0, pitchDegrees = 0, rollDegrees = 0, width = 1280, height = 720, distance = 45) {
  const camera = new THREE.PerspectiveCamera(63, width / height, 0.1, 500);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(...[pitchDegrees, yawDegrees, rollDegrees].map(THREE.MathUtils.degToRad) as [number, number, number], 'YXZ'));
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(0, -1, -distance), rotation, new THREE.Vector3(1, 1, 1));
  const worldPoints = CANONICAL_FACE.map(p => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(matrix));
  const bridgeDepth = -worldPoints[168]!.z;
  const imageWidthWorld = 2 * bridgeDepth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect;
  const landmarks: FaceLandmark3D[] = worldPoints.map(point => {
    const ndc = point.clone().project(camera);
    return { x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2, z: (-point.z - bridgeDepth) / imageWidthWorld };
  });
  return { landmarks, matrix: matrix.toArray(), worldPoints };
}
