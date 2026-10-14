/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import type { FacePose } from './fitting';

interface Sample {pose:FacePose;captureMs:number;receivedMs:number;mediaTime?:number}
function copyPose(pose:FacePose):FacePose {
  return {...pose,position:pose.position.clone(),rotation:pose.rotation.clone(),headPosition:pose.headPosition.clone(),headRotation:pose.headRotation.clone(),state:{...pose.state}};
}

/** Bounded interpolation/prediction. Capture and receipt
 * use the main-thread clock; media time gates progress when video stalls.
 * A maximum of three transient poses is retained, and none leaves the device. */
export class PosePresentation {
  private readonly samples:Sample[]=[];
  private output:FacePose|null=null;
  private mediaTime:number|undefined;
  private pending=false;
  private readonly inverse=new THREE.Quaternion();
  private readonly localA=new THREE.Vector3();
  private readonly localB=new THREE.Vector3();
  private readonly rotationA=new THREE.Quaternion();
  private readonly rotationB=new THREE.Quaternion();
  private readonly previousVelocity=new THREE.Vector3();
  private readonly velocity=new THREE.Vector3();
  private readonly angularDelta=new THREE.Quaternion();
  private readonly previousAngularDelta=new THREE.Quaternion();
  private readonly angularVelocity=new THREE.Vector3();
  private readonly previousAngularVelocity=new THREE.Vector3();

  constructor(private readonly mode:'auto'|'direct'|'interpolated'|'predicted'='direct') {}
  reset():void {this.samples.length=0;this.output=null;this.mediaTime=undefined;this.pending=false;}
  get sampleCount():number {return this.samples.length;}
  get delayMs():number {
    const last=this.samples.at(-1),previous=this.samples.at(-2);
    return this.mode==='interpolated'&&last&&previous?Math.min(50,last.captureMs-previous.captureMs):0;
  }

  ingest(pose:FacePose,captureMs:number,receivedMs:number,mediaTime?:number):boolean {
    if(!Number.isFinite(captureMs)||!Number.isFinite(receivedMs)||receivedMs<captureMs||mediaTime!==undefined&&(!Number.isFinite(mediaTime)||mediaTime<0)) {this.reset();return false;}
    const last=this.samples.at(-1);
    // Duplicate, reversed or discontinuous clocks and large relocation start a
    // fresh timeline. Do not blend an old session/face into a new acquisition.
    if(last&&(captureMs<=last.captureMs||receivedMs<last.receivedMs||captureMs-last.captureMs>250||(mediaTime!==undefined&&last.mediaTime!==undefined&&mediaTime<=last.mediaTime)||pose.headPosition.distanceTo(last.pose.headPosition)>pose.worldEyeSpan))this.reset();
    this.samples.push({pose:copyPose(pose),captureMs,receivedMs,mediaTime});
    if(this.samples.length>3)this.samples.shift();
    this.pending=true;
    return true;
  }

