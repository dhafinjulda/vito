/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import type { GlassesRecipe } from './recipe';
import { validateGlassesRecipe } from './recipe';

export interface GeneratedGlassesFit {
  referenceEyeSpan: number;
  scale: number;
  offset: [number, number, number];
  rotation: [number, number, number];
}

/** Structural match for the SDK's explicit physical asset calibration. */
export interface GeneratedPhysicalFit {
  frontWidthMm: number;
  modelFrontWidth: number;
  source: 'supplier' | 'measured' | 'approximation';
}

export interface GeneratedGlassesValidation {
  valid: boolean;
  issues: Array<{ path: string; message: string }>;
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
  boundsMm: { width: number; height: number; depth: number };
}

export interface GeneratedGlassesMetadata {
  schemaVersion: 1;
  productId: string;
  name: string;
  templateId: GlassesRecipe['templateId'];
  templateVersion: 1;
  generatorVersion: '0.1.0';
  workflowStatus: 'draft';
  fidelityTier: 'template-approximation';
  dimensionsMm: GlassesRecipe['dimensionsMm'];
  dimensionSources: GlassesRecipe['dimensionSources'];
  materialPreset: GlassesRecipe['materialPreset'];
  partNames: { rims: string[]; lenses: string[]; temples: string[]; rearTips: string[]; bridge: string[] };
  units: 'meters';
  axes: { right: '+X'; up: '+Y'; front: '+Z' };
  pivot: 'nose-bridge';
  /** Every mesh uses identity local transforms; shader coordinates share the bridge frame. */
  geometryTransforms: 'baked';
  fit: GeneratedGlassesFit;
  physicalFit: GeneratedPhysicalFit;
  templeCenterlineLengthMm: { left: number; right: number };
  sdk: { version: 1; units: 'meters'; pivot: 'nose-bridge'; fit: GeneratedGlassesFit; physicalFit: GeneratedPhysicalFit };
}

export interface GeneratedGlasses {
  scene: THREE.Group;
  fit: GeneratedGlassesFit;
  physicalFit: GeneratedPhysicalFit;
  boundsMm: { width: number; height: number; depth: number };
  metadata: GeneratedGlassesMetadata;
}

const mm = (value: number) => value / 1000;

class CurveSection extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly curve: THREE.Curve<THREE.Vector3>, private readonly start: number, private readonly end: number) { super(); }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.curve.getPointAt(this.start + (this.end - this.start) * t, target);
  }
}

function contour(width: number, height: number, exponent: number, catEye: boolean): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < 96; i++) {
    const angle = (i / 96) * Math.PI * 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const x = Math.sign(cos) * Math.pow(Math.abs(cos), 2 / exponent) * width / 2;
    let y = Math.sign(sin) * Math.pow(Math.abs(sin), 2 / exponent) * height / 2;
    if (catEye) y += Math.pow(Math.abs(x) / (width / 2), 2) * height * 0.095;
    points.push(new THREE.Vector2(x, y));
  }
  // The cat-eye lift changes silhouette, while merchant dimensions stay exact.
  if (catEye) {
    const minimum = Math.min(...points.map(point => point.y)), maximum = Math.max(...points.map(point => point.y));
    for (const point of points) point.y = (point.y - (minimum + maximum) / 2) * height / (maximum - minimum);
  }
  return points;
}

function shapeFrom(points: THREE.Vector2[], hole?: THREE.Vector2[]): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) shape.lineTo(point.x, point.y);
  shape.closePath();
  if (hole) {
    const path = new THREE.Path();
    path.moveTo(hole[0]!.x, hole[0]!.y);
    for (const point of hole.slice(1)) path.lineTo(point.x, point.y);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

function makeTube(points: THREE.Vector3[], radius: number, material: THREE.Material, name: string, segments = 48): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
  mesh.name = name;
  return mesh;
}

function makeFrameMaterial(recipe: GlassesRecipe): THREE.MeshPhysicalMaterial {
  const metal = recipe.materialPreset === 'metal';
  const material = new THREE.MeshPhysicalMaterial({
    color: recipe.frameColor,
    metalness: metal ? 0.82 : 0.02,
    roughness: metal ? 0.27 : 0.22,
    clearcoat: metal ? 0.35 : 0.9,
    clearcoatRoughness: 0.16,
  });
  material.name = `frame-${recipe.materialPreset}`;
  return material;
}

