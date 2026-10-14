/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createVirtualTryOn } from '@vto/sdk';
import type { VirtualTryOn, SessionStatus } from '@vto/sdk';
import { buildParametricGlasses, disposeGeneratedGlasses, generateGlassesAsset, GlassesGenerationError, validateGlassesRecipe } from '@vto/asset-generator';
import type { GeneratedGlasses, GeneratedGlassesAsset, GenerateGlassesAssetOptions, GlassesRecipe } from '@vto/asset-generator';
import './style.css';

const el = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const canvas = el<HTMLCanvasElement>('#preview');
const description = el<HTMLTextAreaElement>('#description');
const recipeForm = el<HTMLFormElement>('#recipe-form');
const generationState = el<HTMLElement>('#generation-state');
const cameraState = el<HTMLElement>('#camera-state');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(31, 1, 0.01, 3);
camera.position.set(0, 0.012, 0.39);
camera.lookAt(0, -0.01, -0.055);
scene.add(new THREE.HemisphereLight(0xe5eddf, 0x465146, 2.5));
const keyLight = new THREE.DirectionalLight(0xfff2dc, 3.2);
keyLight.position.set(-0.24, 0.32, 0.45);
scene.add(keyLight);
const edgeLight = new THREE.DirectionalLight(0xb2c8ce, 1.8);
edgeLight.position.set(0.32, 0.1, -0.32);
scene.add(edgeLight);
let renderer: THREE.WebGLRenderer | null = null;
let environment: THREE.WebGLRenderTarget | null = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
} catch {
  renderer?.dispose();
  renderer = null;
  el<HTMLElement>('#preview-fallback').hidden = false;
  el<HTMLElement>('#preview-fallback').textContent = 'Preview 3D membutuhkan WebGL. Anda tetap dapat membuat dan mengunduh GLB.';
  canvas.hidden = true;
}

let preview: GeneratedGlasses | null = null;
let bundle: GeneratedGlassesAsset | null = null;
let requestId = 0;
let generation: AbortController | null = null;
let disposed = false;
let cameraSession: VirtualTryOn | null = null;
let cameraEpoch = 0;
let cameraUrl: string | null = null;
let cameraBundle: GeneratedGlassesAsset | null = null;
let syncing = false;
let cameraStarting = false;
let dirty = false;
const draftKey = 'vto-asset-studio-generation-v1';

const cameraStatusText: Record<SessionStatus, string> = {
  idle: 'Kamera belum dimulai.', 'requesting-camera': 'Meminta akses kamera…',
  'loading-tracker': 'Memuat pelacak wajah lokal…', searching: 'Mencari wajah…',
  tracking: 'Wajah dilacak di perangkat. Frame tidak diunggah.', paused: 'Kamera dihentikan.',
  error: 'Preview kamera mengalami masalah.', disposed: 'Preview kamera ditutup.',
};

function updateActions() {
  const unavailable = !bundle || dirty || !!generation;
  for (const selector of ['#download', '#download-manifest', '#download-recipe']) el<HTMLButtonElement>(selector).disabled = unavailable;
  el<HTMLButtonElement>('#camera-start').disabled = unavailable || !renderer || cameraStarting;
  el<HTMLButtonElement>('#generate').setAttribute('aria-busy', String(!!generation));
  el<HTMLButtonElement>('#apply-details').setAttribute('aria-busy', String(!!generation));
  el<HTMLButtonElement>('#generation-cancel').hidden = !generation;
  el<HTMLButtonElement>('#camera-start').hidden = !!cameraSession;
  el<HTMLButtonElement>('#camera-stop').hidden = !cameraSession;
}

function showError(error: unknown) {
  el<HTMLElement>('#form-errors').textContent = error instanceof GlassesGenerationError
    ? error.issues.map((issue) => issue.message).join(' ')
    : error instanceof Error ? error.message : 'Pembuatan aset gagal. Coba kembali.';
}

