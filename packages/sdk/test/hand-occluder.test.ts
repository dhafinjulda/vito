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
import {HandOccluder} from '../src/rendering/HandOccluder';
import {GlassesRenderer,type HandOcclusionSample} from '../src/rendering/GlassesRenderer';
import type {TrackedHand,HeldPose} from '../src/interaction/HandGrip';
import type {Projection} from '../src/glasses/fitting';

const projection:Projection={videoWidth:640,videoHeight:480,width:640,height:480,fov:63};
// Generated coordinates exercise depth geometry, not recorded camera landmarks.
function hand(offset=0):TrackedHand {
  return {handedness:offset?'Right':'Left',landmarks:Array.from({length:21},(_,i)=>({x:.4+offset+(i%4)*.025,y:.7-Math.floor(i/4)*.025,z:(i%5)*-.006}))};
}
function geometry(occluder:HandOccluder) {
  const [joints,bones,palm]=occluder.children as [THREE.InstancedMesh,THREE.InstancedMesh,THREE.Mesh];
  return {joints,bones,palm};
}
function at(occluder:HandOccluder,index:number) {
  const matrix=new THREE.Matrix4();geometry(occluder).joints.getMatrixAt(index,matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
}
function cleared(occluder:HandOccluder) {
  const {joints,bones,palm}=geometry(occluder);
  expect(occluder.visible).toBe(false);
  for(const values of [joints.instanceMatrix.array,bones.instanceMatrix.array,palm.geometry.getAttribute('position').array])expect(Array.from(values).every(value=>value===0)).toBe(true);
}
function create() {const material=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true}),occluder=new HandOccluder(material);return {material,occluder};}

