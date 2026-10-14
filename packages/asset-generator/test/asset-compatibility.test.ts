/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildParametricGlasses, disposeGeneratedGlasses, validateGeneratedGlasses } from '../src/geometry';
import { exportGeneratedGlassesGlb, exportGlassesGlb } from '../src/export';
import { DEFAULT_GLASSES_RECIPE, listGlassesTemplates, type GlassesRecipe } from '../src/recipe';
import { installLensOptics } from '../../sdk/src/rendering/LensOptics';
import { HairMask } from '../../sdk/src/rendering/HairMask';
import { installTempleEffects } from '../../sdk/src/rendering/TempleEffects';
import { physicalAssetScale } from '../../sdk/src/glasses/calibration';

afterEach(() => vi.restoreAllMocks());

function mesh(scene: THREE.Group, name: string): THREE.Mesh {
  const node = scene.getObjectByName(name);
  expect(node).toBeInstanceOf(THREE.Mesh);
  return node as THREE.Mesh;
}

function ringCenter(node: THREE.Mesh, ring: number): THREE.Vector3 {
  const positions = node.geometry.getAttribute('position');
  const point = new THREE.Vector3();
  for (let radial = 0; radial < 8; radial++) point.add(new THREE.Vector3().fromBufferAttribute(positions, ring * 9 + radial));
  return point.divideScalar(8);
}

function isInsideGeometry(node: THREE.Mesh, point: THREE.Vector3): boolean {
  const positions = node.geometry.getAttribute('position'), index = node.geometry.getIndex();
  const count = index?.count ?? positions.count;
  const ray = new THREE.Ray(point, new THREE.Vector3(1, .273, .419).normalize());
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
  const distances: number[] = [];
  for (let vertex = 0; vertex < count; vertex += 3) {
    a.fromBufferAttribute(positions, index?.getX(vertex) ?? vertex);
    b.fromBufferAttribute(positions, index?.getX(vertex + 1) ?? vertex + 1);
    c.fromBufferAttribute(positions, index?.getX(vertex + 2) ?? vertex + 2);
    if (ray.intersectTriangle(a, b, c, false, hit)) {
      const distance = point.distanceTo(hit);
      if (!distances.some(previous => Math.abs(previous - distance) < 1e-8)) distances.push(distance);
    }
  }
  return distances.length % 2 === 1;
}

async function withFileReader<T>(run: () => Promise<T>): Promise<T> {
  const original = globalThis.FileReader;
  class Reader {
    result: ArrayBuffer | null = null;
    onloadend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then(buffer => { this.result = buffer; this.onloadend?.(); }, () => this.onerror?.()); }
  }
  globalThis.FileReader = Reader as unknown as typeof FileReader;
  try { return await run(); } finally { globalThis.FileReader = original; }
}