function selectChip(attribute: string, value: string) {
  document.querySelectorAll<HTMLButtonElement>(`[data-${attribute}]`).forEach((button) => {
    const selected = button.dataset[attribute] === value;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function writeRecipe(recipe: GlassesRecipe) {
  el<HTMLInputElement>('#name').value = recipe.name;
  el<HTMLInputElement>('#productId').value = recipe.productId;
  selectChip('template', recipe.templateId);
  selectChip('material', recipe.materialPreset);
  selectChip('temple', recipe.templeStyle);
  for (const [key, value] of Object.entries(recipe.dimensionsMm)) {
    el<HTMLInputElement>(`[data-dimension="${key}"]`).value = String(value);
    el<HTMLSelectElement>(`[data-source="${key}"]`).value = recipe.dimensionSources[key as keyof typeof recipe.dimensionSources];
  }
  el<HTMLInputElement>('#frameThickness').value = String(recipe.frameThicknessMm);
  el<HTMLInputElement>('#frameColor').value = recipe.frameColor;
  el<HTMLInputElement>('#lensTint').value = recipe.lensTint;
  updateColors();
}

function readRecipe(): unknown {
  const dimensionsMm: Record<string, number> = {};
  const dimensionSources: Record<string, string> = {};
  document.querySelectorAll<HTMLInputElement>('[data-dimension]').forEach((input) => {
    const key = input.dataset.dimension!;
    dimensionsMm[key] = input.value.trim() ? Number(input.value) : NaN;
    dimensionSources[key] = el<HTMLSelectElement>(`[data-source="${key}"]`).value;
  });
  return {
    schemaVersion: 1, templateVersion: 1, generatorVersion: '0.1.0',
    templateId: document.querySelector<HTMLElement>('[data-template].selected')?.dataset.template,
    productId: el<HTMLInputElement>('#productId').value, name: el<HTMLInputElement>('#name').value,
    dimensionsMm, dimensionSources, frameThicknessMm: Number(el<HTMLInputElement>('#frameThickness').value),
    materialPreset: document.querySelector<HTMLElement>('[data-material].selected')?.dataset.material,
    frameColor: el<HTMLInputElement>('#frameColor').value, lensTint: el<HTMLInputElement>('#lensTint').value,
    templeStyle: document.querySelector<HTMLElement>('[data-temple].selected')?.dataset.temple,
  };
}

function updateColors() {
  el<HTMLElement>('#frameColorLabel').textContent = el<HTMLInputElement>('#frameColor').value;
  el<HTMLElement>('#lensTintLabel').textContent = el<HTMLInputElement>('#lensTint').value;
}

function markDirty() {
  // A submitted draft must not overwrite edits made while export is still running.
  ++requestId;
  generation?.abort();
  generation = null;
  dirty = true;
  generationState.textContent = 'Perubahan belum diterapkan. Buat kacamata untuk memperbarui hasil.';
  el<HTMLElement>('#asset-ready').textContent = bundle ? 'Hasil sebelumnya' : 'Belum dibuat';
  updateActions();
}

async function generate(options: Omit<GenerateGlassesAssetOptions, 'signal'>) {
  const revision = ++requestId;
  generation?.abort();
  const controller = new AbortController();
  generation = controller;
  dirty = true;
  el<HTMLElement>('#form-errors').textContent = '';
  generationState.textContent = 'Menyusun geometri dan memeriksa kompatibilitas SDK…';
  updateActions();
  try {
    const result = await generateGlassesAsset({ ...options, signal: controller.signal });
    if (disposed || revision !== requestId || controller.signal.aborted) return;
    const next = buildParametricGlasses(result.recipe);
    if (preview) { scene.remove(preview.scene); disposeGeneratedGlasses(preview); }
    preview = next;
    preview.scene.rotation.set(0.08, -0.38, 0);
    scene.add(preview.scene);
    bundle = result;
    dirty = false;
    writeRecipe(result.recipe);
    el<HTMLElement>('#preview-title').textContent = result.recipe.name;
    el<HTMLElement>('#asset-ready').textContent = 'Siap untuk SDK';
    el<HTMLElement>('#side-width').textContent = `${result.recipe.dimensionsMm.frameWidth} mm`;
    el<HTMLElement>('#side-lens').textContent = `${result.recipe.dimensionsMm.lensWidth} × ${result.recipe.dimensionsMm.lensHeight} mm`;
    el<HTMLElement>('#side-bridge').textContent = `${result.recipe.dimensionsMm.bridgeWidth} mm`;
    el<HTMLElement>('#validation').textContent = result.report.warnings.length
      ? 'Ukuran estimasi. Cocokkan dengan data produk sebelum digunakan sebagai SKU.'
      : 'Ukuran mengikuti sumber yang Anda pilih. Verifikasi fitting terhadap produk fisik.';
    el<HTMLElement>('#asset-report').textContent = `${result.report.meshCount} bagian · ${result.report.triangleCount.toLocaleString('id-ID')} segitiga · ${(result.blob.size / 1024).toFixed(0)} KB. Kalibrasi & metadata fit tertanam di GLB.`;
    el<HTMLElement>('#assumptions').textContent = result.report.assumptions.join(' ') || 'Dimensi dan detail mengikuti recipe yang diterapkan.';
    generationState.textContent = 'Kacamata siap. Coba di kamera atau unduh GLB untuk SDK.';
    try {
      localStorage.setItem(draftKey, JSON.stringify({ recipe: result.recipe, description: description.value }));
      el<HTMLElement>('#save-state').textContent = 'Draft tersimpan di perangkat';
    } catch { el<HTMLElement>('#save-state').textContent = 'Draft sesi ini'; }
    void syncCameraAsset();
  } catch (error) {
    if (disposed || revision !== requestId) return;
    if (controller.signal.aborted) generationState.textContent = 'Pembuatan dibatalkan. Hasil sebelumnya tetap tersedia.';
    else { generationState.textContent = 'Aset belum dibuat. Perbaiki deskripsi atau ukuran.'; showError(error); }
    el<HTMLElement>('#asset-ready').textContent = bundle ? 'Hasil sebelumnya' : 'Belum dibuat';
  } finally {
    if (revision === requestId) { generation = null; updateActions(); }
  }
}

function stopCamera() {
  ++cameraEpoch;
  const session = cameraSession;
  cameraSession = null;
  cameraStarting = false;
  session?.dispose();
  if (cameraUrl) URL.revokeObjectURL(cameraUrl);
  cameraUrl = null;
  cameraBundle = null;
  el<HTMLElement>('#camera-mount').hidden = true;
  el<HTMLElement>('#camera-overlay').hidden = true;
  el<HTMLElement>('.preview-panel').classList.remove('camera-active');
  el<HTMLElement>('#viewport-hint').textContent = 'Seret / tombol panah untuk memutar';
  cameraState.textContent = 'Kamera berhenti. Semua track media dilepas.';
  updateActions();
}

async function syncCameraAsset() {
  if (syncing || !cameraSession || cameraStarting) return;
  syncing = true;
  try {
    while (cameraSession && !cameraStarting && bundle && bundle !== cameraBundle) {
      const session: VirtualTryOn = cameraSession;
      const result = bundle;
      const epoch = cameraEpoch;
      const nextUrl = URL.createObjectURL(result.blob);
      try {
        await session.setGlasses({ url: nextUrl, fit: result.fit, physicalFit: result.physicalFit });
        if (session !== cameraSession || epoch !== cameraEpoch) { URL.revokeObjectURL(nextUrl); continue; }
        if (cameraUrl) URL.revokeObjectURL(cameraUrl);
        cameraUrl = nextUrl;
        cameraBundle = result;
      } catch (error) {
        URL.revokeObjectURL(nextUrl);
        if (session === cameraSession) cameraState.textContent = `Pergantian aset gagal: ${error instanceof Error ? error.message : 'coba kembali'}`;
        break;
      }
    }
  } finally { syncing = false; }
}

async function startCamera() {
  if (!bundle || dirty || generation || cameraSession || disposed) return;
  const result = bundle;
  const epoch = ++cameraEpoch;
  const url = URL.createObjectURL(result.blob);
  cameraUrl = url;
  cameraStarting = true;
  const mount = el<HTMLElement>('#camera-mount');
  // Preserve this overlay layout when the SDK establishes its positioned host.
  mount.style.position = 'absolute';
  mount.hidden = false;
  el<HTMLElement>('.preview-panel').classList.add('camera-active');
  el<HTMLElement>('#viewport-hint').textContent = 'Pemrosesan kamera lokal';
  try {
    const session = createVirtualTryOn({
      container: mount, glassesUrl: url, mirror: true,
      onStatusChange: (status, message) => {
        if (epoch !== cameraEpoch || disposed) return;
        cameraState.textContent = message ?? cameraStatusText[status];
      },
      onError: (error) => { if (epoch === cameraEpoch) cameraState.textContent = error.message; },
    });
    cameraSession = session;
    updateActions();
    // The URL itself embeds the fit; explicitly passing the descriptor also demonstrates
    // atomic asset+physical calibration for application-owned generated bundles.
    await session.setGlasses({ url, fit: result.fit, physicalFit: result.physicalFit });
    if (epoch !== cameraEpoch || disposed) return;
    cameraBundle = result;
    await session.start();
    if (epoch !== cameraEpoch || disposed) return;
    cameraStarting = false;
    updateActions();
    void syncCameraAsset();
  } catch (error) {
    if (epoch !== cameraEpoch || disposed) return;
    stopCamera();
    cameraState.textContent = `Kamera tidak dapat dimulai: ${error instanceof Error ? error.message : 'periksa izin kamera'}`;
  }
}

function download(kind: keyof GeneratedGlassesAsset['files']) {
  if (!bundle || dirty || generation) return;
  const file = bundle.files[kind];
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

el<HTMLFormElement>('#description-form').addEventListener('submit', (event) => {
  event.preventDefault(); void generate({ description: description.value });
});
recipeForm.addEventListener('submit', (event) => { event.preventDefault(); void generate({ recipe: readRecipe() }); });
description.addEventListener('input', markDirty);
recipeForm.addEventListener('input', () => { updateColors(); markDirty(); });
recipeForm.addEventListener('change', markDirty);
for (const attribute of ['template', 'material', 'temple']) {
  document.querySelectorAll<HTMLButtonElement>(`[data-${attribute}]`).forEach((button) => {
    button.addEventListener('click', () => { selectChip(attribute, button.dataset[attribute]!); markDirty(); });
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((button) => {
  button.addEventListener('click', () => { description.value = button.dataset.example!; void generate({ description: description.value }); });
});
el<HTMLButtonElement>('#generation-cancel').addEventListener('click', () => generation?.abort());
el<HTMLButtonElement>('#camera-start').addEventListener('click', () => void startCamera());
el<HTMLButtonElement>('#camera-stop').addEventListener('click', stopCamera);
el<HTMLButtonElement>('#download').addEventListener('click', () => download('glb'));
el<HTMLButtonElement>('#download-manifest').addEventListener('click', () => download('manifest'));
el<HTMLButtonElement>('#download-recipe').addEventListener('click', () => download('recipe'));

let dragPointer: number | null = null;
let lastX = 0;
canvas.addEventListener('pointerdown', (event) => { dragPointer = event.pointerId; lastX = event.clientX; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointermove', (event) => {
  if (dragPointer !== event.pointerId || !preview) return;
  preview.scene.rotation.y += (event.clientX - lastX) * 0.009;
  lastX = event.clientX;
});
const endDrag = () => { dragPointer = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', endDrag);
canvas.addEventListener('keydown', (event) => {
  if (!preview || cameraSession || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') preview.scene.rotation.y += event.key === 'ArrowLeft' ? -0.12 : 0.12;
  else preview.scene.rotation.x += event.key === 'ArrowUp' ? -0.12 : 0.12;
});
const observer = new ResizeObserver(() => {
  if (!renderer) return;
  const { width, height } = canvas.getBoundingClientRect();
  renderer.setSize(Math.max(1, width), Math.max(1, height), false);
  camera.aspect = Math.max(1, width) / Math.max(1, height);
  camera.updateProjectionMatrix();
});
observer.observe(canvas);
let frame = 0;
function animate() {
  if (disposed) return;
  frame = requestAnimationFrame(animate);
  if (renderer && !cameraSession && document.visibilityState === 'visible') renderer.render(scene, camera);
}
animate();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && cameraSession) stopCamera(); });
window.addEventListener('pagehide', () => {
  disposed = true;
  ++requestId;
  generation?.abort();
  stopCamera();
  cancelAnimationFrame(frame);
  observer.disconnect();
  if (preview) disposeGeneratedGlasses(preview);
  scene.environment = null;
  environment?.dispose();
  renderer?.dispose();
});
// A restored document cannot reuse a disposed WebGL renderer or SDK instance.
window.addEventListener('pageshow', (event) => { if (event.persisted && disposed) window.location.reload(); });

let initialRecipe: GlassesRecipe | undefined;
try {
  const stored = localStorage.getItem(draftKey);
  if (stored) {
    const draft: unknown = JSON.parse(stored);
    if (draft && typeof draft === 'object' && 'recipe' in draft) {
      const parsed = validateGlassesRecipe(draft.recipe);
      if (parsed.success) {
        initialRecipe = parsed.recipe;
        if ('description' in draft && typeof draft.description === 'string') description.value = draft.description.slice(0, 1800);
      }
    }
  }
} catch { /* Storage is optional; generation remains available. */ }
void generate(initialRecipe ? { recipe: initialRecipe } : { description: description.value });
