/* Copyright (c) 2026 Dhafin Julda Riyanto. Subject to CPAL-1.0;
 * see LICENSE, NOTICE and THIRD_PARTY_NOTICES.md. */
import type {StartupPerformance} from '../types';

/** One session of local software durations; no images, poses or event history. */
export class StartupMetrics {
  private start:number|null=null;
  private cameraStart:number|null=null;
  private assetStart:number|null=null;
  private values:StartupPerformance=this.empty();
  constructor(private readonly enabled:boolean) {}
  private empty():StartupPerformance {return {cameraPendingMs:null,assetWaitMs:null,trackerReadyMs:null,firstFitSubmissionMs:null};}
  reset(now?:number):void {this.start=now??null;this.cameraStart=this.assetStart=null;this.values=this.empty();}
  cameraRequested(now:number):void {if(this.enabled)this.cameraStart=now;}
  cameraAcquired(now:number):void {if(this.enabled&&this.cameraStart!==null)this.values.cameraPendingMs=Math.max(0,now-this.cameraStart);}
  assetWaiting(now:number):void {if(this.enabled)this.assetStart=now;}
  assetReady(now:number):void {if(this.enabled&&this.assetStart!==null)this.values.assetWaitMs=Math.max(0,now-this.assetStart);}
  trackerReady(now:number):void {if(this.enabled&&this.start!==null&&this.values.trackerReadyMs===null)this.values.trackerReadyMs=Math.max(0,now-this.start);}
  fitSubmitted(now:number):void {if(this.enabled&&this.start!==null&&this.values.trackerReadyMs!==null&&this.values.firstFitSubmissionMs===null)this.values.firstFitSubmissionMs=Math.max(0,now-this.start);}
  snapshot():StartupPerformance|undefined {return this.enabled?{...this.values}:undefined;}
}
