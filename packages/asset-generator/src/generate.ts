/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { interpretGlassesDescription } from './description';
import type { DescriptionInterpretation, DescriptionRecipeField } from './description';
import { buildParametricGlasses, disposeGeneratedGlasses, validateGeneratedGlasses } from './geometry';
import type { GeneratedGlassesFit, GeneratedGlassesValidation, GeneratedPhysicalFit } from './geometry';
import { exportGeneratedGlassesGlb } from './export';
import { validateGlassesRecipe } from './recipe';
import type { GlassesRecipe, RecipeIssue } from './recipe';

/**
 * Return an unknown recipe, or { recipe, assumptions?: string[] }; it is validated
 * before building. Explicit supported product values must agree with the text,
 * and every text-derived dimension must use estimated provenance.
 */
export type GlassesDescriptionInterpreter = (description: string, context: { signal: AbortSignal }) => Promise<unknown>;

export interface GenerateGlassesAssetOptions {
  description?: string;
  recipe?: unknown;
  /** Optional application-owned interpreter. It receives product text only; no camera data or keys. */
  interpreter?: GlassesDescriptionInterpreter;
  signal?: AbortSignal;
  /** Overall delivery deadline, including interpretation and export. Default: 20 seconds. */
  timeoutMs?: number;
}

export interface GlassesGenerationReport extends GeneratedGlassesValidation {
  warnings: string[];
  assumptions: string[];
  interpretation: 'local' | 'provided-recipe' | 'custom-interpreter';
}

export interface GeneratedGlassesManifest {
  schemaVersion: 1;
  kind: 'vto-glasses-asset';
  asset: {
    id: string;
    name: string;
    url: string;
    fit: GeneratedGlassesFit;
    physicalFit: GeneratedPhysicalFit;
  };
  recipe: GlassesRecipe;
  report: GlassesGenerationReport;
}

export interface GeneratedGlassesAssetFile { name: string; blob: Blob }
export interface GeneratedGlassesAsset {
  blob: Blob;
  recipe: GlassesRecipe;
  fit: GeneratedGlassesFit;
  physicalFit: GeneratedPhysicalFit;
  report: GlassesGenerationReport;
  manifest: GeneratedGlassesManifest;
  files: { glb: GeneratedGlassesAssetFile; recipe: GeneratedGlassesAssetFile; manifest: GeneratedGlassesAssetFile };
}

export class GlassesGenerationError extends Error {
  constructor(
    message: string,
    public readonly issues: RecipeIssue[],
    public readonly code: 'invalid-input' | 'interpretation' | 'generation' | 'timeout' = 'invalid-input',
  ) {
    super(message);
    this.name = 'GlassesGenerationError';
  }
}

const recipeKeys = ['schemaVersion', 'templateId', 'templateVersion', 'generatorVersion', 'productId', 'name', 'dimensionsMm', 'dimensionSources', 'frameThicknessMm', 'materialPreset', 'frameColor', 'lensTint', 'templeStyle'];
const dimensionKeys = ['lensWidth', 'lensHeight', 'bridgeWidth', 'templeLength', 'frameWidth'];

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

function isDataRecord(input: Record<string, unknown>): boolean {
  const prototype = Object.getPrototypeOf(input) as unknown;
  return (prototype === null || prototype === Object.prototype)
    && Object.values(Object.getOwnPropertyDescriptors(input)).every((property) => !property.get && !property.set);
}

function strictRecipeIssues(input: unknown): RecipeIssue[] {
  if (!isRecord(input)) return [];
  if (!isDataRecord(input)) return [{ path: '$', message: 'Use a plain JSON recipe object with data properties.' }];
  const issues: RecipeIssue[] = [];
  for (const key of Object.keys(input)) if (!recipeKeys.includes(key)) issues.push({ path: key, message: 'Unknown recipe property. Use the documented version 1 recipe fields.' });
  for (const parent of ['dimensionsMm', 'dimensionSources']) {
    const value = input[parent];
    if (isRecord(value)) {
      if (!isDataRecord(value)) issues.push({ path: parent, message: 'Use a plain JSON object with data properties.' });
      else for (const key of Object.keys(value)) if (!dimensionKeys.includes(key)) issues.push({ path: `${parent}.${key}`, message: 'Unknown dimension property. Use lensWidth, lensHeight, bridgeWidth, templeLength, or frameWidth.' });
    }
  }
  return issues;
}