describe('two-hand approximate depth geometry',()=>{
  it('owns bounded geometry for all 21 joints and all 5 finger chains',()=>{
    const {material,occluder}=create(),{joints,bones,palm}=geometry(occluder);
    expect(joints.count).toBe(21);expect(bones.count).toBe(20);expect(palm.geometry.getAttribute('position').count).toBe(5);
    occluder.update(hand(),40,projection);expect(occluder.visible).toBe(true);
    for(const mesh of occluder.children)expect(mesh.frustumCulled).toBe(false);
    expect(joints.material).toBe(material);expect(material.colorWrite).toBe(false);
    occluder.dispose();material.dispose();
  });
  it('anchors depth to the selected finger contact instead of always the index pinch',()=>{
    const {material,occluder}=create(),sample=hand();sample.landmarks[12]!.z=-.06;
    occluder.update(sample,40,projection,sample.landmarks[12]!.z);
    expect(at(occluder,12).z).toBeCloseTo(-40);
    occluder.update(sample,40,projection);
    expect(at(occluder,12).z).not.toBeCloseTo(-40);
    occluder.dispose();material.dispose();
  });
  it('supports asymmetric calibrated projection and portrait cover without non-finite matrices',()=>{
    const {material,occluder}=create(),sample=hand();
    const p={...projection,width:320,height:640,intrinsics:{imageWidth:640,imageHeight:480,fx:600,fy:710,cx:300,cy:230}};
    occluder.update(sample,40,p,sample.landmarks[8]!.z);
    expect(at(occluder,8).x).toBeCloseTo((sample.landmarks[8]!.x*640-300)*40/600);
    expect(at(occluder,20).z).toBeCloseTo(-(40+(sample.landmarks[20]!.z-sample.landmarks[8]!.z)*640*40/600));
    expect(Array.from(geometry(occluder).bones.instanceMatrix.array).every(Number.isFinite)).toBe(true);
    occluder.dispose();material.dispose();
  });
  it.each(['landmark','shape','sparse','overflow','depth','anchor','dimensions','fov','intrinsics'] as const)('clears a malformed %s sample without retaining old matrices',kind=>{
    const {material,occluder}=create(),sample=hand();let depth=40,anchor:number|undefined,p={...projection};
    occluder.update(sample,depth,p);expect(occluder.visible).toBe(true);
    if(kind==='landmark')sample.landmarks[20]!.z=NaN;
    if(kind==='shape')sample.landmarks.pop();
    if(kind==='sparse')delete sample.landmarks[8];
    if(kind==='overflow')sample.landmarks[20]!.x=1e300;
    if(kind==='depth')depth=Infinity;
    if(kind==='anchor')anchor=NaN;
    if(kind==='dimensions')p.videoHeight=0;
    if(kind==='fov')p.fov=180;
    if(kind==='intrinsics')p.intrinsics={imageWidth:640,imageHeight:480,fx:0,fy:700,cx:320,cy:240};
    occluder.update(sample,depth,p,anchor);cleared(occluder);
    occluder.dispose();material.dispose();
  });
  it('reuses owned geometry and writes finite matrices for coincident joints',()=>{
    const {material,occluder}=create(),before=occluder.children.map(mesh=>(mesh as THREE.Mesh).geometry),sample=hand();sample.landmarks[8]={...sample.landmarks[7]!};
    for(let i=0;i<100;i++)occluder.update(sample,40,projection);
    expect(occluder.children.map(mesh=>(mesh as THREE.Mesh).geometry)).toEqual(before);
    for(const {instanceMatrix} of [geometry(occluder).joints,geometry(occluder).bones])expect(Array.from(instanceMatrix.array).every(Number.isFinite)).toBe(true);
    occluder.dispose();material.dispose();
  });
  it('clears and disposes each owned geometry once while leaving the shared material to its owner',()=>{
    const {material,occluder}=create(),materialDisposed=vi.fn();material.addEventListener('dispose',materialDisposed);
    const disposed=occluder.children.map(mesh=>{const listener=vi.fn();(mesh as THREE.Mesh).geometry.addEventListener('dispose',listener);return listener;});
    occluder.update(hand(),40,projection);occluder.dispose();occluder.dispose();occluder.update(hand(),40,projection);
    cleared(occluder);for(const listener of disposed)expect(listener).toHaveBeenCalledTimes(1);expect(materialDisposed).not.toHaveBeenCalled();material.dispose();
  });
  it('updates two independent renderer slots, bounds extra samples, supports legacy singular input and clears on release',()=>{
    const material=new THREE.MeshBasicMaterial(),occluders=[new HandOccluder(material),new HandOccluder(material)] as const;
    const pose:HeldPose={position:new THREE.Vector3(0,0,-40),rotation:new THREE.Quaternion(),scale:5};
    // Exercise the integration method without constructing a browser/WebGL context.
    const renderer={disposed:false,heldPose:null,current:new THREE.Group(),visible:false,handOccluders:occluders,effectsEnabled:true,
      presentation:{reset:vi.fn()},templeEffects:{setEnabled:vi.fn()},reapplyFrame:vi.fn(),getGrabContext:()=>({projection}),lastFrame:{},dirty:false,hide:vi.fn()};
    const update=(held:HeldPose|null,samples?:readonly HandOcclusionSample[]|HandOcclusionSample|null)=>GlassesRenderer.prototype.setHeldPose.call(renderer as unknown as GlassesRenderer,held,samples);
    const first={hand:hand(),depth:40,anchorZ:-.03},second={hand:hand(.2),depth:45,anchorZ:-.03};
    update(pose,[first,second,{hand:hand(.4),depth:60}]);
    expect(occluders.map(occluder=>occluder.visible)).toEqual([true,true]);expect(at(occluders[0],8).x).toBeLessThan(at(occluders[1],8).x);
    update(pose,[first,{...second,anchorZ:NaN}]);expect(occluders[0].visible).toBe(true);cleared(occluders[1]);
    update(pose,second);expect(occluders[0].visible).toBe(true);cleared(occluders[1]);
    update(pose,[first,second]);update(null);occluders.forEach(cleared);expect(renderer.reapplyFrame).toHaveBeenCalled();
    occluders.forEach(occluder=>occluder.dispose());material.dispose();
  });
  it('allows contact-gated mounted first touch without disabling temple effects and clears null plus empty samples',()=>{
    const material=new THREE.MeshBasicMaterial(),occluders=[new HandOccluder(material),new HandOccluder(material)] as const;
    const effects=vi.fn(),renderer={disposed:false,heldPose:null,current:new THREE.Group(),visible:true,handOccluders:occluders,effectsEnabled:true,
      presentation:{reset:vi.fn()},templeEffects:{setEnabled:effects},reapplyFrame:vi.fn(),getGrabContext:()=>({projection}),lastFrame:{},dirty:false,hide:vi.fn()};
    const update=(samples:readonly HandOcclusionSample[])=>GlassesRenderer.prototype.setHeldPose.call(renderer as unknown as GlassesRenderer,null,samples);
    update([{hand:hand(),depth:40},{hand:hand(.2),depth:45}]);
    expect(occluders.map(occluder=>occluder.visible)).toEqual([true,true]);expect(renderer.heldPose).toBeNull();expect(effects).toHaveBeenLastCalledWith(true);
    update([]);occluders.forEach(cleared);
    renderer.visible=false;update([{hand:hand(),depth:40}]);occluders.forEach(cleared);
    occluders.forEach(occluder=>occluder.dispose());material.dispose();
  });
});
