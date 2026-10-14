/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {HandGrip,TwoHandGrip,sampleHand,sampleHandGrips,unprojectGrip,type HandSample,type TrackedHand,type HeldPose} from '../src/interaction/HandGrip';
import type {Projection} from '../src/glasses/fitting';

const projection:Projection={width:1000,height:1000,videoWidth:1000,videoHeight:1000,fov:63,intrinsics:{imageWidth:1000,imageHeight:1000,fx:1000,fy:1000,cx:500,cy:500}};
function sample(x:number,y=0.5):HandSample {return {point:{x,y,z:0},palmSpan:0.1,pinch:0.1,rotation:new THREE.Quaternion()};}
function asset():HeldPose {return {position:new THREE.Vector3(1,2,-50),rotation:new THREE.Quaternion(),scale:4};}
function samples():[HandSample,HandSample] {return [sample(0.4),sample(0.6)];}
function contacts():[THREE.Vector3,THREE.Vector3] {return [new THREE.Vector3(-5,0,-50),new THREE.Vector3(5,0,-50)];}
function articulatedHand():TrackedHand {
  const p=Array.from({length:21},()=>({x:0.5,y:0.5,z:0}));
  p[0]={x:0.5,y:0.64,z:0};
  const chains=[[1,0.55,0.58],[2,0.56,0.52],[3,0.54,0.46],[4,0.51,0.42],
    [5,0.45,0.54],[6,0.46,0.48],[7,0.48,0.44],[8,0.50,0.42],
    [9,0.49,0.51],[10,0.49,0.46],[11,0.50,0.43],[12,0.51,0.41],
    [13,0.53,0.52],[14,0.53,0.47],[15,0.52,0.44],[16,0.51,0.42],
    [17,0.57,0.55],[18,0.56,0.50],[19,0.54,0.46],[20,0.52,0.43]];
  for(const [i,x,y] of chains)p[i!]={x:x!,y:y!,z:0};
  return {landmarks:p,handedness:'Right'};
}
describe('multi-finger contact samples',()=>{
  it('evaluates each fingertip paired with the thumb and retains the legacy index sample',()=>{
    const hand=articulatedHand(),legacy=sampleHand(hand,1)!,grips=sampleHandGrips(hand,1);
    expect(grips.map(value=>value.finger)).toEqual(['index','middle','ring','little']);
    expect(grips[0]!.point).toEqual(legacy.point);expect(grips[0]!.pinch).toBe(legacy.pinch);
    expect(grips.every(value=>Number.isFinite(value.pinch)&&value.rotation.length()>0.99)).toBe(true);
  });
  it('normalizes pinch by palm size and keeps open fingertips for release hysteresis',()=>{
    const hand=articulatedHand();hand.landmarks[20]!.x+=0.08;
    const initial=sampleHandGrips(hand,1),larger={...hand,landmarks:hand.landmarks.map(p=>({x:0.5+(p.x-0.5)*1.5,y:0.5+(p.y-0.5)*1.5,z:p.z*1.5}))};
    expect(initial.find(value=>value.finger==='little')!.pinch).toBeGreaterThan(0.5);
    for(const value of sampleHandGrips(larger,1))expect(value.pinch).toBeCloseTo(initial.find(item=>item.finger===value.finger)!.pinch,12);
  });
  it('rejects malformed full hands and collapsed fingertips rather than creating a palm grab',()=>{
    const hand=articulatedHand();hand.landmarks[10]!.z=NaN;expect(sampleHandGrips(hand,1)).toEqual([]);
    expect(sampleHandGrips(articulatedHand(),0)).toEqual([]);
    const collapsed=articulatedHand();for(const i of [5,6,7,8])collapsed.landmarks[i]={...collapsed.landmarks[9]!};
    expect(sampleHandGrips(collapsed,1).some(value=>value.finger==='index')).toBe(false);
    const palm=articulatedHand();for(const i of [1,2,3,4])palm.landmarks[i]={...palm.landmarks[9]!};
    expect(sampleHandGrips(palm,1)).toEqual([]);
  });
});
describe('rigid two-hand grip',()=>{
  it('starts at the supplied held pose and preserves contact offsets during translation',()=>{
    const initial=asset(),pair=samples(),contact=contacts(),grip=new TwoHandGrip(initial,contact,pair,projection,0);
    expect(grip.getPose().position.distanceTo(initial.position)).toBe(0);
    const target:[HandSample,HandSample]=[sample(0.45,0.4),sample(0.65,0.4)],pose=grip.update(target,projection,5000);
    expect(pose.position.distanceTo(new THREE.Vector3(3.5,7,-50))).toBeLessThan(1e-8);
    for(const i of [0,1] as const) {
      const local=contact[i].clone().sub(initial.position).multiplyScalar(1/initial.scale);
      const displayed=local.multiplyScalar(pose.scale).applyQuaternion(pose.rotation).add(pose.position);
      expect(displayed.distanceTo(unprojectGrip(target[i].point,50,projection))).toBeLessThan(1e-8);
    }
  });
  it('rotates about the contact midpoint without stretching when hands separate',()=>{
    const initial=asset(),grip=new TwoHandGrip(initial,contacts(),samples(),projection,0);
    const target:[HandSample,HandSample]=[sample(0.5,0.6),sample(0.5,0.4)];
    const quarterTurn=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
    for(const value of target)value.rotation.copy(quarterTurn);
    const pose=grip.update(target,projection,5000);
    expect(pose.rotation.angleTo(quarterTurn)).toBeLessThan(1e-7);
    expect(pose.position.distanceTo(new THREE.Vector3(-2,1,-50))).toBeLessThan(1e-8);
    const separated:[HandSample,HandSample]=[sample(0.5,0.7),sample(0.5,0.3)];
    for(const value of separated)value.rotation.copy(quarterTurn);
    const wider=grip.update(separated,projection,10000);expect(wider.scale).toBe(initial.scale);
    const displayedContacts=contacts().map(contact=>contact.sub(initial.position).applyQuaternion(wider.rotation).add(wider.position));
    expect(displayedContacts[0]!.distanceTo(displayedContacts[1]!)).toBeCloseTo(10,12);
  });
  it('bounds palm twist and averages opposite hand rotations',()=>{
    const grip=new TwoHandGrip(asset(),contacts(),samples(),projection,0),twisted=samples();
    for(const value of twisted)value.rotation.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI*0.8);
    expect(grip.update(twisted,projection,5000).rotation.angleTo(new THREE.Quaternion())).toBeCloseTo(Math.PI/4,8);
    twisted[1].rotation.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI*0.8);
    expect(grip.update(twisted,projection,10000).rotation.angleTo(new THREE.Quaternion())).toBeLessThan(1e-7);
  });
  it('allows an intentional continuous turn past 180 degrees without an axis flip',()=>{
    const grip=new TwoHandGrip(asset(),contacts(),samples(),projection,0);
    let time=0;
    for(let degrees=30;degrees<=210;degrees+=30) {
      const angle=THREE.MathUtils.degToRad(degrees),pair:[HandSample,HandSample]=[
        sample(0.5-0.1*Math.cos(angle),0.5+0.1*Math.sin(angle)),sample(0.5+0.1*Math.cos(angle),0.5-0.1*Math.sin(angle))];
      for(const value of pair)value.rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),angle);
      const pose=grip.update(pair,projection,time+=5000);
      expect(pose.rotation.angleTo(pair[0].rotation)).toBeLessThan(1e-7);
    }
  });
  it('matches elapsed-time filtering across cadences for a shared translation',()=>{
    const positions=[10,20,30].map(hz=>{
      const grip=new TwoHandGrip(asset(),contacts(),samples(),projection,0);
      for(let i=1;i<=hz/5;i++)grip.update([sample(0.45,0.4),sample(0.65,0.4)],projection,i*1000/hz);
      return grip.getPose().position;
    });
    for(const value of positions)expect(value.distanceTo(positions[0]!)).toBeLessThan(1e-8);
  });
  it('holds the previous pose for duplicate, reversed, invalid, collapsed or inverted contacts',()=>{
    const grip=new TwoHandGrip(asset(),contacts(),samples(),projection,100),initial=grip.getPose();
    for(const time of [100,90,NaN])expect(grip.update([sample(0.45),sample(0.65)],projection,time).position.distanceTo(initial.position)).toBe(0);
    const invalid=samples();invalid[0].palmSpan=0;expect(grip.update(invalid,projection,150).position.distanceTo(initial.position)).toBe(0);
    expect(grip.update([sample(0.5),sample(0.5001)],projection,200).position.distanceTo(initial.position)).toBe(0);
    expect(grip.update([sample(0.6),sample(0.4)],projection,5200).position.distanceTo(initial.position)).toBe(0);
    expect(()=>new TwoHandGrip(asset(),contacts(),[sample(0.5),sample(0.5001)],projection)).toThrow(/apart/);
  });
  it('returns independent snapshots and lets one-hand continuation start without a jump',()=>{
    const grip=new TwoHandGrip(asset(),contacts(),samples(),projection,0),held=grip.update([sample(0.45),sample(0.65)],projection,100);
    const pose=grip.getPose();pose.position.x=999;expect(grip.getPose().position.x).not.toBe(999);
    const hand=new HandGrip(held,new THREE.Vector3(held.position.x,held.position.y,-50),sample(0.45),projection,100);
    expect(hand.getPose().position.distanceTo(held.position)).toBe(0);
    expect(hand.update({...sample(0.7),palmSpan:NaN},projection,200).position.distanceTo(held.position)).toBe(0);
  });
});
