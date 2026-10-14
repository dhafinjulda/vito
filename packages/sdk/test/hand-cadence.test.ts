/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect} from 'vitest';
import {HandCadence} from '../src/tracking/HandCadence';
describe('face-first optional hand budgets',()=>{
  it('counts sustained native occupancy even when calls take more than one second',()=>{
    const cadence=new HandCadence();
    for(let i=0;i<7;i++)expect(cadence.observe(1200,i*1400)).toBe(false);
    expect(cadence.observe(1200,9800)).toBe(true);
  });
  it('reduces absent-hand work and restores responsive active cadence',()=>{
    const cadence=new HandCadence();cadence.observe(10,0);
    expect(cadence.intervalMs).toBe(100);cadence.setActive(true);expect(cadence.intervalMs).toBe(50);
  });
  it('bounds slow inference cadence, preserves active tracking and recovers after sustained lower cost',()=>{
    const cadence=new HandCadence();cadence.setActive(true);cadence.observe(180,0);expect(cadence.intervalMs).toBe(250);
    cadence.observe(10,100);expect(cadence.intervalMs).toBe(250);
    for(let t=200;t<=4000;t+=100)cadence.observe(10,t);
    expect(cadence.intervalMs).toBe(50);
    cadence.observe(Infinity,4100);cadence.observe(200,3000);expect(cadence.intervalMs).toBe(50);
  });
  it('requires both consecutive high-cost samples and sustained pressure at the bounded cadence',()=>{
    const cadence=new HandCadence();cadence.setActive(true);
    for(let t=0;t<3000;t+=250)expect(cadence.observe(150,t)).toBe(false);
    expect(cadence.intervalMs).toBe(250);expect(cadence.observe(150,3000)).toBe(true);
    expect(cadence.budgetExceeded).toBe(true);
    // Unavailability is sticky for this camera session; a new instance resets.
    expect(cadence.observe(10,3250)).toBe(true);expect(new HandCadence().budgetExceeded).toBe(false);
    const sparse=new HandCadence();
    for(let t=0;t<=3000;t+=1000)expect(sparse.observe(150,t)).toBe(false);
  });
  it('does not mistake isolated spikes or recovered latency for sustained overload',()=>{
    const cadence=new HandCadence();
    for(let t=0;t<=6000;t+=250)expect(cadence.observe(t%2000===0?500:10,t)).toBe(false);
    const recovering=new HandCadence();
    for(let t=0;t<3000;t+=250)expect(recovering.observe(150,t)).toBe(false);
    expect(recovering.observe(10,3000)).toBe(false);
    for(let t=3250;t<6250;t+=250)expect(recovering.observe(150,t)).toBe(false);
    expect(recovering.budgetExceeded).toBe(false);
  });
  it('clears pressure across a capture pause and ignores duplicate/reversed/invalid clocks',()=>{
    const cadence=new HandCadence();
    for(let t=0;t<=2000;t+=250)expect(cadence.observe(150,t)).toBe(false);
    expect(cadence.observe(500,2000)).toBe(false);expect(cadence.observe(500,1999)).toBe(false);
    expect(cadence.observe(500,NaN)).toBe(false);expect(cadence.observe(-1,2250)).toBe(false);
    expect(cadence.observe(150,4000)).toBe(false);
    for(let t=4250;t<7000;t+=250)expect(cadence.observe(150,t)).toBe(false);
    expect(cadence.observe(150,7000)).toBe(true);
  });
  it('keeps the safety fallback when quality adaptation is explicitly disabled',()=>{
    const cadence=new HandCadence(false);cadence.setActive(true);
    for(let t=0;t<3000;t+=250)expect(cadence.observe(150,t)).toBe(false);
    expect(cadence.intervalMs).toBe(50);expect(cadence.observe(150,3000)).toBe(true);
  });
});
