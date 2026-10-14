/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { Box3, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { buildParametricGlasses } from '../src/geometry';
import { DEFAULT_GLASSES_RECIPE, listGlassesTemplates, validateGlassesRecipe } from '../src/recipe';
import { exportGlassesGlb } from '../src/export';

describe('optional parametric glasses generator', () => {
  it('registers three versioned eyewear templates', () => {
    expect(listGlassesTemplates().map(({ id, version }) => [id, version])).toEqual([
      ['round', 1], ['rectangle', 1], ['cat-eye', 1],
    ]);
  });

  it('normalizes a valid recipe and keeps its approximation provenance', () => {
    const result = validateGlassesRecipe({ ...DEFAULT_GLASSES_RECIPE, name: '  Demo  ' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.recipe.name).toBe('Demo');
    expect(result.warnings).toContain('One or more dimensions are estimates; this template asset is not a verified retail SKU.');
  });

  it('rejects nonfinite, out-of-range, and incomplete recipe inputs', () => {
    const invalid = {
      ...DEFAULT_GLASSES_RECIPE,
      dimensionsMm: { ...DEFAULT_GLASSES_RECIPE.dimensionsMm, lensWidth: Number.NaN },
      dimensionSources: { ...DEFAULT_GLASSES_RECIPE.dimensionSources, templeLength: 'guessed' },
    };
    const result = validateGlassesRecipe(invalid);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.map(({ path }) => path)).toEqual(expect.arrayContaining([
      'dimensionsMm.lensWidth', 'dimensionSources.templeLength',
    ]));
  });

  it('rejects a frame width that cannot preserve the requested lens and bridge dimensions', () => {
    const result = validateGlassesRecipe({
      ...DEFAULT_GLASSES_RECIPE,
      dimensionsMm: { ...DEFAULT_GLASSES_RECIPE.dimensionsMm, frameWidth: 112 },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.map(({ path }) => path)).toContain('dimensionsMm.frameWidth');
  });

  it('builds deterministic semantic GLB nodes in meter units for every template', () => {
    for (const template of listGlassesTemplates()) {
      const recipe = { ...DEFAULT_GLASSES_RECIPE, templateId: template.id, productId: `sku-${template.id}` };
      const first = buildParametricGlasses(recipe);
      const second = buildParametricGlasses(recipe);
      const names: string[] = [];
      first.scene.traverse((node) => names.push(node.name));
      expect(names).toEqual(expect.arrayContaining([
        'rim-left', 'rim-right', 'lens-left', 'lens-right',
        'bridge', 'hinge-left', 'hinge-right', 'temple-left', 'temple-right', 'ear-tip-left', 'ear-tip-right',
      ]));
      expect(first.metadata.fidelityTier).toBe('template-approximation');
      expect(first.fit.referenceEyeSpan).toBeCloseTo(0.08891718, 8);
      expect(first.boundsMm.width).toBeCloseTo(recipe.dimensionsMm.frameWidth, 0);
      expect(first.boundsMm.width).toBeCloseTo(second.boundsMm.width, 8);
      expect(first.boundsMm.depth).toBeGreaterThan(recipe.dimensionsMm.templeLength * 0.8);
      const bounds = new Box3().setFromObject(first.scene);
      expect(bounds.min.x).toBeCloseTo(-bounds.max.x, 5);
      expect(bounds.min.z).toBeLessThan(0);
      const meshes: Mesh[] = [];
      first.scene.traverse((node) => { if (node instanceof Mesh) meshes.push(node); });
      expect(meshes.length).toBeGreaterThan(10);
      expect(meshes.every((mesh) => mesh.geometry.getAttribute('position').count > 0)).toBe(true);
      expect(bounds.getSize(new Vector3()).toArray().every(Number.isFinite)).toBe(true);
    }
  });

  it('exports a binary GLB containing the draft provenance', async () => {
    const previousFileReader = globalThis.FileReader;
    class TestFileReader {
      result: string | ArrayBuffer | null = null;
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer(blob: Blob) {
        void blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.(); }).catch(() => this.onerror?.());
      }
      readAsDataURL(blob: Blob) {
        void blob.arrayBuffer().then((buffer) => {
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
          this.result = `data:${blob.type};base64,${btoa(binary)}`;
          this.onloadend?.();
        }).catch(() => this.onerror?.());
      }
    }
    globalThis.FileReader = TestFileReader as unknown as typeof FileReader;
    try {
      const blob = await exportGlassesGlb(DEFAULT_GLASSES_RECIPE);
      const buffer = await blob.arrayBuffer();
      const header = new DataView(buffer);
      expect(blob.type).toBe('model/gltf-binary');
      expect(header.getUint32(0, true)).toBe(0x46546c67);
      expect(header.getUint32(4, true)).toBe(2);
      const jsonLength = header.getUint32(12, true);
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as { scenes: Array<{ extras?: { vtoGlasses?: { fidelityTier?: string; productId?: string } } }> };
      const metadata = json.scenes.map((scene) => scene.extras?.vtoGlasses).find(Boolean);
      expect(metadata).toMatchObject({ fidelityTier: 'template-approximation', productId: 'demo-frame' });
    } finally {
      globalThis.FileReader = previousFileReader;
    }
  });
});
