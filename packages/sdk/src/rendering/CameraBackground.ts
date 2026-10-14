/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';

/** r176 VideoTexture owns an uncancellable rVFC loop. Use its renderer flags
 * with the SDK's existing decoded-frame clock, avoiding an extra callback that
 * retains disposed textures/video across repeated camera starts. */
class LocalVideoTexture extends THREE.Texture {
  readonly isVideoTexture=true;
  constructor(video:HTMLVideoElement){super(video);this.generateMipmaps=false;this.minFilter=this.magFilter=THREE.LinearFilter;}
  update():void { /* CameraBackground.update explicitly marks new decoded frames. */ }
}

/** One transient local video texture. No copies/recording/cache of camera pixels. */
export class CameraBackground {
  private texture:LocalVideoTexture|null=null;
  private dimensions='';
  private mediaTime=-Infinity;
  get ready():boolean {return this.texture!==null;}
  constructor(private readonly scene:THREE.Scene,private readonly video:HTMLVideoElement) {}
  update(width:number,height:number,mediaTime:number):boolean {
    const vw=this.video.videoWidth,vh=this.video.videoHeight;
    if(this.video.readyState<HTMLMediaElement.HAVE_CURRENT_DATA||!vw||!vh||!width||!height)return false;
    const dimensions=`${vw}/${vh}`;
    if(this.dimensions!==dimensions) {
      this.texture?.dispose();this.texture=new LocalVideoTexture(this.video);
      // Upload the current decoded frame on the first draw.
      this.texture.needsUpdate=true;
      this.texture.colorSpace=THREE.SRGBColorSpace;this.dimensions=dimensions;this.mediaTime=-Infinity;
      this.scene.background=this.texture;
    }
    const texture=this.texture!,scale=Math.max(width/vw,height/vh),rx=width/(vw*scale),ry=height/(vh*scale);
    const cropChanged=texture.repeat.x!==rx||texture.repeat.y!==ry;
    texture.repeat.set(rx,ry);texture.offset.set((1-rx)/2,(1-ry)/2);
    const changed=mediaTime!==this.mediaTime||cropChanged;
    if(mediaTime!==this.mediaTime)texture.needsUpdate=true;
    this.mediaTime=mediaTime;return changed;
  }
  dispose():void {this.scene.background=null;this.texture?.dispose();this.texture=null;this.dimensions='';this.mediaTime=-Infinity;}
}
