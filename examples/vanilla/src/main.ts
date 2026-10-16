/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { createVirtualTryOn, ResourceTimeoutError, CameraAccessError, type SessionStatus, type GlassesAsset } from 'vito-sdk';
import { demoGlassesManifest, getDemoFit, getDemoGlassesAssets } from './demo-assets';
import { registerOfflineExample } from './offline';
import './style.css';

registerOfflineExample();

const element = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const container = element<HTMLElement>('#try-on');
const statusText = element<HTMLElement>('#status');
const indicator = element<HTMLElement>('#indicator');
const message = element<HTMLElement>('#message');
const startButton = element<HTMLButtonElement>('#start');
const stopButton = element<HTMLButtonElement>('#stop');
const resyncButton = element<HTMLButtonElement>('#resync');
const size = element<HTMLInputElement>('#fit-size');
const height = element<HTMLInputElement>('#fit-height');
const depth = element<HTMLInputElement>('#fit-depth');
const products = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-product]'));
const handToggle = element<HTMLInputElement>('#hand-interaction');
const interactionMessage = element<HTMLElement>('#interaction-state');
let fit = getDemoFit();
const glasses: GlassesAsset[] = getDemoGlassesAssets();
const descriptions = demoGlassesManifest.assets.map((asset) => asset.description);
let selected = 0;
let requested:number|null=null,selectionRevision=0;
const productState=element<HTMLElement>('#product-state');
const productNames=products.map(product=>product.querySelector('strong')!.textContent!);
function renderProductSelection(text:string) {
  products.forEach((product,index)=>{product.setAttribute('aria-pressed',String(index===selected));product.setAttribute('aria-busy',String(index===requested));});
  if(productState.textContent!==text)productState.textContent=text;
  [size,height,depth].forEach(input=>input.disabled=requested!==null);
}
let holding=false;
const experiments=new URLSearchParams(location.search);
const compositing=element<HTMLInputElement>('#camera-compositing');
const hairOcclusion=element<HTMLInputElement>('#hair-occlusion');
const cameraFov=element<HTMLInputElement>('#camera-fov');
const eyeReference=element<HTMLInputElement>('#eye-reference');
const candidateControls=[compositing,hairOcclusion,cameraFov,eyeReference];
compositing.checked=experiments.get('compositing')!=='0';hairOcclusion.checked=experiments.get('hairOcclusion')!=='0';

