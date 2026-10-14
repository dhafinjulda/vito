/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import { mapCoverPoint } from './coordinates';

export interface FaceLandmark3D {
  x: number;
  y: number;
  z: number;
}

export interface GlassesPose {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: number;
  eyeSpan: number;
}

/** Builds a camera-space glasses pose from the eye line and nose bridge. */
export function deriveGlassesPose(
  landmarks: FaceLandmark3D[],
  videoWidth: number,
  videoHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): GlassesPose | null {
  if (landmarks.length <= 263 || !videoWidth || !videoHeight || !viewportWidth || !viewportHeight) return null;
  const leftEye = landmarks[33]!;
  const rightEye = landmarks[263]!;
  const bridge = landmarks[168]!;
  const toWorld = (point: FaceLandmark3D) => {
    const { x, y } = mapCoverPoint(point.x, point.y, videoWidth, videoHeight, viewportWidth, viewportHeight);
    const coverScale = Math.max(viewportWidth / videoWidth, viewportHeight / videoHeight);
    return new THREE.Vector3(x, y, -point.z * videoWidth * coverScale);
  };

  const left = toWorld(leftEye);
  const right = toWorld(rightEye);
  const noseBridge = toWorld(bridge);
  const eyeAxis = right.clone().sub(left);
  const eyeSpan = eyeAxis.length();
  if (!Number.isFinite(eyeSpan) || eyeSpan < 12) return null;
  eyeAxis.normalize();

  // Use the eye line and bridge to recover a full 3D facial frame. The old
  // screen-space roll-only fit had no yaw or pitch, so temples stayed flat as
  // the wearer turned their head.
  const eyeMidpoint = left.clone().add(right).multiplyScalar(0.5);
  // Forehead/chin give an anatomical up direction. Bridge 168 can sit above
  // the eye line, which would invert a bridge-only fallback on real faces.
  const forehead = landmarks[10];
  const chin = landmarks[152];
  const headUp = forehead && chin ? toWorld(forehead).sub(toWorld(chin)) : null;
  const upAxis = headUp && headUp.lengthSq() > 1 ? headUp : eyeMidpoint.sub(noseBridge);
  upAxis.addScaledVector(eyeAxis, -upAxis.dot(eyeAxis)).normalize();
  const normalAxis = eyeAxis.clone().cross(upAxis).normalize();
  if (![eyeAxis, upAxis, normalAxis].every((axis) => Number.isFinite(axis.length()) && axis.length() > 0.99)) return null;
  // Recompute up to remove numeric skew and keep an orthonormal, right-handed frame.
  upAxis.copy(normalAxis).cross(eyeAxis).normalize();

  const basis = new THREE.Matrix4().makeBasis(eyeAxis, upAxis, normalAxis);
  return {
    position: noseBridge,
    rotation: new THREE.Quaternion().setFromRotationMatrix(basis),
    // Canonical reference GLBs have a 2.2 unit bridge-to-bridge width. Use 3D
    // eye span so the model's projected width naturally narrows during yaw.
    scale: eyeSpan * 1.9 / 2.2,
    eyeSpan,
  };
}
