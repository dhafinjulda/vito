/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
export { DEFAULT_GLASSES_RECIPE, getGlassesTemplate, listGlassesTemplates, validateGlassesRecipe } from './recipe';
export type { DimensionKey, DimensionSource, GlassesDimensionsMm, GlassesRecipe, GlassesTemplate, GlassesTemplateId, MaterialPreset, RecipeIssue, RecipeValidation, TempleStyle } from './recipe';
export { buildParametricGlasses, validateGeneratedGlasses, disposeGeneratedGlasses } from './geometry';
export type { GeneratedGlasses, GeneratedGlassesFit, GeneratedGlassesMetadata, GeneratedPhysicalFit, GeneratedGlassesValidation } from './geometry';
export { exportGlassesGlb, exportGeneratedGlassesGlb } from './export';
export { interpretGlassesDescription } from './description';
export type { DescriptionInterpretation, DescriptionRecipeField } from './description';
export { generateGlassesAsset, GlassesGenerationError } from './generate';
export type { GenerateGlassesAssetOptions, GlassesDescriptionInterpreter, GlassesGenerationReport, GeneratedGlassesManifest, GeneratedGlassesAssetFile, GeneratedGlassesAsset } from './generate';
