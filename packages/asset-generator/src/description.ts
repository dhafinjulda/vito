/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { DEFAULT_GLASSES_RECIPE, validateGlassesRecipe } from './recipe';
import type { DimensionKey, GlassesRecipe, GlassesTemplateId, MaterialPreset, RecipeIssue } from './recipe';

export type DescriptionInterpretation =
  | { success: true; recipe: GlassesRecipe; assumptions: string[]; issues: []; specifiedFields: DescriptionRecipeField[] }
  | { success: false; assumptions: string[]; issues: RecipeIssue[] };

export type DescriptionRecipeField = Exclude<keyof GlassesRecipe, 'dimensionsMm' | 'dimensionSources'> | `dimensionsMm.${DimensionKey}`;

interface Span { start: number; end: number }
interface ColorMatch extends Span { value: string }

const colors: Record<string, string> = {
  black: '#171717', hitam: '#171717', white: '#F5F2EC', putih: '#F5F2EC',
  gold: '#C5A35E', golden: '#C5A35E', emas: '#C5A35E', silver: '#BFC5CC', perak: '#BFC5CC',
  brown: '#674438', coklat: '#674438', cokelat: '#674438', blue: '#315D91', biru: '#315D91',
  green: '#355C47', hijau: '#355C47', red: '#A53136', merah: '#A53136',
  pink: '#CE91A8', rose: '#CE91A8', merahmuda: '#CE91A8', purple: '#725184', ungu: '#725184',
  gray: '#6B7178', grey: '#6B7178', abu: '#6B7178', smoke: '#6B7178', smoky: '#6B7178',
  amber: '#B47936', kuning: '#D2B34A', yellow: '#D2B34A', orange: '#BD763D', oranye: '#BD763D',
  clear: '#EEF4F4', bening: '#EEF4F4', transparent: '#EEF4F4', transparan: '#EEF4F4',
};
const colorPattern = `#[\\da-f]{6}\\b|\\b(?:merah\\s+muda|abu[-\\s]+abu|${Object.keys(colors).join('|')})\\b`;
const numeric = '[+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)';
const units = '(mm|cm|inches|inch|in\\b|[\"″])?';
const dimensionLabels: Record<DimensionKey | 'frameThicknessMm', string> = {
  lensWidth: 'lens\\s*width|lenswidth|lebar\\s+lensa',
  lensHeight: 'lens\\s*height|lensheight|tinggi\\s+lensa',
  bridgeWidth: 'bridge(?:\\s+width)?|nose\\s+bridge|lebar\\s+(?:bridge|jembatan)|jembatan(?:\\s+hidung)?',
  templeLength: 'temple(?:\\s+length)?|arm\\s+length|panjang\\s+tangkai|tangkai',
  frameWidth: 'frame\\s*width|framewidth|overall\\s+width|total\\s+width|lebar\\s+(?:frame|bingkai|total)',
  frameThicknessMm: 'frame\\s+thickness|rim\\s+thickness|thickness|tebal(?:\\s+(?:frame|bingkai))?',
};

function withoutSpans(text: string, spans: Span[]): string {
  const characters = text.split('');
  for (const { start, end } of spans) for (let index = start; index < end; index++) characters[index] = ' ';
  return characters.join('');
}

function colorValue(token: string): string {
  if (token.startsWith('#')) return token.toUpperCase();
  return colors[token.replace(/[\s-]+/g, '') === 'abuabu' ? 'abu' : token.replace(/\s+/g, '')] ?? colors[token]!;
}

function choose<T>(values: T[], path: string, label: string, issues: RecipeIssue[]): T | undefined {
  const unique = Array.from(new Set(values));
  if (unique.length > 1) issues.push({ path, message: `Conflicting ${label}. Choose one value or remove the other description.` });
  return unique[0];
}

