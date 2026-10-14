/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import type { FaceLandmark3D } from '../glasses/pose';
import { mapCoverPoint } from '../glasses/coordinates';
import { worldPerPixel, type Projection } from '../glasses/fitting';

export interface TrackedHand { landmarks: FaceLandmark3D[]; handedness: string }
export interface HeldPose { position: THREE.Vector3; rotation: THREE.Quaternion; scale: number }
export interface GrabContext {
  projection: Projection;
  asset: HeldPose;
  contactAt(point: { x: number; y: number }): THREE.Vector3 | null;
  face: HeldPose | null;
  head: HeldPose | null;
}
export interface HandSample {point:FaceLandmark3D;palmSpan:number;pinch:number;rotation:THREE.Quaternion}
export type GripFinger='index'|'middle'|'ring'|'little';
export interface FingerHandSample extends HandSample {finger:GripFinger}
export function sampleHand(hand:TrackedHand,aspect:number):HandSample|null {
  const p=hand.landmarks;
  if(!Number.isFinite(aspect)||aspect<=0||p.length!==21||!p.every(q=>[q.x,q.y,q.z].every(Number.isFinite))) return null;
  const delta=(a:number,b:number)=>new THREE.Vector3((p[a]!.x-p[b]!.x)*aspect,p[b]!.y-p[a]!.y,(p[b]!.z-p[a]!.z)*aspect);
  const up=delta(9,0),across=delta(5,17),palmSpan=up.length();
  if(palmSpan<0.015||across.length()<0.01) return null;
  across.normalize();up.addScaledVector(across,-up.dot(across));
  if(up.length()<0.008) return null;
  up.normalize();const normal=across.clone().cross(up).normalize();
  return {point:{x:(p[4]!.x+p[8]!.x)/2,y:(p[4]!.y+p[8]!.y)/2,z:(p[4]!.z+p[8]!.z)/2},palmSpan,
    pinch:Math.hypot((p[4]!.x-p[8]!.x)*aspect,p[4]!.y-p[8]!.y)/palmSpan,
    rotation:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,up,normal))};
}
/** Four thumb-to-finger contacts, evaluated from all 21 joints of the same hand.
 * A contact is never synthesized from a palm centre when fingertips are invalid.
 * Samples include open contacts so the controller can apply release hysteresis.
 */
