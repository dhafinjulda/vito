/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
// Development-only renderer harness. The main Vanilla consumer uses the public API.
import * as THREE from 'three';
import { GlassesRenderer } from '../../../packages/sdk/src/rendering/GlassesRenderer';
import { syntheticFrame } from '../../../packages/sdk/test/synthetic-frame';
import { CANONICAL_BRIDGE } from '../../../packages/sdk/src/glasses/face-topology';
import { GlassesInteraction } from '../../../packages/sdk/src/interaction/GlassesInteraction';
import type { TrackedHand } from '../../../packages/sdk/src/interaction/HandGrip';
import { demoGlassesManifest, getDemoFit } from './demo-assets';
import { registerOfflineExample } from './offline';
import './style.css';

registerOfflineExample();

const result = document.querySelector<HTMLElement>('#result')!;
const selector = document.querySelector<HTMLSelectElement>('#asset')!;
const occlusion = document.querySelector<HTMLInputElement>('#occlusion')!;
const distanceControl = document.querySelector<HTMLInputElement>('#distance-control')!;
const pitchControl = document.querySelector<HTMLInputElement>('#pitch-control')!;
const placementControl = document.querySelector<HTMLInputElement>('#placement-control')!;
const profileSide = document.querySelector<HTMLSelectElement>('#profile-side')!;
const lightingMode = document.querySelector<HTMLSelectElement>('#lighting-mode')!;
const effectsMode = document.querySelector<HTMLInputElement>('#effects-mode')!;
const assets = demoGlassesManifest.assets.map(asset => `/${asset.file}`);
let fit = getDemoFit();
let busy = false;
function setBusy(value: boolean) {
  busy = value;
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input, button, select').forEach(control => { control.disabled = value; });
}
function makeFrame(yaw: number, distance: number, pitch = 0) {
  return syntheticFrame(yaw, pitch, 0, 1280, 720, distance + CANONICAL_BRIDGE[2] * Math.cos(THREE.MathUtils.degToRad(yaw)) * Math.cos(THREE.MathUtils.degToRad(pitch)) - CANONICAL_BRIDGE[1] * Math.sin(THREE.MathUtils.degToRad(pitch)));
}
const views = ['front', 'oblique', 'profile'].map((id, index) => {
  const renderer = new GlassesRenderer(document.querySelector<HTMLCanvasElement>(`#${id}`)!, { smoothing: true, fit });
  const yaw = [0, 45, 84][index]!;
  const frame = makeFrame(yaw, 30);
  const background = new THREE.Scene();
  background.environment = renderer.scene.environment;
  const face = new THREE.Mesh(renderer.occluder.geometry, new THREE.MeshStandardMaterial({ color: 0xbaa693, roughness: 0.85, side: THREE.DoubleSide }));
  face.frustumCulled = false;
  const head = new THREE.Group();
  renderer.headOccluder.children.forEach(() => { const mesh = new THREE.Mesh(renderer.headOccluder.geometry, face.material); mesh.frustumCulled = false; head.add(mesh); });
  head.visible = true;
  background.add(head, face, new THREE.HemisphereLight(0xfff7ed, 0x515d51, 3));
  return { renderer, frame, background, head, face, yaw };
});

function draw() {
  for (const { renderer, background, head } of views) {
    renderer.occluder.visible = occlusion.checked;
    renderer.headOccluder.visible = occlusion.checked;
    head.position.copy(renderer.headOccluder.position);
    head.quaternion.copy(renderer.headOccluder.quaternion);
    head.children.forEach((node, i) => { node.position.copy(renderer.headOccluder.children[i]!.position); node.scale.copy(renderer.headOccluder.children[i]!.scale); });
    const gpu = renderer.renderer;
    gpu.autoClear = false;
    gpu.clear();
    gpu.render(background, renderer.camera);
    gpu.clearDepth();
    renderer.render(true);
    gpu.autoClear = true;
  }
}

