/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import type {VirtualTryOnOptions} from '../types';
type OpticsOptions=Exclude<NonNullable<VirtualTryOnOptions['lensOptics']>,false>;
export interface LensOpticsHandle {materials:THREE.MeshPhysicalMaterial[];setScale(scale:number):void;restore():void}
export function validateLensOptics(options:OpticsOptions):void {
  const ior=options.ior??1.5,thicknessMm=options.thicknessMm??2,transmission=options.transmission??0.95;
  if(!Number.isFinite(ior)||ior<1||ior>2.333||!Number.isFinite(thicknessMm)||thicknessMm<0||thicknessMm>20||!Number.isFinite(transmission)||transmission<0||transmission>1)throw new Error('Invalid lens optics: IOR 1–2.333, thickness 0–20 mm, transmission 0–1.');
}
export function installLensOptics(root:THREE.Object3D,options:OpticsOptions):LensOpticsHandle {
  validateLensOptics(options);
  const ior=options.ior??1.5,thicknessMm=options.thicknessMm??2,transmission=options.transmission??0.95;
  const materials:THREE.MeshPhysicalMaterial[]=[];
  const originals:Array<{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[]}>=[];
  root.traverse(node=>{
    if(!(node instanceof THREE.Mesh)||!/^lens(?:[-_ ]|$)/i.test(node.name))return;
    const source=Array.isArray(node.material)?node.material:[node.material];
    originals.push({mesh:node,material:node.material});
    const converted=source.map(original=>{
      if(!(original instanceof THREE.MeshStandardMaterial))return original;
      const material=original instanceof THREE.MeshPhysicalMaterial?original.clone():new THREE.MeshPhysicalMaterial({color:original.color.clone(),map:original.map,normalMap:original.normalMap,roughnessMap:original.roughnessMap,metalnessMap:original.metalnessMap,alphaMap:original.alphaMap,side:original.side});
      material.ior=ior;material.transmission=transmission;material.roughness=Math.min(original.roughness,0.12);material.metalness=0;material.opacity=1;material.transparent=false;material.depthWrite=true;
      material.name=`${original.name}-vto-optics`;materials.push(material);return material;
    });
    node.material=Array.isArray(node.material)?converted:converted[0]!;
  });
  let restored=false;
  return {materials,setScale(scale){if(Number.isFinite(scale)&&scale>0)for(const material of materials)material.thickness=thicknessMm/10/scale;},restore(){if(restored)return;restored=true;for(const entry of originals)entry.mesh.material=entry.material;for(const material of materials)material.dispose();materials.length=originals.length=0;}};
}