  sample(nowMs:number,mediaTime?:number):FacePose|null {
    const last=this.samples.at(-1);
    if(!last||!Number.isFinite(nowMs))return null;
    if(this.mode==='direct')return last.pose;
    if(mediaTime!==undefined&&!Number.isFinite(mediaTime))return this.output??last.pose;
    if(mediaTime!==undefined&&this.mediaTime!==undefined) {
      if(mediaTime<this.mediaTime) {
        this.samples.splice(0,this.samples.length-1);this.output=null;
      } else if(mediaTime===this.mediaTime&&!this.pending) {
        // A repeated decoded frame holds the presentation, but cannot extend
        // the lifetime of an extrapolated pose beyond its capture-age budget.
        if((this.mode!=='auto'&&this.mode!=='predicted')||nowMs-last.captureMs<=100)return this.output??last.pose;
      }
    }
    this.mediaTime=mediaTime;this.pending=false;
    if(this.mode==='predicted'||this.mode==='auto')return this.predict(nowMs,mediaTime);
    const delay=this.delayMs;
    const elapsed=Math.max(0,nowMs-last.receivedMs);
    // This deliberate delay costs up to one interval (capped at 50 ms). It is
    // opt-in: reducing staircase motion is not proof of lower alignment error.
    const target=last.captureMs+Math.min(delay,elapsed)-delay;
    let before=this.samples[0]!,after=last;
    for(let i=1;i<this.samples.length;i++) {
      const sample=this.samples[i]!;
      if(sample.captureMs>=target){after=sample;break;}
      before=sample;
    }
    const span=after.captureMs-before.captureMs;
    const alpha=span>0?THREE.MathUtils.clamp((target-before.captureMs)/span,0,1):1;
    const a=before.pose,b=after.pose;
    const out=this.output??=copyPose(b);
    out.headPosition.lerpVectors(a.headPosition,b.headPosition,alpha);
    out.headRotation.copy(a.headRotation).slerp(b.headRotation,alpha).normalize();
    // Bridge placement is reconstructed in head-local coordinates so rotation
    // does not turn the bridge into a world-space chord or detach it from masks.
    this.inverse.copy(a.headRotation).invert();
    this.localA.copy(a.position).sub(a.headPosition).applyQuaternion(this.inverse);
    this.rotationA.copy(this.inverse).multiply(a.rotation);
    this.inverse.copy(b.headRotation).invert();
    this.localB.copy(b.position).sub(b.headPosition).applyQuaternion(this.inverse);
    this.rotationB.copy(this.inverse).multiply(b.rotation);
    out.position.copy(this.localA).lerp(this.localB,alpha).applyQuaternion(out.headRotation).add(out.headPosition);
    out.rotation.copy(out.headRotation).multiply(this.rotationA.slerp(this.rotationB,alpha)).normalize();
    out.scale=b.scale;out.worldEyeSpan=b.worldEyeSpan;
    out.headHalfWidth=THREE.MathUtils.lerp(a.headHalfWidth,b.headHalfWidth,alpha);
    out.faceDepth=-out.headPosition.z;
    Object.assign(out.state,b.state,{estimatedDistanceCm:out.faceDepth});
    return out;
  }