function addLens(root: THREE.Group, recipe: GlassesRecipe, centerX: number, frameDepth: number, side: string, exponent: number, catEye: boolean): void {
  const outerWidth = mm(recipe.dimensionsMm.lensWidth) + 2 * mm(recipe.frameThicknessMm);
  const outerHeight = mm(recipe.dimensionsMm.lensHeight) + 2 * mm(recipe.frameThicknessMm);
  const inner = contour(mm(recipe.dimensionsMm.lensWidth), mm(recipe.dimensionsMm.lensHeight), exponent, catEye);
  const outer = contour(outerWidth, outerHeight, exponent, catEye);
  const ringShape = shapeFrom(outer, inner);
  const ringGeometry = new THREE.ExtrudeGeometry(ringShape, { depth: frameDepth, bevelEnabled: false, curveSegments: 16, steps: 1 });
  ringGeometry.computeVertexNormals();
  const rim = new THREE.Mesh(ringGeometry, makeFrameMaterial(recipe));
  rim.name = `rim-${side}`;
  rim.castShadow = true;
  rim.position.x = centerX;
  root.add(rim);

  const lens = new THREE.Mesh(
    new THREE.ShapeGeometry(shapeFrom(inner), 16),
    new THREE.MeshPhysicalMaterial({ color: recipe.lensTint, transparent: true, opacity: 0.22, roughness: 0.12, metalness: 0, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
  );
  lens.name = `lens-${side}`;
  lens.material.name = `lens-${side}-material`;
  lens.position.set(centerX, 0, frameDepth + 0.0002);
  root.add(lens);
}

export function buildParametricGlasses(input: GlassesRecipe): GeneratedGlasses {
  const validation = validateGlassesRecipe(input);
  if (!validation.success) throw new Error(`Invalid glasses recipe: ${validation.errors.map(({ path, message }) => `${path}: ${message}`).join('; ')}`);
  const recipe = validation.recipe;
  const template = { round: { exponent: 2, catEye: false }, rectangle: { exponent: 4, catEye: false }, 'cat-eye': { exponent: 2.4, catEye: true } }[recipe.templateId];
  const root = new THREE.Group();
  root.name = `vto-glasses-${recipe.productId}`;
  const dims = recipe.dimensionsMm;
  const thickness = mm(recipe.frameThicknessMm);
  const frameDepth = Math.max(0.002, thickness * 0.8);
  const centerSeparation = mm(dims.lensWidth + dims.bridgeWidth);
  const lensCenter = centerSeparation / 2;
  const ringOuterX = lensCenter + mm(dims.lensWidth / 2) + thickness;
  const frameHalfWidth = mm(dims.frameWidth / 2);
  const endpiece = Math.max(0, frameHalfWidth - ringOuterX);
  const halfHeight = mm(dims.lensHeight / 2 + recipe.frameThicknessMm);
  const sideContour = contour(mm(dims.lensWidth) + thickness * 2, halfHeight * 2, template.exponent, template.catEye);
  // Anchor to the actual outermost silhouette, including the lifted cat-eye side.
  const attachmentY = sideContour[0]!.y;
  const frame = makeFrameMaterial(recipe);
  const hardware = new THREE.MeshStandardMaterial({ color: recipe.materialPreset === 'metal' ? recipe.frameColor : '#B9A16A', metalness: 0.8, roughness: 0.25 });
  const tipMaterial = new THREE.MeshPhysicalMaterial({ color: recipe.frameColor, roughness: 0.36, clearcoat: 0.65 });
  hardware.name = 'hinge-hardware'; tipMaterial.name = 'temple-tip';

  for (const side of [-1, 1] as const) {
    const label = side < 0 ? 'left' : 'right';
    const x = side * lensCenter;
    addLens(root, recipe, x, frameDepth, label, template.exponent, template.catEye);

    if (endpiece > mm(0.1)) {
      const overlap = Math.min(thickness * .5, mm(1.2));
      const connector = new THREE.Mesh(new THREE.BoxGeometry(endpiece + overlap, thickness * 0.8, frameDepth), frame);
      connector.name = `endpiece-${label}`;
      connector.position.set(side * (ringOuterX + (endpiece - overlap) / 2), attachmentY, frameDepth / 2);
      root.add(connector);
    }
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(mm(3.2), mm(3.2), frameDepth * 1.25), hardware);
    hinge.name = `hinge-${label}`;
    hinge.position.set(side * (frameHalfWidth - mm(1.6)), attachmentY, frameDepth / 2);
    root.add(hinge);

    const templeY = attachmentY;
    const templeLength = mm(dims.templeLength);
    const bend = recipe.templeStyle === 'curved' ? 0.012 : 0.002;
    const templeRadius = recipe.materialPreset === 'metal' ? thickness * 0.34 : thickness * 0.44;
    const points = [
      new THREE.Vector3(side * (frameHalfWidth - templeRadius), templeY, frameDepth * 0.5),
      new THREE.Vector3(side * (frameHalfWidth - templeRadius - 0.002), templeY - 0.002, -templeLength * 0.28),
      new THREE.Vector3(side * (frameHalfWidth - templeRadius - 0.004), templeY - bend, -templeLength * 0.73),
      new THREE.Vector3(side * (frameHalfWidth - templeRadius - 0.008), templeY - bend - 0.008, -templeLength * 0.91),
      new THREE.Vector3(side * (frameHalfWidth - templeRadius - 0.010), templeY - bend - 0.013, -templeLength * 0.97),
      new THREE.Vector3(side * (frameHalfWidth - templeRadius - 0.014), templeY - bend - 0.022, -templeLength),
    ];
    const start = points[0]!.clone();
    const unscaledCurve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const lengthScale = templeLength / unscaledCurve.getLength();
    for (const point of points) point.sub(start).multiplyScalar(lengthScale).add(start);
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    // Both sections use the same arc-length curve and joint: no floating rear tip.
    const temple = new THREE.Mesh(new THREE.TubeGeometry(new CurveSection(curve, 0, 0.86), 48, templeRadius, 8, false), frame);
    temple.name = `temple-${label}`;
    const tip = new THREE.Mesh(new THREE.TubeGeometry(new CurveSection(curve, 0.86, 1), 16, thickness * 0.42, 8, false), tipMaterial);
    tip.name = `ear-tip-${label}`;
    temple.userData.centerlineLengthMm = curve.getLength() * 1000;
    root.add(temple, tip);

    if (recipe.materialPreset === 'metal') {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(mm(2.1), 12, 8), new THREE.MeshPhysicalMaterial({ color: '#E4DDCD', transparent: true, opacity: 0.72, roughness: 0.3 }));
      pad.name = `nose-pad-${label}`;
      pad.scale.set(0.72, 1.35, 0.62);
      pad.position.set(side * mm(dims.bridgeWidth * 0.3), -mm(4), -mm(2));
      const arm = makeTube([
        new THREE.Vector3(side * mm(dims.bridgeWidth * .28), mm(4), frameDepth * .5 + mm(.5)),
        new THREE.Vector3(side * mm(dims.bridgeWidth * .32), mm(.5), -mm(1)),
        pad.position.clone(),
      ], mm(.6), hardware, `nose-pad-arm-${label}`, 16);
      root.add(arm);
      root.add(pad);
    }
  }

  const bridge = makeTube([
    new THREE.Vector3(-mm(dims.bridgeWidth) / 2, mm(2), frameDepth * 0.5),
    new THREE.Vector3(-mm(dims.bridgeWidth) * 0.28, mm(4), frameDepth * 0.5 + mm(0.5)),
    new THREE.Vector3(0, mm(5), frameDepth * 0.5 + mm(0.8)),
    new THREE.Vector3(mm(dims.bridgeWidth) * 0.28, mm(4), frameDepth * 0.5 + mm(0.5)),
    new THREE.Vector3(mm(dims.bridgeWidth) / 2, mm(2), frameDepth * 0.5),
  ], thickness * 0.65, frame, 'bridge', 24);
  root.add(bridge);

  const pivot = new THREE.Vector3(0, mm(5), frameDepth * 0.5 + mm(0.8));
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.updateMatrix();
    node.geometry.applyMatrix4(node.matrix);
    node.geometry.translate(-pivot.x, -pivot.y, -pivot.z);
    node.position.set(0, 0, 0); node.quaternion.identity(); node.scale.set(1, 1, 1); node.updateMatrix();
    node.geometry.computeBoundingBox(); node.geometry.computeBoundingSphere();
  });

  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const partNames = { rims: ['rim-left', 'rim-right'], lenses: ['lens-left', 'lens-right'], temples: ['temple-left', 'temple-right'], rearTips: ['ear-tip-left', 'ear-tip-right'], bridge: ['bridge'] };
  const frontBounds = new THREE.Box3();
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && !/^(?:temple|ear-tip)-/.test(node.name)) frontBounds.union(node.geometry.boundingBox!);
  });
  const physicalFit: GeneratedPhysicalFit = { frontWidthMm: dims.frameWidth, modelFrontWidth: frontBounds.max.x - frontBounds.min.x, source: recipe.dimensionSources.frameWidth === 'estimated' ? 'approximation' : recipe.dimensionSources.frameWidth };
  const fit: GeneratedGlassesFit = { referenceEyeSpan: 0.08891718, scale: 1, offset: [0, 0, 0.003], rotation: [0, 0, 0] };
  const metadata: GeneratedGlassesMetadata = {
    schemaVersion: 1,
    productId: recipe.productId,
    name: recipe.name,
    templateId: recipe.templateId,
    templateVersion: 1,
    generatorVersion: recipe.generatorVersion,
    workflowStatus: 'draft',
    fidelityTier: 'template-approximation',
    dimensionsMm: { ...dims },
    dimensionSources: { ...recipe.dimensionSources },
    materialPreset: recipe.materialPreset,
    partNames,
    units: 'meters', axes: { right: '+X', up: '+Y', front: '+Z' }, pivot: 'nose-bridge', geometryTransforms: 'baked',
    fit, physicalFit,
    templeCenterlineLengthMm: { left: root.getObjectByName('temple-left')!.userData.centerlineLengthMm as number, right: root.getObjectByName('temple-right')!.userData.centerlineLengthMm as number },
    sdk: { version: 1, units: 'meters', pivot: 'nose-bridge', fit, physicalFit },
  };
  root.userData = { vtoGlasses: metadata };
  return {
    scene: root,
    fit, physicalFit,
    boundsMm: { width: size.x * 1000, height: size.y * 1000, depth: size.z * 1000 },
    metadata,
  };
}

