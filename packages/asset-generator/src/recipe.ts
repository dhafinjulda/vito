/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
export type GlassesTemplateId = 'round' | 'rectangle' | 'cat-eye';
export type DimensionSource = 'estimated' | 'measured' | 'supplier';
export type DimensionKey = 'lensWidth' | 'lensHeight' | 'bridgeWidth' | 'templeLength' | 'frameWidth';
export type MaterialPreset = 'acetate' | 'metal';
export type TempleStyle = 'straight' | 'curved';

export interface GlassesDimensionsMm {
  lensWidth: number;
  lensHeight: number;
  bridgeWidth: number;
  templeLength: number;
  frameWidth: number;
}

export interface GlassesRecipe {
  schemaVersion: 1;
  templateId: GlassesTemplateId;
  templateVersion: 1;
  generatorVersion: '0.1.0';
  productId: string;
  name: string;
  dimensionsMm: GlassesDimensionsMm;
  dimensionSources: Record<DimensionKey, DimensionSource>;
  frameThicknessMm: number;
  materialPreset: MaterialPreset;
  frameColor: string;
  lensTint: string;
  templeStyle: TempleStyle;
}

export interface RecipeIssue {
  path: string;
  message: string;
}

export type RecipeValidation =
  | { success: true; recipe: GlassesRecipe; errors: []; warnings: string[] }
  | { success: false; errors: RecipeIssue[]; warnings: [] };

export interface GlassesTemplate {
  id: GlassesTemplateId;
  version: 1;
  label: string;
  shapeExponent: number;
  supports: readonly ['acetate', 'metal'];
}

const dimensionRules: Record<DimensionKey, { min: number; max: number }> = {
  lensWidth: { min: 35, max: 75 },
  lensHeight: { min: 22, max: 60 },
  bridgeWidth: { min: 12, max: 30 },
  templeLength: { min: 90, max: 160 },
  frameWidth: { min: 105, max: 180 },
};
const dimensionKeys = Object.keys(dimensionRules) as DimensionKey[];
const sources = new Set<DimensionSource>(['estimated', 'measured', 'supplier']);
const templateData: GlassesTemplate[] = [
  { id: 'round', version: 1, label: 'Round', shapeExponent: 2, supports: ['acetate', 'metal'] },
  { id: 'rectangle', version: 1, label: 'Rectangle', shapeExponent: 4, supports: ['acetate', 'metal'] },
  { id: 'cat-eye', version: 1, label: 'Cat-eye', shapeExponent: 2.4, supports: ['acetate', 'metal'] },
];

export function listGlassesTemplates(): readonly GlassesTemplate[] {
  return templateData;
}

