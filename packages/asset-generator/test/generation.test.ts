/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { interpretGlassesDescription } from '../src/description';
import { generateGlassesAsset, GlassesGenerationError } from '../src/generate';
import { DEFAULT_GLASSES_RECIPE } from '../src/recipe';
import * as exportModule from '../src/export';
import * as geometryModule from '../src/geometry';

const originalFileReader = globalThis.FileReader;
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
beforeAll(() => { globalThis.FileReader = TestFileReader as unknown as typeof FileReader; });
afterAll(() => { globalThis.FileReader = originalFileReader; });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('local product-description interpreter', () => {
  it('interprets the shortest Indonesian round-frame description deterministically', () => {
    const text = 'Kacamata bulat hitam acetate 52-18-140, lensa bening';
    const result = interpretGlassesDescription(text);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.recipe).toMatchObject({ templateId: 'round', frameColor: '#171717', materialPreset: 'acetate', lensTint: '#EEF4F4', dimensionsMm: { lensWidth: 52, bridgeWidth: 18, templeLength: 140, frameWidth: 146 } });
    expect(Object.values(result.recipe.dimensionSources)).toEqual(Array(5).fill('estimated'));
    expect(result.assumptions.join(' ')).toContain('design targets');
    expect(interpretGlassesDescription(text)).toEqual(result);
  });

  it.each([
    ['Rectangle metal gold 54-18-145, blue lenses', 'rectangle', 'metal', '#C5A35E', '#315D91'],
    ['Cat-eye asetat merah muda, lensa abu-abu', 'cat-eye', 'acetate', '#CE91A8', '#6B7178'],
    ['Kacamata persegi panjang logam perak, lensa bening', 'rectangle', 'metal', '#BFC5CC', '#EEF4F4'],
    ['Mata kucing acetate #725184, lensa #D9E8E4', 'cat-eye', 'acetate', '#725184', '#D9E8E4'],
  ])('interprets supported English and Indonesian designs: %s', (text, templateId, materialPreset, frameColor, lensTint) => {
    const result = interpretGlassesDescription(text);
    expect(result.success).toBe(true);
    if (result.success) expect(result.recipe).toMatchObject({ templateId, materialPreset, frameColor, lensTint });
  });

  it('keeps frame and lens colors separate without requiring punctuation', () => {
    const result = interpretGlassesDescription('round metal gold frame and blue lenses');
    expect(result.success).toBe(true);
    if (result.success) expect(result.recipe).toMatchObject({ frameColor: '#C5A35E', lensTint: '#315D91' });
  });

  it.each([
    'Kacamata bulat hitam acetate 52-18-140 lensa bening',
    'Kacamata bulat hitam dan lensa bening',
    'Round black frame with clear lenses',
    'Round frame black with clear lenses',
  ])('keeps product color separate from a following lens phrase: %s', (text) => {
    const result = interpretGlassesDescription(text);
    expect(result.success, JSON.stringify(result)).toBe(true);
    if (result.success) expect(result.recipe).toMatchObject({ frameColor: '#171717', lensTint: '#EEF4F4' });
  });

  it('supports labeled dimensions, decimal comma, and conversion to millimeters', () => {
    const result = interpretGlassesDescription('Round acetate black, lens width 5,2 cm, lens height 3.8 cm, bridge 18 mm, temple length 140 mm, frame width 146 mm, frame thickness 4 mm');
    expect(result.success, JSON.stringify(result)).toBe(true);
    if (result.success) expect(result.recipe.dimensionsMm).toEqual(DEFAULT_GLASSES_RECIPE.dimensionsMm);
  });

  it('accepts equivalent code and labeled values without false conflicts', () => {
    const result = interpretGlassesDescription('round 52-18-140, lens width 5.2 cm, lensa bening');
    expect(result.success, JSON.stringify(result)).toBe(true);
  });

  it('discloses missing design defaults and derived width rather than inventing supplier data', () => {
    const result = interpretGlassesDescription('rectangle metal gold');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.recipe.frameThicknessMm).toBe(2);
    expect(result.recipe.dimensionsMm.frameWidth).toBe(142);
    expect(result.assumptions.join(' ')).toContain('estimated 8 mm endpiece');
    expect(result.recipe.dimensionSources.frameWidth).toBe('estimated');
  });

  it('supports clear qualitative thickness and temple shape choices', () => {
    const result = interpretGlassesDescription('round metal silver thin straight temples');
    expect(result.success).toBe(true);
    if (result.success) expect(result.recipe).toMatchObject({ frameThicknessMm: 1.5, templeStyle: 'straight' });
  });

  it.each([
    ['aviator metal gold', 'templateId'],
    ['round rectangle acetate', 'templateId'],
    ['round acetate metal', 'materialPreset'],
    ['round wood', 'materialPreset'],
    ['round black red frame', 'frameColor'],
    ['round, blue red lenses', 'lensTint'],
    ['round thin thick', 'frameThicknessMm'],
    ['round straight curved temples', 'templeStyle'],
    ['round tortoiseshell', 'frameColor'],
    ['round, lens tint 20%', 'lensTint'],
    ['round frame #fff', 'frameColor'],
    ['not round metal', 'description'],
    ['shape diamond metal gold', 'templateId'],
    ['round material aluminium', 'materialPreset'],
    ['round warna chartreuse', 'frameColor'],
    ['round lensa aqua', 'lensTint'],
    ['round transparent acetate frame', 'frameColor'],
    ['kacamata bulat bening', 'frameColor'],
  ])('surfaces unsupported or conflicting design requests: %s', (text, path) => {
    const result = interpretGlassesDescription(text);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.map((issue) => issue.path)).toContain(path);
  });

  it.each([
    ['round 52-18-140, lens width 54 mm', 'dimensionsMm.lensWidth'],
    ['round lens width 90 mm', 'dimensionsMm.lensWidth'],
    ['round lens width -52 mm', 'dimensionsMm.lensWidth'],
    ['round frame width 110 mm', 'dimensionsMm.frameWidth'],
    ['round 52-18-140, frame thickness 4 mm, frame thickness 6 mm', 'frameThicknessMm'],
    ['round 52-18', 'dimensionsMm'],
    ['round width 140 mm', 'dimensionsMm'],
    ['round lens width large', 'dimensionsMm'],
    ['round 52-18-140 cm', 'dimensionsMm'],
    ['round PD 64 mm', 'dimensionsMm'],
    ['round lens width 52 meters', 'dimensionsMm.lensWidth'],
    ['round -52-18-140', 'dimensionsMm'],
  ])('rejects conflicting, malformed, or unlabeled dimensions: %s', (text, path) => {
    const result = interpretGlassesDescription(text);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.map((issue) => issue.path)).toContain(path);
  });

  it.each(['', '  ', 'x'.repeat(3001)])('rejects empty and oversized input', (text) => {
    expect(interpretGlassesDescription(text)).toMatchObject({ success: false, issues: [{ path: 'description' }] });
  });
});

