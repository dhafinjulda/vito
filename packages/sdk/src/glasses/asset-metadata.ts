/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import type {GlassesAsset,GlassesFit} from '../types';
import {physicalAssetScale} from './calibration';
import {resolveFit} from './fitting';

export interface EmbeddedGlassesMetadata {
  fit:GlassesFit;
  physicalFit:NonNullable<GlassesAsset['physicalFit']>;
}

const invalid=()=>new Error('Invalid embedded glasses SDK contract. Expected version 1, meters, nose-bridge pivot, and bounded fit/physicalFit metadata.');
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const own=(value:Record<string,unknown>,key:string)=>Object.prototype.hasOwnProperty.call(value,key);
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const triplet=(value:unknown,limit:number):value is [number,number,number]=>Array.isArray(value)&&value.length===3&&value.every(item=>finite(item)&&Math.abs(item)<=limit);

/** Reads only the generated SDK contract. Ordinary GLBs retain legacy fitting.
 * A declared contract must be valid even when a caller overrides its fit: units
 * and pivot affect the geometry itself. Extra asset metadata is never executed
 * or used to load URLs, and only copied, validated scalar fitting data escapes.
 */
export function readEmbeddedGlassesMetadata(userData:unknown):EmbeddedGlassesMetadata|null {
  if(!record(userData)||!own(userData,'vtoGlasses'))return null;
  const glasses=userData.vtoGlasses;
  if(!record(glasses)||!own(glasses,'sdk'))return null;
  const sdk=glasses.sdk;
  if(!record(sdk)||sdk.version!==1||sdk.units!=='meters'||sdk.pivot!=='nose-bridge'||!record(sdk.fit)||!record(sdk.physicalFit))throw invalid();
  const fit=sdk.fit,physical=sdk.physicalFit;
  // Version 1 describes human eyewear in metres, not an arbitrary scene scale.
  if(!finite(fit.referenceEyeSpan)||fit.referenceEyeSpan<.02||fit.referenceEyeSpan>.2||!finite(fit.scale)||!triplet(fit.offset,.25)||!triplet(fit.rotation,Math.PI*2))throw invalid();
  if(!finite(physical.frontWidthMm)||!finite(physical.modelFrontWidth)||physical.modelFrontWidth<.04||physical.modelFrontWidth>.25||!['supplier','measured','approximation'].includes(physical.source as string))throw invalid();
  const physicalFit={frontWidthMm:physical.frontWidthMm,modelFrontWidth:physical.modelFrontWidth,source:physical.source as EmbeddedGlassesMetadata['physicalFit']['source']};
  try {
    const resolved=resolveFit({referenceEyeSpan:fit.referenceEyeSpan,scale:fit.scale,offset:fit.offset,rotation:fit.rotation});
    physicalAssetScale(physicalFit);
    return {fit:resolved,physicalFit};
  } catch {throw invalid();}
}
