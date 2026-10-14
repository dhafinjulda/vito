/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installTempleEffects, isTempleMeshName } from '../src/rendering/TempleEffects';

describe('VTOGlasses temple shader adaptation', () => {
  it('updates compiled fade uniforms without invalidating shaders or replacing materials',()=>{
    const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());mesh.name='temple-left';root.add(mesh);
    const effect=installTempleEffects(root),material=mesh.material as THREE.MeshStandardMaterial;
    const compile=()=>{const shader={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <beginnormal_vertex>',fragmentShader:'#include <color_fragment>'} as THREE.WebGLProgramParametersWithUniforms;material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);return shader;};
    const first=compile(),version=material.version,key=material.customProgramCacheKey();
    effect.setFadeRange(-2.7,.96);
    expect((first.uniforms.uVtoFadeRange!.value as THREE.Vector2).toArray()).toEqual([-3.18,-2.22]);
    expect(compile().uniforms.uVtoFadeRange).toBe(first.uniforms.uVtoFadeRange);
    expect(material.version).toBe(version);expect(material.customProgramCacheKey()).toBe(key);expect(mesh.material).toBe(material);
    effect.setFadeRange(-1.35,.48);expect((first.uniforms.uVtoFadeRange!.value as THREE.Vector2).x).toBeCloseTo(-1.59);
  });
  it('rejects invalid live fade adjustments without changing the current range',()=>{
    const effect=installTempleEffects(new THREE.Group());
    for(const [start,width] of [[NaN,1],[1,0],[1,-1],[1,Infinity]])expect(()=>effect.setFadeRange(start!,width!)).toThrow('fade range');
  });
  it('only selects named temple and rear tip parts', () => {
    expect(isTempleMeshName('temple-left')).toBe(true);
    expect(isTempleMeshName('ear-tip-right')).toBe(true);
    expect(isTempleMeshName('rim-left')).toBe(false);
    expect(isTempleMeshName('clear-lens-left')).toBe(false);
  });

  it('clones standard materials only for selected meshes and can disable the effect', () => {
    const root = new THREE.Group();
    const shared = new THREE.MeshPhysicalMaterial({ color: 0x333333 });
    const temple = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    temple.name = 'temple-left';
    const rim = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    rim.name = 'rim-left';
    root.add(temple, rim);

    const effects = installTempleEffects(root);
    expect(effects.meshCount).toBe(1);
    expect(temple.material).not.toBe(shared);
    expect((temple.material as THREE.Material).transparent).toBe(true);
    expect((temple.material as THREE.Material).depthWrite).toBe(false);
    expect(rim.material).toBe(shared);
    effects.setEnabled(false);
    expect((temple.material as THREE.Material).transparent).toBe(false);
    expect((temple.material as THREE.Material).depthWrite).toBe(true);
    effects.setEnabled(true);
    expect((temple.material as THREE.Material).transparent).toBe(true);
  });

  it('gates both vertex displacement and normal correction behind the same effect toggle', () => {
    const root = new THREE.Group();
    const temple = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    temple.name = 'temple-left';
    root.add(temple);
    const effects = installTempleEffects(root);
    const material = temple.material as THREE.MeshStandardMaterial;
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <begin_vertex>\n#include <beginnormal_vertex>',
      fragmentShader: '#include <color_fragment>',
    };
    material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain('uniform float uVtoEffectsEnabled;');
    expect(shader.vertexShader).toContain('uVtoEffectsEnabled * vtoBendSlope * vtoBendDepth');
    expect(shader.vertexShader).toContain('uVtoEffectsEnabled * tan(uVtoBendAngle)');
    expect(shader.fragmentShader).toContain('mix(1.0, vtoFade, uVtoEffectsEnabled)');
    effects.setEnabled(false);
    expect(shader.uniforms.uVtoEffectsEnabled).toMatchObject({ value: 0 });
    effects.setEnabled(true);
    expect(shader.uniforms.uVtoEffectsEnabled).toMatchObject({ value: 1 });
  });

  it('rejects unsafe deformation and fade settings', () => {
    expect(() => installTempleEffects(new THREE.Group(), { bendAngleDegrees: 30 })).toThrow(/bend angle/i);
    expect(() => installTempleEffects(new THREE.Group(), { fadeWidth: 0 })).toThrow(/fadeWidth/i);
  });
});
