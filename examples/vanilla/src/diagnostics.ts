/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import './style.css';
import { registerOfflineExample } from './offline';
import diagnosticWorkerUrl from './generated-worker-url';

registerOfflineExample();

const status = document.querySelector<HTMLElement>('#status')!;
const details = document.querySelector<HTMLElement>('#details')!;
const button = document.querySelector<HTMLButtonElement>('#run')!;
const hands = document.querySelector<HTMLInputElement>('#hands')!;
const wasmRoot = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const modelAssetPath = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

button.addEventListener('click', async () => {
  button.disabled = true;
  hands.disabled = true;
  let handReady = false;
  let gotHands=false,gotFace=false,facePresent=false,finished=false;
  status.textContent = 'Mengunduh dan menyiapkan model…';
  details.textContent = 'Frame sintetis kosong akan diproses di worker lokal.';
  const worker = new Worker(diagnosticWorkerUrl, { name: 'vto-runtime-diagnostic' });
  const timeout = window.setTimeout(() => finish(new Error('Inisialisasi runtime melewati batas 30 detik.')), 30_000);
  let phase: 'init' | 'frame' = 'init';

  function finish(error?: Error, detectedFace?: boolean) {
    if(finished) return;finished=true;
    window.clearTimeout(timeout);
    worker.terminate();
    button.disabled = false;
    hands.disabled = false;
    if (error) {
      status.textContent = 'Pemeriksaan gagal';
      details.textContent = error.message;
      return;
    }
    status.textContent = 'Runtime dan inferensi worker berhasil';
    details.textContent = `Model dimuat; satu frame kosong diproses. Wajah terdeteksi: ${detectedFace ? 'ya' : 'tidak (sesuai frame kosong)'}. ${hands.checked ? `Model tangan siap: ${handReady ? 'ya' : 'tidak'}.` : ''} Kamera dan alignment langsung belum diuji.`;
  }

  worker.onerror = () => finish(new Error('Worker gagal dimuat. Periksa browser, CSP, serta akses ke file runtime.'));
  worker.onmessage = async (event: MessageEvent<{ type: string; message?: string; landmarks?: unknown; hands?:unknown[]; handTracking?: string; timestampMs?: number }>) => {
    const message = event.data;
    if (message.type === 'error') {
      finish(new Error(message.message ?? 'Worker tracking gagal.'));
    } else if (message.type === 'hand-unavailable') {
      finish(new Error('Inferensi tangan gagal. Gunakan tombol posisi pada perangkat ini.'));
    } else if (phase === 'init' && (message.type === 'ready' || message.type === 'hand-ready')) {
      if (hands.checked && message.type === 'ready' && message.handTracking === 'loading') {
        // Diagnostics explicitly requests optional initialization without a face.
        // The public SDK instead waits until glasses are visibly face-mounted.
        worker.postMessage({type:'enable-hands'});return;
      }
      handReady = message.type === 'hand-ready' || message.handTracking === 'ready';
      if (hands.checked && !handReady) { finish(new Error('Model tangan tidak tersedia; model wajah tetap bisa digunakan.')); return; }
      phase = 'frame';
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext('2d');
      if (!context) { finish(new Error('Canvas 2D tidak tersedia untuk frame sintetis.')); return; }
      context.fillStyle = '#808080';
      context.fillRect(0, 0, canvas.width, canvas.height);
      try {
        const bitmap = await createImageBitmap(canvas);
        worker.postMessage({ type: 'frame', bitmap, timestampMs: performance.now() }, [bitmap]);
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Frame sintetis gagal dikirim ke worker.'));
      }
    } else if (phase === 'frame' && message.type === 'result') {
      gotFace=true;facePresent=Boolean(message.landmarks);
    } else if(phase==='frame'&&message.type==='hand-result') {
      gotHands=true;if(message.hands?.length!==0) finish(new Error('Frame kosong harus menghasilkan tidak ada tangan.'));
    } else if(phase==='frame'&&message.type==='frame-done') {
      if(!gotFace||hands.checked&&!gotHands) finish(new Error('Worker tidak mengirim semua hasil inferensi.'));
      else finish(undefined,facePresent);
    }
  };
  worker.postMessage({ type: 'init', wasmRoot, modelAssetPath, cacheRuntimeAssets: true, handModelAssetPath: hands.checked ? 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' : undefined });
});