export function getGlassesTemplate(id: string, version = 1): GlassesTemplate | undefined {
  return templateData.find((template) => template.id === id && template.version === version);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse and cross-check a merchant recipe without mutating the input. */
export function validateGlassesRecipe(input: unknown): RecipeValidation {
  const errors: RecipeIssue[] = [];
  if (!isRecord(input)) return { success: false, errors: [{ path: '$', message: 'Recipe must be an object.' }], warnings: [] };
  const add = (path: string, message: string) => errors.push({ path, message });
  if (input.schemaVersion !== 1) add('schemaVersion', 'Only recipe schema version 1 is supported.');
  if (input.templateVersion !== 1) add('templateVersion', 'Only template version 1 is supported.');
  if (input.generatorVersion !== '0.1.0') add('generatorVersion', 'This recipe was created for another generator version.');
  const template = typeof input.templateId === 'string' ? getGlassesTemplate(input.templateId, 1) : undefined;
  if (!template) add('templateId', 'Choose a supported round, rectangle, or cat-eye template.');
  for (const key of ['productId', 'name'] as const) {
    if (typeof input[key] !== 'string' || input[key].trim().length < 1 || input[key].trim().length > 80) add(key, 'Enter 1–80 characters.');
  }
  const dimensions = input.dimensionsMm;
  if (!isRecord(dimensions)) add('dimensionsMm', 'All five dimensions in millimeters are required.');
  else for (const key of dimensionKeys) {
    const value = dimensions[key];
    const rule = dimensionRules[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < rule.min || value > rule.max) {
      add(`dimensionsMm.${key}`, `Use a finite value from ${rule.min} to ${rule.max} mm.`);
    }
  }
  const thickness = input.frameThicknessMm;
  if (typeof thickness !== 'number' || !Number.isFinite(thickness) || thickness < 1 || thickness > 8) add('frameThicknessMm', 'Use a finite value from 1 to 8 mm.');
  if (input.materialPreset !== 'acetate' && input.materialPreset !== 'metal') add('materialPreset', 'Choose acetate or metal.');
  if (input.templeStyle !== 'straight' && input.templeStyle !== 'curved') add('templeStyle', 'Choose straight or curved.');
  for (const key of ['frameColor', 'lensTint'] as const) {
    if (typeof input[key] !== 'string' || !/^#[\da-fA-F]{6}$/.test(input[key])) add(key, 'Use a six-digit hex color such as #26342D.');
  }
  const inputSources = input.dimensionSources;
  if (!isRecord(inputSources)) add('dimensionSources', 'A source is required for every dimension.');
  else for (const key of dimensionKeys) if (!sources.has(inputSources[key] as DimensionSource)) add(`dimensionSources.${key}`, 'Choose estimated, measured, or supplier.');

  if (isRecord(dimensions) && typeof thickness === 'number' && Number.isFinite(thickness)
    && ['lensWidth', 'bridgeWidth', 'frameWidth'].every((key) => typeof dimensions[key] === 'number' && Number.isFinite(dimensions[key]))) {
    const lensWidth = dimensions.lensWidth as number;
    const bridgeWidth = dimensions.bridgeWidth as number;
    const frameWidth = dimensions.frameWidth as number;
    const endpieceMm = (frameWidth - 2 * (lensWidth + thickness) - bridgeWidth) / 2;
    if (endpieceMm < 0 || endpieceMm > 20) add('dimensionsMm.frameWidth', 'Frame width conflicts with lens, bridge, and rim dimensions; derived endpiece must be 0–20 mm per side.');
  }
  if (errors.length) return { success: false, errors, warnings: [] };

  const recipe: GlassesRecipe = {
    schemaVersion: 1,
    templateId: input.templateId as GlassesTemplateId,
    templateVersion: 1,
    generatorVersion: '0.1.0',
    productId: (input.productId as string).trim(),
    name: (input.name as string).trim(),
    dimensionsMm: Object.fromEntries(dimensionKeys.map((key) => [key, (dimensions as Record<string, number>)[key]])) as unknown as GlassesDimensionsMm,
    dimensionSources: Object.fromEntries(dimensionKeys.map((key) => [key, inputSources && (inputSources as Record<string, DimensionSource>)[key]])) as Record<DimensionKey, DimensionSource>,
    frameThicknessMm: thickness as number,
    materialPreset: input.materialPreset as MaterialPreset,
    frameColor: (input.frameColor as string).toUpperCase(),
    lensTint: (input.lensTint as string).toUpperCase(),
    templeStyle: input.templeStyle as TempleStyle,
  };
  const warnings = Object.values(recipe.dimensionSources).includes('estimated')
    ? ['One or more dimensions are estimates; this template asset is not a verified retail SKU.']
    : ['Dimensions may be sourced, but template geometry remains an approximation until product review.'];
  return { success: true, recipe, errors: [], warnings };
}

export const DEFAULT_GLASSES_RECIPE: GlassesRecipe = {
  schemaVersion: 1,
  templateId: 'round',
  templateVersion: 1,
  generatorVersion: '0.1.0',
  productId: 'demo-frame',
  name: 'Demo Round Frame',
  dimensionsMm: { lensWidth: 52, lensHeight: 38, bridgeWidth: 18, templeLength: 140, frameWidth: 146 },
  dimensionSources: { lensWidth: 'estimated', lensHeight: 'estimated', bridgeWidth: 'estimated', templeLength: 'estimated', frameWidth: 'estimated' },
  frameThicknessMm: 4,
  materialPreset: 'acetate',
  frameColor: '#26342D',
  lensTint: '#D9E8E4',
  templeStyle: 'curved',
};
