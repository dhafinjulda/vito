/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import type {RuntimePerformance, RuntimeTimingName, TimingDistribution} from '../types';

export type RuntimeRateName='capture'|'face'|'hand'|'render'|'animation'|'camera';
const timingNames:RuntimeTimingName[]=['captureDraw','bitmap','faceInference','handInference','hairInference','fit','renderSubmission','captureToSubmission','resultAge','renderInterval'];
const rateNames:RuntimeRateName[]=['capture','face','hand','render','animation','camera'];
const WINDOW_MS=5000;

/** Numeric runtime durations/counts only. No coordinates, images or poses. */
class NumericWindow {
  private readonly times:Float64Array;
  private readonly values:Float64Array;
  private cursor=0;
  private count=0;
  private lastTime=-Infinity;
  constructor(private readonly capacity:number){this.times=new Float64Array(capacity);this.values=new Float64Array(capacity);}
  record(value:number,time:number):void {
    if(!Number.isFinite(value)||value<0||!Number.isFinite(time)||time<this.lastTime)return;
    this.lastTime=time;this.times[this.cursor]=time;this.values[this.cursor]=value;
    this.cursor=(this.cursor+1)%this.capacity;this.count=Math.min(this.count+1,this.capacity);
  }
  current(now:number):number[] {
    const values:number[]=[];
    for(let i=0;i<this.count;i++) {
      const index=(this.cursor-1-i+this.capacity)%this.capacity;
      if(this.times[index]!>=now-WINDOW_MS&&this.times[index]!<=now)values.push(this.values[index]!);
    }
    return values;
  }
  reset():void {this.times.fill(0);this.values.fill(0);this.cursor=this.count=0;this.lastTime=-Infinity;}
}

/** Five-second bounded window. Quantile allocation occurs only on snapshots. */
export class RuntimeMetrics {
  private readonly timings=new Map<RuntimeTimingName,NumericWindow>();
  private readonly rates=new Map<RuntimeRateName,NumericWindow>();
  private startedAt=0;
  private lastRenderAt:number|null=null;
  private cameraObserved=false;
  constructor(private readonly enabled=true){
    if(enabled){for(const name of timingNames)this.timings.set(name,new NumericWindow(512));for(const name of rateNames)this.rates.set(name,new NumericWindow(2048));}
  }
  reset(now:number):void {
    this.startedAt=now;this.lastRenderAt=null;this.cameraObserved=false;
    for(const window of this.timings.values())window.reset();for(const window of this.rates.values())window.reset();
  }
  timing(name:RuntimeTimingName,duration:number,now:number):void {this.timings.get(name)?.record(duration,now);}
  event(name:RuntimeRateName,now:number,count=1):void {
    if(name==='camera')this.cameraObserved=true;
    this.rates.get(name)?.record(count,now);
    if(name==='render') {
      if(this.lastRenderAt!==null)this.timing('renderInterval',now-this.lastRenderAt,now);
      this.lastRenderAt=now;
    }
  }
  snapshot(now:number):RuntimePerformance|undefined {
    if(!this.enabled)return undefined;
    const observedMs=Math.max(0,Math.min(WINDOW_MS,now-this.startedAt));
    const rate=(name:RuntimeRateName)=>observedMs<250?null:this.rates.get(name)!.current(now).reduce((a,b)=>a+b,0)/(observedMs/1000);
    const timings={} as Record<RuntimeTimingName,TimingDistribution>;
    for(const name of timingNames) {
      const values=this.timings.get(name)!.current(now).sort((a,b)=>a-b),samples=values.length;
      const quantile=(q:number)=>samples?values[Math.max(0,Math.ceil(q*samples)-1)]!:null;
      timings[name]={samples,meanMs:samples?values.reduce((a,b)=>a+b,0)/samples:null,p50Ms:quantile(0.5),p95Ms:quantile(0.95)};
    }
    return {windowMs:WINDOW_MS,observedMs,rates:{captureHz:rate('capture'),faceHz:rate('face'),handHz:rate('hand'),renderHz:rate('render'),animationHz:rate('animation'),cameraHz:this.cameraObserved?rate('camera'):null},timings};
  }
}
