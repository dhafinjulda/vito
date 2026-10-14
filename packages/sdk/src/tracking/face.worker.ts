/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
/// <reference lib="webworker" />
import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { WorkerRequest, WorkerResponse } from './protocol';
import { TRACKER_PROTOCOL_VERSION } from './protocol';
import { prepareRuntimeAssets } from './runtime-assets';
import {HandCadence} from './HandCadence';
import {HairTracker} from './HairTracker';

declare const self: DedicatedWorkerGlobalScope;
let landmarker: FaceLandmarker | undefined;
let handLandmarker: HandLandmarker | undefined;
let lastHandAt = -Infinity;
let handFiles: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | undefined;
let handModelPath: string | undefined;
let handStarting = false;
let revision = 0;
let activeDelegate: 'GPU' | 'CPU' = 'GPU';
let cadence:HandCadence|null=null;
const hair=new HairTracker();
let hairPath:string|undefined,hairStarting=false,hairAvailable=false,hairActive=true;
let warmWidth=640,warmHeight=360;

async function warmTask(task: FaceLandmarker | HandLandmarker) {
  const blank = new OffscreenCanvas(warmWidth, warmHeight);
  let bitmap:ImageBitmap|undefined;
  try {
    const context = blank.getContext('2d');
    if (!context) throw new Error('Tracker warmup canvas unavailable.');
    context.fillStyle = '#808080'; context.fillRect(0, 0, warmWidth, warmHeight);
    bitmap=await createImageBitmap(blank);
    task.detectForVideo(bitmap, 0);
  } finally {bitmap?.close();blank.width = blank.height = 0; }
}