/** Check the generated bridge coordinate contract before passing a GLB to the SDK. */
export function validateGeneratedGlasses(generated: GeneratedGlasses): GeneratedGlassesValidation {
  const issues: GeneratedGlassesValidation['issues'] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const seen = new Set<string>();
  const bounds = new THREE.Box3();
  const frontBounds = new THREE.Box3();
  let meshCount = 0, vertexCount = 0, triangleCount = 0;
  generated.scene.updateMatrixWorld(true);
  generated.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    meshCount++;
    if (seen.has(node.name)) add(node.name, 'Semantic mesh names must be unique.');
    seen.add(node.name);
    if (!node.matrix.equals(new THREE.Matrix4()) || !node.matrixWorld.equals(new THREE.Matrix4())) add(node.name, 'Generated mesh coordinates must be baked in the shared bridge frame.');
    const positions = node.geometry.getAttribute('position');
    if (!positions || positions.itemSize !== 3 || positions.count < 3) { add(node.name, 'A mesh needs triangle positions.'); return; }
    vertexCount += positions.count;
    let positionsFinite = true;
    for (const key of Object.keys(node.geometry.attributes)) {
      const attribute = node.geometry.getAttribute(key);
      for (let i = 0; i < attribute.array.length; i++) if (!Number.isFinite(attribute.array[i])) {
        add(`${node.name}.${key}`, 'Geometry attributes must contain finite values.');
        if (key === 'position') positionsFinite = false;
        break;
      }
    }
    const index = node.geometry.getIndex();
    const count = index?.count ?? positions.count;
    triangleCount += count / 3;
    if (count % 3 !== 0 || (index && !Array.from(index.array).every(value => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < positions.count))) add(node.name, 'Triangle indices must reference existing vertices.');
    if (positionsFinite) node.geometry.computeBoundingBox();
    else add('bounds', 'Finite geometry positions are required to compute wearable bounds.');
    if (positionsFinite && node.geometry.boundingBox) {
      bounds.union(node.geometry.boundingBox);
      if (!/^(?:temple|ear-tip)-/.test(node.name)) frontBounds.union(node.geometry.boundingBox);
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.every(material => material instanceof THREE.MeshStandardMaterial)) add(node.name, 'Standard or physical materials are required for SDK effects.');
    for (const material of materials) if (material instanceof THREE.MeshStandardMaterial && ![material.color.r, material.color.g, material.color.b, material.opacity, material.roughness, material.metalness].every(Number.isFinite)) add(`${node.name}.material`, 'Material properties must contain finite values.');
  });
  const size = bounds.getSize(new THREE.Vector3()).multiplyScalar(1000);
  const boundsMm = { width: size.x, height: size.y, depth: size.z };
  if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 0) || size.x > 250 || size.y > 150 || size.z > 250) add('bounds', 'Generated geometry must have finite wearable bounds in metres.');
  if (meshCount > 32 || vertexCount > 150_000 || triangleCount > 100_000) add('complexity', 'Generated geometry exceeds the browser asset budget.');
  const required = ['rim-left', 'rim-right', 'lens-left', 'lens-right', 'hinge-left', 'hinge-right', 'temple-left', 'temple-right', 'ear-tip-left', 'ear-tip-right', 'bridge'];
  if (generated.metadata.materialPreset === 'metal') required.push('nose-pad-left', 'nose-pad-right', 'nose-pad-arm-left', 'nose-pad-arm-right');
  for (const name of required) if (!seen.has(name)) add(name, 'An SDK semantic part is missing.');
  const connected = (first: string, second: string) => {
    const a = generated.scene.getObjectByName(first), b = generated.scene.getObjectByName(second);
    if (a instanceof THREE.Mesh && b instanceof THREE.Mesh && a.geometry.boundingBox && b.geometry.boundingBox && !a.geometry.boundingBox.intersectsBox(b.geometry.boundingBox)) add(`${first}/${second}`, 'Supporting parts must overlap rather than float separately.');
  };
  for (const side of ['left', 'right']) {
    connected(`hinge-${side}`, `temple-${side}`);
    connected(`temple-${side}`, `ear-tip-${side}`);
    const endpiece = generated.scene.getObjectByName(`endpiece-${side}`);
    if (endpiece) connected(`endpiece-${side}`, `hinge-${side}`);
    if (generated.metadata.materialPreset === 'metal') {
      connected(`nose-pad-arm-${side}`, 'bridge');
      connected(`nose-pad-arm-${side}`, `nose-pad-${side}`);
    }
  }
  const fit = generated.fit, physical = generated.physicalFit;
  if (!Number.isFinite(fit.referenceEyeSpan) || fit.referenceEyeSpan <= 0 || !Number.isFinite(fit.scale) || fit.scale < 0.25 || fit.scale > 4 || fit.offset.length !== 3 || fit.rotation.length !== 3 || ![...fit.offset, ...fit.rotation].every(Number.isFinite)) add('fit', 'Fit metadata must satisfy the SDK fitting contract.');
  if (![physical.frontWidthMm, physical.modelFrontWidth].every(Number.isFinite) || physical.frontWidthMm < 40 || physical.frontWidthMm > 250 || physical.modelFrontWidth <= 0 || !['supplier', 'measured', 'approximation'].includes(physical.source)) add('physicalFit', 'Physical calibration must satisfy the SDK asset contract.');
  if (Math.abs(physical.modelFrontWidth - (frontBounds.max.x - frontBounds.min.x)) > 0.00001) add('physicalFit.modelFrontWidth', 'Calibration must describe the actual front geometry width.');
  if (generated.metadata.units !== 'meters' || generated.metadata.pivot !== 'nose-bridge' || generated.metadata.geometryTransforms !== 'baked') add('metadata', 'The exported coordinate contract must be declared.');
  if (generated.metadata.axes.right !== '+X' || generated.metadata.axes.up !== '+Y' || generated.metadata.axes.front !== '+Z') add('metadata.axes', 'Use +X right, +Y up, +Z front.');
  if (generated.metadata.sdk.version !== 1 || generated.metadata.sdk.units !== 'meters' || generated.metadata.sdk.pivot !== 'nose-bridge') add('metadata.sdk', 'Versioned SDK metadata must declare metres and the bridge pivot.');
  if (JSON.stringify(generated.metadata.sdk.fit) !== JSON.stringify(fit) || JSON.stringify(generated.metadata.sdk.physicalFit) !== JSON.stringify(physical)) add('metadata.sdk', 'Embedded SDK calibration must match the generated asset descriptor.');
  return { valid: issues.length === 0, issues, meshCount, vertexCount, triangleCount, boundsMm };
}

/** Release every owned geometry/material once. Safe to call again after export. */
export function disposeGeneratedGlasses(generated: Pick<GeneratedGlasses, 'scene'>): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  generated.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  generated.scene.clear();
}
