/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import type { FitState, GlassesFit,CameraCalibration } from '../types';
import { CANONICAL_BRIDGE, CANONICAL_EYE_SPAN_CM, CANONICAL_FIT_SPANS, CANONICAL_FACE_SUPPORT_SPANS } from './face-topology';
import { deriveGlassesPose, type FaceLandmark3D } from './pose';
import { mapCoverPoint } from './coordinates';

export const DEFAULT_FIT: GlassesFit = { referenceEyeSpan: 1.45, scale: 1, offset: [0, 0, 0.08], rotation: [0, 0, 0] };
const FACE_SUPPORT_SPANS = [...CANONICAL_FIT_SPANS, ...CANONICAL_FACE_SUPPORT_SPANS];
export interface Projection { videoWidth: number; videoHeight: number; width: number; height: number; fov: number;intrinsics?:CameraCalibration }
export interface FacePose {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: number;
  faceDepth: number;
  worldEyeSpan: number;
  headPosition: THREE.Vector3;
  headRotation: THREE.Quaternion;
  headHalfWidth: number;
  state: FitState;
}

/** Match object-fit: cover without changing distance when the viewport crops the video. */
export function coverCameraFov(sourceFov: number, videoWidth: number, videoHeight: number, width: number, height: number): number {
  const drawnHeight = videoHeight * Math.max(width / videoWidth, height / videoHeight);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(sourceFov) / 2) * height / drawnHeight));
}

export function resolveFit(input: Partial<GlassesFit> = {}, base: GlassesFit = DEFAULT_FIT): GlassesFit {
  const fit = { ...base, ...input, offset: [...(input.offset ?? base.offset)] as GlassesFit['offset'], rotation: [...(input.rotation ?? base.rotation)] as GlassesFit['rotation'] };
  if (!Number.isFinite(fit.referenceEyeSpan) || fit.referenceEyeSpan <= 0 || !Number.isFinite(fit.scale) || fit.scale < 0.25 || fit.scale > 4 || fit.offset.length !== 3 || fit.rotation.length !== 3 || ![...fit.offset, ...fit.rotation].every(Number.isFinite)) {
    throw new Error('Invalid glasses fit. Supply a positive referenceEyeSpan, scale from 0.25 to 4, and finite XYZ offset/rotation.');
  }
  return fit;
}

export function worldPerPixel(depth: number, projection: Projection): number {
  return 2 * depth * Math.tan(THREE.MathUtils.degToRad(projection.fov) / 2) / projection.height;
}

/** Unprojects screen coordinates at their estimated camera-space depth. */
export function projectFacePoint(point: FaceLandmark3D, bridgeZ: number, depth: number, projection: Projection): THREE.Vector3 {
  if(projection.intrinsics) {
    const k=projection.intrinsics,pointDepth=Math.max(1,depth+(point.z-bridgeZ)*projection.videoWidth*depth/k.fx);
    return new THREE.Vector3((point.x*projection.videoWidth-k.cx)*pointDepth/k.fx,(k.cy-point.y*projection.videoHeight)*pointDepth/k.fy,-pointDepth);
  }
  const { videoWidth, videoHeight, width, height } = projection;
  const screen = mapCoverPoint(point.x, point.y, videoWidth, videoHeight, width, height);
  const depthScale = videoWidth * Math.max(width / videoWidth, height / videoHeight) * worldPerPixel(depth, projection);
  const pointDepth = Math.max(1, depth + (point.z - bridgeZ) * depthScale);
  const pixelScale = worldPerPixel(pointDepth, projection);
  return new THREE.Vector3(screen.x * pixelScale, screen.y * pixelScale, -pointDepth);
}

