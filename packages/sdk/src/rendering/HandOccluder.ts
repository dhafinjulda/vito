/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import type { TrackedHand } from '../interaction/HandGrip';
import { mapCoverPoint } from '../glasses/coordinates';
import { worldPerPixel, type Projection } from '../glasses/fitting';

/** Approximate depth-only fingers/palm, anchored to the active grip depth. */
export class HandOccluder extends THREE.Group {
  private readonly joints:THREE.InstancedMesh;
  private readonly bones:THREE.InstancedMesh;
  private readonly palm:THREE.Mesh;
  private readonly points=Array.from({length:21},()=>new THREE.Vector3());
  private readonly instanceTransform=new THREE.Matrix4();
  private readonly boneRotation=new THREE.Quaternion();
  private readonly vector=new THREE.Vector3();
  private readonly midpoint=new THREE.Vector3();
  private readonly instanceScale=new THREE.Vector3();
  private readonly identityRotation=new THREE.Quaternion();
  private readonly y=new THREE.Vector3(0,1,0);
  private disposed=false;
  private readonly links=Array.from({length:5},(_,f)=>Array.from({length:4},(_,j)=>[j===0?0:f*4+j,f*4+j+1])).flat();
  constructor(material:THREE.Material) {
    super();
    this.joints=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),material,21);
    this.bones=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,6),material,20);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(15),3));geometry.setIndex([0,1,2,0,2,3,0,3,4]);
    this.palm=new THREE.Mesh(geometry,material);this.add(this.joints,this.bones,this.palm);
    this.children.forEach(mesh=>{mesh.frustumCulled=false;mesh.renderOrder=-110;});this.visible=false;
  }
  update(hand:TrackedHand,depth:number,p:Projection,anchorZ?:number) {
    if(this.disposed)return;
    const landmarks=hand?.landmarks;
    if(!Array.isArray(landmarks)||landmarks.length!==21){this.clearSample();return;}
    for(let i=0;i<21;i++){const point=landmarks[i];if(!point||![point.x,point.y,point.z].every(Number.isFinite)){this.clearSample();return;}}
    const k=p.intrinsics;
    if(!Number.isFinite(depth)||depth<5||depth>500||anchorZ!==undefined&&!Number.isFinite(anchorZ)||
      ![p.width,p.height,p.videoWidth,p.videoHeight].every(value=>Number.isFinite(value)&&value>0)||
      !Number.isFinite(p.fov)||p.fov<=0||p.fov>=180||
      k&&(![k.fx,k.fy].every(value=>Number.isFinite(value)&&value>0)||![k.cx,k.cy].every(Number.isFinite))) {this.clearSample();return;}
    const contactZ=anchorZ??(landmarks[4]!.z+landmarks[8]!.z)/2;
    const zScale=k?p.videoWidth*depth/k.fx:p.videoWidth*Math.max(p.width/p.videoWidth,p.height/p.videoHeight)*worldPerPixel(depth,p);
    if(!Number.isFinite(zScale)){this.clearSample();return;}
    for(let i=0;i<21;i++) {
      const point=landmarks[i]!,d=THREE.MathUtils.clamp(depth+(point.z-contactZ)*zScale,5,500),world=this.points[i]!;
      if(k)world.set((point.x*p.videoWidth-k.cx)*d/k.fx,(k.cy-point.y*p.videoHeight)*d/k.fy,-d);
      else {const screen=mapCoverPoint(point.x,point.y,p.videoWidth,p.videoHeight,p.width,p.height),units=worldPerPixel(d,p);world.set(screen.x*units,screen.y*units,-d);}
      // Bound the geometry to a generous 10 m lateral workspace as well as the
      // camera depth range. Malformed huge values must not overflow bone math.
      if(![world.x,world.y,world.z].every(value=>Number.isFinite(value)&&Math.abs(value)<=1000)){this.clearSample();return;}
    }
    const radius=THREE.MathUtils.clamp(this.points[0]!.distanceTo(this.points[9]!)*0.065,0.18,0.42);
    for(let i=0;i<21;i++) {
      const r=[4,8,12,16,20].includes(i)?radius*0.65:radius;
      this.instanceScale.setScalar(r);this.instanceTransform.compose(this.points[i]!,this.identityRotation,this.instanceScale);this.joints.setMatrixAt(i,this.instanceTransform);
    }
    this.links.forEach(([a,b],i)=>{
      this.vector.copy(this.points[b!]!).sub(this.points[a!]!);const length=this.vector.length();
      if(length>1e-8)this.boneRotation.setFromUnitVectors(this.y,this.vector.multiplyScalar(1/length));else this.boneRotation.identity();
      this.midpoint.copy(this.points[a!]!).add(this.points[b!]!).multiplyScalar(0.5);
      this.instanceScale.set(radius,Math.max(length,0.001),radius);this.instanceTransform.compose(this.midpoint,this.boneRotation,this.instanceScale);this.bones.setMatrixAt(i,this.instanceTransform);
    });
    const position=this.palm.geometry.getAttribute('position') as THREE.BufferAttribute;
    [0,5,9,13,17].forEach((index,i)=>position.setXYZ(i,this.points[index]!.x,this.points[index]!.y,this.points[index]!.z));
    position.needsUpdate=true;this.joints.instanceMatrix.needsUpdate=this.bones.instanceMatrix.needsUpdate=true;this.visible=true;
  }
  clearSample() {
    this.visible=false;this.points.forEach(point=>point.set(0,0,0));(this.palm.geometry.getAttribute('position').array as Float32Array).fill(0);
    (this.joints.instanceMatrix.array as Float32Array).fill(0);(this.bones.instanceMatrix.array as Float32Array).fill(0);
    this.palm.geometry.getAttribute('position').needsUpdate=true;
    this.joints.instanceMatrix.needsUpdate=this.bones.instanceMatrix.needsUpdate=true;
  }
  dispose() {if(this.disposed)return;this.disposed=true;this.clearSample();this.joints.geometry.dispose();this.bones.geometry.dispose();this.palm.geometry.dispose();this.joints.dispose();this.bones.dispose();}
}

