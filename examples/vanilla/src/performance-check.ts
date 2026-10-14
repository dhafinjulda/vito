/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import type {VirtualTryOn,TrackingHealth} from '@vto/sdk';
import './style.css';

interface BenchmarkConfig {sdkUrl:string;durationMs?:number;repeats?:number;warmupMs?:number;presentation?:'direct'|'interpolated'|'predicted';adaptiveQuality?:boolean}
interface BenchmarkRun {hands:boolean;repeat:number;startupMs:number|undefined;workerUrls:string[];completionCount:number;measuredMs:number;measuredCompletions:number;windows:TrackingHealth[];handActivatedByHarness:boolean;health:TrackingHealth|undefined}
const status=document.querySelector<HTMLElement>('#benchmark-status')!;
const result=document.querySelector<HTMLElement>('#benchmark-result')!;
const start=document.querySelector<HTMLButtonElement>('#run')!;
const cancel=document.querySelector<HTMLButtonElement>('#cancel')!;
let cancelled=false,running=false,session:VirtualTryOn|null=null;
const state:{phase:string;runs:BenchmarkRun[];error:string|null}={phase:'idle',runs:[],error:null};

async function benchmark(config:BenchmarkConfig) {
  if(running)throw new Error('Benchmark already running.');
  const url=new URL(config.sdkUrl,location.href);
  if(url.origin!==location.origin||!url.pathname.endsWith('/vto-sdk.js'))throw new Error('Use a same-origin built SDK URL.');
  const sdk=await import(/* @vite-ignore */url.href) as typeof import('@vto/sdk');
  running=true;cancelled=false;state.phase='running';state.runs=[];state.error=null;start.disabled=true;cancel.disabled=false;
  const originalWorker=window.Worker,originalGum=navigator.mediaDevices.getUserMedia;
  let worker:Worker|null=null,completionCount=0,activateHands=false,nativeHandsReady=false,handResolve:(()=>void)|null=null,handReject:((error:Error)=>void)|null=null;
  const workerUrls:string[]=[];
  window.Worker=class extends originalWorker {
    constructor(workerUrl:string|URL,options?:WorkerOptions) {
      super(workerUrl,options);worker=this;workerUrls.push(String(workerUrl));
      this.addEventListener('message',({data})=>{
        if(data.type==='frame-done')completionCount++;
        if(data.type==='ready'&&activateHands)this.postMessage({type:'enable-hands'});
        if(data.type==='hand-ready'){nativeHandsReady=true;handResolve?.();}
        if(data.type==='hand-unavailable')handReject?.(new Error('Optional hand graph unavailable in benchmark.'));
      });
    }
  };
  const source=document.createElement('canvas');source.width=1280;source.height=720;
  const context=source.getContext('2d')!;
  const pump=window.setInterval(()=>{context.fillStyle='#808080';context.fillRect(0,0,1280,720);},33);
  navigator.mediaDevices.getUserMedia=async()=>source.captureStream(30);
  const delay=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));
  try {
    for(const hands of [false,true])for(let repeat=0;repeat<(config.repeats??3);repeat++) {
      if(cancelled)throw new Error('Benchmark cancelled.');
      completionCount=0;activateHands=false;nativeHandsReady=false;workerUrls.length=0;let latest:TrackingHealth|undefined;
      status.textContent=`Menyiapkan ${hands?'face + hand':'face only'} · run ${repeat+1}…`;
      session=sdk.createVirtualTryOn({container:document.querySelector<HTMLElement>('#benchmark-stage')!,glassesUrl:'/glasses.glb',cameraCompositing:false,hairOcclusion:false,presentation:config.presentation,adaptiveQuality:config.adaptiveQuality,handInteraction:hands?{}:undefined,cacheRuntimeAssets:true,onTrackingHealthChange:health=>{latest=health;}});
      await session.start();
      if(hands&&!nativeHandsReady) {
        // Compatibility with frozen older SDKs that activated hands late.
        await new Promise<void>((resolve,reject)=>{
          const timer=window.setTimeout(()=>reject(new Error('Hand graph startup timed out.')),30000);
          handResolve=()=>{window.clearTimeout(timer);resolve();};handReject=error=>{window.clearTimeout(timer);reject(error);};
          activateHands=true;worker!.postMessage({type:'enable-hands'});
        });
        handResolve=handReject=null;
      }
      await delay(config.warmupMs??5000);
      const started=performance.now(),initialCompletions=completionCount;
      const windows:TrackingHealth[]=[];
      let lastWindowAt=-Infinity;
      while(performance.now()-started<(config.durationMs??60000)) {
        if(cancelled)throw new Error('Benchmark cancelled.');
        const remaining=Math.ceil(((config.durationMs??60000)-(performance.now()-started))/1000);
        status.textContent=`${hands?'face + hand':'face only'} · run ${repeat+1} · ${remaining}s tersisa · ${completionCount} completion`;
        await delay(500);
        if(latest?.phase==='failed')throw new Error('SDK runtime failed during baseline.');
        if(latest&&performance.now()-lastWindowAt>=1000) {windows.push(latest);lastWindowAt=performance.now();}
      }
      state.runs.push({hands,repeat:repeat+1,startupMs:latest?.startupMs,workerUrls:[...workerUrls],completionCount,measuredMs:performance.now()-started,measuredCompletions:completionCount-initialCompletions,windows,handActivatedByHarness:activateHands,health:latest});
      session.dispose();session=null;result.textContent=JSON.stringify(state.runs,null,2);
    }
    state.phase='complete';status.textContent='Benchmark selesai. Hanya agregat runtime; tidak ada kamera/recognition acceptance.';
  } catch(error) {
    state.error=error instanceof Error?error.message:String(error);state.phase=cancelled?'cancelled':'failed';status.textContent=state.error;
  } finally {
    session?.dispose();session=null;window.clearInterval(pump);source.width=source.height=0;
    window.Worker=originalWorker;navigator.mediaDevices.getUserMedia=originalGum;handResolve=handReject=null;
    running=false;start.disabled=false;cancel.disabled=true;
  }
  return {...state,runs:[...state.runs],configuration:{...config},cameraRequested:false,input:'blank canvas captureStream; actual models; hands explicitly enabled by harness',scope:'No-face/palm-detection runtime cost only. Face mesh recognition, active-hand cost, valid fitting/draw and physical device latency are not established.'};
}
declare global {interface Window {vtoRuntimeBenchmark:{start:(config:BenchmarkConfig)=>Promise<unknown>;state:typeof state}}}
window.vtoRuntimeBenchmark={start:benchmark,state};
start.addEventListener('click',()=>{
  const sdkUrl=new URLSearchParams(location.search).get('sdk');
  if(!sdkUrl){status.textContent='Gunakan query sdk dengan URL build yang dibekukan; lihat petunjuk benchmark.';return;}
  void benchmark({sdkUrl});
});
cancel.addEventListener('click',()=>{cancelled=true;session?.stop();});
window.addEventListener('pagehide',()=>{cancelled=true;session?.dispose();});