  private predict(nowMs:number,mediaTime?:number):FacePose {
    const latest=this.samples.at(-1)!,previous=this.samples.at(-2),older=this.samples.at(-3),pose=latest.pose;
    const out=this.output??=copyPose(pose);
    out.headPosition.copy(pose.headPosition);out.headRotation.copy(pose.headRotation);
    // Predict toward the currently displayed media frame, not arbitrary wall
    // time. Missing media mapping, old results or ownership resets disable it.
    const consistentSource=this.mode!=='auto'||this.samples.every(sample=>sample.pose.state.source==='face-matrix');
    const horizon=mediaTime===undefined||latest.mediaTime===undefined||!consistentSource?0:Math.min(30,Math.max(0,(mediaTime-latest.mediaTime)*1000));
    if(horizon>0&&previous&&older&&previous.mediaTime!==undefined&&older.mediaTime!==undefined&&nowMs-latest.captureMs<=100&&nowMs>=latest.receivedMs) {
      // Velocity and prediction horizon must use the same decoded-media clock;
      // callback scheduling jitter is not motion of the wearer's head.
      const dt=(latest.mediaTime!-previous.mediaTime)*1000,previousDt=(previous.mediaTime-older.mediaTime)*1000;
      if(dt<=0||previousDt<=0||dt>250||previousDt>250)return this.copyLatest(pose,out);
      this.velocity.copy(pose.headPosition).sub(previous.pose.headPosition).divideScalar(dt);
      this.previousVelocity.copy(previous.pose.headPosition).sub(older.pose.headPosition).divideScalar(previousDt);
      // Reversal and a newly observed stop suppress extrapolation immediately.
      const consistent=this.mode!=='auto'||this.localA.copy(this.velocity).sub(this.previousVelocity).length()<=this.velocity.length()*0.35;
      const moving=consistent&&this.velocity.dot(this.previousVelocity)>=0&&this.velocity.length()>=this.previousVelocity.length()*0.3&&this.velocity.length()>=pose.worldEyeSpan*0.15/1000;
      if(moving&&this.velocity.length()*horizon<=pose.worldEyeSpan*0.15)out.headPosition.addScaledVector(this.velocity,horizon);
      this.angularDelta.copy(previous.pose.headRotation).invert().multiply(pose.headRotation).normalize();
      this.previousAngularDelta.copy(older.pose.headRotation).invert().multiply(previous.pose.headRotation).normalize();
      if(this.angularDelta.w<0)this.angularDelta.set(-this.angularDelta.x,-this.angularDelta.y,-this.angularDelta.z,-this.angularDelta.w);
      if(this.previousAngularDelta.w<0)this.previousAngularDelta.set(-this.previousAngularDelta.x,-this.previousAngularDelta.y,-this.previousAngularDelta.z,-this.previousAngularDelta.w);
      const angularLength=Math.hypot(this.angularDelta.x,this.angularDelta.y,this.angularDelta.z),previousLength=Math.hypot(this.previousAngularDelta.x,this.previousAngularDelta.y,this.previousAngularDelta.z);
      const predictedAngle=2*Math.atan2(angularLength,this.angularDelta.w)*horizon/dt;
      const angularSpeed=2*Math.atan2(angularLength,this.angularDelta.w)/dt;
      const priorSpeed=2*Math.atan2(previousLength,this.previousAngularDelta.w)/previousDt;
      // Quaternion deltas use the local coordinates of different source
      // poses. Compare their angular velocities in world coordinates so a
      // change of rotation axis cannot pass a speed-only consistency check.
      this.angularVelocity.set(this.angularDelta.x,this.angularDelta.y,this.angularDelta.z).multiplyScalar(angularLength>0?angularSpeed/angularLength:0).applyQuaternion(previous.pose.headRotation);
      this.previousAngularVelocity.set(this.previousAngularDelta.x,this.previousAngularDelta.y,this.previousAngularDelta.z).multiplyScalar(previousLength>0?priorSpeed/previousLength:0).applyQuaternion(older.pose.headRotation);
      const sameDirection=this.angularVelocity.dot(this.previousAngularVelocity)>=0;
      const angularConsistent=this.mode!=='auto'||this.localA.copy(this.angularVelocity).sub(this.previousAngularVelocity).length()<=angularSpeed*0.35;
      // Compare speeds, not raw delta lengths: inference intervals may differ
      // even during a constant-speed turn.
      if(angularConsistent&&sameDirection&&angularSpeed>=priorSpeed*0.3&&angularSpeed>=5*Math.PI/180/1000&&predictedAngle<=8*Math.PI/180)out.headRotation.multiply(this.rotationA.identity().slerp(this.angularDelta,horizon/dt)).normalize();
    }
    this.inverse.copy(pose.headRotation).invert();
    out.position.copy(pose.position).sub(pose.headPosition).applyQuaternion(this.inverse).applyQuaternion(out.headRotation).add(out.headPosition);
    out.rotation.copy(out.headRotation).multiply(this.rotationB.copy(this.inverse).multiply(pose.rotation)).normalize();
    out.scale=pose.scale;out.worldEyeSpan=pose.worldEyeSpan;out.headHalfWidth=pose.headHalfWidth;out.faceDepth=-out.headPosition.z;
    Object.assign(out.state,pose.state,{estimatedDistanceCm:out.faceDepth});
    return out;
  }

  private copyLatest(pose:FacePose,out:FacePose):FacePose {
    out.position.copy(pose.position);out.rotation.copy(pose.rotation);
    out.scale=pose.scale;out.worldEyeSpan=pose.worldEyeSpan;out.headHalfWidth=pose.headHalfWidth;out.faceDepth=pose.faceDepth;
    Object.assign(out.state,pose.state);return out;
  }
}
