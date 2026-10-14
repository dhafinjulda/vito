/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';

/**
 * Glasses-only adaptation of WebAR.rocks.face's temple bending/fading idea.
 * The deformation is restricted to explicitly named temple meshes so shared
 * rim, bridge, hinge and lens materials keep their original shader behavior.
 *
 * Upstream reference: WebAR.rocks.face helpers/WebARRocksMirror.js at
 * 819cdbad4e87a43635d5f9724e30f277a7e7964d (MIT); see THIRD_PARTY_NOTICES.md.
 */
export interface TempleEffectsOptions {
  bendAngleDegrees?: number;
  bendStartZ?: number;
  fadeStartZ?: number;
  fadeWidth?: number;
}

export interface TempleEffectsHandle {
  readonly meshCount: number;
  setEnabled(enabled: boolean): void;
  setFadeRange(startZ:number,width:number):void;
}

const DEFAULTS: Required<TempleEffectsOptions> = {
  bendAngleDegrees: 5,
  bendStartZ: 0,
  fadeStartZ: -1.35,
  fadeWidth: 0.48,
};

const VERTEX_BEND = /* glsl */ `
  float vtoBendDepth = max(0.0, uVtoBendStartZ - position.z);
  float vtoBendSlope = tan(uVtoBendAngle) * sign(position.x);
  transformed.x += uVtoEffectsEnabled * vtoBendSlope * vtoBendDepth;
`;

const NORMAL_BEND = /* glsl */ `
  if (position.z < uVtoBendStartZ) {
    objectNormal.z += uVtoEffectsEnabled * tan(uVtoBendAngle) * sign(position.x) * objectNormal.x;
  }
`;

function isTempleMaterial(material: THREE.Material): material is THREE.MeshStandardMaterial {
  return (material as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;
}

export function isTempleMeshName(name: string): boolean {
  return /(?:^|[-_ ])(?:temple|ear[-_ ]?tip)(?:$|[-_ ])/i.test(name);
}

/** Installs isolated r176 shader materials on temple parts in one loaded GLB. */
export function installTempleEffects(root: THREE.Object3D, options: TempleEffectsOptions = {}): TempleEffectsHandle {
  const config = { ...DEFAULTS, ...options };
  if (!Number.isFinite(config.bendAngleDegrees) || Math.abs(config.bendAngleDegrees) > 25) throw new Error('Temple bend angle must be between -25 and 25 degrees.');
  if (![config.bendStartZ, config.fadeStartZ, config.fadeWidth].every(Number.isFinite) || config.fadeWidth <= 0) throw new Error('Temple effect coordinates must be finite and fadeWidth must be positive.');

  const enabled = { value: 1 };
  const fadeRange={value:new THREE.Vector2(config.fadeStartZ-config.fadeWidth/2,config.fadeStartZ+config.fadeWidth/2)};
  const ownedMaterials: { material: THREE.MeshStandardMaterial; transparent: boolean; depthWrite: boolean }[] = [];
  let meshCount = 0;
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || !isTempleMeshName(node.name)) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    let patched = false;
    const materials = sourceMaterials.map(source => {
      if (!isTempleMaterial(source)) return source;
      const material = source.clone();
      const originalCompile = material.onBeforeCompile;
      const originalKey = material.customProgramCacheKey();
      material.onBeforeCompile = function(shader, renderer) {
        originalCompile.call(this, shader, renderer);
        shader.uniforms.uVtoEffectsEnabled = enabled;
        shader.uniforms.uVtoBendAngle = { value: THREE.MathUtils.degToRad(config.bendAngleDegrees) };
        shader.uniforms.uVtoBendStartZ = { value: config.bendStartZ };
        shader.uniforms.uVtoFadeRange = fadeRange;

        shader.vertexShader = `uniform float uVtoEffectsEnabled;\nuniform float uVtoBendAngle;\nuniform float uVtoBendStartZ;\nvarying float vVtoLocalZ;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BEND}\n  vVtoLocalZ = position.z;`);
        shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${NORMAL_BEND}`);

        shader.fragmentShader = `uniform float uVtoEffectsEnabled;\nuniform vec2 uVtoFadeRange;\nvarying float vVtoLocalZ;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n  float vtoFade = smoothstep(uVtoFadeRange.x, uVtoFadeRange.y, vVtoLocalZ);\n  diffuseColor.a *= mix(1.0, vtoFade, uVtoEffectsEnabled);`);
      };
      material.customProgramCacheKey = () => `${originalKey}|vto-temple-effects-r1`;
      material.transparent = true;
      material.depthWrite = false;
      ownedMaterials.push({ material, transparent: source.transparent, depthWrite: source.depthWrite });
      patched = true;
      return material;
    });
    if (patched) {
      node.material = Array.isArray(node.material) ? materials : materials[0]!;
      meshCount++;
    }
  });

  return {
    get meshCount() { return meshCount; },
    setFadeRange(startZ,width) {
      if(!Number.isFinite(startZ)||!Number.isFinite(width)||width<=0)throw new Error('Temple fade range must be finite with positive width.');
      fadeRange.value.set(startZ-width/2,startZ+width/2);
    },
    setEnabled(value) {
      if(enabled.value===(value?1:0))return;
      enabled.value = value ? 1 : 0;
      for (const entry of ownedMaterials) {
        entry.material.transparent = value ? true : entry.transparent;
        entry.material.depthWrite = value ? false : entry.depthWrite;
        entry.material.needsUpdate = true;
      }
    },
  };
}
