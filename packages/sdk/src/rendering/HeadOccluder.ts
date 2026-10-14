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

/** Conservative head/ear envelopes. Face Landmarker does not detect actual ears.
 * These depth-only volumes fill the space behind the dense facial surface.
 * They belong to the head pose, independent of asset size/offset corrections.
 */
export class HeadOccluder extends THREE.Group {
  readonly geometry = new THREE.SphereGeometry(1, 24, 16);
  private readonly skull: THREE.Mesh;
  private readonly ears: THREE.Mesh[];

  constructor(material: THREE.Material) {
    super();
    this.skull = new THREE.Mesh(this.geometry, material);
    this.ears = [-1, 1].map(() => new THREE.Mesh(this.geometry, material));
    this.add(this.skull, ...this.ears);
    for (const mesh of [this.skull, ...this.ears]) {
      mesh.renderOrder = -100;
      mesh.frustumCulled = false;
    }
    this.visible = false;
  }

  update(pose: FacePose): void {
    this.position.copy(pose.headPosition);
    this.quaternion.copy(pose.headRotation);
    const span = pose.worldEyeSpan;
    const halfWidth = pose.headHalfWidth;
    this.skull.position.set(0, -span * 0.135, -span * 1.21);
    // Close the rear seam with the inward-bending hook, including its tube
    // radius. A narrower skull leaves a sliver at the very end in full profile.
    this.skull.scale.set(halfWidth * 0.94, span * 1.03, span * 0.77);
    this.ears.forEach((ear, index) => {
      // The ear sits behind the cheek anchor, under the temple's contact point.
      // Cover the upper posterior rim too: an endpoint-only mask leaves most
      // of the curved hook floating in front of the ear during profile turns.
      ear.position.set((index ? 1 : -1) * halfWidth * 0.98, -span * 0.21, -span * 1.18);
      ear.scale.set(span * 0.10, span * 0.255, span * 0.225);
    });
  }

  dispose(): void { this.geometry.dispose(); }
}