export function sampleHandGrips(hand:TrackedHand,aspect:number):FingerHandSample[] {
  const basis=sampleHand(hand,aspect);
  if(!basis)return [];
  const p=hand.landmarks,span=basis.palmSpan;
  const length=(a:number,b:number)=>Math.hypot((p[a]!.x-p[b]!.x)*aspect,p[a]!.y-p[b]!.y,(p[a]!.z-p[b]!.z)*aspect);
  const plausibleChain=(joints:readonly number[])=>{
    let total=0;
    for(let i=1;i<joints.length;i++) {
      const segment=length(joints[i-1]!,joints[i]!);
      if(segment>span*2)return false;
      total+=segment;
    }
    return total>=span*0.2&&total<=span*5;
  };
  if(!plausibleChain([1,2,3,4])||length(4,0)<span*0.4)return [];
  const palm={x:(p[0]!.x+p[5]!.x+p[9]!.x+p[17]!.x)/4,y:(p[0]!.y+p[5]!.y+p[9]!.y+p[17]!.y)/4};
  const fingers:readonly [GripFinger,number][]=[['index',8],['middle',12],['ring',16],['little',20]];
  const result:FingerHandSample[]=[];
  for(const [finger,tip] of fingers) {
    if(!plausibleChain([tip-3,tip-2,tip-1,tip])||length(tip,0)<span*0.35)continue;
    const point={x:(p[4]!.x+p[tip]!.x)/2,y:(p[4]!.y+p[tip]!.y)/2,z:(p[4]!.z+p[tip]!.z)/2};
    if(Math.hypot((point.x-palm.x)*aspect,point.y-palm.y)<span*0.15)continue;
    result.push({finger,point,palmSpan:span,pinch:Math.hypot((p[4]!.x-p[tip]!.x)*aspect,p[4]!.y-p[tip]!.y)/span,rotation:basis.rotation.clone()});
  }
  return result;
}
export function unprojectGrip(point:{x:number;y:number},depth:number,p:Projection):THREE.Vector3 {
  if(p.intrinsics){const k=p.intrinsics;return new THREE.Vector3((point.x*p.videoWidth-k.cx)*depth/k.fx,(k.cy-point.y*p.videoHeight)*depth/k.fy,-depth);}
  const screen=mapCoverPoint(point.x,point.y,p.videoWidth,p.videoHeight,p.width,p.height),units=worldPerPixel(depth,p);
  return new THREE.Vector3(screen.x*units,screen.y*units,-depth);
}
/** Preserves contact offset. Absolute hand depth is approximated by palm-size change after acquisition. */
export class HandGrip {
  private readonly initialDepth:number;
  private readonly palmSpan:number;
  private readonly offset:THREE.Vector3;
  private readonly correction:THREE.Quaternion;
  private readonly anchor:THREE.Vector3;
  private readonly rotation:THREE.Quaternion;
  private lastTimestamp:number|null;
  readonly scale:number;
  depth:number;
  constructor(asset:HeldPose,contact:THREE.Vector3,sample:HandSample,p:Projection,timestampMs?:number) {
    this.lastTimestamp=timestampMs??null;
    this.initialDepth=this.depth=-contact.z;this.palmSpan=sample.palmSpan;this.scale=asset.scale;
    this.anchor=unprojectGrip(sample.point,this.depth,p);this.rotation=sample.rotation.clone();
    this.offset=asset.position.clone().sub(this.anchor).applyQuaternion(sample.rotation.clone().invert());
    this.correction=sample.rotation.clone().invert().multiply(asset.rotation);
  }
  update(sample:HandSample,p:Projection,timestampMs?:number):HeldPose {
    const dt=timestampMs===undefined||this.lastTimestamp===null?50:timestampMs-this.lastTimestamp;
    if(!finiteSample(sample)||timestampMs!==undefined&&!Number.isFinite(timestampMs)||!Number.isFinite(dt)||dt<0)return this.pose();
    if(timestampMs!==undefined)this.lastTimestamp=timestampMs;
    // Preserve the former response at 20 Hz, with the same decay per elapsed
    // second at other cadences. Duplicate timestamps contribute no movement.
    const depthAlpha=1-Math.pow(1-0.65,dt/50),anchorAlpha=1-Math.pow(1-0.7,dt/50);
    const depth=THREE.MathUtils.clamp(this.initialDepth*this.palmSpan/sample.palmSpan,this.initialDepth*0.45,this.initialDepth*2.2);
    this.depth+=(depth-this.depth)*depthAlpha;this.anchor.lerp(unprojectGrip(sample.point,this.depth,p),anchorAlpha);this.rotation.slerp(sample.rotation,depthAlpha);
    return this.pose();
  }
  getPose():HeldPose {return this.pose();}
  private pose():HeldPose {
    return {position:this.anchor.clone().add(this.offset.clone().applyQuaternion(this.rotation)),rotation:this.rotation.clone().multiply(this.correction),scale:this.scale};
  }
}

function finiteSample(sample:HandSample):boolean {
  return sample.palmSpan>0&&[sample.point.x,sample.point.y,sample.point.z,sample.palmSpan,sample.pinch,...sample.rotation.toArray()].every(Number.isFinite)&&sample.rotation.lengthSq()>0.5;
}
/** A rigid two-contact constraint. Separation changes never stretch the glasses.
 * Monocular palm-size depth and palm twist remain estimates, not physical forces.
 */