const labels: Record<SessionStatus, string> = {
  idle: 'Siap dimulai', 'requesting-camera': 'Meminta akses kamera…', 'loading-tracker': 'Menyiapkan pemasangan…', searching: 'Posisikan wajah di tengah', tracking: 'Terpasang', paused: 'Kamera dijeda', error: 'Terjadi kendala', disposed: 'Sesi ditutup',
};
function createSession() { return createVirtualTryOn({
  container, glassesUrl: glasses[selected]!.url, fit, mirror: true, faceOcclusion: true, smoothing: true, cacheRuntimeAssets: true,
  presentation:experiments.get('presentation')==='predicted'?'predicted':experiments.get('presentation')==='interpolated'?'interpolated':experiments.get('presentation')==='direct'?'direct':'auto',adaptiveQuality:experiments.get('adaptiveQuality')!=='0',
  handInteraction: handToggle.checked ? {} : undefined,
  cameraCompositing:compositing.checked,lensOptics:compositing.checked?{ior:1.5,thicknessMm:2,transmission:0.95}:undefined,
  hairOcclusion:hairOcclusion.checked?undefined:false,cameraFov:Number(cameraFov.value),
  faceReferenceEyeSpanCm:eyeReference.value.trim()?Number(eyeReference.value):undefined,
  onReadinessChange(stage) {
    const copy={idle:'Siap dimulai.', 'requesting-camera':'Izinkan kamera melalui permintaan browser. Anda bisa menghentikan proses kapan saja.', 'loading-asset':'Memuat bingkai pilihan…', 'loading-runtime':'Menyiapkan pelacakan lokal. Pertama kali mungkin perlu mengunduh model.', 'initializing-tracker':'Menyiapkan model pelacakan di perangkat ini…', 'warming-tracker':'Menyelesaikan persiapan kamera…',prepared:'Persiapan selesai. Tekan Mulai kamera saat siap.',ready:'Posisikan wajah di tengah.',cancelled:'Kamera dihentikan. Tekan Mulai kamera untuk mencoba lagi.',error:''};
    if(copy[stage]&&message.textContent!==copy[stage])message.textContent=copy[stage];
    if(stage==='loading-asset')element<HTMLElement>('#empty-hint').hidden=true;
  },
  onTrackingHealthChange(health) {
    const phase={stopped:'Dihentikan',starting:'Menyiapkan',running:'Berjalan',recovering:'Menyambungkan ulang',failed:'Gagal'}[health.phase];
    element<HTMLElement>('#tracking-health').textContent=`${phase} · ${health.delegate??'backend belum siap'} · frame terkirim ${health.framesSent} · hasil diterima ${health.resultsReceived} · restart ${health.restarts} · waktu hasil ${health.lastLatencyMs??'—'} ms · input ${health.inputWidth}×${health.inputHeight} · rambut ${health.hairTracking??'disabled'} · compositing ${health.cameraCompositing??'disabled'} · fallback ${health.featureFallback??'—'}`;
    const perf=health.performance;
    const number=(value:number|null|undefined)=>value==null?'—':value.toFixed(1);
    element<HTMLElement>('#performance-health').textContent=perf?`Window ${number(perf.observedMs/1000)} s · kamera ${number(perf.rates.cameraHz)} Hz · hasil wajah ${number(perf.rates.faceHz)} Hz · hasil tangan ${number(perf.rates.handHz)} Hz · draw ${number(perf.rates.renderHz)} Hz · rAF ${number(perf.rates.animationHz)} Hz · p95 capture ${number(perf.timings.captureDraw.p95Ms)} ms / bitmap ${number(perf.timings.bitmap.p95Ms)} ms / wajah ${number(perf.timings.faceInference.p95Ms)} ms / tangan ${number(perf.timings.handInference.p95Ms)} ms / rambut ${number(perf.timings.hairInference.p95Ms)} ms / fit ${number(perf.timings.fit.p95Ms)} ms / submit ${number(perf.timings.renderSubmission.p95Ms)} ms / capture→submit ${number(perf.timings.captureToSubmission.p95Ms)} ms`:'Metrik performa belum tersedia.';
  },
  onInteractionChange(state) {
    holding=state.phase==='dragging'||state.phase==='settling';
    if(holding) {statusText.textContent='Kacamata dipegang';element<HTMLElement>('#distance').hidden=true;}
    interactionMessage.textContent = state.availability === 'unavailable' ? 'Pelacakan tangan tidak tersedia. Gunakan tombol posisi; pelacakan wajah tetap berjalan.'
      : state.phase === 'grabbing' ? 'Tahan jepitan sebentar untuk mengambil bingkai…'
      : state.phase === 'dragging' ? state.feedback==='handoff' ? 'Pegangan berhasil dipindahkan. Kacamata mengikuti tangan penerima.' : state.grippingHands===2 ? `Dipegang dua tangan · ${state.contactFingers} titik jari dekat bingkai. Putar bersama; buka salah satu tangan untuk memindahkan pegangan.` : `Dipegang satu tangan · ${state.contactFingers} titik jari dekat bingkai. Jepit sisi lain dengan tangan kedua untuk memindahkan atau memutar bersama.`
      : state.phase === 'settling' ? 'Menyelaraskan pemasangan kacamata…'
      : state.placement === 'head' ? 'Bingkai di atas kepala. Jepit dekat bingkai lalu turunkan, atau gunakan tombol wajah.'
      : handToggle.checked ? state.availability === 'ready' ? state.feedback === 'release-near-face' ? 'Lepaskan dekat wajah atau kepala untuk memasang. Bingkai dikembalikan ke posisi semula.' : !state.handVisible ? 'Tangan belum terbaca. Tunjukkan telapak dan jari ke kamera.' : state.feedback === 'open-to-grab' ? 'Tangan terbaca. Jepit ibu jari dengan telunjuk, tengah, manis, atau kelingking pada bingkai.' : 'Jepitan terbaca. Dekatkan jepitan ke bingkai untuk mengambil.' : 'Menyiapkan kontrol tangan saat startup. Kacamata dapat diambil setelah terpasang.'
      : 'Kontrol tangan nonaktif. Tombol posisi tersedia.';
  },
  onStatusChange(status, detail) {
    statusText.textContent = holding&&['tracking','searching'].includes(status)?'Kacamata dipegang':labels[status];
    indicator.dataset.state = status;
    if (status !== 'tracking') element<HTMLElement>('#distance').hidden = true;
    startButton.disabled = ['requesting-camera', 'loading-tracker', 'tracking', 'searching'].includes(status);
    stopButton.disabled = ['idle', 'disposed', 'error'].includes(status);
    resyncButton.disabled = ['idle','disposed','requesting-camera','loading-tracker'].includes(status);
    handToggle.disabled = !['idle', 'disposed', 'error'].includes(status);
    candidateControls.forEach(control=>control.disabled=handToggle.disabled);
    element<HTMLElement>('#empty-hint').hidden = ['loading-tracker', 'tracking', 'searching'].includes(status);
    if (status === 'idle') message.textContent = 'Kamera dihentikan. Anda bisa memulai lagi kapan saja.';
    if (status === 'searching') message.textContent = holding?'Kacamata mengikuti tangan. Tampilkan wajah kembali untuk memasang.':'Posisikan wajah di tengah dan gunakan pencahayaan yang merata.';
    if (detail) message.textContent = detail;
  },
  onFitStateChange(state) {
    const distance = element<HTMLElement>('#distance');
    distance.hidden = !state.visible||holding;
    const yaw = Math.round(state.yawDegrees);
    const pitch = Math.round(state.pitchDegrees);
    const distanceCm = Math.round(state.estimatedDistanceCm / 5) * 5;
    distance.textContent = `Jarak ≈ ${distanceCm} cm · Yaw ${yaw}° · Pitch ${pitch}°`;
    const guidance = { ready: 'Menoleh perlahan untuk melihat bentuk bingkai dari samping.', 'move-closer': 'Dekatkan wajah sedikit agar pemasangan lebih jelas.', 'center-face': 'Geser wajah ke tengah pratinjau.', 'turn-slightly': 'Kembali sedikit menghadap kamera agar wajah tetap terbaca.' };
    if(message.textContent!==guidance[state.guidance])message.textContent = guidance[state.guidance];
    if (state.visible) statusText.textContent = holding?'Kacamata dipegang':Math.abs(state.yawDegrees) > 30 ? 'Tampilan samping' : 'Terpasang';
  },
  onError(error) {
    resyncButton.disabled=false;
    const cameraCopy={
      'camera-access-blocked':'Akses kamera diblokir oleh izin atau kebijakan browser. Periksa izin kamera situs, lalu tekan Mulai kamera.',
      'camera-not-found':'Kamera tidak ditemukan. Hubungkan atau aktifkan kamera, lalu tekan Mulai kamera.',
      'camera-unreadable':'Kamera belum dapat digunakan. Tutup aplikasi lain yang memakai kamera, periksa kamera, lalu tekan Mulai kamera.',
      'camera-unsupported':'Kamera memerlukan HTTPS dan browser yang mendukung. Buka situs aman di browser lain. Pilihan bingkai tetap bisa dilihat tanpa kamera.',
      'camera-unavailable':'Kamera belum bisa dimulai. Periksa kamera lalu tekan Mulai kamera. Pilihan bingkai tetap bisa dilihat tanpa kamera.',
    };
    message.textContent = error instanceof CameraAccessError ? cameraCopy[error.code] : error instanceof ResourceTimeoutError ? error.stage==='asset'?'Bingkai terlalu lama dimuat. Pilih bingkai lain atau tekan Sambungkan ulang untuk mencoba lagi.':'Pelacakan belum siap. Periksa koneksi lalu tekan Sambungkan ulang.' : 'Pemasangan belum berhasil. Tekan Sambungkan ulang atau pilih bingkai lain. Anda tetap bisa melihat pilihan bingkai tanpa kamera.';
  },
}); }
let session = createSession();
function recreateSession() {
  if(!cameraFov.checkValidity()||!eyeReference.checkValidity()) {
    element<HTMLElement>('#calibration-message').textContent='Periksa rentang FOV dan ukuran referensi.';startButton.disabled=true;return false;
  }
  selectionRevision++;requested=null;
  session.dispose();
  session = createSession();
  renderProductSelection(`Pilihan: ${productNames[selected]}.`);
  handToggle.disabled=false;candidateControls.forEach(control=>control.disabled=false);
  element<HTMLElement>('#calibration-message').textContent='Konfigurasi lokal siap. Tekan Mulai kamera.';
  statusText.textContent = labels.idle; indicator.dataset.state = 'idle'; startButton.disabled = false; stopButton.disabled = true;
  message.textContent = 'Tekan Mulai kamera untuk memulai sesi lokal.';
  updateFit();
  return true;
}
handToggle.addEventListener('change',recreateSession);
candidateControls.forEach(control=>control.addEventListener('change',recreateSession));
element<HTMLButtonElement>('#place-face').addEventListener('click', () => session.setPlacement('face'));
element<HTMLButtonElement>('#place-head').addEventListener('click', () => session.setPlacement('head'));

