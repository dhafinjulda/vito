/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect} from 'vitest';
import {FrameClock} from '../src/tracking/FrameClock';
describe('decoded frame freshness',()=>{
  it('suppresses duplicates while preserving initial zero and advancing video',()=>{
    const clock=new FrameClock();expect(clock.observe(0,0)).toBe(true);
    expect(clock.canSubmit(0)).toBe(true);clock.markSubmitted(0);expect(clock.canSubmit(0)).toBe(false);
    expect(clock.observe(0,500)).toBe(false);expect(clock.stalled(751)).toBe(true);
    clock.observe(0.033,800);expect(clock.stalled(800)).toBe(false);expect(clock.canSubmit(0.033)).toBe(true);
  });
  it('reacquires reversed media clocks and clears sessions without images/poses',()=>{
    const clock=new FrameClock();clock.observe(1,100);clock.markSubmitted(1);
    clock.observe(0,200);expect(clock.canSubmit(0)).toBe(true);
    expect(clock.observe(NaN,300)).toBe(false);expect(clock.canSubmit(Infinity)).toBe(false);
    clock.reset();expect(clock.stalled(10000)).toBe(false);expect(clock.canSubmit(0)).toBe(true);
  });
});
