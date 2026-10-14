/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect} from 'vitest';
import {automaticHairEligible,eyeSpanPixels,RenderingBudget} from '../src/diagnostics/FeaturePolicy';

describe('default feature guards',()=>{
  it('measures actual image support and protects foreshortened profile landmarks despite inferred depth',()=>{
    const points=Array.from({length:468},()=>({x:.5,y:.5,z:0}));points[263]={x:.52,y:.5,z:.3};
    expect(eyeSpanPixels(points,640,360)).toBeCloseTo(12.8);expect(eyeSpanPixels(null,640,360)).toBeNull();expect(eyeSpanPixels(points,0,360)).toBeNull();
  });
  it('requires semantic assets and local capacity for automatic hair',()=>{
    expect(automaticHairEligible(4,8,8)).toBe(true);expect(automaticHairEligible(4,4)).toBe(true);
    expect(automaticHairEligible(0,8,8)).toBe(false);expect(automaticHairEligible(4,2,8)).toBe(false);
    expect(automaticHairEligible(4,8,2)).toBe(false);expect(automaticHairEligible(4,NaN)).toBe(false);
  });
  it('falls back only after sustained render pressure at reduced DPR and resets every session',()=>{
    const budget=new RenderingBudget();for(let t=0;t<5000;t+=100)expect(budget.observe(30,t,1.5)).toBe(false);
    for(let t=5000;t<8000;t+=100)expect(budget.observe(30,t,1)).toBe(false);
    expect(budget.observe(30,8000,1)).toBe(true);budget.reset();expect(budget.observe(30,9000,1)).toBe(false);
    for(let t=9100;t<=14000;t+=100)expect(budget.observe(1,t,1)).toBe(false);
  });
});