function depthProbe(renderer: GlassesRenderer) {
  const target = new THREE.WebGLRenderTarget(1024, 1024);
  const pixel = new Uint8Array(4);
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xff00ff, toneMapped: false }));
  const nose = new THREE.Vector3().fromBufferAttribute(renderer.occluder.geometry.attributes.position!, 4);
  const groups = renderer.scene.children.filter(node => node instanceof THREE.Group && node !== renderer.headOccluder && node !== renderer.handOccluder);
  const asset = groups[0]!;
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(renderer.headOccluder.quaternion);
  const nearSide = normal.x < 0 ? 1 : -1;
  renderer.scene.updateMatrixWorld(true);
  const visibility = groups.map(group => group.visible);
  groups.forEach(group => { group.visible = false; });
  renderer.scene.add(marker);
  function sample(position: THREE.Vector3, occlude: boolean, head = occlude) {
    marker.position.copy(position);
    renderer.occluder.visible = occlude;
    renderer.headOccluder.visible = head;
    const screen = marker.position.clone().project(renderer.camera);
    renderer.renderer.setRenderTarget(target);
    renderer.render(true);
    renderer.renderer.readRenderTargetPixels(target, Math.floor((screen.x + 1) * 512), Math.floor((screen.y + 1) * 512), 1, 1, pixel);
    return pixel[0]! > 180 && pixel[2]! > 180 && pixel[1]! < 50 && pixel[3]! > 180;
  }
  try {
    const behind = nose.clone().add(new THREE.Vector3(0, 0, -3));
    const front = nose.clone().add(new THREE.Vector3(0, 0, 3));
    const face = !sample(behind, true) && sample(behind, false) && sample(front, true);
    // Probe actual model-space ear-tip and front-temple locations on both sides.
    const rear = [-1, 1].map(side => {
      const tip = new THREE.Vector3(side * 1.03, -0.31, -2.16).applyMatrix4(asset.matrixWorld);
      return !sample(tip, true) && sample(tip, false);
    });
    const rim = new THREE.Vector3(nearSide, -0.13, 0).applyMatrix4(asset.matrixWorld);
    const frontVisible = sample(rim, true);
    const nearTip = new THREE.Vector3(nearSide * 1.03, -0.31, -2.16).applyMatrix4(asset.matrixWorld);
    const headAddsCoverage = sample(nearTip, true, false) && !sample(nearTip, true, true);
    return { face, rear, frontVisible, headAddsCoverage, pass: face && rear.every(Boolean) && frontVisible };
  } finally {
    renderer.renderer.setRenderTarget(null);
    renderer.scene.remove(marker);
    groups.forEach((group, i) => { group.visible = visibility[i]!; });
    marker.geometry.dispose(); marker.material.dispose(); target.dispose();
  }
}

/** Check every rasterized fragment of the actual GLB ear hooks, not just an endpoint. */
function earHookProbe(renderer: GlassesRenderer) {
  const target = new THREE.WebGLRenderTarget(1024, 1024);
  const pixels = new Uint8Array(1024 * 1024 * 4);
  const probe = new THREE.MeshBasicMaterial({ color: 0xff00ff, toneMapped: false });
  const asset = renderer.scene.children.find(node => node instanceof THREE.Group && node !== renderer.headOccluder && node !== renderer.handOccluder)!;
  const meshes: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[]; visible: boolean }[] = [];
  asset.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    meshes.push({ mesh: node, material: node.material, visible: node.visible });
    node.visible = node.name.startsWith('ear-tip-');
    if (node.visible) node.material = probe;
  });
  const hooks = meshes.filter(item => item.mesh.visible).length;
  function count(mask: boolean) {
    renderer.occluder.visible = mask;
    renderer.headOccluder.visible = mask;
    renderer.renderer.setRenderTarget(target);
    renderer.render(true);
    renderer.renderer.readRenderTargetPixels(target, 0, 0, 1024, 1024, pixels);
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! > 180 && pixels[i + 2]! > 180 && pixels[i + 1]! < 50 && pixels[i + 3]! > 180) count++;
    return count;
  }
  try {
    const unmaskedPixels = count(false);
    const maskedPixels = count(true);
    return { hooks, unmaskedPixels, maskedPixels, pass: hooks === 2 && unmaskedPixels > 0 && maskedPixels === 0 };
  } finally {
    meshes.forEach(({ mesh, material, visible }) => { mesh.material = material; mesh.visible = visible; });
    renderer.renderer.setRenderTarget(null);
    probe.dispose(); target.dispose();
  }
}