async function initializeHand(files: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>, path: string) {
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  const creation = (async () => {
    try {
      return await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: path, delegate: activeDelegate }, runningMode: 'VIDEO', numHands: 2 });
    } catch {
      if (expired || activeDelegate === 'CPU') return undefined;
      return await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: path, delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2 });
    }
  })().then(task => { if (expired) { task?.close(); return undefined; } return task; });
  const timeout = new Promise<undefined>(resolve => { timer = setTimeout(() => { expired = true; resolve(undefined); }, 8_000); });
  try { return await Promise.race([creation, timeout]); }
  catch { return undefined; }
  finally { clearTimeout(timer!); }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === 'init') {
      revision++;handStarting=false;handFiles=undefined;handModelPath=message.handModelAssetPath;
      warmWidth=Number.isInteger(message.inputWidth)&&message.inputWidth!>0?Math.min(640,message.inputWidth!):640;
      warmHeight=Number.isInteger(message.inputHeight)&&message.inputHeight!>0?Math.min(1600,message.inputHeight!):360;
      hair.close();hairPath=message.hairModelAssetPath;hairStarting=false;hairAvailable=false;hairActive=true;
      activeDelegate=message.delegate??'GPU';
      landmarker?.close(); handLandmarker?.close(); handLandmarker = undefined; lastHandAt = -Infinity;
      // Optional hand safety applies even when quality adaptation is disabled.
      cadence=new HandCadence(message.adaptiveQuality??false);
      const files = await FilesetResolver.forVisionTasks(message.wasmRoot);
      const runtime = await prepareRuntimeAssets(files, message.modelAssetPath, message.cacheRuntimeAssets ?? false);
      try {
        const modelOptions = (delegate: 'GPU' | 'CPU') => runtime.modelAssetBuffer
          ? { modelAssetBuffer: runtime.modelAssetBuffer.slice(), delegate }
          : { modelAssetPath: runtime.modelAssetPath!, delegate };
        try {
          landmarker = await FaceLandmarker.createFromOptions(runtime.files, {
            baseOptions: modelOptions(activeDelegate),
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: true,
          });
        } catch {
          if(activeDelegate==='CPU')throw new Error('CPU face tracker initialization failed.');
          activeDelegate='CPU';
          landmarker = await FaceLandmarker.createFromOptions(runtime.files, {
            baseOptions: modelOptions('CPU'),
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: true,
          });
        }
      } finally {
        runtime.dispose();
      }
      // Compile the face graph in the default path as well. This blank scratch
      // frame avoids charging first-use compilation to live-result freshness.
      try { await warmTask(landmarker!); } catch { /* Actual camera inference can retry. */ }
      handFiles=files;
      if(message.prewarmOptional) {
        const initializingRevision=revision;
        self.postMessage({type:'face-ready'} satisfies WorkerResponse);
        // No live bitmap is dispatched until all requested graphs are warmed.
        // This prevents synchronous native compilation from freezing a fitted face.
        if(handModelPath)await self.onmessage?.call(self,{data:{type:'enable-hands'}} as MessageEvent<WorkerRequest>);
        if(initializingRevision!==revision)return;
        if(hairPath) {
          if(message.hairAuto&&activeDelegate!=='GPU'){hairPath=undefined;self.postMessage({type:'hair-unavailable'} satisfies WorkerResponse);}
          else await self.onmessage?.call(self,{data:{type:'enable-hair'}} as MessageEvent<WorkerRequest>);
        }
        if(initializingRevision!==revision)return;
      }
      self.postMessage({ type: 'ready', protocolVersion:TRACKER_PROTOCOL_VERSION, delegate:activeDelegate, handTracking: handModelPath ? message.prewarmOptional?handLandmarker?'ready':'unavailable':'loading' : 'disabled',...(message.prewarmOptional?{hairTracking:hairAvailable?'ready':message.hairModelAssetPath?'unavailable':'disabled'}:{} ) } satisfies WorkerResponse);
    } else if (message.type === 'enable-hands') {
      if (!handModelPath || !handFiles || handStarting || handLandmarker) return;
      handStarting=true;
      const handStartedAt=performance.now();
      self.postMessage({type:'hand-loading'} satisfies WorkerResponse);
      const activeRevision=revision;
      const task=await initializeHand(handFiles,handModelPath);
      if(activeRevision!==revision) {task?.close();return;}
      handLandmarker=task;
      if(handLandmarker) {
        try {await warmTask(handLandmarker);} catch {handLandmarker.close();handLandmarker=undefined;}
      }
      // Face messages continue while the optional model download is pending.
      self.postMessage(handLandmarker?{type:'hand-ready',startupMs:performance.now()-handStartedAt}:{type:'hand-unavailable',reason:'failure'} satisfies WorkerResponse);
    } else if(message.type==='enable-hair') {
      if(!hairPath||!handFiles||hairStarting)return;
      hairStarting=true;const started=performance.now(),activeRevision=revision;
      self.postMessage({type:'hair-loading'} satisfies WorkerResponse);
      const ready=await hair.initialize(handFiles,hairPath,activeDelegate,warmWidth,warmHeight);
      if(activeRevision!==revision){hair.close();return;}
      hairAvailable=ready;
      self.postMessage(ready?{type:'hair-ready',startupMs:performance.now()-started}:{type:'hair-unavailable'} satisfies WorkerResponse);
    } else if(message.type==='disable-hair') {
      hair.close();hairPath=undefined;hairAvailable=false;
    } else if(message.type==='hair-activity') {
      hairActive=message.active;
    } else if(message.type==='hand-activity') {
      cadence?.setActive(message.active);
    } else if (message.type === 'frame') {
      try {
        const faceStartedAt=performance.now();
        const result = landmarker?.detectForVideo(message.bitmap, message.timestampMs);
        const faceInferenceMs=performance.now()-faceStartedAt;
        const face = result?.faceLandmarks[0];
        self.postMessage({type:'result',landmarks:face?face.map(({x,y,z})=>({x,y,z})):null,faceMatrix:face?result?.facialTransformationMatrixes[0]?.data??null:null,timestampMs:message.timestampMs,faceInferenceMs} satisfies WorkerResponse);
        if (handLandmarker && message.timestampMs - lastHandAt >= (cadence?.intervalMs??100)) {
          lastHandAt = message.timestampMs;
          try {
            const handStart = performance.now();
            const hands=handLandmarker.detectForVideo(message.bitmap,message.timestampMs);
            const handInferenceMs=performance.now()-handStart;
            if(cadence?.observe(handInferenceMs,message.timestampMs)) {
              // Do not publish a final stale gesture. Face has already been
              // delivered, and the shared bitmap still closes in finally.
              handLandmarker.close();handLandmarker=undefined;handModelPath=undefined;
              self.postMessage({type:'hand-unavailable',reason:'budget'} satisfies WorkerResponse);
            } else {
              self.postMessage({type:'hand-result',hands:hands.landmarks.map((points,i)=>({landmarks:points.map(({x,y,z})=>({x,y,z})),handedness:hands.handedness?.[i]?.[0]?.categoryName??`hand-${i}`})),timestampMs:message.timestampMs,handInferenceMs} satisfies WorkerResponse);
            }
          }
          catch { handLandmarker?.close(); handLandmarker = undefined;handModelPath=undefined; self.postMessage({ type: 'hand-unavailable',reason:'failure' } satisfies WorkerResponse); }
        }
        try {
          const mask=face&&hairActive?hair.sample(message.bitmap,message.timestampMs):null;
          if(mask)self.postMessage({type:'hair-result',...mask,timestampMs:message.timestampMs} satisfies WorkerResponse,[mask.data.buffer]);
        } catch(error) {hair.close();hairAvailable=false;self.postMessage({type:'hair-unavailable',reason:error instanceof Error&&error.name==='HairBudgetError'?'budget':'failure'} satisfies WorkerResponse);}
      } finally {
        message.bitmap.close();
        self.postMessage({type:'frame-done',timestampMs:message.timestampMs} satisfies WorkerResponse);
      }
    } else {
      revision++;handFiles=undefined;handModelPath=undefined;cadence=null;
      hair.close();hairPath=undefined;
      landmarker?.close();
      handLandmarker?.close(); handLandmarker = undefined;
      landmarker = undefined;
      self.postMessage({ type: 'disposed' } satisfies WorkerResponse);
      self.close();
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Face tracker failed.' } satisfies WorkerResponse);
  }
};
