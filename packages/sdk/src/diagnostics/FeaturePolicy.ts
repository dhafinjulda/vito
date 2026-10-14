/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
/** Local capability inputs only. No camera-derived profiles or persistence. */
export function automaticHairEligible(semanticParts:number,cores:number,memoryGb?:number):boolean {
  return semanticParts>0&&Number.isFinite(cores)&&cores>=4&&(memoryGb===undefined||memoryGb>=4);
}
/** Actual image support, not inferred landmark Z. Foreshortened profile eyes
 * must not look like a large frontal face to the input-resolution governor. */
export function eyeSpanPixels(points:ReadonlyArray<{x:number;y:number}>|null,width:number,height:number):number|null {
  const a=points?.[33],b=points?.[263];
  if(!a||!b||![a.x,a.y,b.x,b.y,width,height].every(Number.isFinite)||width<=0||height<=0)return null;
  return Math.hypot((a.x-b.x)*width,(a.y-b.y)*height);
}

/** One-way per-session fallback, after DPR reduction has had a chance to help. */
export class RenderingBudget {
  private pressureAt:number|null=null;
  private cost=0;
  private last:number|null=null;
  reset():void {this.pressureAt=this.last=null;this.cost=0;}
  observe(costMs:number,now:number,pixelRatio:number):boolean {
    if(!Number.isFinite(costMs)||costMs<0||!Number.isFinite(now)||this.last!==null&&now<=this.last)return false;
    const gap=this.last===null?0:now-this.last;
    if(gap>500)this.pressureAt=null;
    this.cost+=(costMs-this.cost)*(this.last===null?1:1-Math.exp(-gap/500));this.last=now;
    if(this.cost<=12||pixelRatio>1){this.pressureAt=null;return false;}
    this.pressureAt??=now;return now-this.pressureAt>=3000;
  }
}
