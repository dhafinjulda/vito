/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect} from 'vitest';
import {RuntimeMetrics} from '../src/diagnostics/RuntimeMetrics';

describe('bounded local runtime timing aggregates',()=>{
  it('computes nearest-rank p50/p95 and distinct rates',()=>{
    const metrics=new RuntimeMetrics();metrics.reset(0);
    for(let i=1;i<=20;i++){metrics.timing('faceInference',i,i*50);metrics.event('face',i*50);}
    for(let i=1;i<=10;i++)metrics.event('render',i*100);
    const result=metrics.snapshot(1000)!;
    expect(result.timings.faceInference).toEqual({samples:20,meanMs:10.5,p50Ms:10,p95Ms:19});
    expect(result.rates).toMatchObject({faceHz:20,renderHz:10,cameraHz:null,handHz:0});
    expect(result.timings.renderInterval.p95Ms).toBe(100);
  });
  it('expires old durations and clears temporal state on reset',()=>{
    const metrics=new RuntimeMetrics();metrics.reset(0);metrics.timing('fit',5,1000);metrics.event('camera',1000,3);
    expect(metrics.snapshot(1000)!.rates.cameraHz).toBe(3);
    expect(metrics.snapshot(7000)!.timings.fit.samples).toBe(0);
    metrics.reset(7000);
    expect(metrics.snapshot(7000)!.rates.cameraHz).toBeNull();
    expect(metrics.snapshot(8000)!.timings.fit.p95Ms).toBeNull();
  });
  it('ignores nonfinite/negative values and bounds retained samples',()=>{
    const metrics=new RuntimeMetrics();metrics.reset(0);
    metrics.timing('bitmap',NaN,100);metrics.timing('bitmap',-1,100);metrics.timing('bitmap',1,Infinity);
    expect(metrics.snapshot(100)!.timings.bitmap.samples).toBe(0);
    for(let i=0;i<10000;i++)metrics.timing('bitmap',i,1000);
    expect(metrics.snapshot(1000)!.timings.bitmap.samples).toBe(512);
    expect(metrics.snapshot(1000)!.timings.bitmap.p95Ms).toBeLessThan(10000);
    expect(JSON.stringify(metrics.snapshot(1000))).not.toMatch(/landmarks|pose|image|timestamp/);
  });
  it('does not allocate or expose timing windows when diagnostics are not subscribed',()=>{
    const metrics=new RuntimeMetrics(false);metrics.reset(0);metrics.event('face',100);metrics.timing('fit',5,100);
    expect(metrics.snapshot(1000)).toBeUndefined();
  });
});