export function fitFace(landmarks: FaceLandmark3D[], matrix: number[] | null, projection: Projection, fit: GlassesFit,eyeSpanCm=CANONICAL_EYE_SPAN_CM,assetScale:number|null=null): FacePose | null {
  if (landmarks.length < 468 || ![projection.videoWidth,projection.videoHeight,projection.width,projection.height,projection.fov].every(value => Number.isFinite(value) && value > 0)) return null;
  if(!Number.isFinite(eyeSpanCm)||eyeSpanCm<3||eyeSpanCm>14)throw new Error('faceReferenceEyeSpanCm must be between 3 and 14 cm (outer-eye span, not PD).');
  for (let i = 0; i < 468; i++) {
    const p = landmarks[i]!;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null;
  }
  // Quality thresholds belong to source-camera pixels, never CSS preview size.
  let rotation: THREE.Quaternion | null = null;
  let faceDepth = 60;
  let source: FitState['source'] = 'landmarks';
  if (matrix?.length === 16 && matrix.every(Number.isFinite)) {
    // MediaPipe's MatrixData packed data uses column-major Eigen storage,
    // matching Three.js fromArray. Remove scale before extracting rotation.
    const transform = new THREE.Matrix4().fromArray(matrix);
    const determinant = transform.determinant();
    if (Number.isFinite(determinant) && determinant > 0 && Math.abs(matrix[15]! - 1) < 0.01 && [matrix[3], matrix[7], matrix[11]].every(value => Math.abs(value!) < 0.001)) {
      const basis = new THREE.Matrix4().extractRotation(transform);
      const axes = [0, 1, 2].map(i => new THREE.Vector3().setFromMatrixColumn(basis, i));
      // extractRotation removes scale, but cannot remove a corrupt/sheared basis.
      if (Math.max(Math.abs(axes[0]!.dot(axes[1]!)), Math.abs(axes[0]!.dot(axes[2]!)), Math.abs(axes[1]!.dot(axes[2]!))) < 0.02) {
        rotation = new THREE.Quaternion().setFromRotationMatrix(basis).normalize();
        const metricBridge = new THREE.Vector3(...CANONICAL_BRIDGE).applyMatrix4(transform);
        faceDepth = THREE.MathUtils.clamp(-metricBridge.z, 15, 150);
        source = 'face-matrix';
      }
    }
  }
  if (!rotation) {
    // A full anatomical basis works when the eyes are foreshortened/occluded.
    // Z uses the same weak-perspective source-width units as MediaPipe landmarks.
    const difference = (a: number, b: number) => new THREE.Vector3(
      (landmarks[a]!.x - landmarks[b]!.x) * projection.videoWidth,
      (landmarks[b]!.y - landmarks[a]!.y) * projection.videoHeight,
      (landmarks[b]!.z - landmarks[a]!.z) * projection.videoWidth,
    );
    const across = difference(454, 234);
    const up = difference(10, 152);
    if (across.length() >= 12 && up.length() >= 12) {
      across.normalize();
      up.addScaledVector(across, -up.dot(across));
      if (up.length() >= 12) {
        up.normalize();
        const forward = across.clone().cross(up).normalize();
        rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, forward.clone().cross(across).normalize(), forward));
      }
    }
    rotation ??= deriveGlassesPose(landmarks, projection.videoWidth, projection.videoHeight, projection.videoWidth, projection.videoHeight)?.rotation ?? null;
    if (!rotation) return null;
  }
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
  const yawDegrees = THREE.MathUtils.radToDeg(Math.atan2(normal.x, normal.z));
  const pitchDegrees = THREE.MathUtils.radToDeg(Math.atan2(-normal.y, Math.hypot(normal.x, normal.z)));
  const bridge = landmarks[168]!;
  const screenBridge = mapCoverPoint(bridge.x, bridge.y, projection.videoWidth, projection.videoHeight, projection.width, projection.height);
  // Seven independent spans make a bad corner/hidden landmark less influential.
  // Median consensus is robust to three corrupt spans, without a temporal hold
  // that would prevent genuine approach/retreat. Canonical proportions remain
  // an assumption: this is visual fitting, not measured physical face sizing.
  const depthCandidates: number[] = [];
  for (const [a, b, canonicalSpan] of CANONICAL_FIT_SPANS) {
    const observed = projectFacePoint(landmarks[a]!, bridge.z, faceDepth, projection).distanceTo(projectFacePoint(landmarks[b]!, bridge.z, faceDepth, projection));
    const candidate = faceDepth * canonicalSpan / observed;
    if (observed > 0.01 && Number.isFinite(candidate) && candidate >= 5 && candidate <= 500) depthCandidates.push(candidate);
  }
  if (depthCandidates.length < 4) return null;
  depthCandidates.sort((a, b) => a - b);
  const middle = Math.floor(depthCandidates.length / 2);
  faceDepth = depthCandidates.length % 2 ? depthCandidates[middle]! : (depthCandidates[middle - 1]! + depthCandidates[middle]!) / 2;
  if (!Number.isFinite(faceDepth) || faceDepth < 5 || faceDepth > 500) return null;
  faceDepth*=eyeSpanCm/CANONICAL_EYE_SPAN_CM;
  const worldEyeSpan = eyeSpanCm;
  const scale = (assetScale??worldEyeSpan / fit.referenceEyeSpan) * fit.scale;
  const headPosition = projectFacePoint(bridge, bridge.z, faceDepth, projection);
  const headRotation = rotation.clone();
  const cheekAxis = projectFacePoint(landmarks[454]!, bridge.z, faceDepth, projection).sub(projectFacePoint(landmarks[234]!, bridge.z, faceDepth, projection)).applyQuaternion(rotation.clone().invert());
  const headHalfWidth = THREE.MathUtils.clamp(Math.abs(cheekAxis.x) / 2, worldEyeSpan * 0.6, worldEyeSpan * 1.1);
  const position = headPosition.clone();
  position.add(new THREE.Vector3(...fit.offset).multiplyScalar(scale).applyQuaternion(rotation));
  rotation = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...fit.rotation)));
  // Equivalent source resolution from the whole head, not a single eye pair.
  const support = FACE_SUPPORT_SPANS.map(([a, b, span]) => {
    const p = landmarks[a]!, q = landmarks[b]!;
    return Math.hypot((p.x - q.x) * projection.videoWidth, (p.y - q.y) * projection.videoHeight, (p.z - q.z) * projection.videoWidth) * CANONICAL_EYE_SPAN_CM / span;
  }).sort((a, b) => a - b);
  const sourceFaceResolution = (support[4]! + support[5]!) / 2;
  const centered = Math.abs(screenBridge.x) <= projection.width * 0.46 && Math.abs(screenBridge.y) <= projection.height * 0.46;
  const guidance: FitState['guidance'] = !centered ? 'center-face' : Math.abs(yawDegrees) > 85 || Math.abs(pitchDegrees) > 65 ? 'turn-slightly' : sourceFaceResolution < 35 ? 'move-closer' : 'ready';
  // Steep upward/downward views remain useful for inspecting the frame.
  // Guidance is advisory; hide only for offscreen, tiny, or rear-facing poses.
  const visible = centered && sourceFaceResolution >= 16 && normal.z > 0.02;
  return { position, rotation, scale, faceDepth, worldEyeSpan, headPosition, headRotation, headHalfWidth, state: { visible, source, yawDegrees, pitchDegrees, estimatedDistanceCm: faceDepth, guidance } };
}

