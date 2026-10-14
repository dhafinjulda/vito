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
import {GlassesInteraction} from '../src/interaction/GlassesInteraction';
import {sampleHand,HandGrip,unprojectGrip,type TrackedHand,type GrabContext} from '../src/interaction/HandGrip';
import {placedGlassesPose} from '../src/interaction/placement';
import {fitFace,DEFAULT_FIT} from '../src/glasses/fitting';
import {syntheticFrame} from './synthetic-frame';

const projection={width:640,height:400,videoWidth:1280,videoHeight:720,fov:63};
function hand(dx=0,dy=0,open=false,id='Right'):TrackedHand {
  const p=Array.from({length:21},()=>({x:0.5+dx,y:0.54+dy,z:0}));
  p[0]={x:0.5+dx,y:0.62+dy,z:0};p[9]={x:0.5+dx,y:0.54+dy,z:0};
  p[5]={x:0.46+dx,y:0.56+dy,z:0};p[17]={x:0.54+dx,y:0.56+dy,z:0};
  p[4]={x:0.5+dx-(open?0.03:0.005),y:0.5+dy,z:0};p[8]={x:0.5+dx+(open?0.03:0.005),y:0.5+dy,z:0};
  return {landmarks:p,handedness:id};
}
function context():GrabContext {
  const asset={position:new THREE.Vector3(0,0,-45),rotation:new THREE.Quaternion(),scale:4};
  return {projection,asset,face:asset,head:{...asset,position:new THREE.Vector3(0,9,-48)},contactAt:p=>Math.hypot(p.x-0.5,p.y-0.5)<0.13?unprojectGrip(p,45,projection):null};
}
function grab() {const c=new GlassesInteraction(true);c.setAvailability('ready');const ctx=context();c.update([hand()],1000,ctx);c.update([hand()],1080,ctx);return {c,ctx};}
describe('free contact-based holding',()=>{
  it('rejects a nearby upside-down target and cancels a settling mount when the face disappears',()=>{
    const rejected=grab();rejected.ctx.face=null;
    rejected.ctx.head={...rejected.ctx.asset,position:rejected.ctx.asset.position.clone(),rotation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI)};
    expect(rejected.c.update([hand(0,0,true)],1160,rejected.ctx)).toMatchObject({phase:'idle',placement:'face',feedback:'release-near-face'});
    const mounted=grab();mounted.c.update([hand(0,0,true)],1160,mounted.ctx);expect(mounted.c.snapshot().phase).toBe('settling');
    mounted.ctx.face=null;mounted.c.tick(1210,mounted.ctx);expect(mounted.c.heldPose).toBeNull();expect(mounted.c.snapshot().phase).toBe('idle');
  });
  it('eases an aligned release, follows the current mount and finishes without a held pose',()=>{
    const {c,ctx}=grab();c.update([hand(0.01)],1160,ctx);
    expect(c.update([hand(0.01,0,true)],1240,ctx).phase).toBe('settling');
    const start=c.heldPose!.position.clone();ctx.face!.position.x=1;
    c.tick(1340,ctx);expect(c.heldPose!.position.distanceTo(start)).toBeGreaterThan(0);
    c.tick(1440,ctx);expect(c.snapshot().phase).toBe('idle');expect(c.heldPose).toBeNull();
  });
  it('ignores ordinary waving and remote pinches, and exposes detection feedback',()=>{
    const c=new GlassesInteraction(true);c.setAvailability('ready');
    expect(c.update([hand(0,0,true)],1000,context())).toMatchObject({phase:'idle',handVisible:true,feedback:'open-to-grab'});
    expect(c.update([hand(0.4)],1100,context()).phase).toBe('idle');
    expect(c.update([hand()],1200,context()).phase).toBe('grabbing');
    expect(c.update([hand()],1240,context()).phase).toBe('grabbing');
  });
  it('preserves contact on acquisition and carries freely sideways, independently of the face',()=>{
    const {c,ctx}=grab();expect(c.snapshot().phase).toBe('dragging');expect(c.heldPose!.position.distanceTo(ctx.asset.position)).toBeLessThan(1e-8);
    c.update([hand(0.1)],1160,ctx);expect(c.heldPose!.position.x).toBeGreaterThan(4);
    ctx.asset.position.x=-20;c.update([hand(0.1)],1240,ctx);expect(c.heldPose!.position.x).toBeGreaterThan(4);
  });
  it('acquires the current asset pose without jumping when the head moves during pinch dwell',()=>{
    const c=new GlassesInteraction(true);c.setAvailability('ready');const ctx=context();
    c.update([hand()],1000,ctx);ctx.asset.position.x=2;
    c.update([hand()],1080,ctx);expect(c.heldPose!.position.distanceTo(ctx.asset.position)).toBeLessThan(1e-8);
  });
  it('keeps the hand grip through face occlusion and cancels after genuine hand loss',()=>{
    const {c,ctx}=grab();c.onFaceLost();ctx.face=ctx.head=null;ctx.contactAt=()=>null;
    c.update([hand(0.08)],1160,ctx);expect(c.heldPose!.position.x).toBeGreaterThan(2);expect(c.snapshot().phase).toBe('dragging');
    c.tick(1700);expect(c.heldPose).toBeNull();expect(c.snapshot().phase).toBe('idle');
  });
  it('mounts near the head and returns to the prior mount when released away',()=>{
    const {c,ctx}=grab();for(const t of [1160,1240,1320]) c.update([hand(0,-0.16)],t,ctx);
    expect(c.update([hand(0,-0.16,true)],1400,ctx).placement).toBe('head');
    const again=grab();for(const [time,x] of [[1160,.1],[1240,.2],[1320,.3]])again.c.update([hand(x)],time!,again.ctx);
    expect(again.c.update([hand(0.3,0,true)],1400,again.ctx)).toMatchObject({phase:'settling',placement:'face',feedback:'release-near-face'});
    const release=again.c.heldPose!.position.clone();expect(release.distanceTo(again.ctx.asset.position)).toBeGreaterThan(6);
    again.c.tick(1400,again.ctx);expect(again.c.heldPose!.position.distanceTo(release)).toBeLessThan(1e-8);
    again.c.tick(1600,again.ctx);expect(again.c.snapshot()).toMatchObject({phase:'idle',feedback:'release-near-face'});expect(again.c.heldPose).toBeNull();
  });
  it('locks the acquired hand identity and resets on stop/unavailable/malformed input',()=>{
    const {c,ctx}=grab();c.update([hand(0.2,0,false,'Left')],1160,ctx);expect(c.heldPose!.position.x).toBeCloseTo(0);
    c.tick(1600);expect(c.heldPose).toBeNull();
    c.setAvailability('unavailable');expect(c.update([hand()],1700,ctx).phase).toBe('idle');
    c.reset();expect(c.snapshot().placement).toBe('face');expect(sampleHand({landmarks:[{x:NaN,y:0,z:0}],handedness:'Right'},1)).toBeNull();
  });
});
describe('rigid hand grip and mounted placement',()=>{
  it('has the same step response at 10/20/30 Hz and ignores duplicate/reversed time',()=>{
    const initial=sampleHand(hand(),1280/720)!,target=sampleHand(hand(0.1),1280/720)!;
    target.rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),0.8);
    const results=[10,20,30].map(hz=>{
      const ctx=context(),grip=new HandGrip(ctx.asset,new THREE.Vector3(0,0,-45),initial,projection,0);
      let last=grip.update(initial,projection,0);
      for(let i=1;i<=hz/5;i++)last=grip.update(target,projection,i*1000/hz);
      return last;
    });
    for(const value of results) {
      expect(value.position.distanceTo(results[0]!.position)).toBeLessThan(1e-8);
      expect(value.rotation.angleTo(results[0]!.rotation)).toBeLessThan(1e-7);
    }
    const ctx=context(),grip=new HandGrip(ctx.asset,new THREE.Vector3(0,0,-45),initial,projection,100);
    expect(grip.update(target,projection,100).position.distanceTo(ctx.asset.position)).toBe(0);
    expect(grip.update(target,projection,90).position.distanceTo(ctx.asset.position)).toBe(0);
  });
  it('rotates about the original contact and approximates approach from palm size without changing model scale',()=>{
    const ctx=context(),initial=sampleHand(hand(),1280/720)!;
    ctx.asset.position.x=-4;
    const grip=new HandGrip(ctx.asset,new THREE.Vector3(0,0,-45),initial,projection);
    const twist=hand();twist.landmarks=twist.landmarks.map(p=>({x:0.5+(p.y-0.5)/(1280/720),y:0.5-(p.x-0.5)*(1280/720),z:p.z}));
    const rotated=grip.update(sampleHand(twist,1280/720)!,projection);
    expect(rotated.rotation.angleTo(ctx.asset.rotation)).toBeGreaterThan(0.8);expect(rotated.scale).toBe(4);
    const larger=hand();larger.landmarks=larger.landmarks.map(p=>({x:0.5+(p.x-0.5)*1.4,y:0.5+(p.y-0.5)*1.4,z:p.z*1.4}));
    expect(grip.update(sampleHand(larger,1280/720)!,projection).position.z).toBeGreaterThan(-40);
  });
  it('retains face/head masks independently of mounted crown placement',()=>{
    const frame=syntheticFrame(45,20),pose=fitFace(frame.landmarks,frame.matrix,projection,DEFAULT_FIT)!;
    const original=pose.headPosition.clone(),crown=placedGlassesPose(pose,1);
    expect(crown.position.distanceTo(pose.position)).toBeGreaterThan(8);expect(pose.headPosition.distanceTo(original)).toBe(0);
  });
});