describe('validated SDK-ready asset generation', () => {
  it('generates one local GLB with semantic SDK metadata and portable JSON files', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const buildSpy = vi.spyOn(geometryModule, 'buildParametricGlasses');
    const disposalSpy = vi.spyOn(geometryModule, 'disposeGeneratedGlasses');
    const bundle = await generateGlassesAsset({ description: 'Kacamata bulat hitam acetate 52-18-140, lensa bening' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(disposalSpy).toHaveBeenCalledTimes(1);
    expect(buildSpy.mock.results[0]!.value.scene.children).toHaveLength(0);
    expect(bundle.report).toMatchObject({ valid: true, issues: [], interpretation: 'local' });
    expect(bundle.report.meshCount).toBeGreaterThan(10);
    expect(bundle.report.triangleCount).toBeLessThan(100_000);
    expect(bundle.physicalFit).toMatchObject({ frontWidthMm: 146, source: 'approximation' });
    expect(bundle.physicalFit.modelFrontWidth).toBeCloseTo(0.146, 5);
    expect(bundle.files.glb.blob).toBe(bundle.blob);
    expect(JSON.parse(await bundle.files.recipe.blob.text())).toEqual(bundle.recipe);
    expect(JSON.parse(await bundle.files.manifest.blob.text())).toEqual(bundle.manifest);
    expect(bundle.manifest.asset).toMatchObject({ fit: bundle.fit, physicalFit: bundle.physicalFit });
    expect(bundle.manifest.asset.url).toBe(bundle.files.glb.name);
    const buffer = await bundle.blob.arrayBuffer();
    const view = new DataView(buffer);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    expect(view.getUint32(4, true)).toBe(2);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, view.getUint32(12, true)))) as { nodes: Array<{ name: string }>; scenes: Array<{ extras?: { vtoGlasses?: { sdk?: unknown; fidelityTier?: string } } }> };
    expect(json.nodes.map((node) => node.name)).toEqual(expect.arrayContaining(['lens-left', 'lens-right', 'temple-left', 'ear-tip-right']));
    expect(json.scenes[0]?.extras?.vtoGlasses).toMatchObject({ fidelityTier: 'template-approximation', sdk: { fit: bundle.fit, physicalFit: bundle.physicalFit } });
  });

  it('supports a supplied validated recipe while retaining explicit dimension provenance', async () => {
    const recipe = { ...DEFAULT_GLASSES_RECIPE, dimensionSources: { ...DEFAULT_GLASSES_RECIPE.dimensionSources, frameWidth: 'measured' } };
    const bundle = await generateGlassesAsset({ recipe });
    expect(bundle.report.interpretation).toBe('provided-recipe');
    expect(bundle.physicalFit.source).toBe('measured');
    expect(bundle.recipe).not.toBe(recipe);
    expect(recipe.dimensionSources.frameWidth).toBe('measured');
  });

  it('provides only product text and an abort signal to an injected interpreter', async () => {
    const interpreter = vi.fn(async () => ({ recipe: { ...DEFAULT_GLASSES_RECIPE, frameColor: '#171717' }, assumptions: ['Design target dimensions only.'] }));
    const bundle = await generateGlassesAsset({ description: 'Round black frame', interpreter });
    expect(interpreter).toHaveBeenCalledOnce();
    const [description, context] = interpreter.mock.calls[0] as unknown as [string, { signal: AbortSignal }];
    expect(description).toBe('Round black frame');
    expect(Object.keys(context)).toEqual(['signal']);
    expect(context.signal).toBeInstanceOf(AbortSignal);
    expect(bundle.report.interpretation).toBe('custom-interpreter');
    expect(bundle.report.assumptions).toContain('Design target dimensions only.');
  });

  it.each([
    null,
    'not JSON',
    { ...DEFAULT_GLASSES_RECIPE, uploadUrl: 'https://invalid.example' },
    { ...DEFAULT_GLASSES_RECIPE, dimensionsMm: { ...DEFAULT_GLASSES_RECIPE.dimensionsMm, pd: 64 } },
    { ...DEFAULT_GLASSES_RECIPE, templateId: 'aviator' },
    { recipe: DEFAULT_GLASSES_RECIPE, url: 'https://invalid.example' },
    { recipe: DEFAULT_GLASSES_RECIPE, assumptions: [42] },
    Object.create(DEFAULT_GLASSES_RECIPE) as unknown,
    { ...DEFAULT_GLASSES_RECIPE, dimensionsMm: Object.create(DEFAULT_GLASSES_RECIPE.dimensionsMm) as unknown },
  ])('validates and rejects unknown model output before geometry allocation', async (output) => {
    const buildSpy = vi.spyOn(geometryModule, 'buildParametricGlasses');
    await expect(generateGlassesAsset({ description: 'round frame', interpreter: async () => output })).rejects.toBeInstanceOf(GlassesGenerationError);
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it('rejects invented measured or supplier provenance from a description interpreter', async () => {
    const recipe = { ...DEFAULT_GLASSES_RECIPE, dimensionSources: { ...DEFAULT_GLASSES_RECIPE.dimensionSources, lensWidth: 'supplier' } };
    await expect(generateGlassesAsset({ description: 'round 52-18-140', interpreter: async () => recipe })).rejects.toMatchObject({ code: 'interpretation', issues: [{ path: 'dimensionSources.lensWidth' }] });
  });

  it('rejects model accessor properties without evaluating them', async () => {
    const getter = vi.fn(() => DEFAULT_GLASSES_RECIPE);
    const output = Object.defineProperty({}, 'recipe', { enumerable: true, get: getter });
    await expect(generateGlassesAsset({ description: 'round', interpreter: async () => output })).rejects.toMatchObject({ code: 'interpretation' });
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    ['round 52-18-140', { ...DEFAULT_GLASSES_RECIPE, templateId: 'rectangle' }, 'templateId'],
    ['round 52-18-140', { ...DEFAULT_GLASSES_RECIPE, dimensionsMm: { ...DEFAULT_GLASSES_RECIPE.dimensionsMm, lensWidth: 54 } }, 'dimensionsMm.lensWidth'],
    ['round black frame', DEFAULT_GLASSES_RECIPE, 'frameColor'],
    ['round, clear lenses', DEFAULT_GLASSES_RECIPE, 'lensTint'],
    ['round thin', DEFAULT_GLASSES_RECIPE, 'frameThicknessMm'],
    ['round straight temples', DEFAULT_GLASSES_RECIPE, 'templeStyle'],
  ])('rejects schema-valid interpreter output that contradicts explicit product values: %s', async (description, recipe, path) => {
    const buildSpy = vi.spyOn(geometryModule, 'buildParametricGlasses');
    await expect(generateGlassesAsset({ description, interpreter: async () => recipe })).rejects.toMatchObject({ code: 'interpretation', issues: expect.arrayContaining([{ path, message: expect.stringContaining('explicit product value') }]) });
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it('allows an interpreter to propose unspecified values without inventing provenance', async () => {
    const bundle = await generateGlassesAsset({ description: 'Kacamata untuk koleksi baru', interpreter: async () => ({ ...DEFAULT_GLASSES_RECIPE, templateId: 'cat-eye', materialPreset: 'metal' }) });
    expect(bundle.recipe).toMatchObject({ templateId: 'cat-eye', materialPreset: 'metal' });
    expect(bundle.physicalFit.source).toBe('approximation');
  });

  it('surfaces unsupported source requests without calling an interpreter to silently substitute a template', async () => {
    const interpreter = vi.fn(async () => DEFAULT_GLASSES_RECIPE);
    await expect(generateGlassesAsset({ description: 'aviator 52-18-140', interpreter })).rejects.toMatchObject({ code: 'interpretation', issues: expect.arrayContaining([{ path: 'templateId', message: expect.stringContaining('unsupported') }]) });
    expect(interpreter).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { description: 'round', recipe: DEFAULT_GLASSES_RECIPE },
    { recipe: DEFAULT_GLASSES_RECIPE, interpreter: async () => DEFAULT_GLASSES_RECIPE },
    { description: 'round', timeoutMs: Number.NaN },
    { description: 'round', timeoutMs: 0 },
    { description: 'round', timeoutMs: 120001 },
    { recipe: { ...DEFAULT_GLASSES_RECIPE, unknown: true } },
  ])('rejects invalid generation options and recipe properties', async (options) => {
    await expect(generateGlassesAsset(options)).rejects.toBeInstanceOf(GlassesGenerationError);
  });

  it('does not invoke an interpreter or build geometry after an already-aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    const interpreter = vi.fn(async () => DEFAULT_GLASSES_RECIPE);
    const buildSpy = vi.spyOn(geometryModule, 'buildParametricGlasses');
    await expect(generateGlassesAsset({ description: 'round', interpreter, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(interpreter).not.toHaveBeenCalled();
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it('cancels a pending interpreter and suppresses its late recipe', async () => {
    const controller = new AbortController();
    let resolve!: (recipe: unknown) => void;
    let receivedSignal: AbortSignal | undefined;
    const buildSpy = vi.spyOn(geometryModule, 'buildParametricGlasses');
    const request = generateGlassesAsset({ description: 'round', signal: controller.signal, interpreter: async (_description, { signal }) => {
      receivedSignal = signal;
      return new Promise((done) => { resolve = done; });
    } });
    await Promise.resolve();
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(receivedSignal?.aborted).toBe(true);
    resolve(DEFAULT_GLASSES_RECIPE);
    await Promise.resolve();
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it('does not invoke a deferred interpreter when cancelled in the same task', async () => {
    const controller = new AbortController();
    const interpreter = vi.fn(async () => DEFAULT_GLASSES_RECIPE);
    const request = generateGlassesAsset({ description: 'round', interpreter, signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(interpreter).not.toHaveBeenCalled();
  });

  it('bounds an interpreter that ignores cancellation with an explicit deadline', async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    const request = generateGlassesAsset({ description: 'round', timeoutMs: 100, interpreter: async (_description, { signal }) => {
      receivedSignal = signal;
      return new Promise(() => {});
    } });
    const result = expect(request).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(receivedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans geometry after an asynchronous export failure', async () => {
    const disposalSpy = vi.spyOn(geometryModule, 'disposeGeneratedGlasses');
    vi.spyOn(exportModule, 'exportGeneratedGlassesGlb').mockRejectedValueOnce(new Error('Synthetic export failure'));
    await expect(generateGlassesAsset({ description: 'round' })).rejects.toThrow('Synthetic export failure');
    expect(disposalSpy).toHaveBeenCalledOnce();
  });

  it('suppresses cancelled export delivery and disposes geometry when the borrowed exporter settles', async () => {
    const controller = new AbortController();
    let finishExport!: (value: Blob) => void;
    const disposalSpy = vi.spyOn(geometryModule, 'disposeGeneratedGlasses');
    vi.spyOn(exportModule, 'exportGeneratedGlassesGlb').mockImplementationOnce(() => new Promise((done) => { finishExport = done; }));
    const request = generateGlassesAsset({ description: 'round', signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(disposalSpy).not.toHaveBeenCalled();
    finishExport(new Blob(['unused']));
    await Promise.resolve();
    await Promise.resolve();
    expect(disposalSpy).toHaveBeenCalledOnce();
  });
});
