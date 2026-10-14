/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import type { FacePose } from '../glasses/fitting';

/** Approximate crown path in head-local centimeters; does not alter occlusion. */
export function placedGlassesPose(pose: FacePose, progress: number) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const ease = t * t * (3 - 2 * t);
  const lift = new THREE.Vector3(0, pose.worldEyeSpan * 1.04 * t, -pose.worldEyeSpan * 0.32 * ease);
  const correction = pose.headRotation.clone().invert().multiply(pose.rotation);
  const rotation = pose.headRotation.clone()
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -65 * Math.PI / 180 * ease))
    .multiply(correction);
  return { position: pose.position.clone().add(lift.applyQuaternion(pose.headRotation)), rotation };
}
