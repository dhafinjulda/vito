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
import type {FacePose} from '../src/glasses/fitting';
import {PosePresentation} from '../src/glasses/PosePresentation';

function pose(x=0,angle=0):FacePose {
  const headPosition=new THREE.Vector3(x,0,-45),headRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
  return {headPosition,headRotation,position:new THREE.Vector3(0,0,0.8).applyQuaternion(headRotation).add(headPosition),rotation:headRotation.clone(),scale:4,faceDepth:45,worldEyeSpan:8.9,headHalfWidth:7,
    state:{visible:true,source:'face-matrix',yawDegrees:angle*180/Math.PI,pitchDegrees:0,estimatedDistanceCm:45,guidance:'ready'}};
}
function rotatedPose(rotation:THREE.Quaternion):FacePose {
  const input=pose();
  input.headRotation.copy(rotation);input.rotation.copy(rotation);
  input.position.set(0,0,0.8).applyQuaternion(rotation).add(input.headPosition);
  return input;
}

describe('bounded pose presentation',()=>{
  it('automatically predicts consistent matrix motion, but not acceleration or landmark fallback',()=>{
    for(const values of [[0,1,2],[0,.1,1]]) {
      const timeline=new PosePresentation('auto');
      for(let i=0;i<3;i++)timeline.ingest(pose(values[i]),i*50,i*50+5,i*.05);
      const predicted=timeline.sample(120,.12)!.headPosition.x;
      expect(predicted).toBeCloseTo(values[1]===.1?1:2.4);
    }
    const fallback=new PosePresentation('auto');for(let i=0;i<3;i++){const input=pose(i);input.state.source='landmarks';fallback.ingest(input,i*50,i*50+5,i*.05);}
    expect(fallback.sample(120,.12)!.headPosition.x).toBe(2);
    expect(fallback.ingest(pose(),160,170,NaN)).toBe(false);
  });
  it('uses decoded media intervals despite jitter in capture callbacks and resets duplicate media',()=>{
    const timeline=new PosePresentation('predicted');
    timeline.ingest(pose(0),0,5,0);timeline.ingest(pose(1),80,85,0.05);timeline.ingest(pose(2),110,115,0.1);
    expect(timeline.sample(130,0.12)!.headPosition.x).toBeCloseTo(2.4);
    timeline.ingest(pose(3),140,145,0.1);expect(timeline.sampleCount).toBe(1);
    expect(timeline.sample(150,0.15)!.headPosition.x).toBe(3);
  });
  it('falls back immediately when the angular velocity changes axis despite matching speed',()=>{
    const timeline=new PosePresentation('auto');
    const previous=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),0.1);
    const latest=previous.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sqrt(3)/2,0.5,0),0.1));
    for(const [i,rotation] of [new THREE.Quaternion(),previous,latest].entries())timeline.ingest(rotatedPose(rotation),i*50,i*50+5,i*.05);
    const output=timeline.sample(120,.12)!;
    expect(output.headRotation.angleTo(latest)).toBeLessThan(1e-6);
    expect(output.position.distanceTo(rotatedPose(latest).position)).toBeLessThan(1e-6);
  });
  it.each(['auto','predicted'] as const)('uses angular speed rather than interval length with irregular inference cadence in %s mode',mode=>{
    const timeline=new PosePresentation(mode);
    for(const time of [0,80,90])timeline.ingest(pose(0,time*.002),time,time+5,time/1000);
    expect(timeline.sample(110,.11)!.headRotation.angleTo(pose(0,.22).headRotation)).toBeLessThan(1e-6);
  });
  it('predicts a consistent world rotation from an arbitrarily oriented head, including quaternion sign changes',()=>{
    const timeline=new PosePresentation('auto');
    const initial=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.7,-.2));
    const worldAxis=new THREE.Vector3(.6,.8,0);
    for(let i=0;i<3;i++) {
      const rotation=new THREE.Quaternion().setFromAxisAngle(worldAxis,i*.1).multiply(initial);
      if(i===2)rotation.set(-rotation.x,-rotation.y,-rotation.z,-rotation.w);
      timeline.ingest(rotatedPose(rotation),i*50,i*50+5,i*.05);
    }
    const expected=new THREE.Quaternion().setFromAxisAngle(worldAxis,.24).multiply(initial);
    expect(timeline.sample(120,.12)!.headRotation.angleTo(expected)).toBeLessThan(1e-6);
  });
  it.each(['auto','predicted'] as const)('expires extrapolation even when the displayed media timestamp repeats in %s mode',mode=>{
    const timeline=new PosePresentation(mode);
    for(let i=0;i<3;i++)timeline.ingest(pose(i,i*.1),i*50,i*50+5,i*.05);
    expect(timeline.sample(120,.12)!.headPosition.x).toBeCloseTo(2.4);
    const expired=timeline.sample(250,.12)!;
    expect(expired.headPosition.x).toBe(2);
    expect(expired.headRotation.angleTo(pose(0,.2).headRotation)).toBeLessThan(1e-6);
    expect(expired.position.clone().sub(expired.headPosition).applyQuaternion(expired.headRotation.clone().invert()).z).toBeCloseTo(.8);
  });
  it('requires a consistent matrix source throughout the automatic prediction window',()=>{
    const timeline=new PosePresentation('auto');
    for(let i=0;i<3;i++) {
      const input=pose(i,i*.1);if(i<2)input.state.source='landmarks';
      timeline.ingest(input,i*50,i*50+5,i*.05);
    }
    const output=timeline.sample(120,.12)!;
    expect(output.headPosition.x).toBe(2);
    expect(output.headRotation.angleTo(pose(0,.2).headRotation)).toBeLessThan(1e-6);
  });
  it('predicts toward displayed media by at most 30 ms while keeping bridge placement rigid',()=>{
    const timeline=new PosePresentation('predicted');
    for(let i=0;i<3;i++)timeline.ingest(pose(i,i*0.1),i*50,i*50+10,i*0.05);
    const current=timeline.sample(120,0.12)!;
    expect(current.headPosition.x).toBeCloseTo(2.4);
    expect(current.headRotation.angleTo(pose(0,0.24).headRotation)).toBeLessThan(1e-6);
    expect(current.position.clone().sub(current.headPosition).applyQuaternion(current.headRotation.clone().invert()).z).toBeCloseTo(0.8);
    expect(timeline.sample(180,0.18)!.headPosition.x).toBeCloseTo(2.6);
    expect(timeline.sample(190,0.18)!.headPosition.x).toBeCloseTo(2.6);
    expect(timeline.sample(250,0.25)!.headPosition.x).toBe(2);
  });
  it('disables prediction on missing media mapping, observed stop, reversal and reacquisition',()=>{
    for(const values of [[0,1,1],[0,1,0]]) {
      const timeline=new PosePresentation('predicted');
      for(let i=0;i<3;i++)timeline.ingest(pose(values[i]),i*50,i*50+10,i*0.05);
      expect(timeline.sample(130,0.13)!.headPosition.x).toBe(values[2]);
      timeline.reset();timeline.ingest(pose(3),140,150,0.14);expect(timeline.sample(170,0.17)!.headPosition.x).toBe(3);
    }
    const timeline=new PosePresentation('predicted');
    for(let i=0;i<3;i++)timeline.ingest(pose(i),i*50,i*50+10);
    expect(timeline.sample(130,0.13)!.headPosition.x).toBe(2);
  });
  it('does not amplify small stationary noise in the deterministic low-motion fixture',()=>{
    const timeline=new PosePresentation('predicted');
    let seed=7,squared=0,baselineSquared=0;
    for(let i=0;i<200;i++) {
      seed=(1664525*seed+1013904223)>>>0;
      const noise=(seed/2**32-0.5)*0.04,input=pose(noise,noise*0.05),time=i*1000/30;
      timeline.ingest(input,time,time+10,time/1000);
      const out=timeline.sample(time+20,(time+20)/1000)!;
      squared+=out.headPosition.x**2;baselineSquared+=noise**2;
    }
    expect(Math.sqrt(squared/200)).toBeLessThanOrEqual(Math.sqrt(baselineSquared/200)+1e-10);
  });
  it('keeps direct mode immediate and snapshots input ownership',()=>{
    const timeline=new PosePresentation(),input=pose(1);
    timeline.ingest(input,100,120);input.headPosition.x=99;
    expect(timeline.sample(120)?.headPosition.x).toBe(1);
    expect(timeline.delayMs).toBe(0);
  });
  it.each([15,20,30])('caps delay and retains at most three samples at %i Hz',hz=>{
    const timeline=new PosePresentation('interpolated'),interval=1000/hz;
    for(let i=0;i<30;i++)timeline.ingest(pose(i*0.01),i*interval,i*interval+10);
    expect(timeline.sampleCount).toBe(3);
    expect(timeline.delayMs).toBeCloseTo(Math.min(50,interval));
    expect(timeline.sample(29*interval+10+timeline.delayMs)?.headPosition.x).toBeCloseTo(0.29);
  });
  it('uses shortest-arc rotation and preserves the head-local bridge offset',()=>{
    const timeline=new PosePresentation('interpolated');
    timeline.ingest(pose(0,170*Math.PI/180),0,10);
    timeline.ingest(pose(2,-170*Math.PI/180),40,50);
    const out=timeline.sample(70)!;
    expect(out.headPosition.x).toBeCloseTo(1);
    expect(out.rotation.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI))).toBeLessThan(1e-6);
    expect(out.position.clone().sub(out.headPosition).applyQuaternion(out.headRotation.clone().invert()).distanceTo(new THREE.Vector3(0,0,0.8))).toBeLessThan(1e-6);
    expect(out.scale).toBe(4);
  });
  it('holds presentation when media repeats, and clears history on media reversal',()=>{
    const timeline=new PosePresentation('interpolated');
    timeline.ingest(pose(),0,10);timeline.sample(10,0);
    timeline.ingest(pose(2),40,50);
    const x=timeline.sample(60,0.04)!.headPosition.x;
    expect(timeline.sample(75,0.04)!.headPosition.x).toBe(x);
    expect(timeline.sample(75,0.07)!.headPosition.x).toBeGreaterThan(x);
    expect(timeline.sample(80,0.01)!.headPosition.x).toBe(2);
    expect(timeline.sampleCount).toBe(1);
  });
  it('resets on duplicate/reversed clocks, gaps, relocation and explicit loss',()=>{
    const timeline=new PosePresentation('interpolated');
    timeline.ingest(pose(),10,20);timeline.ingest(pose(1),40,50);
    timeline.ingest(pose(2),40,60);expect(timeline.sampleCount).toBe(1);
    timeline.ingest(pose(3),30,70);expect(timeline.sampleCount).toBe(1);
    timeline.ingest(pose(4),500,510);expect(timeline.sampleCount).toBe(1);
    timeline.ingest(pose(30),530,540);expect(timeline.sampleCount).toBe(1);
    timeline.reset();expect(timeline.sample(600)).toBeNull();
    expect(timeline.ingest(pose(),NaN,700)).toBe(false);
    expect(timeline.ingest(pose(),800,700)).toBe(false);
    expect(timeline.sampleCount).toBe(0);
  });
  it.each([30,60,90])('never extrapolates or overshoots at %i render Hz',hz=>{
    const timeline=new PosePresentation('interpolated');
    timeline.ingest(pose(),0,10);timeline.ingest(pose(1),50,60);
    let previous=0;
    for(let now=60;now<500;now+=1000/hz) {
      const x=timeline.sample(now)!.headPosition.x;
      expect(x).toBeGreaterThanOrEqual(previous);expect(x).toBeLessThanOrEqual(1);previous=x;
    }
  });
});
