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
import { DEFAULT_FIT, fitFace } from '../src/glasses/fitting';
import { HeadOccluder } from '../src/rendering/HeadOccluder';
import { syntheticFrame } from './synthetic-frame';

describe('rear temple occlusion', () => {
  it.each([[-84, 0, 0], [84, 0, 0], [-84, -20, -15], [84, 20, 15], [-45, 0, 0], [45, 0, 0]])('covers the full hook surface at yaw %s / pitch %s / roll %s', (yaw, pitch, roll) => {
    const frame = syntheticFrame(yaw, pitch, roll, 1280, 720, 60);
    const pose = fitFace(frame.landmarks, frame.matrix, { videoWidth: 1280, videoHeight: 720, width: 640, height: 400, fov: 63 }, DEFAULT_FIT)!;
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mask = new HeadOccluder(material);
    mask.update(pose);
    mask.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const point = new THREE.Vector3();
    const failures: string[] = [];
    try {
      for (const side of [-1, 1]) {
        // Same complete tube surface as the original demo GLBs, including
        // the previously untested upper/middle curve and its 0.041 radius.
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 1.14, -0.08, -1.76),
          new THREE.Vector3(side * 1.10, -0.14, -2.00),
          new THREE.Vector3(side * 1.03, -0.31, -2.16),
        ], false, 'centripetal');
        const hook = new THREE.TubeGeometry(curve, 48, 0.041, 10, false);
        const vertices = hook.attributes.position!;
        for (let index = 0; index < vertices.count; index++) {
          point.fromBufferAttribute(vertices, index).multiplyScalar(pose.scale).applyQuaternion(pose.rotation).add(pose.position);
          const distance = point.length();
          ray.set(new THREE.Vector3(), point.clone().normalize());
          ray.far = distance - 0.001;
          if (!ray.intersectObject(mask, true).length) failures.push(`${side}/${index}`);
        }
        hook.dispose();
        // Retain the near-side front temple. The far-side arm should be hidden
        // by the head in a full profile, so it is not a visibility requirement.
        if (side === -Math.sign(yaw)) {
          point.set(side * 1.20, -0.015, -1.0).multiplyScalar(pose.scale).applyQuaternion(pose.rotation).add(pose.position);
          ray.set(new THREE.Vector3(), point.clone().normalize()); ray.far = point.length() - 0.001;
          expect(ray.intersectObject(mask, true)).toHaveLength(0);
        }
      }
      expect(failures, `Uncovered hook vertices: ${failures.slice(0, 8).join(', ')}`).toHaveLength(0);
    } finally { mask.dispose(); material.dispose(); }
  });
});
