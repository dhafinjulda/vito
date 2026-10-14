/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
/** Tracks decoded media progression, never pixel/face contents. Receipt of a
 * worker packet alone cannot make a frozen camera frame fresh again. */
export class FrameClock {
  private media:number|null=null;
  private observedAt:number|null=null;
  private submitted:number|null=null;
  reset():void {this.media=this.observedAt=this.submitted=null;}
  observe(mediaTime:number,now:number):boolean {
    if(!Number.isFinite(mediaTime)||mediaTime<0||!Number.isFinite(now))return false;
    if(this.media===null||mediaTime!==this.media) {
      if(this.media!==null&&mediaTime<this.media)this.submitted=null;
      this.media=mediaTime;this.observedAt=now;return true;
    }
    return false;
  }
  canSubmit(mediaTime:number):boolean {return Number.isFinite(mediaTime)&&mediaTime>=0&&mediaTime!==this.submitted;}
  markSubmitted(mediaTime:number):void {this.submitted=mediaTime;}
  stalled(now:number,budgetMs=750):boolean {return this.observedAt!==null&&now-this.observedAt>budgetMs;}
}