/** All 468 vertices follow the same perspective projection as the eyewear. */
export function writeFaceVertices(target: Float32Array, landmarks: FaceLandmark3D[], depth: number, projection: Projection, alpha = 1, correction?: THREE.Matrix4): void {
  const bridgeZ = landmarks[168]!.z;
  const coverScale = Math.max(projection.width / projection.videoWidth, projection.height / projection.videoHeight);
  const drawnWidth = projection.videoWidth * coverScale;
  const drawnHeight = projection.videoHeight * coverScale;
  const unitsPerDepth = 2 * Math.tan(THREE.MathUtils.degToRad(projection.fov) / 2) / projection.height;
  const depthScale = drawnWidth * unitsPerDepth * depth;
  const k=projection.intrinsics;
  const m = correction?.elements;
  for (let i = 0; i < 468; i++) {
    const point = landmarks[i]!;
    const pointDepth = Math.max(1, depth + (point.z - bridgeZ) * (k?projection.videoWidth*depth/k.fx:depthScale));
    const pixelScale = unitsPerDepth * pointDepth;
    const index = i * 3;
    // Keep the hot path allocation-free; this buffer is shared with WebGL.
    const x = k?(point.x*projection.videoWidth-k.cx)*pointDepth/k.fx:(point.x - 0.5) * drawnWidth * pixelScale;
    const y = k?(k.cy-point.y*projection.videoHeight)*pointDepth/k.fy:(0.5 - point.y) * drawnHeight * pixelScale;
    const z = -pointDepth;
    const cx = m ? m[0]! * x + m[4]! * y + m[8]! * z + m[12]! : x;
    const cy = m ? m[1]! * x + m[5]! * y + m[9]! * z + m[13]! : y;
    const cz = m ? m[2]! * x + m[6]! * y + m[10]! * z + m[14]! : z;
    target[index] = target[index]! + (cx - target[index]!) * alpha;
    target[index + 1] = target[index + 1]! + (cy - target[index + 1]!) * alpha;
    target[index + 2] = target[index + 2]! + (cz - target[index + 2]!) * alpha;
  }
}
