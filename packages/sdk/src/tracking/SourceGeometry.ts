/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
/** Bounded capture metadata only; no pixels or derived camera data. A revision
 * also detects resize-and-return while an asynchronous capture is in flight. */
export interface CaptureGeometry {
  readonly width:number;
  readonly height:number;
  readonly revision:number;
  readonly inputWidth:number;
  readonly inputHeight:number;
}

export class SourceGeometry {
  private width=0;
  private height=0;
  private revision=0;

  reset():void {this.width=this.height=0;this.revision++;}

  observe(width:number,height:number):boolean {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)return false;
    if(width===this.width&&height===this.height)return false;
    const changed=this.width>0&&this.height>0;
    this.width=width;this.height=height;this.revision++;
    return changed;
  }

  capture(inputWidth:number,inputHeight:number):CaptureGeometry {
    return {width:this.width,height:this.height,revision:this.revision,inputWidth,inputHeight};
  }

  matches(capture:CaptureGeometry):boolean {
    return capture.width>0&&capture.height>0&&capture.revision===this.revision&&capture.width===this.width&&capture.height===this.height;
  }
}
