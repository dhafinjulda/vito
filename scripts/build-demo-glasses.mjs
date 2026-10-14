/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { readFileSync, writeFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../examples/vanilla/src/glasses-manifest.json', import.meta.url), 'utf8'));

// Original demonstration designs; this is a build-time fixture utility.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};

function contour(cx, cy, halfWidth, halfHeight, radius) {
  const points = [];
  const corners = [[1,1,0],[-1,1,Math.PI/2],[-1,-1,Math.PI],[1,-1,3*Math.PI/2]];
  for (const [sx,sy,start] of corners) {
    for(let i=0;i<=16;i++) {
      const angle=start+i/16*Math.PI/2;
      const x=cx+sx*(halfWidth-radius)+Math.cos(angle)*radius;
      const y=cy+sy*(halfHeight-radius)+Math.sin(angle)*radius;
      points.push(new THREE.Vector3(x,y,-0.10*Math.pow(x/1.25,2)));
    }
  }
  return points;
}

function tube(points, radius, material, closed=false, name='') {
  const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal');
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve, closed?128:48,radius,10,closed),material);
  mesh.name=name;
  return mesh;
}

async function build(asset) {
  const { design: kind, file: filename } = asset;
  const scene=new THREE.Group(); scene.name=kind==='acetate'?'Contour Acetate':'Linea Titanium';
  const frame=new THREE.MeshPhysicalMaterial({color:kind==='acetate'?0x202b26:0xbb9d6d,metalness:kind==='acetate'?0:0.85,roughness:kind==='acetate'?0.18:0.25,clearcoat:1,clearcoatRoughness:0.13});
  const hardware=new THREE.MeshStandardMaterial({color:0xb9a16a,metalness:0.9,roughness:0.22});
  const tips=new THREE.MeshPhysicalMaterial({color:0x272723,roughness:0.35,clearcoat:0.7});
  const lens=new THREE.MeshPhysicalMaterial({color:0xd9e8e4,transparent:true,opacity:0.12,roughness:0.08,metalness:0,clearcoat:1,side:THREE.DoubleSide,depthWrite:false});
  const radius=kind==='acetate'?0.047:0.026;
  const halfHeight=kind==='acetate'?0.34:0.37;
  for(const side of [-1,1]) {
    const sideName=side<0?'left':'right';
    const outline=contour(side*0.64,-0.13,0.52,halfHeight,kind==='acetate'?0.14:0.24);
    scene.add(tube(outline,radius,frame,true,`rim-${sideName}`));
    const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(p.x,p.y)));
    const lensGeometry=new THREE.ShapeGeometry(shape,32);
    const vertices=lensGeometry.attributes.position;
    for(let i=0;i<vertices.count;i++) vertices.setZ(i,-0.10*Math.pow(vertices.getX(i)/1.25,2)+0.008);
    lensGeometry.computeVertexNormals();
    const lensMesh=new THREE.Mesh(lensGeometry,lens); lensMesh.name=`clear-lens-${sideName}`; scene.add(lensMesh);
    scene.add(tube([new THREE.Vector3(side*1.14,0.03,-0.085),new THREE.Vector3(side*1.21,0.015,-0.24),new THREE.Vector3(side*1.20,-0.015,-1.35),new THREE.Vector3(side*1.14,-0.08,-1.82)],kind==='acetate'?0.038:0.022,frame,false,`temple-${sideName}`));
    scene.add(tube([new THREE.Vector3(side*1.14,-0.08,-1.76),new THREE.Vector3(side*1.10,-0.14,-2.00),new THREE.Vector3(side*1.03,-0.31,-2.16)],0.041,tips,false,`ear-tip-${sideName}`));
    const hinge=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.075,0.13),hardware);hinge.position.set(side*1.17,0.03,-0.13);hinge.name=`hinge-${sideName}`;scene.add(hinge);
    if(kind!=='acetate') {
      const pad=new THREE.Mesh(new THREE.SphereGeometry(0.052,16,10),new THREE.MeshPhysicalMaterial({color:0xe6e0cf,transparent:true,opacity:0.6,roughness:0.3}));
      pad.scale.set(0.7,1.5,0.55);pad.position.set(side*0.14,-0.13,-0.075);pad.name=`nose-pad-${side}`;scene.add(pad);
    }
  }
  scene.add(tube([new THREE.Vector3(-0.14,0.035,0),new THREE.Vector3(-0.065,0.075,0.025),new THREE.Vector3(0.065,0.075,0.025),new THREE.Vector3(0.14,0.035,0)],radius*0.8,frame,false,'bridge'));
  scene.userData={demo:true,vtoGlasses:{schemaVersion:manifest.schemaVersion,id:asset.id,label:asset.label,coordinateSystem:manifest.coordinateSystem,fit:asset.fit,nominalDimensionsMm:asset.nominalDimensionsMm,partNames:asset.partNames,assetProvenance:asset.assetProvenance}};
  const exporter=new GLTFExporter();
  const glb=await exporter.parseAsync(scene,{binary:true});
  writeFileSync(new URL(`../examples/vanilla/public/${filename}`,import.meta.url),Buffer.from(glb));
  console.log(`${filename}: ${glb.byteLength} bytes`);
}
for (const asset of manifest.assets) await build(asset);
