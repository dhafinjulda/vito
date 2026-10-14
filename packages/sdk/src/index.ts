/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import type { VirtualTryOn, VirtualTryOnOptions, SessionStatus, TrackingHealth } from './types';
import type { WorkerRequest, WorkerResponse } from './tracking/protocol';
import { TRACKER_PROTOCOL_VERSION } from './tracking/protocol';
import { GlassesRenderer } from './rendering/GlassesRenderer';
import faceWorkerUrl from './tracking/face.worker.ts?worker&url';
import { GlassesInteraction } from './interaction/GlassesInteraction';
import { RuntimeMetrics } from './diagnostics/RuntimeMetrics';
import { QualityGovernor } from './diagnostics/QualityGovernor';
import {FrameClock} from './tracking/FrameClock';
import {SourceGeometry,type CaptureGeometry} from './tracking/SourceGeometry';
import {AssetReadiness} from './assets/AssetReadiness';
import {CameraBrandmark} from './branding/CameraBrandmark';
import {validateLensOptics} from './rendering/LensOptics';
import {validateCameraCalibration} from './glasses/calibration';
import {automaticHairEligible,eyeSpanPixels,RenderingBudget} from './diagnostics/FeaturePolicy';

export type { VirtualTryOn, VirtualTryOnOptions, SessionStatus, GlassesAsset, GlassesFit, FitState, GlassesPlacement, GlassesInteractionState, TrackingHealth, RuntimePerformance, RuntimeTimingName, TimingDistribution,CameraCalibration } from './types';
export {cameraCalibrationFromReference} from './glasses/calibration';
export { mapCoverPoint } from './glasses/coordinates';
export { deriveGlassesPose } from './glasses/pose';
export type { FaceLandmark3D, GlassesPose } from './glasses/pose';

const DEFAULT_WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const DEFAULT_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const DEFAULT_HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const DEFAULT_HAIR_MODEL='https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite';
const INFERENCE_TIMEOUT_MS = 3_000;
const HAND_INITIALIZATION_TIMEOUT_MS = 12_000;
const MAX_WORKER_RECOVERIES = 2;
// A hard 200 ms cutoff made valid CPU/acquisition results permanently invisible.
// Keep a bounded display age, independently of the worker's 3-second watchdog.
const MAX_RESULT_AGE_MS = 1_000;
const MAX_POSE_SILENCE_MS = 750;
const CAPTURE_TIMEOUT_MS = 2_000;
const MAX_TRACKING_INPUT_WIDTH = 640;

