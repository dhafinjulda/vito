/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect} from 'vitest';
import {QualityGovernor} from '../src/diagnostics/QualityGovernor';

describe('opt-in quality hysteresis',()=>{
  it('protects unknown/small faces and immediately restores recognition input on face loss',()=>{
    const policy=new QualityGovernor(true);
    for(let t=0;t<=3000;t+=100)policy.observeTracking(100,t);
    expect(policy.inputWidth).toBe(640);
    policy.observeFaceSupport(100);for(let t=3100;t<=5500;t+=100)policy.observeTracking(100,t);
    expect(policy.inputWidth).toBe(480);
    policy.observeFaceSupport(50);expect(policy.inputWidth).toBe(640);
    policy.observeFaceSupport(100);for(let t=5600;t<=9000;t+=100)policy.observeTracking(100,t);
    expect(policy.inputWidth).toBe(480);policy.observeFaceSupport(null);expect(policy.inputWidth).toBe(640);
  });
  it('requires sustained pressure and restores quality after a stable lower load',()=>{
    const policy=new QualityGovernor();
    for(let t=0;t<2000;t+=100)policy.observeTracking(40,t);
    expect(policy.inputWidth).toBe(640);policy.observeTracking(40,2000);expect(policy.inputWidth).toBe(480);
    for(let t=2100;t<7000;t+=100)policy.observeTracking(5,t);
    expect(policy.inputWidth).toBe(480);
    for(let t=7000;t<=9000;t+=100)policy.observeTracking(5,t);
    expect(policy.inputWidth).toBe(640);
  });
  it('does not lower quality on one slow sample or oscillate at a threshold',()=>{
    const policy=new QualityGovernor();policy.observeTracking(150,0);
    for(let t=100;t<=4000;t+=100)policy.observeTracking(5,t);
    expect(policy.inputWidth).toBe(640);
    for(let t=4100;t<=9000;t+=100)policy.observeTracking(t%200?29:27,t);
    expect(policy.inputWidth).toBe(640);
  });
  it('treats render pressure independently, ignores invalid clocks and clears session state',()=>{
    const policy=new QualityGovernor();
    for(let t=0;t<=2000;t+=100)policy.observeRender(12,t);
    expect(policy.pixelRatioCap).toBe(1);expect(policy.inputWidth).toBe(640);
    policy.observeRender(NaN,2100);policy.observeTracking(Infinity,2100);policy.observeRender(0,1000);
    expect(policy.pixelRatioCap).toBe(1);
    policy.reset();expect(policy.pixelRatioCap).toBe(1.5);expect(policy.inputWidth).toBe(640);
  });
});
