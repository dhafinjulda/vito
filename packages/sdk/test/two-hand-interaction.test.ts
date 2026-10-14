/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {GlassesInteraction} from '../src/interaction/GlassesInteraction';
import {unprojectGrip,type GrabContext,type GripFinger,type TrackedHand} from '../src/interaction/HandGrip';
import {syntheticHand} from './synthetic-hand';

const projection={width:640,height:360,videoWidth:1280,videoHeight:720,fov:63};
function setup(){
  const c=new GlassesInteraction(true);c.setAvailability('ready');
  const asset={position:new THREE.Vector3(0,0,-45),rotation:new THREE.Quaternion(),scale:4};
  const ctx:GrabContext={projection,asset,face:asset,head:{...asset,position:new THREE.Vector3(0,9,-48)},contactAt:p=>Math.hypot(p.x-.5,p.y-.5)<.18?unprojectGrip(p,45,projection):null};
  const update=(hands:TrackedHand[],time:number)=>{if(c.heldPose)ctx.asset=c.heldPose;return c.update(hands,time,ctx);};
  return {c,ctx,update};
}
function heldPair(){const value=setup();value.update([syntheticHand(.45)],1000);value.update([syntheticHand(.45)],1080);value.update([syntheticHand(.45),syntheticHand(.55,.5,'middle','Left')],1160);value.update([syntheticHand(.45),syntheticHand(.55,.5,'middle','Left')],1240);return value;}

describe('ten-finger and two-hand controller',()=>{
  for(const id of ['Left','Right'])for(const finger of ['index','middle','ring','little'] as GripFinger[]){
    it(`acquires ${id} thumb/${finger} with contact and dwell`,()=>{const {c,update}=setup();expect(update([syntheticHand(.5,.5,finger,id)],1000).phase).toBe('grabbing');expect(update([syntheticHand(.5,.5,finger,id)],1080)).toMatchObject({phase:'dragging',grippingHands:1});expect(c.heldPose!.position.toArray()).toEqual([0,0,-45]);});
  }
  it('joins without jumping and follows two hands while preserving object scale',()=>{
    const {c,update}=heldPair();expect(c.snapshot()).toMatchObject({grippingHands:2,feedback:'held-two-hands'});
    expect(c.heldPose!.position.toArray()).toEqual([0,0,-45]);expect(c.occludingHands).toHaveLength(2);
    update([syntheticHand(.47),syntheticHand(.57,.5,'middle','Left')],1320);expect(c.heldPose!.position.x).toBeGreaterThan(.5);expect(c.heldPose!.scale).toBe(4);
    const before=c.heldPose!.rotation.clone();update([syntheticHand(.47,.48),syntheticHand(.57,.52,'middle','Left')],1400);
    expect(c.heldPose!.rotation.angleTo(before)).toBeGreaterThan(.1);expect(c.heldPose!.scale).toBe(4);
  });
  it('transfers to the receiver on donor release without moving the object, then follows receiver motion',()=>{
    const {c,update}=heldPair(),before=c.heldPose!;
    expect(update([syntheticHand(.45,.5,'index','Right',true),syntheticHand(.55,.5,'middle','Left')],1320)).toMatchObject({grippingHands:1,feedback:'handoff',phase:'dragging'});
    expect(c.heldPose!.position.distanceTo(before.position)).toBeLessThan(1e-8);expect(c.heldPose!.rotation.angleTo(before.rotation)).toBeLessThan(1e-7);
    update([syntheticHand(.57,.5,'middle','Left')],1400);expect(c.heldPose!.position.x).toBeGreaterThan(.5);
    update([syntheticHand(.57,.5,'middle','Left'),syntheticHand(.47,.5,'ring','Right')],1480);
    update([syntheticHand(.57,.5,'middle','Left'),syntheticHand(.47,.5,'ring','Right')],1560);expect(c.snapshot().grippingHands).toBe(2);
    const transferred=c.heldPose!.position.clone();update([syntheticHand(.57,.5,'middle','Left',true),syntheticHand(.47,.5,'ring','Right')],1640);
    expect(c.snapshot().feedback).toBe('handoff');expect(c.heldPose!.position.distanceTo(transferred)).toBeLessThan(1e-8);
  });
  it('transfers only an acquired receiver when the donor disappears',()=>{
    const {c,update}=heldPair(),before=c.heldPose!.position.clone();update([syntheticHand(.55,.5,'middle','Left')],1320);
    expect(c.snapshot()).toMatchObject({grippingHands:1,feedback:'handoff'});expect(c.heldPose!.position.distanceTo(before)).toBeLessThan(1e-8);
    update([syntheticHand(.55,.5,'middle','Left')],1400);c.tick(1900);expect(c.heldPose).toBeNull();expect(c.occludingHands).toHaveLength(0);
  });
  it('keeps owners through reorder/soft label changes and reseats another contacting finger without a jump',()=>{
    const {c,update}=heldPair(),before=c.heldPose!.position.clone();
    update([syntheticHand(.55,.5,'middle','Right'),syntheticHand(.45,.5,'index','Left')],1320);expect(c.snapshot().grippingHands).toBe(2);expect(c.heldPose!.position.distanceTo(before)).toBeLessThan(1e-8);
    update([syntheticHand(.55,.5,'little','Right'),syntheticHand(.45,.5,'ring','Left')],1400);expect(c.snapshot().grippingHands).toBe(2);expect(c.heldPose!.position.distanceTo(before)).toBeLessThan(1e-8);
  });
  it('requires second contact/dwell and cannot be captured by a distant other hand',()=>{
    const {c,update}=setup();update([syntheticHand(.45)],1000);update([syntheticHand(.45)],1080);
    update([syntheticHand(.45),syntheticHand(.9,.5,'middle','Left')],1160);update([syntheticHand(.45),syntheticHand(.9,.5,'middle','Left')],1240);expect(c.snapshot().grippingHands).toBe(1);
    update([syntheticHand(.45),syntheticHand(.55,.5,'middle','Left')],1320);expect(c.snapshot().grippingHands).toBe(1);
    update([syntheticHand(.45),syntheticHand(.55,.5,'middle','Left')],1360);expect(c.snapshot().grippingHands).toBe(1);
    update([syntheticHand(.45),syntheticHand(.55,.5,'middle','Left')],1400);expect(c.snapshot().grippingHands).toBe(2);
  });
  it('continues with face absent and clears both grips on lifecycle/reset or disabled tracking',()=>{
    const {c,ctx,update}=heldPair();ctx.face=ctx.head=null;ctx.contactAt=()=>null;c.onFaceLost();
    update([syntheticHand(.47),syntheticHand(.57,.5,'middle','Left')],1320);expect(c.snapshot().grippingHands).toBe(2);
    c.reset();expect(c.snapshot()).toMatchObject({phase:'idle',grippingHands:0,contactFingers:0});expect(c.occludingHands).toHaveLength(0);
    const next=heldPair();next.c.setAvailability('unavailable');expect(next.c.heldPose).toBeNull();expect(next.c.occludingHands).toHaveLength(0);
  });
  it('counts no more than ten actual fingertip contacts and masks mounted first-touch',()=>{
    const {c,ctx,update}=setup();ctx.contactAt=p=>unprojectGrip(p,45,projection);
    const state=update([syntheticHand(.45,.5,'index','Right',true),syntheticHand(.55,.5,'middle','Left',true)],1000);
    expect(state).toMatchObject({phase:'idle',grippingHands:0,contactFingers:10});expect(c.heldPose).toBeNull();expect(c.occludingHands).toHaveLength(2);
  });
});