/** Read back the actual GLB before/after the GLSL effect toggle. */
function templeShaderProbe(renderer: GlassesRenderer) {
  const target = new THREE.WebGLRenderTarget(512, 512, { depthBuffer: true, stencilBuffer: false });
  const withoutEffects = new Uint8Array(512 * 512 * 4);
  const withEffects = new Uint8Array(512 * 512 * 4);
  const faceVisible = renderer.occluder.visible;
  const headVisible = renderer.headOccluder.visible;
  renderer.occluder.visible = false;
  renderer.headOccluder.visible = false;
  try {
    renderer.setTempleEffectsEnabled(false);
    renderer.renderer.setRenderTarget(target);
    renderer.render(true);
    renderer.renderer.readRenderTargetPixels(target, 0, 0, 512, 512, withoutEffects);
    renderer.setTempleEffectsEnabled(true);
    renderer.render(true);
    renderer.renderer.readRenderTargetPixels(target, 0, 0, 512, 512, withEffects);
    let changedPixels = 0;
    for (let i = 0; i < withoutEffects.length; i += 4) {
      if (Math.abs(withoutEffects[i]! - withEffects[i]!) + Math.abs(withoutEffects[i + 1]! - withEffects[i + 1]!) + Math.abs(withoutEffects[i + 2]! - withEffects[i + 2]!) > 18) changedPixels++;
    }
    const programs = renderer.renderer.info.programs?.filter(program => program.usedTimes > 0).length ?? 0;
    return { namedTempleMeshes: renderer.templeEffectMeshCount, changedPixels, programs, pass: renderer.templeEffectMeshCount >= 2 && changedPixels > 0 && programs > 0 };
  } finally {
    renderer.setTempleEffectsEnabled(true);
    renderer.renderer.setRenderTarget(null);
    renderer.occluder.visible = faceVisible;
    renderer.headOccluder.visible = headVisible;
    target.dispose();
  }
}

/** Confirm the near-side temple remains visible through the real depth masks. */
function templeVisibilityProbe(renderer: GlassesRenderer) {
  const target = new THREE.WebGLRenderTarget(512, 512);
  const pixels = new Uint8Array(512 * 512 * 4);
  const probe = new THREE.MeshBasicMaterial({ color: 0xff00ff, toneMapped: false });
  const asset = renderer.scene.children.find(node => node instanceof THREE.Group && node !== renderer.headOccluder && node !== renderer.handOccluder)!;
  const meshes: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[]; visible: boolean }[] = [];
  asset.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    meshes.push({ mesh: node, material: node.material, visible: node.visible });
    node.visible = node.name.startsWith('temple-');
    if (node.visible) node.material = probe;
  });
  const temples = meshes.filter(item => item.mesh.visible).length;
  function count(mask: boolean) {
    renderer.occluder.visible = mask;
    renderer.headOccluder.visible = mask;
    renderer.renderer.setRenderTarget(target);
    renderer.render(true);
    renderer.renderer.readRenderTargetPixels(target, 0, 0, 512, 512, pixels);
    let visiblePixels = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! > 180 && pixels[i + 2]! > 180 && pixels[i + 1]! < 50 && pixels[i + 3]! > 180) visiblePixels++;
    return visiblePixels;
  }
  try {
    const unmaskedPixels = count(false);
    const maskedPixels = count(true);
    return { temples, unmaskedPixels, maskedPixels, pass: temples === 2 && unmaskedPixels > 0 && maskedPixels > 0 };
  } finally {
    meshes.forEach(({ mesh, material, visible }) => { mesh.material = material; mesh.visible = visible; });
    renderer.renderer.setRenderTarget(null);
    probe.dispose(); target.dispose();
  }
}

function tiltedProfileProbe(view: typeof views[number], distance: number) {
  const yaw = view.yaw;
  const yawRadians = THREE.MathUtils.degToRad(yaw);
  const depth = distance + CANONICAL_BRIDGE[2] * Math.cos(yawRadians);
  const frame = syntheticFrame(yaw, 12, 8, 1280, 720, depth);
  view.renderer.setPose(frame.landmarks, 1280, 720, frame.matrix, performance.now() + 35);
  try {
    const hooks = earHookProbe(view.renderer);
    const temple = templeVisibilityProbe(view.renderer);
    const effects = templeShaderProbe(view.renderer);
    return { pitchDegrees: 12, rollDegrees: 8, hooks, temple, effects, pass: hooks.pass && temple.pass && effects.pass };
  } finally {
    view.renderer.setPose(view.frame.landmarks, 1280, 720, view.frame.matrix, performance.now() + 70);
  }
}