function failure(issues: RecipeIssue[], code: GlassesGenerationError['code'] = 'invalid-input'): GlassesGenerationError {
  return new GlassesGenerationError(issues.map(({ path, message }) => `${path}: ${message}`).join(' '), issues, code);
}

function abortError(): DOMException { return new DOMException('Glasses asset generation was cancelled.', 'AbortError'); }

function assertRunning(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof GlassesGenerationError ? signal.reason : abortError();
}

async function cancellable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  assertRunning(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason instanceof GlassesGenerationError ? signal.reason : abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    task.then((result) => {
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted) onAbort();
      else resolve(result);
    }, (error: unknown) => {
      signal.removeEventListener('abort', onAbort);
      reject(error);
    });
    if (signal.aborted) onAbort();
  });
}

function jsonFile(name: string, value: unknown): GeneratedGlassesAssetFile {
  return { name, blob: new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }) };
}

function fieldValue(recipe: GlassesRecipe, field: DescriptionRecipeField): unknown {
  if (field.startsWith('dimensionsMm.')) return recipe.dimensionsMm[field.slice('dimensionsMm.'.length) as keyof GlassesRecipe['dimensionsMm']];
  return recipe[field as Exclude<keyof GlassesRecipe, 'dimensionsMm' | 'dimensionSources'>];
}

/**
 * Generate a semantic GLB, SDK fit descriptor, and reproducible JSON files locally.
 * The default path performs no network requests. Object URLs and SDK lifecycle are
 * owned by the caller. Aborting suppresses delivery; an already-started GLB export
 * may finish internally and its temporary geometry is disposed when it settles.
 */
