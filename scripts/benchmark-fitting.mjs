/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';

// Local, deterministic generic geometry only. No model inference or camera.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { fitFace, DEFAULT_FIT } = await server.ssrLoadModule('/packages/sdk/src/glasses/fitting.ts');
  const { PoseSmoother } = await server.ssrLoadModule('/packages/sdk/src/glasses/PoseSmoother.ts');
  const { syntheticFrame } = await server.ssrLoadModule('/packages/sdk/test/synthetic-frame.ts');
  const projection = { width: 640, height: 400, videoWidth: 1280, videoHeight: 720, fov: 63 };
  const baseFrame = syntheticFrame(0, 0, 0, 1280, 720, 60);
  const base = fitFace(baseFrame.landmarks, baseFrame.matrix, projection, DEFAULT_FIT);
  const smoother = new PoseSmoother(); smoother.update(base, 1000);
  let old = base; let oldSquared = 0; let newSquared = 0;
  for (let i = 1; i <= 120; i++) {
    const noise = i % 2 ? 0.12 : -0.12;
    const offset = new THREE.Vector3(noise, 0, 0);
    const raw = { ...base, position: base.position.clone().add(offset), headPosition: base.headPosition.clone().add(offset) };
    const dt = 1 / 30;
    // Exact former smoothing rule, used only as a comparison control.
    const speed = raw.position.distanceTo(old.position) / base.worldEyeSpan / dt;
    const alpha = 1 - Math.exp(-dt / (0.055 / (1 + speed * 8)));
    old = { ...raw, position: old.position.clone().lerp(raw.position, alpha) };
    const refined = smoother.update(raw, 1000 + i * 1000 / 30).pose;
    if (i > 30) { oldSquared += (old.position.x - base.position.x) ** 2; newSquared += (refined.position.x - base.position.x) ** 2; }
  }
  const depthChecks = [-84, -45, 0, 45, 84].map(yaw => {
    const frame = syntheticFrame(yaw, 0, 0, 1280, 720, 60);
    const clean = fitFace(frame.landmarks, frame.matrix, projection, DEFAULT_FIT);
    const noisy = frame.landmarks.map(p => ({ ...p })); noisy[33].x += 0.04; noisy[33].z += 0.025;
    const refined = fitFace(noisy, frame.matrix, projection, DEFAULT_FIT);
    return { yaw, depthErrorCm: Math.abs(clean.faceDepth - refined.faceDepth) };
  });
  const result = { synthetic: true, scope: 'pose solver/filter only; excludes model inference, GPU and real-person accuracy', fps: 30,
    noiseAmplitudeCm: 0.12, warmupFrames: 30, measuredFrames: 90,
    formerFilterRmsCm: Math.sqrt(oldSquared / 90), refinedFilterRmsCm: Math.sqrt(newSquared / 90), depthChecks };
  result.reductionVsFormerPercent = 100 * (1 - result.refinedFilterRmsCm / result.formerFilterRmsCm);
  await mkdir(new URL('../docs/evidence/', import.meta.url), { recursive: true });
  await writeFile(new URL('../docs/evidence/tracking-refinement.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await server.close(); }
