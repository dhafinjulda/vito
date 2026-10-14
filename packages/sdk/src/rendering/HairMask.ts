/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import {isTempleMeshName} from './TempleEffects';
import type {FacePose} from '../glasses/fitting';

/** Confidence mask only for semantic rear parts. Not hair depth/ear detection. */
export class HairMask {
  private readonly texture=new THREE.DataTexture(new Uint8Array(1),1,1,THREE.RedFormat);
  private readonly enabled={value:0};
  private readonly size={value:new THREE.Vector2(1,1)};
  private readonly crop={value:new THREE.Vector2(1,1)};
  private readonly headPosition=new THREE.Vector3();
  private readonly headRotation=new THREE.Quaternion();
  private timestamp=-Infinity;
  private readonly rearZ={value:-0.1};
  private bindings:Array<{material:THREE.Material;compile:THREE.Material['onBeforeCompile'];key:THREE.Material['customProgramCacheKey'];transparent:boolean;depthWrite:boolean}>=[];
  meshCount=0;
  constructor(){this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;this.texture.needsUpdate=true;}
  install(root:THREE.Object3D,referenceEyeSpan=1.45):void {
    this.uninstall();this.setReferenceEyeSpan(referenceEyeSpan);
    this.meshCount=0;
    root.traverse(node=>{
      if(!(node instanceof THREE.Mesh)||!isTempleMeshName(node.name))return;
      const materials=Array.isArray(node.material)?node.material:[node.material];
      for(const material of materials) {
        const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
        if(this.bindings.some(entry=>entry.material===material))continue;
        this.bindings.push({material,compile,key:material.customProgramCacheKey,transparent:material.transparent,depthWrite:material.depthWrite});
        material.onBeforeCompile=(shader:Parameters<THREE.Material['onBeforeCompile']>[0],renderer:THREE.WebGLRenderer)=>{
          compile.call(material,shader,renderer);
          shader.uniforms.uVtoHair={value:this.texture};shader.uniforms.uVtoHairEnabled=this.enabled;shader.uniforms.uVtoHairSize=this.size;shader.uniforms.uVtoHairCrop=this.crop;
          shader.uniforms.uVtoHairRearZ=this.rearZ;
          shader.vertexShader=`varying float vVtoHairZ;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\n vVtoHairZ=position.z;');
          shader.fragmentShader=`uniform sampler2D uVtoHair;uniform float uVtoHairEnabled;uniform float uVtoHairRearZ;uniform vec2 uVtoHairSize;uniform vec2 uVtoHairCrop;varying float vVtoHairZ;\n${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>
            vec2 hairUv=(gl_FragCoord.xy/uVtoHairSize-0.5)*uVtoHairCrop+0.5;
            hairUv.y=1.0-hairUv.y;
            float hairConfidence=texture2D(uVtoHair,hairUv).r;
            diffuseColor.a*=1.0-uVtoHairEnabled*smoothstep(0.55,0.85,hairConfidence)*step(vVtoHairZ,uVtoHairRearZ);`);
        };
        material.customProgramCacheKey=()=>`${key}|vto-hair-r1`;material.transparent=true;material.depthWrite=false;material.needsUpdate=true;
      }
      this.meshCount++;
    });
  }
  setReferenceEyeSpan(referenceEyeSpan:number):void {
    if(!Number.isFinite(referenceEyeSpan)||referenceEyeSpan<=0)throw new Error('Hair reference eye span must be positive and finite.');
    const value=-referenceEyeSpan*(0.1/1.45);
    if(value===this.rearZ.value)return;
    this.rearZ.value=value;this.clear();
  }
  uninstall():void {
    this.clear();for(const entry of this.bindings){entry.material.onBeforeCompile=entry.compile;entry.material.customProgramCacheKey=entry.key;entry.material.transparent=entry.transparent;entry.material.depthWrite=entry.depthWrite;entry.material.needsUpdate=true;}
    this.bindings.length=0;this.meshCount=0;
  }
  set(data:Uint8Array,width:number,height:number,timestamp:number,pose:FacePose|null):boolean {
    if(!pose||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width*height!==data.length||data.length>1048576||!Number.isFinite(timestamp))return false;
    const previous=this.texture.image.data as Uint8Array;
    if(previous.length===data.length&&timestamp>this.timestamp&&timestamp-this.timestamp<=500&&pose.headPosition.distanceTo(this.headPosition)<pose.worldEyeSpan*.03&&pose.headRotation.angleTo(this.headRotation)<5*Math.PI/180) {
      for(let i=0;i<data.length;i++)data[i]=Math.round(data[i]!*0.65+previous[i]!*0.35);
    }
    (this.texture.image.data as Uint8Array).fill(0);
    if(this.texture.image.width!==width||this.texture.image.height!==height)this.texture.dispose();
    this.texture.image={data,width,height};this.texture.needsUpdate=true;
    this.timestamp=timestamp;this.headPosition.copy(pose.headPosition);this.headRotation.copy(pose.headRotation);return true;
  }
  update(now:number,pose:FacePose|null,active:boolean,videoWidth:number,videoHeight:number,width:number,height:number,drawingSize:THREE.Vector2):boolean {
    const scale=Math.max(width/videoWidth,height/videoHeight);
    this.size.value.copy(drawingSize);this.crop.value.set(width/(videoWidth*scale),height/(videoHeight*scale));
    const valid=active&&pose&&now-this.timestamp>=0&&now-this.timestamp<=500&&pose.headPosition.distanceTo(this.headPosition)<pose.worldEyeSpan*0.03&&pose.headRotation.angleTo(this.headRotation)<5*Math.PI/180;
    const next=valid?1:0,changed=this.enabled.value!==next;this.enabled.value=next;return changed;
  }
  clear():void {this.enabled.value=0;this.timestamp=-Infinity;(this.texture.image.data as Uint8Array).fill(0);this.texture.needsUpdate=true;this.headPosition.set(0,0,0);this.headRotation.identity();}
  dispose():void {this.uninstall();this.texture.dispose();}
}