function syntheticLightSample(rgb: [number, number, number]) {
  const width = 32, height = 24;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const isBorder = x < 6 || x >= width - 6 || y < 5 || y >= height - 5;
    const color = isBorder ? rgb : [202, 164, 142];
    const offset = (y * width + x) * 4;
    rgba[offset] = color[0]!; rgba[offset + 1] = color[1]!; rgba[offset + 2] = color[2]!; rgba[offset + 3] = 255;
  }
  return { rgba, width, height };
}

function localLightingProbe(renderer: GlassesRenderer) {
  const target = new THREE.WebGLRenderTarget(256, 256);
  const warmPixels = new Uint8Array(256 * 256 * 4);
  const coolPixels = new Uint8Array(256 * 256 * 4);
  const warmInput = syntheticLightSample([188, 120, 65]);
  const coolInput = syntheticLightSample([55, 102, 182]);
  renderer.clearLocalAmbientSample();
  try {
    const warm = renderer.setLocalAmbientSample(warmInput.rgba, warmInput.width, warmInput.height, 10_000);
    renderer.renderer.setRenderTarget(target);
    renderer.render(true);
    renderer.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, warmPixels);
    const cool = renderer.setLocalAmbientSample(coolInput.rgba, coolInput.width, coolInput.height, 10_650);
    renderer.render(true);
    renderer.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, coolPixels);
    let changedPixels = 0;
    for (let i = 0; i < warmPixels.length; i += 4) if (Math.abs(warmPixels[i]! - coolPixels[i]!) + Math.abs(warmPixels[i + 1]! - coolPixels[i + 1]!) + Math.abs(warmPixels[i + 2]! - coolPixels[i + 2]!) > 0) changedPixels++;
    const pass = !!warm && !!cool && warm.color[0] > warm.color[2] && cool.color[2] > cool.color[0] && changedPixels > 0;
    return { warmLuminance: warm?.luminance ?? null, coolLuminance: cool?.luminance ?? null, confidence: [warm?.confidence ?? 0, cool?.confidence ?? 0], changedPixels, pass };
  } finally {
    renderer.clearLocalAmbientSample();
    renderer.renderer.setRenderTarget(null);
    target.dispose();
  }
}

function pitchProbe(view: typeof views[number]) {
  const { renderer, frame } = view;
  const target = new THREE.WebGLRenderTarget(256, 256);
  const pixels = new Uint8Array(256 * 256 * 4);
  try {
    return [-80, -70, -45, 45, 70, 80].map(pitch => {
      const tilted = makeFrame(0, Number(distanceControl.value), pitch);
      renderer.setPose(null, 1280, 720);
      const state = renderer.setPose(tilted.landmarks, 1280, 720, tilted.matrix);
      renderer.renderer.setRenderTarget(target);
      renderer.render(true);
      renderer.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels);
      let visiblePixels = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 0) visiblePixels++;
      return { pitch, visible: state?.visible ?? false, visiblePixels, pass: !!state?.visible && visiblePixels > 0 };
    });
  } finally {
    renderer.renderer.setRenderTarget(null);
    target.dispose();
    renderer.setPose(null, 1280, 720);
    renderer.setPose(frame.landmarks, 1280, 720, frame.matrix);
  }
}