export class TwoHandGrip {
  readonly scale:number;
  readonly depths:[number,number];
  private readonly initialDepths:[number,number];
  private readonly palmSpans:[number,number];
  private readonly initialRotations:[THREE.Quaternion,THREE.Quaternion];
  private readonly anchors:[THREE.Vector3,THREE.Vector3];
  private readonly initialLine:THREE.Vector3;
  private readonly currentLine:THREE.Vector3;
  private readonly lineRotation=new THREE.Quaternion();
  private readonly offset:THREE.Vector3;
  private readonly initialRotation:THREE.Quaternion;
  private lastTimestamp:number|null;
  private twist=0;
  private held:HeldPose;
  constructor(asset:HeldPose,contacts:[THREE.Vector3,THREE.Vector3],samples:[HandSample,HandSample],p:Projection,timestampMs?:number) {
    if(!samples.every(finiteSample)||!contacts.every(contact=>[contact.x,contact.y,contact.z].every(Number.isFinite)&&contact.z<0))throw new Error('Two-hand grip requires finite contacts in front of the camera.');
    this.scale=asset.scale;this.lastTimestamp=timestampMs??null;
    this.initialDepths=[-contacts[0].z,-contacts[1].z];this.depths=[...this.initialDepths];
    this.palmSpans=[samples[0].palmSpan,samples[1].palmSpan];
    this.initialRotations=[samples[0].rotation.clone().normalize(),samples[1].rotation.clone().normalize()];
    this.anchors=[unprojectGrip(samples[0].point,this.depths[0],p),unprojectGrip(samples[1].point,this.depths[1],p)];
    const line=this.anchors[1].clone().sub(this.anchors[0]);
    if(line.length()<0.5)throw new Error('Two-hand grip contacts must be at least 0.5 cm apart.');
    this.initialLine=line.normalize();this.currentLine=this.initialLine.clone();
    this.offset=asset.position.clone().sub(this.anchors[0].clone().add(this.anchors[1]).multiplyScalar(0.5));
    this.initialRotation=asset.rotation.clone();this.held={position:asset.position.clone(),rotation:asset.rotation.clone(),scale:this.scale};
  }
  update(samples:[HandSample,HandSample],p:Projection,timestampMs?:number):HeldPose {
    const dt=timestampMs===undefined||this.lastTimestamp===null?50:timestampMs-this.lastTimestamp;
    if(!samples.every(finiteSample)||timestampMs!==undefined&&!Number.isFinite(timestampMs)||!Number.isFinite(dt)||dt<=0)return this.getPose();
    if(timestampMs!==undefined)this.lastTimestamp=timestampMs;
    const depthAlpha=1-Math.pow(0.35,dt/50),anchorAlpha=1-Math.pow(0.3,dt/50);
    const targets:[THREE.Vector3,THREE.Vector3]=[new THREE.Vector3(),new THREE.Vector3()];
    const nextDepths:[number,number]=[this.depths[0],this.depths[1]];
    for(const i of [0,1] as const) {
      const depth=THREE.MathUtils.clamp(this.initialDepths[i]*this.palmSpans[i]/samples[i].palmSpan,this.initialDepths[i]*0.45,this.initialDepths[i]*2.2);
      nextDepths[i]+=(depth-nextDepths[i])*depthAlpha;
      targets[i].copy(unprojectGrip(samples[i].point,nextDepths[i],p));
    }
    // Crossing or coincident detections provide no stable contact line. Keep the
    // last pose until the controller resolves ownership instead of spinning it.
    if(targets[0].distanceTo(targets[1])<0.5)return this.getPose();
    const nextAnchors:[THREE.Vector3,THREE.Vector3]=[this.anchors[0].clone().lerp(targets[0],anchorAlpha),this.anchors[1].clone().lerp(targets[1],anchorAlpha)];
    const line=nextAnchors[1].clone().sub(nextAnchors[0]);
    if(line.length()<0.5||line.clone().normalize().dot(this.currentLine)<-0.98)return this.getPose();
    for(const i of [0,1] as const){this.depths[i]=nextDepths[i];this.anchors[i].copy(nextAnchors[i]);}
    // Transport the contact frame incrementally: an intentional continuous turn
    // can pass 180 degrees without setFromUnitVectors choosing a new swing axis.
    line.normalize();this.lineRotation.premultiply(new THREE.Quaternion().setFromUnitVectors(this.currentLine,line)).normalize();this.currentLine.copy(line);
    const lineRotation=this.lineRotation.clone();
    let targetTwist=0;
    for(const i of [0,1] as const) {
      const residual=lineRotation.clone().invert().multiply(samples[i].rotation.clone().normalize().multiply(this.initialRotations[i].clone().invert()));
      const component=new THREE.Vector3(residual.x,residual.y,residual.z).dot(this.initialLine);
      let angle=2*Math.atan2(component,residual.w);
      if(angle>Math.PI)angle-=2*Math.PI;if(angle<-Math.PI)angle+=2*Math.PI;
      targetTwist+=THREE.MathUtils.clamp(angle,-Math.PI/4,Math.PI/4)/2;
    }
    this.twist+=(targetTwist-this.twist)*depthAlpha;
    const delta=lineRotation.multiply(new THREE.Quaternion().setFromAxisAngle(this.initialLine,this.twist));
    this.held={position:this.anchors[0].clone().add(this.anchors[1]).multiplyScalar(0.5).add(this.offset.clone().applyQuaternion(delta)),rotation:delta.multiply(this.initialRotation),scale:this.scale};
    return this.getPose();
  }
  getPose():HeldPose {return {position:this.held.position.clone(),rotation:this.held.rotation.clone(),scale:this.scale};}
}
