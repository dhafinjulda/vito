/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
/** Optional, reversible quality policy. These are measured software budgets,
 * not a claim that smaller input improves model accuracy or device FPS. */
export class QualityGovernor {
  constructor(private readonly protectRecognition=false) {}
  private faceSupport:number|null=null;
  observeFaceSupport(pixels:number|null):void {
    this.faceSupport=pixels!==null&&Number.isFinite(pixels)&&pixels>0?pixels:null;
    if(this.protectRecognition&&(this.faceSupport===null||this.faceSupport<60)) {
      this.inputWidth=640;this.trackingPressureAt=null;
    }
  }
  private trackingCost=0;
  private renderCost=0;
  private trackingPressureAt:number|null=null;
  private renderPressureAt:number|null=null;
  private lastTrackingChange=-Infinity;
  private lastRenderChange=-Infinity;
  private lastTrackingAt:number|null=null;
  private lastRenderAt:number|null=null;
  inputWidth:480|640=640;
  pixelRatioCap:1|1.5=1.5;

  reset():void {
    this.inputWidth=640;this.pixelRatioCap=1.5;this.trackingCost=this.renderCost=0;
    this.trackingPressureAt=this.renderPressureAt=this.lastTrackingAt=this.lastRenderAt=null;
    this.lastTrackingChange=this.lastRenderChange=-Infinity;
    this.faceSupport=null;
  }
  observeTracking(costMs:number,now:number):void {
    if(this.protectRecognition&&(this.faceSupport===null||this.inputWidth===640&&this.faceSupport<80||this.faceSupport<60)){this.trackingPressureAt=null;return;}
    if(!Number.isFinite(costMs)||costMs<0||!Number.isFinite(now)||this.lastTrackingAt!==null&&now<=this.lastTrackingAt)return;
    if(this.lastTrackingAt!==null&&now-this.lastTrackingAt>500)this.trackingPressureAt=null;
    const alpha=this.lastTrackingAt===null?1:1-Math.exp(-(now-this.lastTrackingAt)/500);
    this.trackingCost+=(costMs-this.trackingCost)*alpha;this.lastTrackingAt=now;
    const change=this.inputWidth===640?this.trackingCost>28:this.trackingCost<16;
    if(!change){this.trackingPressureAt=null;return;}
    this.trackingPressureAt??=now;
    const dwell=this.inputWidth===640?2000:5000;
    if(now-this.trackingPressureAt>=dwell&&now-this.lastTrackingChange>=2000) {
      this.inputWidth=this.inputWidth===640?480:640;this.lastTrackingChange=now;this.trackingPressureAt=null;
    }
  }
  observeRender(costMs:number,now:number):void {
    if(!Number.isFinite(costMs)||costMs<0||!Number.isFinite(now)||this.lastRenderAt!==null&&now<=this.lastRenderAt)return;
    if(this.lastRenderAt!==null&&now-this.lastRenderAt>500)this.renderPressureAt=null;
    const alpha=this.lastRenderAt===null?1:1-Math.exp(-(now-this.lastRenderAt)/500);
    this.renderCost+=(costMs-this.renderCost)*alpha;this.lastRenderAt=now;
    const change=this.pixelRatioCap===1.5?this.renderCost>8:this.renderCost<4;
    if(!change){this.renderPressureAt=null;return;}
    this.renderPressureAt??=now;
    const dwell=this.pixelRatioCap===1.5?2000:5000;
    if(now-this.renderPressureAt>=dwell&&now-this.lastRenderChange>=2000) {
      this.pixelRatioCap=this.pixelRatioCap===1.5?1:1.5;this.lastRenderChange=now;this.renderPressureAt=null;
    }
  }
}