function gripProbe(view:typeof views[number]) {
  const {renderer,frame}=view;
  const model=renderer.scene.children.find(node=>node instanceof THREE.Group&&node!==renderer.headOccluder&&node!==renderer.handOccluder)!;
  const target=new THREE.WebGLRenderTarget(256,256),pixels=new Uint8Array(256*256*4),masked=new Uint8Array(pixels.length);
  const control=new GlassesInteraction(true);control.setAvailability('ready');
  try {
    model.updateMatrixWorld(true);
    const bridge=model.getObjectByName('bridge')!;
    const world=new THREE.Box3().setFromObject(bridge).getCenter(new THREE.Vector3()),p=renderer.getGrabContext()!.projection;
    const ndc=world.project(renderer.camera),cover=Math.max(p.width/p.videoWidth,p.height/p.videoHeight);
    const point={x:0.5+ndc.x*p.width/(2*p.videoWidth*cover),y:0.5-ndc.y*p.height/(2*p.videoHeight*cover)};
    const hand=(dx=0,twist=0):TrackedHand=>{
      const span=0.08,points=Array.from({length:21},()=>({x:point.x+dx,y:point.y+0.04,z:0}));
      points[0]={x:point.x+dx,y:point.y+span,z:0};points[9]={x:point.x+dx,y:point.y,z:0};
      points[5]={x:point.x+dx-0.04,y:point.y+0.02,z:0};points[17]={x:point.x+dx+0.04,y:point.y+0.02,z:0};
      points[4]={x:point.x+dx-0.005,y:point.y,z:0};points[8]={x:point.x+dx+0.005,y:point.y,z:0};
      const aspect=p.videoWidth/p.videoHeight;
      return {handedness:'Right',landmarks:points.map(q=>{const x=(q.x-point.x-dx)*aspect,y=point.y-q.y;return {x:point.x+dx+(x*Math.cos(twist)-y*Math.sin(twist))/aspect,y:point.y-(x*Math.sin(twist)+y*Math.cos(twist)),z:q.z};})};
    };
    const apply=(h:TrackedHand,t:number)=>{control.update([h],t,renderer.getGrabContext());renderer.setHeldPose(control.heldPose,control.occludingHand);};
    const initialPosition=model.position.clone(),initialRotation=model.quaternion.clone();
    apply(hand(),1000);apply(hand(),1080);
    const acquired=control.snapshot().phase==='dragging';
    const noJump=model.position.distanceTo(initialPosition)<0.01;
    apply(hand(0.08,0.8),1160);apply(hand(0.08,0.8),1240);
    const lateralCm=model.position.x-initialPosition.x,rotationRadians=model.quaternion.angleTo(initialRotation);
    renderer.setPose(null,1280,720);control.onFaceLost();apply(hand(0.08,0.8),1320);
    const survivesFaceLoss=model.visible&&control.snapshot().phase==='dragging';
    renderer.renderer.setRenderTarget(target);renderer.handOccluder.visible=false;renderer.render(true);renderer.renderer.readRenderTargetPixels(target,0,0,256,256,pixels);
    renderer.handOccluder.visible=true;renderer.render(true);renderer.renderer.readRenderTargetPixels(target,0,0,256,256,masked);
    let unmaskedPixels=0,maskedPixels=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]!>0) unmaskedPixels++;if(masked[i]!>0) maskedPixels++;}
    const fingerOcclusion=maskedPixels<unmaskedPixels&&maskedPixels>0;
    return {acquired,noJump,lateralCm,rotationRadians,survivesFaceLoss,unmaskedPixels,maskedPixels,fingerOcclusion,pass:acquired&&noJump&&lateralCm>1&&rotationRadians>0.3&&survivesFaceLoss&&fingerOcclusion};
  } finally {
    renderer.renderer.setRenderTarget(null);target.dispose();renderer.setHeldPose(null);renderer.setPose(frame.landmarks,1280,720,frame.matrix);control.reset();
  }
}

function placementProbe(view: typeof views[number]) {
  const { renderer } = view;
  const target = new THREE.WebGLRenderTarget(256, 256);
  const facePixels = new Uint8Array(256 * 256 * 4), headPixels = new Uint8Array(facePixels.length);
  const headPosition = renderer.headOccluder.position.clone();
  const headRotation = renderer.headOccluder.quaternion.clone();
  try {
    renderer.renderer.setRenderTarget(target);
    renderer.setPlacementProgress(0); renderer.render(true);
    renderer.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, facePixels);
    renderer.setPlacementProgress(1); renderer.render(true);
    renderer.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, headPixels);
    let headVisiblePixels = 0, changedPixels = 0;
    for (let i = 0; i < headPixels.length; i += 4) {
      if (headPixels[i + 3]! > 0) headVisiblePixels++;
      if (headPixels[i] !== facePixels[i] || headPixels[i + 1] !== facePixels[i + 1] || headPixels[i + 2] !== facePixels[i + 2] || headPixels[i + 3] !== facePixels[i + 3]) changedPixels++;
    }
    const maskUnchanged = renderer.headOccluder.position.distanceTo(headPosition) < 1e-6 && renderer.headOccluder.quaternion.angleTo(headRotation) < 1e-6;
    return { headVisiblePixels, changedPixels, maskUnchanged, pass: headVisiblePixels > 0 && changedPixels > 0 && maskUnchanged };
  } finally {
    renderer.renderer.setRenderTarget(null); target.dispose(); renderer.setPlacementProgress(0);
  }
}

