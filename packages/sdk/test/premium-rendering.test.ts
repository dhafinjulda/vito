/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {installLensOptics} from '../src/rendering/LensOptics';
import {HairMask} from '../src/rendering/HairMask';
import {CameraBackground} from '../src/rendering/CameraBackground';
import {fitFace,DEFAULT_FIT} from '../src/glasses/fitting';
import {syntheticFrame} from './synthetic-frame';

describe('optional premium materials',()=>{
  it('updates the hair rear boundary for a live reference change and clears its incompatible mask',()=>{
    const frame=syntheticFrame(),pose=fitFace(frame.landmarks,frame.matrix,{videoWidth:1280,videoHeight:720,width:640,height:360,fov:63},DEFAULT_FIT)!;
    const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);mesh.name='temple-left';root.add(mesh);
    const mask=new HairMask();mask.install(root);
    const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'} as THREE.WebGLProgramParametersWithUniforms;material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
    const data=new Uint8Array([255]);mask.set(data,1,1,100,pose);mask.update(150,pose,true,1280,720,640,360,new THREE.Vector2(640,360));
    expect(shader.uniforms.uVtoHairEnabled!.value).toBe(1);const version=material.version;
    mask.setReferenceEyeSpan(2.9);
    expect(shader.uniforms.uVtoHairRearZ!.value).toBeCloseTo(-.2);expect(shader.uniforms.uVtoHairEnabled!.value).toBe(0);expect(data[0]).toBe(0);expect(material.version).toBe(version);
    expect(()=>mask.setReferenceEyeSpan(0)).toThrow('reference');expect(shader.uniforms.uVtoHairRearZ!.value).toBeCloseTo(-.2);
    mask.dispose();mesh.geometry.dispose();material.dispose();
  });
  it('uploads the first decoded camera frame and keeps cover crop and cleanup local',()=>{
    const callback=vi.fn(),scene=new THREE.Scene(),video={videoWidth:1280,videoHeight:720,readyState:2,requestVideoFrameCallback:callback} as unknown as HTMLVideoElement;
    // CameraBackground uses the browser constant, not a fake video's fields.
    const previous=globalThis.HTMLMediaElement;
    Object.assign(globalThis,{HTMLMediaElement:{HAVE_CURRENT_DATA:2}});
    try {
      const background=new CameraBackground(scene,video);
      expect(background.update(400,600,0)).toBe(true);
      expect(callback).not.toHaveBeenCalled(); // SDK owns the only capture callback.
      const texture=scene.background as THREE.VideoTexture;
      expect(texture.version).toBeGreaterThan(0);expect(texture.repeat.x).toBeCloseTo(.375);expect(texture.repeat.y).toBe(1);
      expect(background.update(400,600,0)).toBe(false);expect(background.update(400,600,.033)).toBe(true);
      background.dispose();expect(scene.background).toBeNull();
    }finally {Object.assign(globalThis,{HTMLMediaElement:previous});}
  });
  it('limits optics to semantic lenses and keeps thickness calibrated to world scale',()=>{
    const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({transparent:true,opacity:0.3});
    const lens=new THREE.Mesh(new THREE.BoxGeometry(),material),rim=new THREE.Mesh(new THREE.BoxGeometry(),material);lens.name='lens-left';rim.name='rim-left';root.add(lens,rim);
    const optics=installLensOptics(root,{thicknessMm:2});optics.setScale(5);
    expect(optics.materials).toHaveLength(1);expect(optics.materials[0]!.thickness).toBeCloseTo(0.04);expect(optics.materials[0]!.transmission).toBe(0.95);
    expect(rim.material).toBe(material);expect(()=>installLensOptics(root,{ior:3})).toThrow();
    optics.restore();expect(lens.material).toBe(material);expect(optics.materials).toHaveLength(0);optics.restore();
    lens.geometry.dispose();rim.geometry.dispose();material.dispose();for(const m of optics.materials)m.dispose();
  });
  it('expires hair masks and disables them on owner changes, large motion and malformed shape',()=>{
    const frame=syntheticFrame(),pose=fitFace(frame.landmarks,frame.matrix,{videoWidth:1280,videoHeight:720,width:640,height:360,fov:63},DEFAULT_FIT)!;
    const mask=new HairMask(),data=new Uint8Array(16).fill(255),size=new THREE.Vector2(640,360);
    expect(mask.set(data,4,4,100,pose)).toBe(true);
    expect(mask.update(150,pose,true,1280,720,640,360,size)).toBe(true);
    expect(mask.update(160,pose,false,1280,720,640,360,size)).toBe(true);
    mask.update(170,pose,true,1280,720,640,360,size);
    expect(mask.update(601,pose,true,1280,720,640,360,size)).toBe(true);
    expect(mask.set(new Uint8Array(2),4,4,700,pose)).toBe(false);
    mask.clear();expect([...data]).toEqual(Array(16).fill(0));mask.dispose();
  });
});
