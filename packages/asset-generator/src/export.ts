/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Scene } from 'three';
import { buildParametricGlasses, disposeGeneratedGlasses, validateGeneratedGlasses } from './geometry';
import type { GeneratedGlasses } from './geometry';
import type { GlassesRecipe } from './recipe';

/** Export a validated, reproducible template approximation as binary glTF (GLB). */
export async function exportGeneratedGlassesGlb(generated: GeneratedGlasses): Promise<Blob> {
  const validation = validateGeneratedGlasses(generated);
  if (!validation.valid) throw new Error(`Invalid generated glasses: ${validation.issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`);
  const exporter = new GLTFExporter();
  // glTF scene extras survive on GLTFLoader.scene.userData. A Group alone would
  // put the calibration on descendant node extras, outside the SDK root contract.
  const exportScene = new Scene();
  exportScene.name = generated.scene.name;
  exportScene.userData = { vtoGlasses: generated.metadata };
  const exportGroup = generated.scene.clone(true);
  exportGroup.userData = {};
  exportScene.add(exportGroup);
  // Viewer visibility is presentation state; the asset always includes its parts.
  const result = await exporter.parseAsync(exportScene, { binary: true, onlyVisible: false });
  if (!(result instanceof ArrayBuffer)) throw new Error('The glTF exporter did not return a binary GLB.');
  return new Blob([result], { type: 'model/gltf-binary' });
}

/** Build and export one validated asset; temporary geometry is released on success or failure. */
export async function exportGlassesGlb(recipe: GlassesRecipe): Promise<Blob> {
  const generated = buildParametricGlasses(recipe);
  try { return await exportGeneratedGlassesGlb(generated); }
  finally { disposeGeneratedGlasses(generated); }
}