export async function generateGlassesAsset(options: GenerateGlassesAssetOptions): Promise<GeneratedGlassesAsset> {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) throw failure([{ path: 'options', message: 'Pass a generation options object.' }]);
  const hasDescription = options.description !== undefined;
  const hasRecipe = options.recipe !== undefined;
  if (hasDescription === hasRecipe) throw failure([{ path: 'options', message: 'Provide exactly one description or recipe.' }]);
  if (options.interpreter !== undefined && (!hasDescription || typeof options.interpreter !== 'function')) throw failure([{ path: 'interpreter', message: 'An interpreter function can only be used with a description.' }]);
  const timeoutMs = options.timeoutMs ?? 20_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) throw failure([{ path: 'timeoutMs', message: 'Use a finite deadline from 100 to 120000 milliseconds.' }]);
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) throw failure([{ path: 'signal', message: 'Use an AbortSignal.' }]);
  if (hasDescription && (typeof options.description !== 'string' || !options.description.trim() || options.description.length > 3000)) throw failure([{ path: 'description', message: 'Enter a product description from 1 to 3000 characters.' }]);

  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener('abort', forwardAbort, { once: true });
  if (options.signal?.aborted) forwardAbort();
  const timer = setTimeout(() => controller.abort(failure([{ path: 'request', message: 'Asset generation timed out. Try again or shorten the interpreter request.' }], 'timeout')), timeoutMs);
  let interpretation: GlassesGenerationReport['interpretation'] = 'provided-recipe';
  let assumptions: string[] = [];
  let descriptionConstraints: Extract<DescriptionInterpretation, { success: true }> | undefined;
  try {
    assertRunning(controller.signal);
    let input: unknown = options.recipe;
    if (hasDescription) {
      if (options.interpreter) {
        interpretation = 'custom-interpreter';
        const interpreted = interpretGlassesDescription(options.description!);
        if (!interpreted.success) throw failure(interpreted.issues, 'interpretation');
        descriptionConstraints = interpreted;
        let output: unknown;
        try {
          output = await cancellable(Promise.resolve().then(() => {
            assertRunning(controller.signal);
            return options.interpreter!(options.description!, { signal: controller.signal });
          }), controller.signal);
        } catch (error) {
          assertRunning(controller.signal);
          throw failure([{ path: 'interpreter', message: `Product interpretation failed: ${error instanceof Error ? error.message : 'the interpreter did not return a recipe'}` }], 'interpretation');
        }
        if (isRecord(output) && Object.hasOwn(output, 'recipe')) {
          if (!isDataRecord(output)) throw failure([{ path: 'interpreter', message: 'Return a plain JSON object with data properties.' }], 'interpretation');
          const extra = Object.keys(output).filter((key) => !['recipe', 'assumptions'].includes(key));
          if (extra.length) throw failure(extra.map((path) => ({ path: `interpreter.${path}`, message: 'Unknown interpreter output property. Return recipe and optional assumptions only.' })), 'interpretation');
          input = output.recipe;
          if (output.assumptions !== undefined) {
            if (!Array.isArray(output.assumptions) || output.assumptions.length > 20 || output.assumptions.some((value) => typeof value !== 'string' || !value.trim() || value.length > 300)) throw failure([{ path: 'interpreter.assumptions', message: 'Use at most 20 nonempty assumption strings, each up to 300 characters.' }], 'interpretation');
            assumptions = (output.assumptions as string[]).map((value) => value.trim());
          }
        } else input = output;
        const outputIssues = strictRecipeIssues(input);
        if (outputIssues.length) throw failure(outputIssues, 'interpretation');
        if (isRecord(input) && isRecord(input.dimensionSources)) {
          const inventedSources = Object.entries(input.dimensionSources).filter(([, value]) => value !== 'estimated');
          if (inventedSources.length) throw failure(inventedSources.map(([key]) => ({ path: `dimensionSources.${key}`, message: 'Descriptions cannot establish supplier/measured provenance. Mark text-derived dimensions as estimated; import a verified recipe separately.' })), 'interpretation');
        }
        assumptions.push('The application-owned interpreter proposed a template recipe; product geometry and dimensions remain unverified.');
      } else {
        interpretation = 'local';
        const interpreted = interpretGlassesDescription(options.description!);
        if (!interpreted.success) throw failure(interpreted.issues, 'interpretation');
        input = interpreted.recipe;
        assumptions = interpreted.assumptions;
      }
    }
    assertRunning(controller.signal);
    const shapeIssues = strictRecipeIssues(input);
    if (shapeIssues.length) throw failure(shapeIssues, interpretation === 'custom-interpreter' ? 'interpretation' : 'invalid-input');
    const validation = validateGlassesRecipe(input);
    if (!validation.success) throw failure(validation.errors, interpretation === 'custom-interpreter' ? 'interpretation' : 'invalid-input');
    const recipe = validation.recipe;
    if (descriptionConstraints) {
      const conflicts: RecipeIssue[] = [];
      for (const field of descriptionConstraints.specifiedFields) {
        const expected = fieldValue(descriptionConstraints.recipe, field);
        const actual = fieldValue(recipe, field);
        const agrees = typeof expected === 'number' && typeof actual === 'number' ? Math.abs(expected - actual) < 1e-6 : expected === actual;
        if (!agrees) conflicts.push({ path: field, message: `The interpreter changed an explicit product value (${String(expected)} → ${String(actual)}). Keep the requested value or revise the description.` });
      }
      if (conflicts.length) throw failure(conflicts, 'interpretation');
    }
    const generated = buildParametricGlasses(recipe);
    let exporting = false;
    try {
      const geometryReport = validateGeneratedGlasses(generated);
      if (!geometryReport.valid) throw failure(geometryReport.issues, 'generation');
      assertRunning(controller.signal);
      const fit: GeneratedGlassesFit = { ...generated.fit, offset: [...generated.fit.offset], rotation: [...generated.fit.rotation] };
      const physicalFit = { ...generated.physicalFit };
      const report: GlassesGenerationReport = { ...geometryReport, warnings: [...validation.warnings], assumptions, interpretation };
      const exportTask = exportGeneratedGlassesGlb(generated).finally(() => disposeGeneratedGlasses(generated));
      exporting = true;
      const blob = await cancellable(exportTask, controller.signal);
      assertRunning(controller.signal);
      const safeId = recipe.productId.replace(/[^\w.-]+/g, '-').replace(/^\.+/, '') || 'generated-frame';
      const assetName = `${safeId}.glb`;
      const manifest: GeneratedGlassesManifest = {
        schemaVersion: 1, kind: 'vto-glasses-asset',
        asset: { id: recipe.productId, name: recipe.name, url: assetName, fit, physicalFit }, recipe, report,
      };
      return {
        blob, recipe, fit, physicalFit, report, manifest,
        files: { glb: { name: assetName, blob }, recipe: jsonFile(`${safeId}.recipe.json`, recipe), manifest: jsonFile(`${safeId}.manifest.json`, manifest) },
      };
    } finally {
      if (!exporting) disposeGeneratedGlasses(generated);
    }
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}