export function createVirtualTryOn(input: VirtualTryOnOptions): VirtualTryOn {
  const options={...input,presentation:input.presentation??'auto',adaptiveQuality:input.adaptiveQuality??true,cameraCompositing:input.cameraCompositing??true,
    lensOptics:input.lensOptics??(input.cameraCompositing===false?false:{})};
  if (!options.container) throw new Error('A container element is required.');
  if(options.lensOptics&&!options.cameraCompositing)throw new Error('lensOptics requires cameraCompositing.');
  if(options.lensOptics)validateLensOptics(options.lensOptics);
  if(options.cameraCalibration)validateCameraCalibration(options.cameraCalibration);
  if(options.cameraFov!==undefined&&(!Number.isFinite(options.cameraFov)||options.cameraFov<35||options.cameraFov>95))throw new Error('cameraFov must be between 35 and 95 degrees.');
  if(options.faceReferenceEyeSpanCm!==undefined&&(!Number.isFinite(options.faceReferenceEyeSpanCm)||options.faceReferenceEyeSpanCm<3||options.faceReferenceEyeSpanCm>14))throw new Error('faceReferenceEyeSpanCm must be between 3 and 14 cm.');
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('aria-label', 'Local camera preview');
  const canvas = document.createElement('canvas');
  // Normalize camera textures into bounded RGBA input. Direct video ImageBitmap
  // transfer can stall on native camera texture formats despite blank tests.
  const processingCanvas = document.createElement('canvas');
  const processingContext = processingCanvas.getContext('2d', {alpha:false,willReadFrequently:true});
  canvas.setAttribute('aria-hidden', 'true');
  const mirror = options.mirror ?? true;
  const mediaStyle = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
  Object.assign(options.container.style, { position: options.container.style.position || 'relative', overflow: 'hidden' });
  Object.assign(video.style, { cssText: mediaStyle, transform: mirror ? 'scaleX(-1)' : 'none' });
  Object.assign(canvas.style, { cssText: `${mediaStyle}pointer-events:none;`, transform: mirror ? 'scaleX(-1)' : 'none' });
  options.container.append(video, canvas);
  const brandmark = new CameraBrandmark(options.container);

  let status: SessionStatus = 'idle';
  let stream: MediaStream | null = null;
  let worker: Worker | null = null;
  let renderer: GlassesRenderer | null = null;
  let disposed = false;
  let startAbort:AbortController|null=null;
  let generation = 0;
  let framePending = false;
  let frameCallback = 0;
  let frameCallbackIsVideo = false;
  let frameTimeout: number | null = null;
  let captureTimeout: number | null = null;
  let pumpTimer: number | null = null;
  let trackerReady = false;
  let pendingTimestamp: number | null = null;
  let lastVideoCallbackAt = -Infinity;
  let decodedMediaTime:number|undefined;
  let decodedFrameCount=0,fallbackMediaTime:number|undefined;
  const mediaTime=()=>{
    if(decodedMediaTime===undefined)return video.currentTime;
    if(performance.now()-lastVideoCallbackAt<=250)return decodedMediaTime;
    // A playing element's clock can advance while its camera picture is frozen.
    // The backup pump requires decoded-frame evidence when rVFC goes silent.
    const count=video.getVideoPlaybackQuality?.().totalVideoFrames;
    if(count!==undefined&&count!==decodedFrameCount) {
      decodedFrameCount=count;fallbackMediaTime=video.currentTime;
    }
    return fallbackMediaTime??decodedMediaTime;
  };
  let lastCaptureAt = -Infinity;
  let readyResolve: (() => void) | null = null;
  let readyReject: ((error: Error) => void) | null = null;
  const assets=new AssetReadiness();
  let renderCallback = 0;
  let lastFitNotification = 0;
  let lastFaceResultAt: number | null = null;
  const metrics=new RuntimeMetrics(Boolean(options.onTrackingHealthChange));
  const quality=new QualityGovernor(true);
  const renderingBudget=new RenderingBudget();
  let compositingActive=false,hairEnabledForRun=false,optionalSuppressed=false;
  const frameClock=new FrameClock();
  const sourceGeometry=new SourceGeometry();
  let latestCapture:{timestampMs:number;geometry:CaptureGeometry}|null=null;
  let cameraStalled=false;
  let pendingInferenceCost:number|null=null;
  let startedAt=0;
  let pendingCaptureStartAt:number|null=null;
  let pendingCaptureMediaTime:number|undefined;
  let pendingSubmissionCaptureAt:number|null=null;
  let lastPresentedFrames:number|null=null;
  let health: TrackingHealth = {phase:'stopped',delegate:null,framesSent:0,resultsReceived:0,restarts:0,lastLatencyMs:null,inputWidth:0,inputHeight:0};
  let lastHealthNotification = -Infinity;
  const notifyHealth = (force = false) => {
    const now = performance.now();
    if (!force && now - lastHealthNotification < 500) return;
    lastHealthNotification = now;
    options.onTrackingHealthChange?.({...health,pixelRatio:renderer?.pixelRatio,performance:metrics.snapshot(now)});
  };
  const interaction = new GlassesInteraction(Boolean(options.handInteraction));
  let lastInteraction = '';
  let appliedHeld:typeof interaction.heldPose=null;
  let appliedHands:typeof interaction.occludingHands|null=null;
  let appliedProgress=0;
  const notifyInteraction = () => {
    const state = interaction.snapshot();
    const key = `${state.availability}/${state.phase}/${state.placement}/${Math.round(state.progress * 100)}/${state.handVisible}/${state.grippingHands}/${state.contactFingers}/${state.feedback}`;
    if (key === lastInteraction) return;
    lastInteraction = key;
    if(options.adaptiveQuality&&options.handInteraction&&worker)worker.postMessage({type:'hand-activity',active:state.handVisible||state.phase!=='idle'} satisfies WorkerRequest);
    if(hairEnabledForRun&&worker)worker.postMessage({type:'hair-activity',active:state.placement==='face'&&state.phase!=='dragging'&&state.phase!=='settling'} satisfies WorkerRequest);
    options.onInteractionChange?.(state);
  };
  const applyInteraction=()=>{
    const state=interaction.snapshot(),held=interaction.heldPose,hands=interaction.occludingHands;
    if(appliedProgress!==state.progress) {renderer?.setPlacementProgress(state.progress);appliedProgress=state.progress;}
    if(appliedHeld!==held||appliedHands!==hands) {renderer?.setHeldPose(held,hands);appliedHeld=held;appliedHands=hands;}
    notifyInteraction();
  };
  const observeSourceGeometry=()=>{
    if(!sourceGeometry.observe(video.videoWidth,video.videoHeight))return;
    // A fit, pinch depth and hair projection from the old camera aspect cannot
    // be reused in the new one, including while a bitmap/result is pending.
    lastFaceResultAt=null;pendingSubmissionCaptureAt=null;
    quality.observeFaceSupport(null);
    interaction.reset();applyInteraction();
    renderer?.setPose(null,video.videoWidth,video.videoHeight);
    renderer?.clearHairMask?.();
    renderer?.clearLocalAmbientSample();
    setStatus('searching','Ukuran kamera berubah. Menyesuaikan pelacakan kembali.');
  };
  const resizeObserver = new ResizeObserver(() => renderer?.resize());
  resizeObserver.observe(options.container);

  const setStatus = (next: SessionStatus, message?: string) => {
    if (status === next && !message) return;
    status = next;
    options.onStatusChange?.(next, message);
  };
  const stopCamera = () => {
    brandmark.setVisible(false);
    generation++;
    const cancellation=new Error('Camera startup cancelled.');cancellation.name='AbortError';
    startAbort?.abort(cancellation);startAbort=null;
    if (frameCallback) {
      if (frameCallbackIsVideo && 'cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(frameCallback);
      else cancelAnimationFrame(frameCallback);
    }
    frameCallback = 0;
    if (pumpTimer !== null) window.clearInterval(pumpTimer);
    pumpTimer = null;
    if (captureTimeout !== null) window.clearTimeout(captureTimeout);
    captureTimeout = null;
    if (frameTimeout !== null) window.clearTimeout(frameTimeout);
    frameTimeout = null;
    if (stream) for (const track of stream.getTracks()) track.stop();
    renderer?.setCameraVideo(null);video.style.opacity='1';
    stream = null;
    video.srcObject = null;
    framePending = false;
    pendingTimestamp = null;trackerReady = false;
    pendingCaptureStartAt=pendingSubmissionCaptureAt=null;lastPresentedFrames=null;
    pendingCaptureMediaTime=undefined;
    latestCapture=null;sourceGeometry.reset();
    frameClock.reset();
    decodedFrameCount=0;fallbackMediaTime=undefined;
    cameraStalled=false;
    processingCanvas.width = processingCanvas.height = 0;
    lastVideoCallbackAt = lastCaptureAt = -Infinity;
    decodedMediaTime=undefined;
    lastFaceResultAt = null;
    renderer?.clearLocalAmbientSample();
    if (worker) {
      readyReject?.(new Error('Camera session stopped while the tracker was starting.'));
      readyResolve = null;
      readyReject = null;
      worker.terminate();
      worker = null;
    }
    readyResolve = null;
    readyReject = null;
    interaction.reset();
    interaction.setAvailability(options.handInteraction ? 'loading' : 'disabled');
    applyInteraction();renderer?.setPose(null, video.videoWidth, video.videoHeight);
    compositingActive=false;hairEnabledForRun=false;
    health.phase='stopped';health.cameraCompositing='disabled';health.hairTracking='disabled';notifyHealth(true);
    metrics.reset(performance.now());
    quality.reset();renderer?.setPixelRatioCap(quality.pixelRatioCap);
  };
  const fail = (error: Error) => {
    stopCamera();
    health.phase='failed';notifyHealth(true);
    setStatus('error', error.message);
    options.onError?.(error);
  };
  const fallbackRendering=(reason:'render-failure'|'render-budget')=>{
    compositingActive=false;video.style.opacity='1';renderer?.disableCameraCompositing();
    health.cameraCompositing='fallback';health.featureFallback=reason;notifyHealth(true);
  };
  const renderLoop = () => {
    if (disposed) return;
    if(trackerReady)observeSourceGeometry();
    if(trackerReady&&frameClock.observe(mediaTime(),performance.now()))cameraStalled=false;
    if(trackerReady&&!cameraStalled&&frameClock.stalled(performance.now())) {
      cameraStalled=true;
      quality.observeFaceSupport(null);
      if(lastFaceResultAt!==null)renderer?.setPose(null,video.videoWidth,video.videoHeight);
      lastFaceResultAt=null;interaction.reset();applyInteraction();
      setStatus('searching','Frame kamera belum diperbarui. Menunggu kamera kembali berjalan.');
    }
    if (lastFaceResultAt !== null && performance.now() - lastFaceResultAt > MAX_POSE_SILENCE_MS) {
      lastFaceResultAt = null;
      quality.observeFaceSupport(null);
      renderer?.setPose(null, video.videoWidth, video.videoHeight);
      interaction.onFaceLost();applyInteraction();
      setStatus('searching', 'Pelacakan belum diperbarui. Tunggu wajah terbaca kembali.');
    }
    if(options.handInteraction) {interaction.tick(performance.now(),interaction.snapshot().phase==='settling'?renderer?.getGrabContext():undefined);applyInteraction();}
    const renderStartedAt=performance.now();
    if(trackerReady)metrics.event('animation',renderStartedAt);
    let drawn=false;
    try {
      drawn=renderer?.render(false,renderStartedAt,mediaTime())??false;
      if(drawn&&(renderer?.hasShaderFailure||renderer?.hasVideoUploadFailure))throw new Error('Optional rendering shader/video upload failed.');
    } catch(error) {
      if(compositingActive||hairEnabledForRun) {
        hairEnabledForRun=false;renderer?.disableHairOcclusion();worker?.postMessage({type:'disable-hair'} satisfies WorkerRequest);health.hairTracking='unavailable';
        if(compositingActive)fallbackRendering('render-failure');else {health.featureFallback='render-failure';notifyHealth(true);}
      }
      else {fail(error instanceof Error?error:new Error('Rendering failed.'));}
    }
    if(drawn&&compositingActive&&renderer?.cameraBackgroundReady){video.style.opacity='0';health.cameraCompositing='active';}
    if(drawn&&trackerReady) {
      const submittedAt=performance.now();
      metrics.timing('renderSubmission',submittedAt-renderStartedAt,submittedAt);metrics.event('render',submittedAt);
      if(options.adaptiveQuality){quality.observeRender(submittedAt-renderStartedAt,submittedAt);renderer?.setPixelRatioCap(quality.pixelRatioCap);}
      if(compositingActive&&renderingBudget.observe(submittedAt-renderStartedAt,submittedAt,renderer?.pixelRatio??1))fallbackRendering('render-budget');
      if(pendingSubmissionCaptureAt!==null)metrics.timing('captureToSubmission',submittedAt-pendingSubmissionCaptureAt,submittedAt);
      pendingSubmissionCaptureAt=null;
    }
    if(trackerReady)notifyHealth();
    renderCallback = requestAnimationFrame(renderLoop);
  };
  renderCallback = requestAnimationFrame(renderLoop);

  const instance: VirtualTryOn = {
    video,
    canvas,
    get status() { return status; },
    async start() {
      if (disposed) throw new Error('This SDK instance has been disposed.');
      if (stream) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        const error = new Error('Camera access requires HTTPS or localhost and a supported browser.');
        fail(error);
        throw error;
      }
      const run = ++generation;
      const abort=new AbortController();startAbort=abort;
      startedAt=performance.now();metrics.reset(startedAt);
      quality.reset();pendingInferenceCost=null;
      renderingBudget.reset();optionalSuppressed=false;
      frameClock.reset();
      sourceGeometry.reset();latestCapture=null;
      decodedFrameCount=0;fallbackMediaTime=undefined;
      cameraStalled=false;
      health={phase:'starting',delegate:null,framesSent:0,resultsReceived:0,restarts:0,lastLatencyMs:null,inputWidth:0,inputHeight:0,hairTracking:options.hairOcclusion?'loading':'disabled'};notifyHealth(true);
      setStatus('requesting-camera');
      try {
        const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
        if (disposed || run !== generation) {
          acquired.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = acquired;
        for (const track of acquired.getTracks()) track.addEventListener('ended', () => {
          if (run === generation && !disposed) fail(new Error('The camera stream ended.'));
        }, { once: true });
        video.srcObject = acquired;
        await video.play();
        if (disposed || run !== generation) return;
        brandmark.setVisible(true);
        sourceGeometry.observe(video.videoWidth,video.videoHeight);
        await assets.wait(abort.signal);
        if (disposed || run !== generation) return;
        renderer?.resetFeatureFallbacks?.();
        compositingActive=options.cameraCompositing;
        if(compositingActive)renderer?.setCameraVideo(video);
        hairEnabledForRun=options.hairOcclusion!==false&&(options.hairOcclusion!==undefined||automaticHairEligible(renderer?.templeEffectMeshCount??0,navigator.hardwareConcurrency,(navigator as Navigator&{deviceMemory?:number}).deviceMemory));
        health.hairTracking=hairEnabledForRun?'loading':'disabled';health.cameraCompositing=compositingActive?'active':'disabled';
        if(!hairEnabledForRun){renderer?.disableHairOcclusion?.();if(options.hairOcclusion!==false)health.featureFallback='device-or-asset';}
        setStatus('loading-tracker');
        try {renderer?.warmup?.();}
        catch {hairEnabledForRun=false;renderer?.disableHairOcclusion?.();fallbackRendering('render-failure');}
        if(disposed||run!==generation)return;
        let recoveries = 0;
        let recoveryTask: Promise<void> | null = null;
        let recoverTracker: (error: Error, runId: number, failedWorker: Worker) => void;
        let handLoadingUntil=0;
        const armInferenceTimeout=(targetWorker:Worker)=>{
          if(frameTimeout!==null)window.clearTimeout(frameTimeout);
          const timeout=handLoadingUntil?Math.max(1,handLoadingUntil-performance.now()):INFERENCE_TIMEOUT_MS;
          frameTimeout=window.setTimeout(()=>recoverTracker(new Error('Face tracking inference timed out.'),run,targetWorker),timeout);
        };
        const initializeTracker = async (): Promise<void> => {
          if (disposed || run !== generation) throw new Error('The camera session ended while the tracker was restarting.');
          // MediaPipe's WASM loader uses importScripts, which module workers disable.
          // Vite bundles this worker to a self-contained classic-worker asset.
          const activeWorker = new Worker(faceWorkerUrl, { name: 'vto-face-landmarker' });
          worker = activeWorker;
          trackerReady = false;
          handLoadingUntil=0;
          let initializing = true;
          let facePrepared=false;
          let optionalInitTimeout:number|null=null;
          const warmedStages=new Set<'hand'|'hair'>();
          const clearOptionalDeadline=()=>{if(optionalInitTimeout!==null)window.clearTimeout(optionalInitTimeout);optionalInitTimeout=null;};
          const armOptionalDeadline=(stage:'hand'|'hair')=>{
            if(!initializing||warmedStages.has(stage))return;
            warmedStages.add(stage);clearOptionalDeadline();
            optionalInitTimeout=window.setTimeout(()=>readyReject?.(new Error(`Optional ${stage} startup timed out.`)),HAND_INITIALIZATION_TIMEOUT_MS);
          };
          let handsRequested = false;
          let hairRequested=false,firstFaceRendered=false;
          const requestHair=()=>{
            if(!hairEnabledForRun||optionalSuppressed||hairRequested||!firstFaceRendered||disposed||worker!==activeWorker||run!==generation)return;
            hairRequested=true;activeWorker.postMessage({type:'enable-hair'} satisfies WorkerRequest);
          };
          const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
          const initTimeout = window.setTimeout(() => readyReject?.(new Error('Tracker startup timed out.')), !optionalSuppressed&&(options.handInteraction||hairEnabledForRun)?40_000:20_000);
          activeWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            if (run !== generation || disposed || worker !== activeWorker) return;
            const message = event.data;
            let captureMatches=true;
            if(message.type==='result'||message.type==='hand-result'||message.type==='hair-result') {
              observeSourceGeometry();
              captureMatches=!latestCapture||message.timestampMs===latestCapture.timestampMs&&sourceGeometry.matches(latestCapture.geometry);
            }
            if(message.type==='face-ready'){facePrepared=true;}
            else if (message.type === 'ready') {
              if (message.protocolVersion !== TRACKER_PROTOCOL_VERSION) {
                readyReject?.(new Error('Tracker runtime version does not match the SDK. Reload the page to load the current worker.'));
                readyResolve=null;readyReject=null;return;
              }
              initializing = false;
              handsRequested=message.handTracking==='ready'||message.handTracking==='unavailable'||optionalSuppressed;
              hairRequested=message.hairTracking!==undefined||optionalSuppressed;
              if(message.hairTracking)health.hairTracking=optionalSuppressed&&hairEnabledForRun?'unavailable':message.hairTracking;
              trackerReady = true;
              metrics.reset(performance.now());
              quality.reset();pendingInferenceCost=null;renderer?.setPixelRatioCap(quality.pixelRatioCap);
              health.startupMs=performance.now()-startedAt;
              health.phase='running';health.delegate=message.delegate??null;notifyHealth(true);
              readyResolve?.(); readyResolve = null; readyReject = null;
              setStatus('searching', recoveries ? 'Pelacakan lokal tersambung kembali.' : undefined);
              interaction.setAvailability(optionalSuppressed&&options.handInteraction?'unavailable':message.handTracking ?? (options.handInteraction ? 'unavailable' : 'disabled'));
              notifyInteraction();
            } else if (message.type === 'result') {
              const age = performance.now() - message.timestampMs;
              const receivedAt=performance.now();
              metrics.event('face',receivedAt);metrics.timing('resultAge',age,receivedAt);
              if(message.faceInferenceMs!==undefined)metrics.timing('faceInference',message.faceInferenceMs,receivedAt);
              if(options.adaptiveQuality&&message.timestampMs===pendingTimestamp&&message.faceInferenceMs!==undefined)pendingInferenceCost=message.faceInferenceMs;
              health.resultsReceived++;health.lastLatencyMs=Math.max(0,Math.round(age));notifyHealth();
              if (!Number.isFinite(age) || age < -50 || age > MAX_RESULT_AGE_MS || frameClock.stalled(receivedAt)) {
                quality.observeFaceSupport(null);
                lastFaceResultAt = null;
                renderer?.setPose(null, video.videoWidth, video.videoHeight);
                interaction.onFaceLost();applyInteraction();
                setStatus('searching', 'Hasil pelacakan terlambat dan diabaikan.');
                return;
              }
              if(!captureMatches)return;
              const fitStartedAt=performance.now();
              const mediaTime=message.timestampMs===pendingTimestamp?pendingCaptureMediaTime:undefined;
              let fitState;
              const geometry=latestCapture?.geometry;
              const sourceWidth=geometry?.width??video.videoWidth,sourceHeight=geometry?.height??video.videoHeight;
              try {fitState=(options.presentation==='predicted'||options.presentation==='auto')&&mediaTime!==undefined?renderer?.setPose(message.landmarks,sourceWidth,sourceHeight,message.faceMatrix??null,message.timestampMs,mediaTime):renderer?.setPose(message.landmarks,sourceWidth,sourceHeight,message.faceMatrix??null,message.timestampMs);}
              catch(error){fail(error instanceof Error?error:new Error('Fitting failed.'));return;}
              quality.observeFaceSupport(fitState?.visible?eyeSpanPixels(message.landmarks,geometry?.inputWidth??health.inputWidth,geometry?.inputHeight??health.inputHeight):null);
              metrics.timing('fit',performance.now()-fitStartedAt,performance.now());
              if(fitState?.visible)pendingSubmissionCaptureAt=message.timestampMs===pendingTimestamp?pendingCaptureStartAt??message.timestampMs:message.timestampMs;
              // Expire silence since receipt, independently of capture latency.
              // Using capture age here flickered at a 500 ms inference cadence.
              lastFaceResultAt = fitState?.visible ? performance.now() : null;
              if (!fitState?.visible) {interaction.onFaceLost();applyInteraction();}
              setStatus(fitState?.visible ? 'tracking' : 'searching');
              // Hands cannot delay the first face-mounted render. The optional
              // graph is downloaded/initialized only after a valid visible fit.
              if (fitState?.visible && options.handInteraction && !handsRequested) {
                handsRequested = true;
                requestAnimationFrame(() => {
                  if (!disposed && run === generation && worker === activeWorker) activeWorker.postMessage({type:'enable-hands'} satisfies WorkerRequest);
                });
              }
              if(hairEnabledForRun&&fitState?.visible&&!firstFaceRendered)requestAnimationFrame(()=>{
                if(disposed||run!==generation||worker!==activeWorker)return;
                firstFaceRendered=true;
                if(!options.handInteraction||interaction.snapshot().availability==='unavailable'||interaction.snapshot().availability==='ready')requestHair();
              });
              if (fitState && performance.now() - lastFitNotification > 100) {
                lastFitNotification = performance.now();
                options.onFitStateChange?.(fitState);
              }
            } else if(message.type==='hand-result') {
              if(!captureMatches)return;
              metrics.event('hand',performance.now());
              if(message.handInferenceMs!==undefined)metrics.timing('handInference',message.handInferenceMs,performance.now());
              if(options.adaptiveQuality&&message.timestampMs===pendingTimestamp&&pendingInferenceCost!==null&&message.handInferenceMs!==undefined)pendingInferenceCost+=message.handInferenceMs;
              if(performance.now()-message.timestampMs<=450&&!frameClock.stalled(performance.now())) interaction.update(message.hands,message.timestampMs,renderer?.getGrabContext()??null,performance.now());
              else interaction.tick(performance.now());
              applyInteraction();
              if(interaction.heldPose)pendingSubmissionCaptureAt=message.timestampMs===pendingTimestamp?pendingCaptureStartAt??message.timestampMs:message.timestampMs;
            } else if(message.type==='frame-done') {
              if (pendingTimestamp !== message.timestampMs) return;
              if(options.adaptiveQuality&&pendingInferenceCost!==null)quality.observeTracking(pendingInferenceCost,performance.now());
              pendingInferenceCost=null;
              if(frameTimeout!==null) window.clearTimeout(frameTimeout);frameTimeout=null;framePending=false;
              pendingTimestamp=null;
              pendingCaptureStartAt=null;
              pendingCaptureMediaTime=undefined;
            } else if (message.type === 'hand-unavailable') {
              clearOptionalDeadline();
              handLoadingUntil=0;if(pendingTimestamp!==null)armInferenceTimeout(activeWorker);
              if(message.reason){health.featureFallback=message.reason==='budget'?'hand-budget':'hand-failure';notifyHealth(true);}
              interaction.setAvailability('unavailable');applyInteraction();
              requestHair();
            } else if (message.type === 'hand-loading') {
              armOptionalDeadline('hand');
              // Native graph compilation can synchronously block this shared
              // worker. Give this one phase a bounded deadline, not an endless
              // sequence of watchdog extensions. Face freshness is unchanged.
              if(!handLoadingUntil)handLoadingUntil=performance.now()+HAND_INITIALIZATION_TIMEOUT_MS;
              if(pendingTimestamp!==null)armInferenceTimeout(activeWorker);
            } else if (message.type === 'hand-ready') {
              clearOptionalDeadline();
              handLoadingUntil=0;if(pendingTimestamp!==null)armInferenceTimeout(activeWorker);
              health.handStartupMs=message.startupMs;
              interaction.setAvailability('ready');applyInteraction();
              requestHair();
            } else if(message.type==='hair-loading') {
              armOptionalDeadline('hair');
              health.hairTracking='loading';
              if(!handLoadingUntil)handLoadingUntil=performance.now()+HAND_INITIALIZATION_TIMEOUT_MS;
              if(pendingTimestamp!==null)armInferenceTimeout(activeWorker);notifyHealth(true);
            } else if(message.type==='hair-ready'||message.type==='hair-unavailable') {
              clearOptionalDeadline();
              health.hairTracking=message.type==='hair-ready'?'ready':'unavailable';
              if(message.type==='hair-ready')health.hairStartupMs=message.startupMs;
              else {renderer?.disableHairOcclusion?.();health.featureFallback=message.reason==='budget'?'hair-budget':'hair-failure';}
              handLoadingUntil=0;if(pendingTimestamp!==null)armInferenceTimeout(activeWorker);notifyHealth(true);
            } else if(message.type==='hair-result') {
              if(!captureMatches){message.data.fill(0);return;}
              metrics.timing('hairInference',message.inferenceMs,performance.now());
              if(options.adaptiveQuality&&message.timestampMs===pendingTimestamp&&pendingInferenceCost!==null)pendingInferenceCost+=message.inferenceMs;
              if(performance.now()-message.timestampMs<=500&&!frameClock.stalled(performance.now()))renderer?.setHairMask(message.data,message.width,message.height,message.timestampMs);
              else message.data.fill(0);
            } else if (message.type === 'error') {
              const failure = new Error(message.message);
              if (initializing) {
                readyReject?.(failure); readyResolve = null; readyReject = null;
              } else {
                recoverTracker(failure, run, activeWorker);
              }
            }
          };
          activeWorker.onerror = () => {
            const failure = new Error('Face tracking worker failed.');
            if (initializing) {
              readyReject?.(failure); readyResolve = null; readyReject = null;
            } else {
              recoverTracker(failure, run, activeWorker);
            }
          };
          activeWorker.postMessage({ type: 'init', delegate:recoveries?'CPU':'GPU',adaptiveQuality:options.adaptiveQuality,prewarmOptional:true,inputWidth:Math.min(640,video.videoWidth||640),inputHeight:Math.round((video.videoHeight||360)*Math.min(640,video.videoWidth||640)/(video.videoWidth||640)),hairAuto:options.hairOcclusion===undefined, wasmRoot: options.wasmRoot ?? DEFAULT_WASM_ROOT, modelAssetPath: options.modelAssetPath ?? DEFAULT_MODEL, cacheRuntimeAssets: options.cacheRuntimeAssets ?? false, handModelAssetPath: !optionalSuppressed&&options.handInteraction ? options.handInteraction.modelAssetPath ?? DEFAULT_HAND_MODEL : undefined,hairModelAssetPath:!optionalSuppressed&&hairEnabledForRun?(options.hairOcclusion||{}).modelAssetPath??DEFAULT_HAIR_MODEL:undefined } satisfies WorkerRequest);
          try { await ready; }
          catch (error) {
            if (worker === activeWorker) { activeWorker.terminate(); worker = null; }
            if(facePrepared&&!optionalSuppressed&&(options.handInteraction||hairEnabledForRun)&&!disposed&&run===generation) {
              optionalSuppressed=true;recoveries++;health.restarts=recoveries;health.featureFallback='optional-startup';health.hairTracking='unavailable';
              renderer?.disableHairOcclusion?.();interaction.setAvailability(options.handInteraction?'unavailable':'disabled');notifyHealth(true);
              window.clearTimeout(initTimeout);clearOptionalDeadline();return initializeTracker();
            }
            throw error;
          } finally { window.clearTimeout(initTimeout);clearOptionalDeadline(); }
        };
        recoverTracker = (failure, runId, failedWorker) => {
          if (disposed || runId !== generation || worker !== failedWorker || recoveryTask) return;
          if (frameTimeout !== null) window.clearTimeout(frameTimeout);
          frameTimeout = null;
          if (captureTimeout !== null) window.clearTimeout(captureTimeout);
          captureTimeout = null;
          framePending = false;
          pendingTimestamp=null;trackerReady=false;
          pendingCaptureStartAt=pendingSubmissionCaptureAt=null;
          pendingCaptureMediaTime=undefined;
          latestCapture=null;
          lastFaceResultAt = null;
          interaction.reset();interaction.setAvailability(options.handInteraction?'loading':'disabled');applyInteraction();renderer?.setPose(null,video.videoWidth,video.videoHeight);
          if (recoveries >= MAX_WORKER_RECOVERIES) {
            fail(new Error(`Face tracker could not recover after ${MAX_WORKER_RECOVERIES} local restarts: ${failure.message}`));
            return;
          }
          recoveries++;
          optionalSuppressed=true;health.featureFallback='worker-recovery';renderer?.disableHairOcclusion?.();
          health.phase='recovering';health.restarts=recoveries;health.hairTracking=options.hairOcclusion?'loading':'disabled';notifyHealth(true);
          setStatus('loading-tracker', `Pelacakan macet. Menyambungkan ulang dengan CPU (${recoveries}/${MAX_WORKER_RECOVERIES})…`);
          failedWorker.terminate();
          worker = null;
          recoveryTask = initializeTracker().catch((error: unknown) => {
            if (!disposed && runId === generation) fail(error instanceof Error ? error : new Error('Could not restart face tracking.'));
          }).finally(() => { recoveryTask = null; });
        };
        await initializeTracker();
        const submitFrame = (now: number) => {
          if (disposed || run !== generation) return;
          observeSourceGeometry();
          if(frameClock.observe(mediaTime(),performance.now()))cameraStalled=false;
          renderer?.updateAmbientFromVideo(video, now);
          if (!framePending && trackerReady && worker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && (decodedMediaTime!==undefined||now-lastCaptureAt>=30)) {
            if(!frameClock.canSubmit(mediaTime()))return;
            if (!processingContext) {fail(new Error('Local camera processing canvas is unavailable.'));return;}
            const width = Math.min(options.adaptiveQuality?quality.inputWidth:MAX_TRACKING_INPUT_WIDTH,video.videoWidth);
            const height = Math.max(1,Math.round(video.videoHeight*width/video.videoWidth));
            if (!width || !Number.isFinite(height)) return;
            if (processingCanvas.width !== width || processingCanvas.height !== height) {processingCanvas.width=width;processingCanvas.height=height;}
            const captureStartedAt=performance.now();
            const captureMediaTime=mediaTime();
            const captureGeometry=sourceGeometry.capture(width,height);
            try {processingContext.drawImage(video,0,0,width,height);}
            catch (error) {fail(error instanceof Error?error:new Error('Could not normalize the camera frame.'));return;}
            framePending = true;
            frameClock.markSubmitted(captureMediaTime);
            metrics.timing('captureDraw',performance.now()-captureStartedAt,performance.now());
            lastCaptureAt = now;
            const targetWorker = worker;
            // Capture and inference have distinct watchdogs. A capture failure
            // must not be misreported as a MediaPipe inference timeout.
            captureTimeout = window.setTimeout(() => recoverTracker(new Error('Local camera frame capture timed out.'), run, targetWorker), CAPTURE_TIMEOUT_MS);
            const timestampMs=performance.now();
            const bitmapStartedAt=performance.now();
            createImageBitmap(processingCanvas).then((bitmap) => {
              if (disposed || run !== generation || worker !== targetWorker) { bitmap.close(); return; }
              if(captureTimeout!==null)window.clearTimeout(captureTimeout);captureTimeout=null;
              observeSourceGeometry();
              if(!sourceGeometry.matches(captureGeometry)) {bitmap.close();framePending=false;return;}
              metrics.timing('bitmap',performance.now()-bitmapStartedAt,performance.now());
              try {
                pendingTimestamp=timestampMs;
                pendingCaptureStartAt=captureStartedAt;
                pendingCaptureMediaTime=captureMediaTime;
                latestCapture={timestampMs,geometry:captureGeometry};
                armInferenceTimeout(targetWorker);
                targetWorker.postMessage({ type: 'frame', bitmap, timestampMs } satisfies WorkerRequest, [bitmap]);
                health.framesSent++;health.inputWidth=width;health.inputHeight=height;notifyHealth();
                metrics.event('capture',performance.now());
              } catch (error) {
                bitmap.close();
                if (frameTimeout !== null) window.clearTimeout(frameTimeout);
                frameTimeout = null;
                framePending = false;
                fail(error instanceof Error ? error : new Error('Could not transfer the local camera frame to the worker.'));
              }
            }).catch((error: unknown) => { if (disposed || run !== generation || worker !== targetWorker) return; framePending = false; fail(error instanceof Error ? error : new Error('Could not read the local camera frame.')); });
          }
        };
        const schedule = (now: number,metadata?:VideoFrameCallbackMetadata) => {
          if (disposed || run !== generation) return;
          lastVideoCallbackAt=performance.now();
          if(metadata&&Number.isFinite(metadata.mediaTime)&&metadata.mediaTime>=0) {
            decodedMediaTime=metadata.mediaTime;fallbackMediaTime=undefined;
            decodedFrameCount=video.getVideoPlaybackQuality?.().totalVideoFrames??0;
          }
          if(metadata&&Number.isFinite(metadata.presentedFrames)) {
            const frames=metadata.presentedFrames;
            metrics.event('camera',lastVideoCallbackAt,lastPresentedFrames===null?1:Math.max(0,frames-lastPresentedFrames));lastPresentedFrames=frames;
          }
          submitFrame(now);
          if ('requestVideoFrameCallback' in video) { frameCallbackIsVideo = true; frameCallback = video.requestVideoFrameCallback(schedule); }
          else { frameCallbackIsVideo = false; frameCallback = requestAnimationFrame(schedule); }
        };
        if ('requestVideoFrameCallback' in video) { frameCallbackIsVideo = true; frameCallback = video.requestVideoFrameCallback(schedule); }
        else { frameCallbackIsVideo = false; frameCallback = requestAnimationFrame(schedule); }
        // Some embedded/mobile browsers stop delivering video callbacks while
        // the stream remains live. Keep a bounded independent capture pump.
        pumpTimer=window.setInterval(()=>{
          const now=performance.now();
          if(now-lastVideoCallbackAt>250)submitFrame(now);
        },100);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error('Could not start the virtual try-on.');
        if (run === generation) fail(failure);
        throw failure;
      }
    },
    stop() {
      if (disposed) return;
      stopCamera();
      setStatus('idle');
    },
    async setGlasses(asset) {
      if (disposed) throw new Error('This SDK instance has been disposed.');
      interaction.reset();applyInteraction();
      let load:Promise<void>;
      try {
        renderer ??= new GlassesRenderer(canvas, { fit: options.fit, cameraFov: options.cameraFov, faceOcclusion: options.faceOcclusion, smoothing: options.smoothing, ambientLighting: options.ambientLighting, presentation:options.presentation,cameraCalibration:options.cameraCalibration,faceReferenceEyeSpanCm:options.faceReferenceEyeSpanCm,lensOptics:options.lensOptics,hairOcclusion:options.hairOcclusion!==false });
        load=renderer.load(asset);
      } catch(error) {load=Promise.reject(error);}
      await assets.track(load);
    },
    setFit(fit) { if (disposed) throw new Error('This SDK instance has been disposed.'); renderer?.setFit(fit); },
    setPlacement(placement) {
      if (disposed) throw new Error('This SDK instance has been disposed.');
      if (placement !== 'face' && placement !== 'head') throw new Error('Placement must be face or head.');
      interaction.setPlacement(placement);applyInteraction();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(renderCallback);
      stopCamera();
      renderer?.dispose();
      renderer = null;
      resizeObserver.disconnect();
      video.remove(); canvas.remove(); brandmark.dispose();
      setStatus('disposed');
    },
  };

  const start = instance.start.bind(instance);
  let starting:{generation:number;promise:Promise<void>}|null=null;
  instance.start = () => {
    if (disposed) return Promise.reject(new Error('This SDK instance has been disposed.'));
    if(starting?.generation===generation)return starting.promise;
    const promise=start().finally(()=>{if(starting?.promise===promise)starting=null;});
    starting={generation,promise};
    return promise;
  };

  const onVisibility = () => { if (document.visibilityState === 'hidden') instance.stop(); };
  const onPageHide = () => instance.stop();
  const onContextLost = (event: Event) => {
    event.preventDefault();
    if (!disposed) fail(new Error('The 3D graphics context was lost. Reload this page to restore the preview.'));
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  canvas.addEventListener('webglcontextlost', onContextLost);
  const dispose = instance.dispose.bind(instance);
  instance.dispose = () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    dispose();
  };
  const initialAsset = instance.setGlasses(options.glassesUrl);
  void initialAsset.catch((error: unknown) => {
    const failure = error instanceof Error ? error : new Error('Could not load the glasses asset.');
    options.onError?.(failure);
  });
  return instance;
}