function productId(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return `generated-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Interpret supported Indonesian/English product descriptions entirely on-device.
 * Missing values use disclosed design defaults. Numbers in text are design targets,
 * never verified retail measurements or evidence of supplier provenance.
 */
export function interpretGlassesDescription(input: string): DescriptionInterpretation {
  const issues: RecipeIssue[] = [];
  const assumptions: string[] = [];
  if (typeof input !== 'string' || !input.trim() || input.length > 3000) {
    return { success: false, assumptions, issues: [{ path: 'description', message: 'Enter a product description from 1 to 3000 characters.' }] };
  }
  const text = input.trim().normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[–—−]/g, '-');
  const shapeDefinitions: Array<[GlassesTemplateId, RegExp]> = [
    ['cat-eye', /\b(?:cat[\s-]?eye|mata\s+kucing)\b/g],
    ['round', /\b(?:round|rounded|circular|bulat|bundar)\b/g],
    ['rectangle', /\b(?:rectangle|rectangular|square|kotak|persegi(?:\s+panjang)?)\b/g],
  ];
  const shapes = shapeDefinitions.flatMap(([id, pattern]) => Array.from(text.matchAll(pattern), () => id));
  const unsupportedShape = /\b(?:aviator|pilot|wayfarer|browline|rimless|half[-\s]?rim|semi[-\s]?rimless|oval|hexagon(?:al)?|octagon(?:al)?|triangle|triangular|heart[-\s]?shaped|sport|sports|wraparound|tanpa\s+bingkai|segi\s+(?:enam|delapan|tiga)|hati)\b/g;
  for (const match of text.matchAll(unsupportedShape)) issues.push({ path: 'templateId', message: `Shape “${match[0]}” is unsupported. Choose round/bulat, rectangle/kotak, or cat-eye/mata kucing.` });
  const templateId = choose(shapes, 'templateId', 'frame shapes', issues) ?? 'round';
  if (!shapes.length && !issues.some((issue) => issue.path === 'templateId')) assumptions.push('No supported shape was specified; the round template is used.');
  for (const match of text.matchAll(/\b(?:shape|bentuk)(?:\s+(?:frame|bingkai|kacamata))?\s*[:=]?\s+(mata\s+kucing|cat[\s-]?eye|persegi\s+panjang|[a-z-]+)/g)) {
    if (!shapeDefinitions.some(([, pattern]) => new RegExp(pattern.source).test(match[1]!))) issues.push({ path: 'templateId', message: `Shape “${match[1]}” is unsupported. Choose round/bulat, rectangle/kotak, or cat-eye/mata kucing.` });
  }

  const materialValues: MaterialPreset[] = [];
  if (/\b(?:acetate|asetat)\b/.test(text)) materialValues.push('acetate');
  if (/\b(?:metal|logam)\b/.test(text)) materialValues.push('metal');
  const unsupportedMaterial = /\b(?:wood(?:en)?|kayu|bamboo|bambu|plastic|plastik|resin|titanium|stainless|steel)\b/g;
  for (const match of text.matchAll(unsupportedMaterial)) issues.push({ path: 'materialPreset', message: `Material “${match[0]}” has no dedicated preset. Choose acetate/asetat or metal/logam.` });
  const materialPreset = choose(materialValues, 'materialPreset', 'materials', issues) ?? 'acetate';
  if (!materialValues.length && !issues.some((issue) => issue.path === 'materialPreset')) assumptions.push('Material was unspecified; the acetate appearance preset is used.');
  for (const match of text.matchAll(/\b(?:material|bahan)(?:\s+(?:frame|bingkai))?\s*[:=]?\s+([a-z-]+)/g)) {
    if (!/^(?:acetate|asetat|metal|logam)$/.test(match[1]!)) issues.push({ path: 'materialPreset', message: `Material “${match[1]}” is unsupported. Choose acetate/asetat or metal/logam.` });
  }

  const spans: Span[] = [];
  const requested: Partial<Record<DimensionKey | 'frameThicknessMm', number[]>> = {};
  const addNumber = (key: DimensionKey | 'frameThicknessMm', value: number) => { (requested[key] ??= []).push(value); };
  const codes = /\b(\d{2}(?:[.,]\d+)?)\s*(?:-|□)\s*(\d{2}(?:[.,]\d+)?)\s*-\s*(\d{2,3}(?:[.,]\d+)?)\b/g;
  for (const match of text.matchAll(codes)) {
    addNumber('lensWidth', Number(match[1]!.replace(',', '.')));
    addNumber('bridgeWidth', Number(match[2]!.replace(',', '.')));
    addNumber('templeLength', Number(match[3]!.replace(',', '.')));
    spans.push({ start: match.index!, end: match.index! + match[0].length });
    if (/[-+]\s*$/.test(text.slice(Math.max(0, match.index! - 3), match.index!))) issues.push({ path: 'dimensionsMm', message: 'Dimension codes must contain positive millimeter values, for example 52-18-140.' });
    const followingUnit = text.slice(match.index! + match[0].length).match(/^\s*(cm|inch(?:es)?|in\b)/);
    if (followingUnit) issues.push({ path: 'dimensionsMm', message: 'The lens-bridge-temple code uses millimeters. Use 52-18-140, or give individually labeled dimensions with units.' });
  }
  for (const [key, label] of Object.entries(dimensionLabels) as Array<[DimensionKey | 'frameThicknessMm', string]>) {
    const pattern = new RegExp(`\\b(?:${label})\\s*(?:[:=]\\s*)?(${numeric})(?![\\d.])\\s*${units}(?!\\w)`, 'g');
    for (const match of text.matchAll(pattern)) {
      let value = Number(match[1]!.replace(',', '.'));
      if (match[2] === 'cm') value *= 10;
      if (match[2] && !['cm', 'mm'].includes(match[2])) value *= 25.4;
      addNumber(key, value);
      spans.push({ start: match.index!, end: match.index! + match[0].length });
      const unknownUnit = !match[2] && text.slice(match.index! + match[0].length).match(/^\s*(m|met(?:er|re)s?|px|pixels?|pt|points?|ft|feet)\b/);
      if (unknownUnit) issues.push({ path: key === 'frameThicknessMm' ? key : `dimensionsMm.${key}`, message: `Unit “${unknownUnit[1]}” is unsupported. Use mm, cm, or inches for a physical product dimension.` });
    }
  }
  const remainingDimensions = withoutSpans(text, spans);
  for (const match of remainingDimensions.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:mm|cm|inch(?:es)?)\b/g)) {
    issues.push({ path: 'dimensionsMm', message: `Label dimension “${match[0]}”: lens width, lens height, bridge width, temple length, frame width, or frame thickness.` });
  }
  if (/\b\d{2}\s*-\s*\d{2}\b/.test(remainingDimensions)) issues.push({ path: 'dimensionsMm', message: 'Use all three parts of the lens-bridge-temple code, for example 52-18-140.' });
  if (/\b(?:pupillary|interpupillary|pd|diameter|diameter\s+lensa)\b/.test(text)) issues.push({ path: 'dimensionsMm', message: 'This generator accepts product dimensions, not wearer PD or lens diameter. Specify lens width and lens height instead.' });
  for (const match of remainingDimensions.matchAll(/\b(?:lens\s+(?:width|height)|bridge\s+width|temple\s+length|frame\s+width|(?:lebar|tinggi)\s+lensa|lebar\s+(?:frame|bingkai|jembatan)|panjang\s+tangkai)\b/g)) {
    issues.push({ path: 'dimensionsMm', message: `Give a numeric value after “${match[0]}”, for example ${match[0]} 52 mm.` });
  }
  const selected: Partial<Record<DimensionKey | 'frameThicknessMm', number>> = {};
  for (const [key, values] of Object.entries(requested) as Array<[DimensionKey | 'frameThicknessMm', number[]]>) {
    const unique = values.filter((value, index) => !values.slice(0, index).some((other) => Math.abs(value - other) < 1e-6));
    selected[key] = choose(unique, key === 'frameThicknessMm' ? key : `dimensionsMm.${key}`, `${key} dimensions`, issues);
  }
  const thicknessWords: number[] = [];
  if (/\b(?:thin|slim|tipis)\b/.test(remainingDimensions)) thicknessWords.push(materialPreset === 'metal' ? 1.5 : 2);
  if (/\b(?:thick|chunky|tebal)\b/.test(remainingDimensions)) thicknessWords.push(6);
  const wordThickness = choose(thicknessWords, 'frameThicknessMm', 'rim thickness descriptions', issues);
  const frameThicknessMm = selected.frameThicknessMm ?? wordThickness ?? (materialPreset === 'metal' ? 2 : 4);
  if (selected.frameThicknessMm === undefined) assumptions.push(`Rim thickness is a design ${wordThickness === undefined ? 'default' : 'estimate from the description'}: ${frameThicknessMm} mm.`);
  const dimensionsMm = {
    lensWidth: selected.lensWidth ?? DEFAULT_GLASSES_RECIPE.dimensionsMm.lensWidth,
    lensHeight: selected.lensHeight ?? DEFAULT_GLASSES_RECIPE.dimensionsMm.lensHeight,
    bridgeWidth: selected.bridgeWidth ?? DEFAULT_GLASSES_RECIPE.dimensionsMm.bridgeWidth,
    templeLength: selected.templeLength ?? DEFAULT_GLASSES_RECIPE.dimensionsMm.templeLength,
    frameWidth: 0,
  };
  dimensionsMm.frameWidth = selected.frameWidth ?? 2 * (dimensionsMm.lensWidth + frameThicknessMm) + dimensionsMm.bridgeWidth + 16;
  for (const key of ['lensWidth', 'lensHeight', 'bridgeWidth', 'templeLength'] as const) if (selected[key] === undefined) assumptions.push(`${key} is a design default: ${dimensionsMm[key]} mm.`);
  if (selected.frameWidth === undefined) assumptions.push(`Frame width is derived as ${dimensionsMm.frameWidth} mm with an estimated 8 mm endpiece on each side.`);
  if (Object.keys(requested).length) assumptions.push('Numbers in the description are design targets; no dimension is verified as measured or supplier-sourced.');

  const colorMatches: ColorMatch[] = Array.from(text.matchAll(new RegExp(colorPattern, 'g')), (match) => ({ value: colorValue(match[0]), start: match.index!, end: match.index! + match[0].length }));
  const lensColors: ColorMatch[] = [];
  const frameColors: ColorMatch[] = [];
  const ambiguousColors: ColorMatch[] = [];
  for (const match of colorMatches) {
    const before = text.slice(0, match.start);
    const after = text.slice(match.end);
    const segment = before.split(/[,;.!]/).at(-1) ?? '';
    const lastLensLabel = Array.from(segment.matchAll(/\b(?:lensa|lenses?|tint)\b/g)).at(-1)?.index ?? -1;
    const lastFrameLabel = Array.from(segment.matchAll(/\b(?:frame|bingkai|rim)\b/g)).at(-1)?.index ?? -1;
    const suffix = after.split(/[,;.!]/)[0] ?? '';
    const nextLabel = suffix.match(/\b(lensa|lenses?|tint|frame|bingkai|rim)\b/);
    const between = nextLabel ? suffix.slice(0, nextLabel.index) : '';
    const extraColors = Array.from(between.matchAll(new RegExp(colorPattern, 'g')));
    const rest = between.replace(new RegExp(colorPattern, 'g'), '').replace(/\b(?:tinted?|berwarna)\b/g, '')
      .replace(extraColors.length ? /\b(?:and|dan)\b/g : /$^/g, '').trim();
    const lensAfter = nextLabel !== null && /^(?:lensa|lenses?|tint)$/.test(nextLabel[1]!) && !rest;
    const frameAfter = nextLabel !== null && /^(?:frame|bingkai|rim)$/.test(nextLabel[1]!) && !rest.replace(/\b(?:acetate|metal|asetat|logam)\b/g, '').trim();
    if ((lastLensLabel > lastFrameLabel && lastLensLabel >= 0) || lensAfter) lensColors.push(match);
    else if ((lastFrameLabel > lastLensLabel && lastFrameLabel >= 0) || frameAfter) frameColors.push(match);
    else ambiguousColors.push(match);
  }
  const frameColor = choose([...frameColors, ...ambiguousColors].map(({ value }) => value), 'frameColor', 'frame colors', issues) ?? '#171717';
  const lensTint = choose(lensColors.map(({ value }) => value), 'lensTint', 'lens tints', issues) ?? '#EEF4F4';
  if ([...frameColors, ...ambiguousColors].some(({ start, end }) => /^(?:clear|bening|transparent|transparan)$/.test(text.slice(start, end)))) issues.push({ path: 'frameColor', message: 'Transparent frame materials need a custom asset. Use an opaque solid frame color; clear lenses are supported.' });
  if (!frameColors.length && !ambiguousColors.length) assumptions.push('Frame color was unspecified; black is used.');
  if (!lensColors.length) assumptions.push('Lens tint was unspecified; the clear appearance preset is used.');
  for (const match of text.matchAll(/\b(?:warna(?:\s+(?:frame|bingkai|lensa))?|(?:frame|lens)\s+colou?r|(?:lens\s+)?tint|lensa)(?:\s+(?:berwarna|warna))?\s*[:=]?\s+([a-z#][\w#-]*)/g)) {
    const token = match[1]!;
    if (!['merah', 'abu'].includes(token) && !new RegExp(`^(?:${colorPattern})$`).test(token)) issues.push({ path: /(?:lensa|lens|tint)/.test(match[0]) ? 'lensTint' : 'frameColor', message: `Color “${token}” is unsupported. Use a named solid color, a six-digit hex color, or “lensa bening”.` });
  }
  const textWithoutColors = withoutSpans(text, colorMatches);
  for (const match of textWithoutColors.matchAll(/#[\w]+/g)) issues.push({ path: 'frameColor', message: `Color “${match[0]}” is invalid. Use a six-digit hex color, for example #26342D.` });
  if (/\b(?:tint|lensa|lens(?:es)?)\b[^,;.!]*\d+\s*%/.test(text)) issues.push({ path: 'lensTint', message: 'Percentage tint/transmittance is not supported by this recipe. Use a lens color or “lensa bening”.' });
  if (/\b(?:tortoise(?:shell)?|havana|gradient|gradien|pattern|motif|translucent|tembus\s+pandang)\b/.test(text)) issues.push({ path: 'frameColor', message: 'Patterns, gradients, and translucent frame materials need a custom asset. Use one solid frame color for this generator.' });
  if (/\b(?:not|bukan|jangan)\s+(?:round|bulat|rectangle|kotak|cat[\s-]?eye|acetate|asetat|metal|logam)\b/.test(text)) issues.push({ path: 'description', message: 'Specify the desired shape and material directly; negative alternatives are ambiguous.' });

  const templeValues: GlassesRecipe['templeStyle'][] = [];
  if (/\b(?:straight|lurus)\b/.test(text)) templeValues.push('straight');
  if (/\b(?:curved|bent|melengkung|lengkung|bengkok)\b/.test(text)) templeValues.push('curved');
  const templeStyle = choose(templeValues, 'templeStyle', 'temple shapes', issues) ?? 'curved';
  if (!templeValues.length) assumptions.push('Temple shape was unspecified; the curved template is used.');

  const recipe: GlassesRecipe = {
    schemaVersion: 1, templateVersion: 1, generatorVersion: '0.1.0',
    templateId, productId: productId(text), name: `${{ round: 'Round', rectangle: 'Rectangle', 'cat-eye': 'Cat-eye' }[templateId]} ${materialPreset === 'metal' ? 'Metal' : 'Acetate'} Frame`,
    dimensionsMm, dimensionSources: { lensWidth: 'estimated', lensHeight: 'estimated', bridgeWidth: 'estimated', templeLength: 'estimated', frameWidth: 'estimated' },
    frameThicknessMm, materialPreset, frameColor, lensTint, templeStyle,
  };
  const validation = validateGlassesRecipe(recipe);
  if (!validation.success) issues.push(...validation.errors);
  if (issues.length || !validation.success) return { success: false, assumptions, issues };
  const specifiedFields: DescriptionRecipeField[] = [];
  if (shapes.length) specifiedFields.push('templateId');
  if (materialValues.length) specifiedFields.push('materialPreset');
  for (const key of Object.keys(selected) as Array<DimensionKey | 'frameThicknessMm'>) specifiedFields.push(key === 'frameThicknessMm' ? key : `dimensionsMm.${key}`);
  if (wordThickness !== undefined && !specifiedFields.includes('frameThicknessMm')) specifiedFields.push('frameThicknessMm');
  if (frameColors.length || ambiguousColors.length) specifiedFields.push('frameColor');
  if (lensColors.length) specifiedFields.push('lensTint');
  if (templeValues.length) specifiedFields.push('templeStyle');
  return { success: true, recipe: validation.recipe, assumptions, issues: [], specifiedFields };
}