async function load() {
  if (busy) return;
  setBusy(true);
  result.dataset.result = 'running';
  delete result.dataset.checks;
  result.textContent = 'Memuat bingkai…';
  try {
    pitchControl.value = '0';
    placementControl.value = '0'; views.forEach(view => view.renderer.setPlacementProgress(0));
    document.querySelector<HTMLOutputElement>('#pitch-value')!.value = '0°';
    views.forEach(view => { view.frame = makeFrame(view.yaw, Number(distanceControl.value)); });
    const selectedIndex = Number(selector.value);
    const selectedAsset = demoGlassesManifest.assets[selectedIndex]!;
    fit = getDemoFit(selectedIndex);
    await Promise.all(views.map(async ({ renderer, frame }) => {
      await renderer.load({ url: assets[selectedIndex]!, fit });
      renderer.setPose(frame.landmarks, 1280, 720, frame.matrix, performance.now());
      renderer.occluder.geometry.computeVertexNormals();
    }));
    if (selectedAsset.license === 'CC0') {
      draw();
      const probes = views.map(({ renderer }) => {
        const model = renderer.scene.children.find(node => node instanceof THREE.Group && node !== renderer.headOccluder && node !== renderer.handOccluder);
        let meshCount = 0;
        model?.traverse(node => { if (node instanceof THREE.Mesh) meshCount++; });
        renderer.render(true);
        return { visible: !!model?.visible, meshCount, textureCount: renderer.renderer.info.memory.textures, webglError: renderer.renderer.getContext().getError() };
      });
      const pass = probes.every(probe => probe.visible && probe.meshCount > 0 && probe.textureCount >= 3 && probe.webglError === WebGLRenderingContext.NO_ERROR);
      result.dataset.checks = JSON.stringify({ cc0Asset: probes });
      result.dataset.result = pass ? 'pass' : 'fail';
      result.textContent = pass
        ? `LULUS · Model CC0 PBR termuat dan dirender pada tiga pose sintetis; ${probes[0]!.meshCount} mesh dan ${probes[0]!.textureCount} tekstur GPU per renderer. Belum menguji kecocokan produk retail atau pengguna nyata.`
        : `GAGAL · Model CC0 tidak siap dirender pada semua pose: ${JSON.stringify(probes)}.`;
      return;
    }
    const checks = views.map(({ renderer }) => depthProbe(renderer));
    const hooks = views.map(({ renderer }) => earHookProbe(renderer));
    const templeEffects = views.map(({ renderer }) => templeShaderProbe(renderer));
    const templeVisibility = views.map(({ renderer }) => templeVisibilityProbe(renderer));
    const tiltedProfile = tiltedProfileProbe(views[2]!, Number(distanceControl.value));
    const localLighting = views.map(({ renderer }) => localLightingProbe(renderer));
    draw();
    const duplicateDrawsSkipped = views.every(({ renderer }) => {
      const frame = renderer.renderer.info.render.frame;
      for (let i = 0; i < 10; i++) renderer.render();
      return renderer.renderer.info.render.frame === frame;
    });
    const pitch = pitchProbe(views[0]!);
    const placement = placementProbe(views[0]!);
    const grip=gripProbe(views[0]!);
    result.dataset.checks = JSON.stringify({ poses: checks, hooks, templeEffects, templeVisibility, tiltedProfile, localLighting, duplicateDrawsSkipped, pitch, placement, grip });
    const pass = checks.every((check, i) => (i !== 0 || check.face && check.rear.every(Boolean) && check.frontVisible) && (i === 0 || check.pass && check.headAddsCoverage)) && hooks.every(check => check.pass) && templeEffects.every(check => check.pass) && templeVisibility.every(check => check.pass) && tiltedProfile.pass && localLighting.every(check => check.pass) && duplicateDrawsSkipped && pitch.every(check => check.pass) && placement.pass;
    result.dataset.result = pass&&grip.pass ? 'pass' : 'fail';
    result.textContent = pass&&grip.pass ? 'LULUS · Grab, gerak bebas, rotasi, occlusion jari dan pegangan saat wajah tertutup lulus pada data sintetis; pemeriksaan fitting dasar juga lulus.' : `GAGAL · Grip ${JSON.stringify(grip)}; baseline ${pass}`;
    draw();
  } catch (error) { result.dataset.result = 'fail'; result.textContent = error instanceof Error ? error.message : 'Pemeriksaan gagal.'; }
  finally { setBusy(false); }
}
document.querySelector<HTMLButtonElement>('#soak')!.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  result.dataset.result = 'running';
  const startIndex = Number(selector.value);
  const cold = views.map(({ renderer }) => ({ ...renderer.renderer.info.memory }));
  try {
    // A transmissive CC0 material lazily allocates a renderer-owned transmission
    // target. Warm every material path before testing per-asset disposal; keep
    // the cold counts visible rather than calling this persistent target a leak.
    for(const nextIndex of [...assets.map((_,i)=>i),startIndex]) {
      await Promise.all(views.map(async({renderer,frame})=>{
        await renderer.load({url:assets[nextIndex]!,fit:getDemoFit(nextIndex)});
        renderer.setPose(frame.landmarks,1280,720,frame.matrix,performance.now());
      }));draw();
    }
    const baseline=views.map(({renderer})=>({...renderer.renderer.info.memory}));
    for (let i = 0; i < 20; i++) {
      result.textContent = `Menguji pergantian aset ${i + 1}/20…`;
      await Promise.all(views.map(async ({ renderer, frame }) => {
        const nextIndex = (startIndex + i + 1) % assets.length;
        await renderer.load({ url: assets[nextIndex]!, fit: getDemoFit(nextIndex) });
        renderer.setPose(frame.landmarks, 1280, 720, frame.matrix, performance.now());
      }));
      draw();
    }
    await Promise.all(views.map(async ({ renderer, frame }) => {
      await renderer.load({ url: assets[startIndex]!, fit: getDemoFit(startIndex) });
      renderer.setPose(frame.landmarks, 1280, 720, frame.matrix, performance.now());
    }));
    draw();
    const after = views.map(({ renderer }) => ({ ...renderer.renderer.info.memory }));
    const pass = after.every((memory, index) => memory.geometries === baseline[index]!.geometries && memory.textures === baseline[index]!.textures);
    result.dataset.result = pass ? 'soak-pass' : 'fail';
    result.dataset.checks=JSON.stringify({cold,baseline,after,swaps:20,warmedAssets:assets.length,pass,scope:'GPU geometry/texture counters after material warmup; not proof of absence of heap leaks.'});
    result.textContent = `${pass ? 'LULUS' : 'GAGAL'} · 20 pergantian tiga aset pada 3 renderer; aset awal dipulihkan. Sebelum warmup: ${cold.map(m=>`${m.geometries}/${m.textures}`).join(', ')}; baseline hangat: ${baseline.map(m => `${m.geometries}/${m.textures}`).join(', ')}; akhir: ${after.map(m => `${m.geometries}/${m.textures}`).join(', ')}. Counter GPU, bukan bukti bebas heap leak.`;
  } catch (error) { result.dataset.result = 'fail'; result.textContent = String(error); }
  finally { setBusy(false); }
});
selector.addEventListener('change', () => void load());
profileSide.addEventListener('change', () => {
  views[2]!.yaw = Number(profileSide.value) * 84;
  views[2]!.frame = makeFrame(views[2]!.yaw, Number(distanceControl.value));
  document.querySelector<HTMLElement>('#profile-caption')!.textContent = `Samping penuh · ${views[2]!.yaw}°`;
  void load();
});
let lightUpdate: number | null = null;
lightingMode.addEventListener('change', () => {
  if (lightUpdate !== null) window.clearInterval(lightUpdate);
  lightUpdate = null;
  if (lightingMode.value === 'default') {
    views.forEach(({ renderer }) => renderer.clearLocalAmbientSample());
    draw();
    return;
  }
  const sample = syntheticLightSample(lightingMode.value === 'warm' ? [188, 120, 65] : [55, 102, 182]);
  const update = () => {
    views.forEach(({ renderer }) => renderer.setLocalAmbientSample(sample.rgba, sample.width, sample.height, performance.now()));
    draw();
  };
  update();
  lightUpdate = window.setInterval(update, 100);
});
occlusion.addEventListener('change', draw);
effectsMode.addEventListener('change', () => {
  views.forEach(({ renderer }) => renderer.setTempleEffectsEnabled(effectsMode.checked));
  draw();
});
document.querySelector<HTMLButtonElement>('#rerun')!.addEventListener('click', () => void load());
window.addEventListener('resize', () => { views.forEach(({ renderer }) => renderer.resize()); draw(); });
distanceControl.addEventListener('input', () => {
  const distance = Number(distanceControl.value);
  document.querySelector<HTMLOutputElement>('#distance-value')!.value = `${distance} cm`;
  views.forEach(view => { view.frame = makeFrame(view.yaw, distance, Number(pitchControl.value)); view.renderer.setPose(view.frame.landmarks, 1280, 720, view.frame.matrix); });
  draw();
});
pitchControl.addEventListener('input', () => {
  const pitch = Number(pitchControl.value);
  document.querySelector<HTMLOutputElement>('#pitch-value')!.value = `${pitch}°`;
  views.forEach(view => {
    view.frame = makeFrame(view.yaw, Number(distanceControl.value), pitch);
    view.renderer.setPose(null, 1280, 720);
    view.renderer.setPose(view.frame.landmarks, 1280, 720, view.frame.matrix);
  });
  result.dataset.result = 'preview';
  delete result.dataset.checks;
  result.textContent = `Pratinjau kepala ${pitch < 0 ? 'menengadah' : 'menunduk'} ${Math.abs(pitch)}°. Tekan ulangi pemeriksaan GPU untuk kembali ke matriks tes standar.`;
  draw();
});
placementControl.addEventListener('input', () => {
  views.forEach(view => view.renderer.setPlacementProgress(Number(placementControl.value) / 100));
  result.dataset.result = 'preview'; delete result.dataset.checks;
  result.textContent = 'Pratinjau posisi wajah/atas kepala sintetis. Rambut dan occlusion tangan belum dimodelkan.';
  draw();
});
document.querySelector<HTMLButtonElement>('#motion')!.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  result.dataset.result = 'running';
  const costs: number[] = [];
  const start = performance.now();
  try {
    for (let i = 0; i < 180; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const frames = views.map(view => makeFrame(Math.sin(i / 30) * 65 + view.yaw / 8, 55 + Math.sin(i / 45) * 20));
      const before = performance.now();
      views.forEach((view, index) => {
        const frame = frames[index]!;
        view.renderer.setPose(frame.landmarks, 1280, 720, frame.matrix, before);
        view.renderer.render();
      });
      costs.push(performance.now() - before);
      if (i % 30 === 0) result.textContent = `Menguji gerakan & jarak ${i + 1}/180 frame…`;
    }
    const elapsed = performance.now() - start;
    const sorted = [...costs].sort((a, b) => a - b);
    result.dataset.result = 'motion-complete';
    result.textContent = `180 frame / 3 renderer: ${(180000 / elapsed).toFixed(1)} frame/detik teramati; waktu fitting + pengiriman render CPU rata-rata ${(costs.reduce((a, b) => a + b) / costs.length).toFixed(2)} ms, p95 ${sorted[Math.floor(sorted.length * 0.95)]!.toFixed(2)} ms. Tidak termasuk inferensi MediaPipe atau waktu eksekusi GPU; bukan hasil kamera/perangkat nyata.`;
  } finally {
    setBusy(false);
    views.forEach(view => view.renderer.setPose(view.frame.landmarks, 1280, 720, view.frame.matrix));
    draw();
  }
});
window.addEventListener('pagehide', () => { if (lightUpdate !== null) window.clearInterval(lightUpdate); views.forEach(({ renderer, face }) => { (face.material as THREE.Material).dispose(); renderer.dispose(); }); }, { once: true });
void load();

