/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import type { FacePose } from './fitting';

/** Original speed-adaptive low-pass implementation inspired by the 1 Euro
 * algorithm (Casiez et al., CHI 2012). No third-party implementation copied. */
function filterAlpha(cutoff: number, dt: number): number {
  return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
}

/** Independent translation/rotation filtering keeps turning from amplifying
 * distance jitter. Asset and masks are reconstructed from one filtered head. */
export class PoseSmoother {
  private previous: FacePose | null = null;
  private raw: FacePose | null = null;
  private timestamp = 0;
  private readonly velocity = new THREE.Vector3();
  private readonly angularVelocity = new THREE.Vector3();

  reset(): void {
    this.previous = null; this.raw = null; this.timestamp = 0;
    this.velocity.set(0, 0, 0); this.angularVelocity.set(0, 0, 0);
  }

  update(pose: FacePose, timestampMs: number, enabled = true): { pose: FacePose; alpha: number } {
    const dt = (timestampMs - this.timestamp) / 1000;
    const previous = this.previous;
    const raw = this.raw;
    let alpha = 1;
    if (enabled && previous && raw && dt > 0 && dt < 0.3 && pose.headPosition.distanceTo(raw.headPosition) < pose.worldEyeSpan) {
      const derivativeAlpha = filterAlpha(1, dt);
      const span = Math.max(pose.worldEyeSpan, 0.01);
      const derivative = pose.headPosition.clone().sub(raw.headPosition).divideScalar(span * dt);
      this.velocity.lerp(derivative, derivativeAlpha);
      const axisAlphas = [this.velocity.x, this.velocity.y, this.velocity.z].map(speed => filterAlpha(1.5 + 8 * Math.abs(speed), dt));
      const headPosition = previous.headPosition.clone();
      headPosition.x += (pose.headPosition.x - headPosition.x) * axisAlphas[0]!;
      headPosition.y += (pose.headPosition.y - headPosition.y) * axisAlphas[1]!;
      headPosition.z += (pose.headPosition.z - headPosition.z) * axisAlphas[2]!;

      // Signed shortest-arc derivative cancels alternating rotational noise.
      const delta = raw.headRotation.clone().invert().multiply(pose.headRotation);
      if (delta.w < 0) { delta.x *= -1; delta.y *= -1; delta.z *= -1; delta.w *= -1; }
      const vectorLength = Math.hypot(delta.x, delta.y, delta.z);
      const angleScale = vectorLength > 1e-8 ? 2 * Math.atan2(vectorLength, delta.w) / (vectorLength * dt) : 0;
      this.angularVelocity.lerp(new THREE.Vector3(delta.x, delta.y, delta.z).multiplyScalar(angleScale), derivativeAlpha);
      const rotationAlpha = filterAlpha(1.5 + 2 * this.angularVelocity.length(), dt);
      const headRotation = previous.headRotation.clone().slerp(pose.headRotation, rotationAlpha);
      const inverseHead = pose.headRotation.clone().invert();
      const localOffset = pose.position.clone().sub(pose.headPosition).applyQuaternion(inverseHead);
      const localRotation = inverseHead.clone().multiply(pose.rotation);
      const faceDepth = -headPosition.z;
      alpha = Math.max(rotationAlpha, ...axisAlphas);
      const input = pose;
      pose = {
        ...pose,
        headPosition, headRotation, faceDepth,
        position: localOffset.applyQuaternion(headRotation).add(headPosition),
        rotation: headRotation.clone().multiply(localRotation),
        headHalfWidth: previous.headHalfWidth + (pose.headHalfWidth - previous.headHalfWidth) * filterAlpha(0.8, dt),
        state: { ...pose.state, estimatedDistanceCm: faceDepth },
      };
      this.raw = input;
    } else {
      this.velocity.set(0, 0, 0); this.angularVelocity.set(0, 0, 0);
      this.raw = pose;
    }
    this.previous = pose;
    this.timestamp = timestampMs;
    return { pose, alpha };
  }
}