describe('generated assets follow the SDK coordinate and material contract', () => {
  for (const template of listGlassesTemplates()) for (const materialPreset of ['acetate', 'metal'] as const) {
    it(`${template.id}/${materialPreset}: metres, bridge pivot, finite geometry and connected rear tips`, () => {
      const recipe: GlassesRecipe = { ...DEFAULT_GLASSES_RECIPE, templateId: template.id, materialPreset };
      const generated = buildParametricGlasses(recipe);
      try {
        const report = validateGeneratedGlasses(generated);
        expect(report.valid, JSON.stringify(report.issues)).toBe(true);
        expect(report.vertexCount).toBeLessThan(150_000);
        expect(report.triangleCount).toBeLessThan(100_000);
        expect(generated.metadata).toMatchObject({ units: 'meters', pivot: 'nose-bridge', geometryTransforms: 'baked', axes: { right: '+X', up: '+Y', front: '+Z' } });
        expect(generated.boundsMm.width).toBeCloseTo(recipe.dimensionsMm.frameWidth, 3);
        expect(generated.boundsMm.height).toBeGreaterThan(recipe.dimensionsMm.lensHeight);
        expect(generated.metadata.templeCenterlineLengthMm.left).toBeCloseTo(recipe.dimensionsMm.templeLength, 5);
        expect(generated.metadata.templeCenterlineLengthMm.right).toBeCloseTo(recipe.dimensionsMm.templeLength, 5);
        expect(generated.physicalFit.modelFrontWidth * 1000).toBeCloseTo(recipe.dimensionsMm.frameWidth, 3);
        expect(physicalAssetScale(generated.physicalFit)).toBeCloseTo(100, 3);
        for (const side of ['left', 'right']) {
          const temple = mesh(generated.scene, `temple-${side}`), tip = mesh(generated.scene, `ear-tip-${side}`);
          expect(ringCenter(temple, 48).distanceTo(ringCenter(tip, 0))).toBeLessThan(0.000001);
          expect(temple.position.toArray()).toEqual([0, 0, 0]);
          expect(tip.geometry.boundingBox!.max.z).toBeLessThan(0);
          const lens = mesh(generated.scene, `lens-${side}`);
          expect(lens.geometry.boundingBox!.min.z).toBeGreaterThan(0);
          const lensSize = lens.geometry.boundingBox!.getSize(new THREE.Vector3()).multiplyScalar(1000);
          expect(lensSize.x).toBeCloseTo(recipe.dimensionsMm.lensWidth, 3);
          expect(lensSize.y).toBeCloseTo(recipe.dimensionsMm.lensHeight, 3);
        }
        const bridge = mesh(generated.scene, 'bridge');
        // Tube section 12 is the apex. It is the common model origin.
        expect(ringCenter(bridge, 12).length()).toBeLessThan(0.000001);
        if (materialPreset === 'metal') expect(mesh(generated.scene, 'nose-pad-left').geometry.boundingBox!.max.z).toBeLessThan(0);
        const color = (mesh(generated.scene, 'rim-left').material as THREE.MeshPhysicalMaterial).color;
        expect(color.getHexString(THREE.SRGBColorSpace)).toBe('26342d');
      } finally { disposeGeneratedGlasses(generated); }
    });
  }

  it('gets the actual SDK optics, temple and hair adaptations on all generated semantic parts', () => {
    const generated = buildParametricGlasses(DEFAULT_GLASSES_RECIPE);
    const optics = installLensOptics(generated.scene, {});
    const temples = installTempleEffects(generated.scene, { fadeStartZ: -.083, fadeWidth: .029 });
    const hair = new HairMask();
    try {
      hair.install(generated.scene, generated.fit.referenceEyeSpan);
      expect(optics.materials).toHaveLength(2);
      expect(temples.meshCount).toBe(4);
      expect(hair.meshCount).toBe(4);
      optics.setScale(physicalAssetScale(generated.physicalFit)!);
      expect(optics.materials[0]!.thickness).toBeCloseTo(.002);
      expect(optics.materials[0]!.transmission).toBe(.95);
    } finally { hair.dispose(); optics.restore(); disposeGeneratedGlasses(generated); }
  });

  it('keeps every rim, endpiece, hinge, temple and metal nose pad connected across styles and boundary dimensions', () => {
    const dimensionCases = [
      { dimensionsMm: DEFAULT_GLASSES_RECIPE.dimensionsMm, frameThicknessMm: 4 },
      { dimensionsMm: { lensWidth: 35, lensHeight: 22, bridgeWidth: 12, templeLength: 90, frameWidth: 105 }, frameThicknessMm: 1 },
      { dimensionsMm: { lensWidth: 65, lensHeight: 60, bridgeWidth: 30, templeLength: 160, frameWidth: 180 }, frameThicknessMm: 8 },
      // No derived endpiece: the hinge itself must overlap the rim.
      { dimensionsMm: { lensWidth: 50, lensHeight: 38, bridgeWidth: 18, templeLength: 140, frameWidth: 120 }, frameThicknessMm: 1 },
    ];
    for (const template of listGlassesTemplates()) for (const materialPreset of ['acetate', 'metal'] as const)
      for (const templeStyle of ['curved', 'straight'] as const) for (const dimensions of dimensionCases) {
        const recipe = { ...DEFAULT_GLASSES_RECIPE, templateId: template.id, materialPreset, templeStyle, ...dimensions };
        const generated = buildParametricGlasses(recipe);
        try {
          expect(validateGeneratedGlasses(generated).valid).toBe(true);
          for (const side of ['left', 'right'] as const) {
            const sign = side === 'left' ? -1 : 1;
            const rim = mesh(generated.scene, `rim-${side}`), hinge = mesh(generated.scene, `hinge-${side}`), temple = mesh(generated.scene, `temple-${side}`);
            const connector = generated.scene.getObjectByName(`endpiece-${side}`) as THREE.Mesh | undefined;
            const positions = rim.geometry.getAttribute('position'), outerX = sign < 0 ? rim.geometry.boundingBox!.min.x : rim.geometry.boundingBox!.max.x;
            let anchorY = 0;
            for (let vertex = 0; vertex < positions.count; vertex++) if (Math.abs(positions.getX(vertex) - outerX) < 1e-8) { anchorY = positions.getY(vertex); break; }
            const anchor = new THREE.Vector3(outerX - sign * Math.min(recipe.frameThicknessMm * .000125, .0003), anchorY, (rim.geometry.boundingBox!.min.z + rim.geometry.boundingBox!.max.z) / 2);
            expect(isInsideGeometry(rim, anchor), `${template.id}/${materialPreset}/${templeStyle}: rim attachment`).toBe(true);
            expect((connector ?? hinge).geometry.boundingBox!.containsPoint(anchor), `${template.id}/${materialPreset}/${templeStyle}: connector inside rim at ${recipe.frameThicknessMm}mm`).toBe(true);
            if (connector) expect(connector.geometry.boundingBox!.intersectsBox(hinge.geometry.boundingBox!)).toBe(true);
            expect(hinge.geometry.boundingBox!.intersectsBox(temple.geometry.boundingBox!)).toBe(true);
            expect(generated.metadata.templeCenterlineLengthMm[side]).toBeCloseTo(recipe.dimensionsMm.templeLength, 4);
            if (materialPreset === 'metal') {
              const arm = mesh(generated.scene, `nose-pad-arm-${side}`), pad = mesh(generated.scene, `nose-pad-${side}`);
              expect(isInsideGeometry(mesh(generated.scene, 'bridge'), ringCenter(arm, 0))).toBe(true);
              expect(isInsideGeometry(pad, ringCenter(arm, 16))).toBe(true);
            }
          }
        } finally { disposeGeneratedGlasses(generated); }
      }
  });

  for (const source of ['estimated', 'supplier', 'measured'] as const) {
    it(`keeps ${source} frame-width provenance without promoting template fidelity`, () => {
      const generated = buildParametricGlasses({ ...DEFAULT_GLASSES_RECIPE, dimensionSources: { ...DEFAULT_GLASSES_RECIPE.dimensionSources, frameWidth: source } });
      try {
        expect(generated.physicalFit.source).toBe(source === 'estimated' ? 'approximation' : source);
        expect(generated.metadata.fidelityTier).toBe('template-approximation');
        expect(generated.metadata.sdk.physicalFit).toEqual(generated.physicalFit);
      } finally { disposeGeneratedGlasses(generated); }
    });
  }

  it('supports dimensions at the small and large valid recipe limits', () => {
    for (const recipe of [
      { ...DEFAULT_GLASSES_RECIPE, dimensionsMm: { lensWidth: 35, lensHeight: 22, bridgeWidth: 12, templeLength: 90, frameWidth: 105 }, frameThicknessMm: 1 },
      { ...DEFAULT_GLASSES_RECIPE, dimensionsMm: { lensWidth: 65, lensHeight: 60, bridgeWidth: 30, templeLength: 160, frameWidth: 180 }, frameThicknessMm: 8 },
    ]) {
      const generated = buildParametricGlasses(recipe);
      try { expect(validateGeneratedGlasses(generated).valid).toBe(true); }
      finally { disposeGeneratedGlasses(generated); }
    }
  });

  it('rejects nonfinite attributes, incorrect indices and detached coordinate transforms', () => {
    const generated = buildParametricGlasses(DEFAULT_GLASSES_RECIPE);
    try {
      mesh(generated.scene, 'rim-left').geometry.getAttribute('position').setX(0, Number.NaN);
      mesh(generated.scene, 'temple-left').position.x = .01;
      mesh(generated.scene, 'ear-tip-right').geometry.getIndex()!.setX(0, 1_000_000);
      const report = validateGeneratedGlasses(generated);
      expect(report.valid).toBe(false);
      expect(report.issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['rim-left.position', 'temple-left', 'ear-tip-right', 'bounds']));
    } finally { disposeGeneratedGlasses(generated); }
  });

  it('rejects missing semantic parts and mismatched physical width', () => {
    const generated = buildParametricGlasses(DEFAULT_GLASSES_RECIPE);
    try {
      mesh(generated.scene, 'lens-left').name = 'clear-lens-left';
      generated.physicalFit.modelFrontWidth *= 2;
      const report = validateGeneratedGlasses(generated);
      expect(report.valid).toBe(false);
      expect(report.issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['lens-left', 'physicalFit.modelFrontWidth']));
    } finally { disposeGeneratedGlasses(generated); }
  });

  it('rejects a detached front connection and missing metal pad support before export', () => {
    const generated = buildParametricGlasses({ ...DEFAULT_GLASSES_RECIPE, templateId: 'cat-eye', materialPreset: 'metal' });
    try {
      mesh(generated.scene, 'endpiece-right').geometry.translate(0, .008, 0);
      mesh(generated.scene, 'nose-pad-arm-left').name = 'unsupported-metal-part';
      const report = validateGeneratedGlasses(generated);
      expect(report.valid).toBe(false);
      expect(report.issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['endpiece-right/hinge-right', 'nose-pad-arm-left']));
    } finally { disposeGeneratedGlasses(generated); }
  });

  it('disposes every shared resource once and releases scene children', () => {
    const generated = buildParametricGlasses(DEFAULT_GLASSES_RECIPE);
    const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>();
    generated.scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
    });
    const materialSpies = [...materials].map(material => vi.spyOn(material, 'dispose'));
    const geometrySpies = [...geometries].map(geometry => vi.spyOn(geometry, 'dispose'));
    disposeGeneratedGlasses(generated); disposeGeneratedGlasses(generated);
    expect([...materialSpies, ...geometrySpies].every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(generated.scene.children).toHaveLength(0);
  });

  it('exports embedded fit, physical calibration and lens names without taking scene ownership', async () => {
    const generated = buildParametricGlasses(DEFAULT_GLASSES_RECIPE);
    try {
      mesh(generated.scene, 'lens-left').visible = false;
      const blob = await withFileReader(() => exportGeneratedGlassesGlb(generated));
      const buffer = await blob.arrayBuffer(), header = new DataView(buffer);
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, header.getUint32(12, true)))) as { nodes: Array<{ name: string }>; scenes: Array<{ extras?: { vtoGlasses?: { sdk: unknown } } }>; buffers: Array<{ uri?: string }> };
      expect(header.getUint32(0, true)).toBe(0x46546c67);
      expect(json.scenes[0]?.extras?.vtoGlasses?.sdk).toEqual(generated.metadata.sdk);
      expect(json.nodes.some(node => node.name === 'lens-left')).toBe(true);
      expect(json.buffers.every(buffer => !buffer.uri)).toBe(true);
      expect(generated.scene.children.length).toBeGreaterThan(0);
      expect(mesh(generated.scene, 'lens-left').visible).toBe(false);
      const loaded = await new GLTFLoader().parseAsync(buffer, '');
      expect(loaded.scene.userData.vtoGlasses.sdk).toEqual(generated.metadata.sdk);
      expect(loaded.scene.getObjectByName('lens-left')).toBeInstanceOf(THREE.Mesh);
      disposeGeneratedGlasses({ scene: loaded.scene });
    } finally { disposeGeneratedGlasses(generated); }
  });

  it('refuses unsafe generated geometry before invoking the exporter', async () => {
    const generated = buildParametricGlasses(DEFAULT_GLASSES_RECIPE);
    const exporter = vi.spyOn(GLTFExporter.prototype, 'parseAsync');
    try {
      mesh(generated.scene, 'lens-left').name = 'wrong-name';
      await expect(exportGeneratedGlassesGlb(generated)).rejects.toThrow('An SDK semantic part is missing');
      expect(exporter).not.toHaveBeenCalled();
    } finally { disposeGeneratedGlasses(generated); }
  });

  it('exports the same bytes for the same recipe without timestamps or random node identifiers', async () => {
    const first = await withFileReader(() => exportGlassesGlb(DEFAULT_GLASSES_RECIPE));
    const second = await withFileReader(() => exportGlassesGlb(DEFAULT_GLASSES_RECIPE));
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(new Uint8Array(await second.arrayBuffer()));
  });

  it('releases temporary resources when recipe export fails', async () => {
    vi.spyOn(GLTFExporter.prototype, 'parseAsync').mockRejectedValueOnce(new Error('Synthetic export failure'));
    const geometryDisposal = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const materialDisposal = vi.spyOn(THREE.Material.prototype, 'dispose');
    await expect(exportGlassesGlb(DEFAULT_GLASSES_RECIPE)).rejects.toThrow('Synthetic export failure');
    expect(geometryDisposal.mock.calls.length).toBeGreaterThan(10);
    expect(materialDisposal.mock.calls.length).toBeGreaterThan(0);
  });
});
