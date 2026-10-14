/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect} from 'vitest';
import {SourceGeometry} from '../src/tracking/SourceGeometry';

describe('capture source geometry',()=>{
  it('retains source dimensions separately from normalized input',()=>{
    const source=new SourceGeometry();expect(source.observe(1280,720)).toBe(false);
    const capture=source.capture(640,360);
    expect(capture).toMatchObject({width:1280,height:720,inputWidth:640,inputHeight:360});
    expect(source.matches(capture)).toBe(true);expect(source.observe(1280,720)).toBe(false);
    expect(source.matches(capture)).toBe(true);
  });
  it('invalidates old captures even when a camera returns to its prior size',()=>{
    const source=new SourceGeometry();source.observe(1280,720);const capture=source.capture(640,360);
    expect(source.observe(720,1280)).toBe(true);expect(source.matches(capture)).toBe(false);
    expect(source.observe(1280,720)).toBe(true);expect(source.matches(capture)).toBe(false);
    expect(source.matches(source.capture(640,360))).toBe(true);
  });
  it('ignores metadata gaps and invalidates across stop/reset',()=>{
    const source=new SourceGeometry();source.observe(1280,720);const capture=source.capture(640,360);
    for(const [w,h] of [[0,0],[NaN,720],[1280,-1],[1280,720.5]])expect(source.observe(w!,h!)).toBe(false);
    expect(source.matches(capture)).toBe(true);source.reset();source.observe(1280,720);
    expect(source.matches(capture)).toBe(false);
  });
});