startButton.addEventListener('click', async () => {
  message.textContent = 'Video dan data wajah diproses di perangkat ini.';
  try { await session.start(); } catch { /* SDK reports the failure through callbacks. */ }
});
stopButton.addEventListener('click', () => session.stop());
resyncButton.addEventListener('click', async () => {
  if(!recreateSession())return;
  try {await session.start();} catch { /* SDK reports failures. */ }
});

function updateFit() {
  session.setFit({ scale: Number(size.value) / 100, offset: [0, Number(height.value) / 100 * fit.referenceEyeSpan, Number(depth.value) / 100 * fit.referenceEyeSpan] });
  element<HTMLOutputElement>('#size-value').value = `${size.value}%`;
  element<HTMLOutputElement>('#height-value').value = height.value === '0' ? 'Netral' : `${Number(height.value) > 0 ? '+' : ''}${height.value}%`;
  element<HTMLOutputElement>('#depth-value').value = `${depth.value}%`;
}
function resetFit() { size.value = '100'; height.value = '0'; depth.value = '6'; updateFit(); }
[size, height, depth].forEach(input => input.addEventListener('input', updateFit));
element<HTMLButtonElement>('#reset-fit').addEventListener('click', resetFit);
async function selectProduct(next:number) {
  if(next===requested||(next===selected&&requested===null))return;
  const revision=++selectionRevision,target=session;
  requested=next;
  renderProductSelection(`Memuat ${productNames[next]}… Pilihan aktif: ${productNames[selected]}.`);
  try {
    await target.setGlasses(glasses[next]!);
    if(revision!==selectionRevision||target!==session)return;
    selected=next;requested=null;fit=getDemoFit(selected);resetFit();
    element<HTMLElement>('#product-description').textContent=descriptions[selected]!;
    renderProductSelection(`Bingkai aktif: ${productNames[selected]}.`);
  }catch {
    if(revision!==selectionRevision||target!==session)return;
    requested=null;
    renderProductSelection(`${productNames[next]} gagal dimuat. Pilihan aktif tetap ${productNames[selected]}. Pilih bingkai lain untuk mencoba lagi.`);
  }
}
products.forEach(button=>button.addEventListener('click',()=>void selectProduct(Number(button.dataset.product))));
window.addEventListener('pagehide', () => session.dispose(), { once: true });
