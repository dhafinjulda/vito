/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rendererMocks = vi.hoisted(() => ({ failure: null as Error | null, initialLoad: null as Promise<void>|null, instances: [] as Array<{ load: ReturnType<typeof vi.fn>; render: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; setPose: ReturnType<typeof vi.fn>; clearLocalAmbientSample: ReturnType<typeof vi.fn>; updateAmbientFromVideo: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>;disableCameraCompositing:ReturnType<typeof vi.fn>;disableHairOcclusion:ReturnType<typeof vi.fn>;setHairMask:ReturnType<typeof vi.fn>;clearHairMask:ReturnType<typeof vi.fn> }> }));

vi.mock('../src/rendering/GlassesRenderer', () => ({
  GlassesRenderer: class {
    load = vi.fn().mockImplementation(()=>rendererMocks.initialLoad??Promise.resolve());
    render = vi.fn();
    resize = vi.fn();
    setPose = vi.fn().mockReturnValue({ visible: true, source: 'face-matrix', yawDegrees: 0, pitchDegrees: 0, guidance: 'ready' });
    clearLocalAmbientSample = vi.fn();
    updateAmbientFromVideo = vi.fn();
    setFit = vi.fn();
    setCameraVideo=vi.fn();
    setHairMask=vi.fn();
    clearHairMask=vi.fn();
    disableCameraCompositing=vi.fn();disableHairOcclusion=vi.fn();resetFeatureFallbacks=vi.fn();
    cameraBackgroundReady=true;
    setPixelRatioCap=vi.fn();
    setPlacementProgress = vi.fn();
    setHeldPose=vi.fn();
    getGrabContext=vi.fn().mockReturnValue(null);
    dispose = vi.fn();
    constructor() { if (rendererMocks.failure) throw rendererMocks.failure; rendererMocks.instances.push(this); }
  },
}));

import { createVirtualTryOn,CameraAccessError } from '../src/index';
import { TRACKER_PROTOCOL_VERSION } from '../src/tracking/protocol';
import type { VirtualTryOnOptions } from '../src/types';

class TestWorker {
  static instances: TestWorker[] = [];
  static protocolVersion = TRACKER_PROTOCOL_VERSION;
  static prepared=false;
  static hangOptional=false;
  static failFaceOnly=false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn((message: { type: string; handModelAssetPath?: string;hairModelAssetPath?:string }) => {
    if(message.type==='warmup')queueMicrotask(()=>this.onmessage?.({data:{type:'warmup-ready'}} as MessageEvent));
    if (message.type === 'init') queueMicrotask(() => {
      if(TestWorker.failFaceOnly&&!message.handModelAssetPath&&!message.hairModelAssetPath){this.onmessage?.({data:{type:'error',message:'Face-only initialization failed'}} as MessageEvent);return;}
      if(TestWorker.prepared)this.onmessage?.({data:{type:'face-ready'}} as MessageEvent);
      if(TestWorker.hangOptional&&(message.handModelAssetPath||message.hairModelAssetPath)){this.onmessage?.({data:{type:'hand-loading'}} as MessageEvent);return;}
      this.onmessage?.({ data: { type: 'ready', protocolVersion:TestWorker.protocolVersion, handTracking: message.handModelAssetPath ? TestWorker.prepared?'ready':'loading' : 'disabled',...(TestWorker.prepared?{hairTracking:message.hairModelAssetPath?'ready':'disabled'}:{}) } } as MessageEvent);
    });
  });
  terminate = vi.fn();
  constructor() { TestWorker.instances.push(this); }
}

class TestResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(_callback: ResizeObserverCallback) { }
}

function streamWithTrack() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

function setup(getUserMedia: ReturnType<typeof vi.fn>, options: Partial<VirtualTryOnOptions> = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.stubGlobal('Worker', TestWorker);
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn()} as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  Object.defineProperty(HTMLVideoElement.prototype,'videoWidth',{configurable:true,get:()=>1280});
  Object.defineProperty(HTMLVideoElement.prototype,'videoHeight',{configurable:true,get:()=>720});
  const session = createVirtualTryOn({ container, glassesUrl: '/glasses.glb', ...options });
  let manualMediaTime:number|null=null;
  // Model decoded media progression explicitly; jsdom's video clock otherwise
  // stays at zero even when the fake camera/worker callbacks advance.
  Object.defineProperty(session.video,'currentTime',{configurable:true,get:()=>manualMediaTime??performance.now()/1000,set:(value:number)=>{manualMediaTime=value;}});
  return { container, session };
}

describe('Virtual Try-On camera lifecycle', () => {
  it.each(['NotAllowedError','NotFoundError','NotReadableError','AbortError'])('releases prepared ownership and reports one typed %s camera error',async name=>{
    const native=new DOMException('Camera failure',name),onError=vi.fn(),gum=vi.fn().mockRejectedValue(native);
    const {session}=setup(gum,{onError});await session.prepare();
    const error=await session.start().catch(e=>e);
    expect(error).toBeInstanceOf(CameraAccessError);expect(error.cause).toBe(native);expect(error.name).toBe(name);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);expect(session.status).toBe('error');
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();expect(gum.mock.calls[0]![0].audio).toBe(false);session.dispose();
  });
  it('permits explicit start retry after a blocked camera is corrected',async()=>{
    const {stream,track}=streamWithTrack(),gum=vi.fn().mockRejectedValueOnce(new DOMException('Blocked','NotAllowedError')).mockResolvedValueOnce(stream);
    const {session}=setup(gum);await expect(session.start()).rejects.toBeInstanceOf(CameraAccessError);
    await session.start();expect(session.status).toBe('searching');session.dispose();expect(track.stop).toHaveBeenCalledOnce();
  });
  it('bounds failed optional preparation to one fallback and one final notification',async()=>{
    vi.useFakeTimers();TestWorker.prepared=TestWorker.hangOptional=TestWorker.failFaceOnly=true;
    const gum=vi.fn(),onError=vi.fn(),{session}=setup(gum,{hairOcclusion:{},resourceTimeoutMs:100,onError});
    const result=session.prepare().catch(e=>e);await vi.advanceTimersByTimeAsync(101);
    expect(await result).toMatchObject({message:'Face-only initialization failed'});
    expect(TestWorker.instances).toHaveLength(2);expect(onError).toHaveBeenCalledOnce();expect(gum).not.toHaveBeenCalled();
    for(const worker of TestWorker.instances)expect(worker.terminate).toHaveBeenCalledOnce();session.dispose();
  });
  it('prepares one face-only fallback after optional timeout and reuses it on start',async()=>{
    vi.useFakeTimers();TestWorker.prepared=TestWorker.hangOptional=true;
    const {stream,track}=streamWithTrack(),gum=vi.fn().mockResolvedValue(stream),onError=vi.fn(),health=vi.fn();
    const {session}=setup(gum,{hairOcclusion:{},handInteraction:{},resourceTimeoutMs:100,onError,onTrackingHealthChange:health});
    const preparation=session.prepare();await vi.advanceTimersByTimeAsync(101);await preparation;
    expect(gum).not.toHaveBeenCalled();expect(onError).not.toHaveBeenCalled();expect(TestWorker.instances).toHaveLength(2);
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    expect(TestWorker.instances[1]!.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'init',delegate:'CPU',hairModelAssetPath:undefined,handModelAssetPath:undefined}));
    await session.start();expect(TestWorker.instances).toHaveLength(2);expect(gum).toHaveBeenCalledOnce();
    expect(health.mock.calls.at(-1)![0]).toMatchObject({restarts:1,featureFallback:'optional-startup',hairTracking:'unavailable',preparation:{reused:true}});
    session.dispose();expect(track.stop).toHaveBeenCalledOnce();expect(TestWorker.instances[1]!.terminate).toHaveBeenCalledOnce();
  });
  it('does not conceal a protocol mismatch with optional preparation fallback',async()=>{
    TestWorker.prepared=true;TestWorker.protocolVersion=-1;
    const onError=vi.fn(),{session}=setup(vi.fn(),{hairOcclusion:{},onError});
    await expect(session.prepare()).rejects.toThrow('version');expect(TestWorker.instances).toHaveLength(1);
    expect(onError).toHaveBeenCalledOnce();expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();session.dispose();
  });
  it('bounds a stalled prepared geometry warmup and releases camera and worker',async()=>{
    vi.useFakeTimers();const {stream,track}=streamWithTrack();
    const {session}=setup(vi.fn().mockResolvedValue(stream),{resourceTimeoutMs:100});await session.prepare();
    Object.defineProperty(HTMLVideoElement.prototype,'videoWidth',{configurable:true,get:()=>720});
    Object.defineProperty(HTMLVideoElement.prototype,'videoHeight',{configurable:true,get:()=>1280});
    TestWorker.instances[0]!.postMessage.mockImplementationOnce(()=>{});
    const result=session.start().catch(e=>e);await vi.advanceTimersByTimeAsync(101);
    expect(await result).toMatchObject({code:'tracker-timeout'});expect(track.stop).toHaveBeenCalledOnce();
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();session.dispose();
  });
  it('warms changed camera geometry on the prepared worker before dispatch',async()=>{
    const {stream}=streamWithTrack(),health=vi.fn(),{session}=setup(vi.fn().mockResolvedValue(stream),{onTrackingHealthChange:health});
    await session.prepare();const worker=TestWorker.instances[0]!;
    Object.defineProperty(HTMLVideoElement.prototype,'videoWidth',{configurable:true,get:()=>720});
    Object.defineProperty(HTMLVideoElement.prototype,'videoHeight',{configurable:true,get:()=>1280});
    await session.start();expect(TestWorker.instances).toHaveLength(1);
    expect(worker.postMessage).toHaveBeenCalledWith({type:'warmup',inputWidth:640,inputHeight:1138});
    expect(health.mock.calls.at(-1)![0].preparation.activationWarmupMs).toBeGreaterThanOrEqual(0);session.dispose();
  });
  it('prepares without media and reuses exactly one initialized worker on start',async()=>{
    const {stream,track}=streamWithTrack(),gum=vi.fn().mockResolvedValue(stream),health=vi.fn();
    const {session}=setup(gum,{onTrackingHealthChange:health});
    const first=session.prepare();expect(session.prepare()).toBe(first);await first;await session.prepare();
    expect(gum).not.toHaveBeenCalled();expect(TestWorker.instances).toHaveLength(1);expect(session.status).toBe('idle');
    const worker=TestWorker.instances[0]!;await session.start();
    expect(gum).toHaveBeenCalledOnce();expect(TestWorker.instances).toHaveLength(1);
    expect(worker.postMessage.mock.calls.filter(([m])=>m.type==='init')).toHaveLength(1);
    expect(health.mock.calls.at(-1)![0].preparation).toMatchObject({reused:true});
    session.stop();expect(track.stop).toHaveBeenCalledOnce();expect(worker.terminate).toHaveBeenCalledOnce();session.dispose();
  });
  it('shares in-flight preparation with concurrent explicit start and requests camera immediately',async()=>{
    TestWorker.hangOptional=true;
    const {stream}=streamWithTrack(),gum=vi.fn().mockResolvedValue(stream);
    const {session}=setup(gum,{hairOcclusion:{}});
    const preparation=session.prepare();for(let i=0;i<20&&!TestWorker.instances.length;i++)await Promise.resolve();
    const start=session.start();expect(gum).toHaveBeenCalledOnce();expect(session.start()).toBe(start);
    const worker=TestWorker.instances[0]!;
    worker.onmessage?.({data:{type:'ready',protocolVersion:TRACKER_PROTOCOL_VERSION,hairTracking:'ready'}} as MessageEvent);
    await preparation;await start;expect(TestWorker.instances).toHaveLength(1);session.dispose();
  });
  it('cancels preparation before assets complete without camera or worker acquisition',async()=>{
    let finish!:()=>void;rendererMocks.initialLoad=new Promise<void>(r=>{finish=r;});
    const gum=vi.fn(),{session}=setup(gum);
    const pending=session.prepare();session.stop();await expect(pending).rejects.toMatchObject({name:'AbortError'});
    finish();await Promise.resolve();expect(gum).not.toHaveBeenCalled();expect(TestWorker.instances).toHaveLength(0);session.dispose();
  });
  it('rejects prepared-stage reentrant disposal and releases the warmed worker',async()=>{
    let session!:ReturnType<typeof createVirtualTryOn>;
    ({session}=setup(vi.fn(),{onReadinessChange:stage=>{if(stage==='prepared')session.dispose();}}));
    await expect(session.prepare()).rejects.toMatchObject({name:'AbortError'});
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();expect(session.status).toBe('disposed');
  });
  it('reinitializes instead of reusing preparation after an asset replacement',async()=>{
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream));
    await session.prepare();const old=TestWorker.instances[0]!;await session.setGlasses('/new.glb');await session.start();
    expect(TestWorker.instances).toHaveLength(2);expect(old.terminate).toHaveBeenCalledOnce();session.dispose();
  });
  it('releases prepared workers on page hide and rejects prepare after disposal',async()=>{
    const gum=vi.fn(),{session}=setup(gum);await session.prepare();
    window.dispatchEvent(new Event('pagehide'));expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    expect(gum).not.toHaveBeenCalled();session.dispose();await expect(session.prepare()).rejects.toThrow('disposed');
  });
  it('times out camera-free preparation once and allows an explicit retry',async()=>{
    vi.useFakeTimers();TestWorker.hangOptional=true;
    const gum=vi.fn(),onError=vi.fn(),{session}=setup(gum,{hairOcclusion:{},resourceTimeoutMs:100,onError});
    const result=session.prepare().catch(e=>e);await vi.advanceTimersByTimeAsync(101);
    expect(await result).toMatchObject({code:'tracker-timeout'});expect(onError).toHaveBeenCalledOnce();
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();expect(gum).not.toHaveBeenCalled();
    TestWorker.hangOptional=false;await session.prepare();expect(TestWorker.instances).toHaveLength(2);session.dispose();
  });
  it('stops late camera acquisition when concurrent preparation/start is cancelled',async()=>{
    let resolve!:(s:MediaStream)=>void;const {stream,track}=streamWithTrack();
    const {session}=setup(vi.fn(()=>new Promise(r=>{resolve=r;})));
    await session.prepare();const start=session.start();session.stop();resolve(stream);await start;
    expect(track.stop).toHaveBeenCalledOnce();expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();session.dispose();
  });
  it('reports an initial asset preparation failure once without requesting a camera',async()=>{
    rendererMocks.initialLoad=Promise.reject(new Error('Preparation GLB missing'));
    const gum=vi.fn(),onError=vi.fn(),{session}=setup(gum,{onError});
    await expect(session.prepare()).rejects.toThrow('Preparation GLB missing');
    expect(onError).toHaveBeenCalledOnce();expect(gum).not.toHaveBeenCalled();session.dispose();
  });
  it('announces disposal cancellation after media and owned DOM are released',async()=>{
    const {stream,track}=streamWithTrack();let released=false;
    const {session,container}=setup(vi.fn().mockResolvedValue(stream),{onReadinessChange:stage=>{if(stage==='cancelled')released=track.stop.mock.calls.length===1&&container.children.length===0;}});
    await session.start();session.dispose();expect(released).toBe(true);
  });
  it('bounds stalled video playback after acquisition and stops its track',async()=>{
    vi.useFakeTimers();const {stream,track}=streamWithTrack(),onError=vi.fn();
    const {session}=setup(vi.fn().mockResolvedValue(stream),{resourceTimeoutMs:100,onError});
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(()=>new Promise(()=>{}));
    const start=session.start().catch(e=>e);await vi.advanceTimersByTimeAsync(101);
    expect(await start).toMatchObject({code:'tracker-timeout'});expect(track.stop).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();expect(TestWorker.instances).toHaveLength(0);session.dispose();
  });
  it('does not notify an obsolete initial asset failure after a replacement succeeds',async()=>{
    let reject!:(error:Error)=>void;rendererMocks.initialLoad=new Promise((_,no)=>{reject=no;});
    const onError=vi.fn(),{session}=setup(vi.fn(),{onError});rendererMocks.initialLoad=null;
    await session.setGlasses('/replacement.glb');reject(new Error('Obsolete initial asset'));
    await Promise.resolve();await Promise.resolve();await Promise.resolve();expect(onError).not.toHaveBeenCalled();session.dispose();
  });
  it('times out an unresponsive worker with a typed error and releases media',async()=>{
    vi.useFakeTimers();const {stream,track}=streamWithTrack(),onError=vi.fn();
    const {session}=setup(vi.fn().mockResolvedValue(stream),{resourceTimeoutMs:100,onError});
    vi.stubGlobal('Worker',class extends TestWorker {postMessage=vi.fn();});
    const start=session.start().catch(e=>e);await vi.advanceTimersByTimeAsync(101);
    expect(await start).toMatchObject({code:'tracker-timeout',stage:'tracker',retryable:true});
    expect(track.stop).toHaveBeenCalledOnce();expect(onError).toHaveBeenCalledOnce();
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();session.dispose();
  });
  it('does not apply the resource deadline to an unanswered camera permission request',async()=>{
    vi.useFakeTimers();let grant!:(stream:MediaStream)=>void;const onError=vi.fn();
    const {stream,track}=streamWithTrack(),{session}=setup(vi.fn(()=>new Promise(resolve=>{grant=resolve;})),{resourceTimeoutMs:100,onError});
    const start=session.start();await vi.advanceTimersByTimeAsync(1000);
    expect(session.status).toBe('requesting-camera');expect(onError).not.toHaveBeenCalled();
    session.stop();grant(stream);await start;expect(track.stop).toHaveBeenCalledOnce();session.dispose();
  });
  it('honors cancellation from the permission-stage callback before requesting media',async()=>{
    const gum=vi.fn(),stages:string[]=[];
    const {session}=setup(gum,{onReadinessChange:stage=>{stages.push(stage);if(stage==='requesting-camera')session.stop();}});
    await session.start();expect(gum).not.toHaveBeenCalled();expect(stages).toEqual(['requesting-camera','cancelled']);session.dispose();
  });
  it('does not restart frame dispatch after stop in the ready-stage callback',async()=>{
    const {stream,track}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream),{onReadinessChange:stage=>{if(stage==='ready')session.stop();}});
    await session.start();expect(session.status).toBe('idle');expect(track.stop).toHaveBeenCalledOnce();
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();session.dispose();
  });
  it('bounds a stalled initial asset, reports stages and permits a replacement retry',async()=>{
    vi.useFakeTimers();rendererMocks.initialLoad=new Promise(()=>{});
    const {stream,track}=streamWithTrack(),error=vi.fn(),stages=vi.fn();
    const {session}=setup(vi.fn().mockResolvedValue(stream),{resourceTimeoutMs:100,onError:error,onReadinessChange:stages});
    const start=session.start().catch(e=>e);await vi.advanceTimersByTimeAsync(101);
    expect(await start).toMatchObject({code:'asset-timeout'});expect(error).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalled();expect(stages).toHaveBeenCalledWith('loading-asset');expect(stages).toHaveBeenCalledWith('error');
    rendererMocks.initialLoad=null;await session.setGlasses('/valid.glb');await session.start();
    expect(session.status).toBe('searching');expect(stages).toHaveBeenCalledWith('ready');session.dispose();
  });
  it('keeps first-fit submission empty for blank frames and clears startup diagnostics on stop',async()=>{
    const {stream}=streamWithTrack(),health=vi.fn(),{session}=setup(vi.fn().mockResolvedValue(stream),{onTrackingHealthChange:health});
    await session.start();
    const startup=health.mock.calls.at(-1)![0].startup;
    expect(startup.cameraPendingMs).toBeGreaterThanOrEqual(0);
    expect(startup.assetWaitMs).toBeGreaterThanOrEqual(0);
    expect(startup.trackerReadyMs).toBeGreaterThanOrEqual(0);
    expect(startup.firstFitSubmissionMs).toBeNull();
    session.stop();expect(Object.values(health.mock.calls.at(-1)![0].startup)).toEqual([null,null,null,null]);
    session.dispose();
  });
  it('reports an initial asset failure once per start attempt and releases the camera',async()=>{
    rendererMocks.failure=new Error('Initial asset unavailable');
    const {stream,track}=streamWithTrack(),onError=vi.fn();
    const {session}=setup(vi.fn().mockResolvedValue(stream),{onError});
    await expect(session.start()).rejects.toThrow('Initial asset unavailable');
    expect(onError).toHaveBeenCalledTimes(1);expect(track.stop).toHaveBeenCalledTimes(1);
    expect(session.status).toBe('error');expect(TestWorker.instances).toHaveLength(0);
    await expect(session.start()).rejects.toThrow('Initial asset unavailable');
    expect(onError).toHaveBeenCalledTimes(2);session.dispose();
  });
  it('reports an initial load failure while idle without requiring camera start',async()=>{
    rendererMocks.failure=new Error('Idle asset unavailable');const onError=vi.fn(),gum=vi.fn();
    const {session}=setup(gum,{onError});
    await vi.waitFor(()=>expect(onError).toHaveBeenCalledTimes(1));
    expect(gum).not.toHaveBeenCalled();session.dispose();
  });
  it('does not report late initial load failures after disposal',async()=>{
    rendererMocks.failure=new Error('Disposed asset unavailable');const onError=vi.fn();
    const {session}=setup(vi.fn(),{onError});session.dispose();
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });
  it('ignores in-flight face/hand/hair from a prior source size and resumes on a new capture',async()=>{
    const {stream,track}=streamWithTrack(),gum=vi.fn().mockResolvedValue(stream),health=vi.fn();
    const {session}=setup(gum,{handInteraction:{},hairOcclusion:{},onTrackingHealthChange:health});
    let width=1280,height=720,callback:VideoFrameRequestCallback|undefined;
    Object.defineProperties(session.video,{videoWidth:{get:()=>width},videoHeight:{get:()=>height}});
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:vi.fn((next:VideoFrameRequestCallback)=>{callback=next;return 25;})});
    Object.defineProperty(HTMLVideoElement.prototype,'cancelVideoFrameCallback',{configurable:true,value:vi.fn()});
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({close:vi.fn()}));
    await session.start();const worker=TestWorker.instances[0]!,render=rendererMocks.instances[0]!;
    callback?.(performance.now(),{mediaTime:1} as VideoFrameCallbackMetadata);await Promise.resolve();
    const sent=worker.postMessage.mock.calls.find(([m])=>m.type==='frame')![0] as unknown as {timestampMs:number};
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:sent.timestampMs}} as MessageEvent);
    expect(session.status).toBe('tracking');
    width=720;height=1280;const mask=new Uint8Array([255]);
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:sent.timestampMs}} as MessageEvent);
    worker.onmessage?.({data:{type:'hair-result',data:mask,width:1,height:1,inferenceMs:1,timestampMs:sent.timestampMs}} as MessageEvent);
    worker.onmessage?.({data:{type:'hand-result',hands:[],timestampMs:sent.timestampMs}} as MessageEvent);
    expect(session.status).toBe('searching');expect(render.setPose).toHaveBeenLastCalledWith(null,720,1280);
    expect(render.clearHairMask).toHaveBeenCalledOnce();expect(render.setHairMask).not.toHaveBeenCalled();expect(mask[0]).toBe(0);
    worker.onmessage?.({data:{type:'frame-done',timestampMs:sent.timestampMs}} as MessageEvent);
    // Completion unlocks capture, but cannot make the old geometry valid.
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:sent.timestampMs}} as MessageEvent);
    expect(session.status).toBe('searching');
    callback?.(performance.now(),{mediaTime:2} as VideoFrameCallbackMetadata);await Promise.resolve();
    const fresh=worker.postMessage.mock.calls.filter(([m])=>m.type==='frame').at(-1)![0] as unknown as {timestampMs:number};
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:fresh.timestampMs}} as MessageEvent);
    expect(render.setPose).toHaveBeenLastCalledWith([],720,1280,null,fresh.timestampMs,2);
    expect(session.status).toBe('tracking');expect(TestWorker.instances).toHaveLength(1);expect(gum).toHaveBeenCalledOnce();
    expect(track.stop).not.toHaveBeenCalled();session.dispose();expect(track.stop).toHaveBeenCalledOnce();
  });
  it('closes an asynchronous bitmap whose source changed and returned before transfer',async()=>{
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream));
    let width=1280,height=720,callback:VideoFrameRequestCallback|undefined,resolve!:(bitmap:{close:ReturnType<typeof vi.fn>})=>void;
    Object.defineProperties(session.video,{videoWidth:{get:()=>width},videoHeight:{get:()=>height}});
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:vi.fn((next:VideoFrameRequestCallback)=>{callback=next;return 26;})});
    Object.defineProperty(HTMLVideoElement.prototype,'cancelVideoFrameCallback',{configurable:true,value:vi.fn()});
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    vi.stubGlobal('createImageBitmap',vi.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({close:vi.fn()}));
    await session.start();const worker=TestWorker.instances[0]!;
    callback?.(performance.now(),{mediaTime:1} as VideoFrameCallbackMetadata);
    width=720;height=1280;vi.mocked(requestAnimationFrame).mock.calls[0]![0](performance.now());
    width=1280;height=720;vi.mocked(requestAnimationFrame).mock.calls[0]![0](performance.now());
    const obsolete={close:vi.fn()};resolve(obsolete);await Promise.resolve();
    expect(obsolete.close).toHaveBeenCalledOnce();expect(worker.postMessage.mock.calls.filter(([m])=>m.type==='frame')).toHaveLength(0);
    callback?.(performance.now(),{mediaTime:2} as VideoFrameCallbackMetadata);await Promise.resolve();
    expect(worker.postMessage.mock.calls.filter(([m])=>m.type==='frame')).toHaveLength(1);session.dispose();
  });
  it('reports sustained hand fallback while preserving tracking and button placement',async()=>{
    const {stream,track}=streamWithTrack(),health=vi.fn(),{session}=setup(vi.fn().mockResolvedValue(stream),{handInteraction:{},onTrackingHealthChange:health});
    await session.start();const worker=TestWorker.instances[0]!;
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:performance.now()}} as MessageEvent);
    worker.onmessage?.({data:{type:'hand-unavailable',reason:'budget'}} as MessageEvent);
    expect(session.status).toBe('tracking');expect(health).toHaveBeenCalledWith(expect.objectContaining({featureFallback:'hand-budget',phase:'running'}));
    expect(track.stop).not.toHaveBeenCalled();session.setPlacement('head');session.dispose();
  });
  it('can restart with the retained model after a replacement asset fails',async()=>{
    const {stream,track}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream));
    await session.start();rendererMocks.instances[0]!.load.mockRejectedValueOnce(new Error('SKU unavailable'));
    await expect(session.setGlasses('/missing.glb')).rejects.toThrow('SKU unavailable');
    expect(track.stop).not.toHaveBeenCalled();session.stop();await session.start();
    expect(session.status).toBe('searching');expect(TestWorker.instances).toHaveLength(2);session.dispose();
  });
  it('waits for the latest replacement before preparing the tracker',async()=>{
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream));await Promise.resolve();
    let resolve!:(value:void)=>void;rendererMocks.instances[0]!.load.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    const swap=session.setGlasses('/replacement.glb'),starting=session.start();
    await Promise.resolve();await Promise.resolve();expect(TestWorker.instances).toHaveLength(0);
    resolve();await swap;await starting;expect(TestWorker.instances).toHaveLength(1);session.dispose();
  });
  it('immediately starts a new generation after canceling an unsettled permission request',async()=>{
    const old=streamWithTrack(),current=streamWithTrack();let resolve!:(stream:MediaStream)=>void;
    const gum=vi.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue(current.stream),{session}=setup(gum);
    const canceled=session.start();session.stop();const fresh=session.start();
    expect(fresh).not.toBe(canceled);await fresh;expect(gum).toHaveBeenCalledTimes(2);expect(session.status).toBe('searching');
    resolve(old.stream);await canceled;expect(old.track.stop).toHaveBeenCalledOnce();expect(current.track.stop).not.toHaveBeenCalled();
    session.dispose();expect(current.track.stop).toHaveBeenCalledOnce();
  });
  it('aborts startup waiting on an asset and permits a later independent start',async()=>{
    const {stream}=streamWithTrack(),stages=vi.fn(),{session}=setup(vi.fn().mockResolvedValue(stream),{onReadinessChange:stages});await Promise.resolve();
    let resolve!:(value:void)=>void;rendererMocks.instances[0]!.load.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    const swap=session.setGlasses('/slow.glb'),start=session.start(),observed=start.catch(e=>e);
    await vi.waitFor(()=>expect(stages).toHaveBeenCalledWith('loading-asset'));session.stop();
    expect(await observed).toMatchObject({name:'AbortError'});expect(TestWorker.instances).toHaveLength(0);
    const fresh=session.start();resolve();await swap;await fresh;expect(session.status).toBe('searching');session.dispose();
  });
  it('uses auto motion/adaptive/compositing defaults and honors explicit opt-outs',async()=>{
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream));
    await session.start();expect(TestWorker.instances[0]!.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'init',adaptiveQuality:true,prewarmOptional:true}));
    expect(session.video.style.opacity).not.toBe('0'); // first draw owns preview switch.
    session.dispose();
  });
  it('does not request graph compilation after a prewarmed first face result',async()=>{
    TestWorker.prepared=true;const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream),{hairOcclusion:{},handInteraction:{}});
    await session.start();const worker=TestWorker.instances[0]!,before=vi.mocked(requestAnimationFrame).mock.calls.length;
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:performance.now()}} as MessageEvent);
    for(const [callback] of vi.mocked(requestAnimationFrame).mock.calls.slice(before))callback(performance.now());
    expect(worker.postMessage).not.toHaveBeenCalledWith({type:'enable-hands'});expect(worker.postMessage).not.toHaveBeenCalledWith({type:'enable-hair'});session.dispose();
  });
  it('retries an optional startup hang once with face-only CPU without reacquiring the camera',async()=>{
    vi.useFakeTimers();TestWorker.prepared=TestWorker.hangOptional=true;
    const {stream,track}=streamWithTrack(),gum=vi.fn().mockResolvedValue(stream),health=vi.fn();
    const {session}=setup(gum,{handInteraction:{},hairOcclusion:{},onTrackingHealthChange:health});
    const start=session.start();await vi.advanceTimersByTimeAsync(12001);await start;
    expect(TestWorker.instances).toHaveLength(2);expect(gum).toHaveBeenCalledOnce();expect(track.stop).not.toHaveBeenCalled();
    expect(TestWorker.instances[1]!.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'init',delegate:'CPU',handModelAssetPath:undefined,hairModelAssetPath:undefined}));
    expect(health).toHaveBeenLastCalledWith(expect.objectContaining({featureFallback:'optional-startup',phase:'running',hairTracking:'unavailable'}));
    session.dispose();
  });
  it('falls back to DOM preview/original lenses after one optional draw exception without stopping the camera',async()=>{
    const {stream,track}=streamWithTrack(),health=vi.fn(),{session}=setup(vi.fn().mockResolvedValue(stream),{onTrackingHealthChange:health});
    await session.start();rendererMocks.instances[0]!.render.mockImplementationOnce(()=>{throw new Error('transmission shader');});
    vi.mocked(requestAnimationFrame).mock.calls[0]![0](performance.now());
    expect(rendererMocks.instances[0]!.disableCameraCompositing).toHaveBeenCalledOnce();expect(track.stop).not.toHaveBeenCalled();
    expect(session.video.style.opacity).toBe('1');expect(health).toHaveBeenCalledWith(expect.objectContaining({cameraCompositing:'fallback',featureFallback:'render-failure'}));session.dispose();
  });
  it('rejects invalid premium configuration before creating elements or requesting a camera',()=>{
    const container=document.createElement('div'),base={container,glassesUrl:'/glasses.glb'};
    expect(()=>createVirtualTryOn({...base,cameraCompositing:false,lensOptics:{}})).toThrow('requires');
    expect(()=>createVirtualTryOn({...base,cameraCompositing:true,lensOptics:{ior:3}})).toThrow('Invalid lens');
    expect(()=>createVirtualTryOn({...base,faceReferenceEyeSpanCm:NaN})).toThrow('faceReference');
    expect(()=>createVirtualTryOn({...base,cameraFov:0})).toThrow('cameraFov');
    expect(()=>createVirtualTryOn({...base,cameraCalibration:{imageWidth:1280,imageHeight:720,fx:0,fy:1,cx:640,cy:360}})).toThrow('intrinsics');
    expect(container.children.length).toBe(0);expect(TestWorker.instances).toHaveLength(0);
  });
  it('does not mistake an advancing playback clock for decoded frames when video callbacks stop',async()=>{
    vi.useFakeTimers();const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream));
    let callback:VideoFrameRequestCallback|undefined,count=1;
    Object.defineProperty(session.video,'getVideoPlaybackQuality',{value:()=>({totalVideoFrames:count})});
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:vi.fn((next:VideoFrameRequestCallback)=>{callback=next;return 20;})});
    Object.defineProperty(HTMLVideoElement.prototype,'cancelVideoFrameCallback',{configurable:true,value:vi.fn()});
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    const bitmap=vi.fn().mockResolvedValue({close:vi.fn()});vi.stubGlobal('createImageBitmap',bitmap);
    await session.start();callback?.(performance.now(),{mediaTime:0,presentedFrames:1} as VideoFrameCallbackMetadata);await Promise.resolve();
    const worker=TestWorker.instances[0]!,sent=worker.postMessage.mock.calls.find(([m])=>m.type==='frame')![0] as unknown as {timestampMs:number};
    worker.onmessage?.({data:{type:'frame-done',timestampMs:sent.timestampMs}} as MessageEvent);
    await vi.advanceTimersByTimeAsync(1100);expect(bitmap).toHaveBeenCalledTimes(1);
    count++;await vi.advanceTimersByTimeAsync(100);expect(bitmap).toHaveBeenCalledTimes(2);session.dispose();
  });
  it('stops feeding a frozen decoded video and does not refresh a visible face from late worker packets',async()=>{
    vi.useFakeTimers();const {stream}=streamWithTrack(),status=vi.fn();
    const {session}=setup(vi.fn().mockResolvedValue(stream),{onStatusChange:status});session.video.currentTime=0;
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    const bitmap=vi.fn().mockResolvedValue({close:vi.fn()});vi.stubGlobal('createImageBitmap',bitmap);
    await session.start();await vi.advanceTimersByTimeAsync(300);
    const worker=TestWorker.instances[0]!,sent=worker.postMessage.mock.calls.find(([m])=>m.type==='frame')![0] as unknown as {timestampMs:number};
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:sent.timestampMs}} as MessageEvent);
    worker.onmessage?.({data:{type:'frame-done',timestampMs:sent.timestampMs}} as MessageEvent);
    await vi.advanceTimersByTimeAsync(800);expect(bitmap).toHaveBeenCalledTimes(1);
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:performance.now()}} as MessageEvent);
    expect(session.status).toBe('searching');expect(rendererMocks.instances[0]!.setPose).toHaveBeenLastCalledWith(null,1280,720);
    session.video.currentTime=1;await vi.advanceTimersByTimeAsync(100);expect(bitmap).toHaveBeenCalledTimes(2);session.dispose();
  });
  it('serializes optional hair initialization after first-face render and hand readiness',async()=>{
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream),{hairOcclusion:{},handInteraction:{}});
    await session.start();const worker=TestWorker.instances[0]!;
    expect(worker.postMessage).not.toHaveBeenCalledWith({type:'enable-hair'});
    const before=vi.mocked(requestAnimationFrame).mock.calls.length;
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:performance.now()}} as MessageEvent);
    const callbacks=vi.mocked(requestAnimationFrame).mock.calls.slice(before);
    for(const [callback] of callbacks)callback(performance.now());
    expect(worker.postMessage).toHaveBeenCalledWith({type:'enable-hands'});expect(worker.postMessage).not.toHaveBeenCalledWith({type:'enable-hair'});
    worker.onmessage?.({data:{type:'hand-ready'}} as MessageEvent);expect(worker.postMessage).toHaveBeenCalledWith({type:'enable-hair'});
    session.dispose();
  });
  it('allows explicit placement without starting a camera, and resets at stop', () => {
    const getUserMedia=vi.fn(); const onInteractionChange=vi.fn();
    const {session}=setup(getUserMedia,{onInteractionChange});
    session.setPlacement('head');
    expect(onInteractionChange).toHaveBeenLastCalledWith(expect.objectContaining({placement:'head',progress:1,availability:'disabled'}));
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(() => session.setPlacement('invalid' as 'face')).toThrow();
    session.stop();
    expect(onInteractionChange).toHaveBeenLastCalledWith(expect.objectContaining({placement:'face',progress:0}));
    session.dispose(); expect(() => session.setPlacement('face')).toThrow();
  });
  it('keeps hands opt-in and passes a custom model only when enabled', async () => {
    for(const handInteraction of [undefined,{modelAssetPath:'/local-hand.task'}]) {
      const {stream}=streamWithTrack(); const {session}=setup(vi.fn().mockResolvedValue(stream),{handInteraction});
      await session.start();
      const worker=TestWorker.instances.at(-1)!;
      expect(worker.postMessage.mock.calls[0]![0].handModelAssetPath).toBe(handInteraction?.modelAssetPath);
      session.dispose();
    }
  });
  it('accepts usable 250 ms face results and only requests hands after a visible fit',async()=>{
    let now=2000;vi.spyOn(performance,'now').mockImplementation(()=>now);
    const {stream}=streamWithTrack(),onInteractionChange=vi.fn();
    const {session}=setup(vi.fn().mockResolvedValue(stream),{handInteraction:{},onInteractionChange});
    await session.start();const worker=TestWorker.instances[0]!;
    expect(onInteractionChange).toHaveBeenLastCalledWith(expect.objectContaining({availability:'loading'}));
    expect(worker.postMessage).not.toHaveBeenCalledWith({type:'enable-hands'});
    const landmarks=Array.from({length:478},()=>({x:0.5,y:0.5,z:0}));
    worker.onmessage?.({data:{type:'result',landmarks,timestampMs:1750}} as MessageEvent);
    expect(session.status).toBe('tracking');
    const callbacks=vi.mocked(requestAnimationFrame).mock.calls;
    callbacks.at(-1)![0](now);
    expect(worker.postMessage).toHaveBeenCalledWith({type:'enable-hands'});
    worker.onmessage?.({data:{type:'hand-ready'}} as MessageEvent);
    expect(onInteractionChange).toHaveBeenLastCalledWith(expect.objectContaining({availability:'ready'}));
    // If inference then hangs, a face pose expires without waiting for recovery.
    now=2800;callbacks[0]![0](now);
    expect(session.status).toBe('searching');
    expect(rendererMocks.instances[0]!.setPose).toHaveBeenLastCalledWith(null,1280,720);
    session.dispose();
  });
  it.each([500,900])('renders %i ms face results while retaining a bounded age limit',async age=>{
    vi.spyOn(performance,'now').mockReturnValue(3000);
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream));
    await session.start();const worker=TestWorker.instances[0]!;
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:3000-age}} as MessageEvent);
    expect(session.status).toBe('tracking');
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:1999}} as MessageEvent);
    expect(session.status).toBe('searching');
    expect(rendererMocks.instances[0]!.setPose).toHaveBeenLastCalledWith(null,1280,720);
    session.dispose();
  });
  it('never enables hands for invisible face fits',async()=>{
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream),{handInteraction:{}});
    await session.start();const worker=TestWorker.instances[0]!;
    rendererMocks.instances[0]!.setPose.mockReturnValueOnce({visible:false});
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:performance.now()}} as MessageEvent);
    expect(session.status).toBe('searching');
    expect(worker.postMessage).not.toHaveBeenCalledWith({type:'enable-hands'});
    session.dispose();
  });
  it('degrades hand inference failure to buttons while preserving the camera/face session', async () => {
    const {stream,track}=streamWithTrack(); const onInteractionChange=vi.fn(); const onError=vi.fn();
    const {session}=setup(vi.fn().mockResolvedValue(stream),{handInteraction:{},onInteractionChange,onError});
    await session.start();
    TestWorker.instances[0]!.onmessage?.({data:{type:'hand-unavailable'}} as MessageEvent);
    expect(onInteractionChange).toHaveBeenLastCalledWith(expect.objectContaining({availability:'unavailable'}));
    expect(session.status).toBe('searching'); expect(track.stop).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
    session.setPlacement('head'); expect(onInteractionChange).toHaveBeenLastCalledWith(expect.objectContaining({placement:'head'}));
    session.dispose();
  });
  beforeEach(() => {
    TestWorker.instances = [];
    TestWorker.protocolVersion = TRACKER_PROTOCOL_VERSION;
    TestWorker.prepared=TestWorker.hangOptional=TestWorker.failFaceOnly=false;
    rendererMocks.instances = [];
    rendererMocks.failure = null;rendererMocks.initialLoad=null;
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests video without audio and stops all resources idempotently', async () => {
    const { stream, track } = streamWithTrack();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const { container, session } = setup(getUserMedia);

    await session.start();
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    expect(session.status).toBe('searching');
    expect(TestWorker.instances).toHaveLength(1);

    session.stop();
    session.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(rendererMocks.instances[0]!.clearLocalAmbientSample).toHaveBeenCalled();
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledTimes(1);
    expect(session.status).toBe('idle');

    session.dispose();
    expect(container.children).toHaveLength(0);
    expect(session.status).toBe('disposed');
  });
  it('rejects a cached incompatible worker before sending camera frames',async()=>{
    TestWorker.protocolVersion=0;
    const {stream,track}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream));
    await expect(session.start()).rejects.toThrow('runtime version does not match');
    expect(session.status).toBe('error');expect(track.stop).toHaveBeenCalledTimes(1);
    expect(TestWorker.instances[0]!.postMessage).toHaveBeenCalledTimes(1);
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledTimes(1);
    session.dispose();
  });
  it('captures bounded RGBA input when video-frame callbacks stop arriving',async()=>{
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval','performance']});
    const {stream,track}=streamWithTrack(),onTrackingHealthChange=vi.fn();
    const {session}=setup(vi.fn().mockResolvedValue(stream),{onTrackingHealthChange});
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:vi.fn(()=>1)});
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    const bitmap=vi.fn().mockResolvedValue({close:vi.fn()});vi.stubGlobal('createImageBitmap',bitmap);
    await session.start();await vi.advanceTimersByTimeAsync(1000);
    expect(bitmap).toHaveBeenCalledTimes(1);
    const scratch=bitmap.mock.calls[0]![0] as HTMLCanvasElement;
    expect(scratch).toBeInstanceOf(HTMLCanvasElement);expect([scratch.width,scratch.height]).toEqual([640,360]);
    const worker=TestWorker.instances[0]!,sent=worker.postMessage.mock.calls.find(([m])=>m.type==='frame')![0] as unknown as {timestampMs:number};
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:sent.timestampMs}} as MessageEvent);
    worker.onmessage?.({data:{type:'frame-done',timestampMs:sent.timestampMs+1}} as MessageEvent);
    await vi.advanceTimersByTimeAsync(100);expect(bitmap).toHaveBeenCalledTimes(1);
    worker.onmessage?.({data:{type:'frame-done',timestampMs:sent.timestampMs}} as MessageEvent);
    await vi.advanceTimersByTimeAsync(100);expect(bitmap).toHaveBeenCalledTimes(2);
    session.dispose();expect(track.stop).toHaveBeenCalledTimes(1);expect([scratch.width,scratch.height]).toEqual([0,0]);
  });
  it('separates capture timeout and closes a late bitmap without unlocking the recovered frame',async()=>{
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval','performance']});
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream));
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:vi.fn(()=>1)});
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    let resolve!:(bitmap:{close:ReturnType<typeof vi.fn>})=>void;
    const bitmap=vi.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({close:vi.fn()});
    vi.stubGlobal('createImageBitmap',bitmap);
    await session.start();await vi.advanceTimersByTimeAsync(2300);
    expect(TestWorker.instances).toHaveLength(2);
    expect(TestWorker.instances[0]!.postMessage.mock.calls.some(([m])=>m.type==='frame')).toBe(false);
    expect(TestWorker.instances[1]!.postMessage.mock.calls[0]![0]).toEqual(expect.objectContaining({delegate:'CPU'}));
    const late={close:vi.fn()};resolve(late);await Promise.resolve();
    expect(late.close).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);expect(bitmap).toHaveBeenCalledTimes(2);
    session.dispose();
  });

  it('shares concurrent start requests and releases resources over twenty camera cycles', async () => {
    const tracks: Array<ReturnType<typeof streamWithTrack>['track']> = [];
    const getUserMedia = vi.fn(() => {
      const { stream, track } = streamWithTrack(); tracks.push(track); return Promise.resolve(stream);
    });
    const { session } = setup(getUserMedia);
    const first = session.start();
    expect(session.start()).toBe(first);
    await first;
    session.stop();
    for (let cycle = 1; cycle < 20; cycle++) { await session.start(); session.stop(); }
    expect(getUserMedia).toHaveBeenCalledTimes(20);
    expect(tracks.every(track => track.stop.mock.calls.length === 1)).toBe(true);
    expect(TestWorker.instances.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true);
    session.dispose();
  });

  it('does not create a worker if stopped while video playback is still starting', async () => {
    const { stream, track } = streamWithTrack();
    const { session } = setup(vi.fn().mockResolvedValue(stream));
    let finishPlayback!: () => void;
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => new Promise(resolve => { finishPlayback = resolve; }));
    const starting = session.start();
    await Promise.resolve();
    session.stop();
    finishPlayback();
    await starting;
    expect(TestWorker.instances).toHaveLength(0);
    expect(track.stop).toHaveBeenCalledTimes(1);
    session.dispose();
  });

  it('releases the camera if the WebGL graphics context is lost', async () => {
    const { stream, track } = streamWithTrack();
    const onError = vi.fn();
    const { session } = setup(vi.fn().mockResolvedValue(stream), { onError });
    await session.start();
    session.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(session.status).toBe('error');
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('graphics context was lost') }));
    session.dispose();
  });

  it('stops camera startup if graphics/asset initialization fails', async () => {
    rendererMocks.failure = new Error('WebGL initialization failed');
    const { stream, track } = streamWithTrack();
    const { session } = setup(vi.fn().mockResolvedValue(stream), { onError: vi.fn() });
    await expect(session.start()).rejects.toThrow('WebGL initialization failed');
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(TestWorker.instances).toHaveLength(0);
    expect(session.status).toBe('error');
    session.dispose();
  });

  it('maps predictive presentation to the captured video time, not the later receipt time',async()=>{
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream),{presentation:'predicted'});
    let callback:VideoFrameRequestCallback|undefined;
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:vi.fn((next:VideoFrameRequestCallback)=>{callback=next;return 19;})});
    Object.defineProperty(HTMLVideoElement.prototype,'cancelVideoFrameCallback',{configurable:true,value:vi.fn()});
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({close:vi.fn()}));
    await session.start();session.video.currentTime=0.12;
    callback?.(performance.now(),{} as VideoFrameCallbackMetadata);await Promise.resolve();
    const worker=TestWorker.instances[0]!,sent=worker.postMessage.mock.calls.find(([m])=>m.type==='frame')![0] as unknown as {timestampMs:number};
    session.video.currentTime=0.24;
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:sent.timestampMs}} as MessageEvent);
    expect(rendererMocks.instances[0]!.setPose).toHaveBeenLastCalledWith([],1280,720,null,sent.timestampMs,0.12);
    session.dispose();
  });
  it('sends a captured frame only to the worker and accepts a fresh local tracking result', async () => {
    const { stream } = streamWithTrack();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const { session } = setup(getUserMedia);
    let frameCallback: VideoFrameRequestCallback | undefined;
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: vi.fn((callback: VideoFrameRequestCallback) => { frameCallback = callback; return 9; }),
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLVideoElement.prototype, 'readyState', { configurable: true, get: () => HTMLMediaElement.HAVE_CURRENT_DATA });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 720 });
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }));

    await session.start();
    const timestampMs = performance.now();
    frameCallback?.(timestampMs, {} as VideoFrameCallbackMetadata);
    await Promise.resolve();
    const worker = TestWorker.instances[0]!;
    expect(rendererMocks.instances[0]!.updateAmbientFromVideo).toHaveBeenCalledWith(session.video, timestampMs);
    const frameMessage = worker.postMessage.mock.calls.find(([message]) => message.type === 'frame')?.[0];
    expect(frameMessage).toBeDefined();

    const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    const capturedTimestamp=(frameMessage as unknown as {timestampMs:number}).timestampMs;
    worker.onmessage?.({ data: { type: 'result', landmarks, timestampMs:capturedTimestamp+1 } } as MessageEvent);
    expect(session.status).toBe('searching');
    worker.onmessage?.({ data: { type: 'result', landmarks, timestampMs:capturedTimestamp } } as MessageEvent);
    expect(session.status).toBe('tracking');
    expect(rendererMocks.instances[0]!.setPose).toHaveBeenCalledWith(landmarks, 1280, 720, null, capturedTimestamp,expect.any(Number));
    session.dispose();
  });

  it('does not queue another bitmap after a face result while hands still own the current frame',async()=>{
    const {stream}=streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream),{handInteraction:{}});
    let callback:VideoFrameRequestCallback|undefined;
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:vi.fn((next:VideoFrameRequestCallback)=>{callback=next;return 15;})});
    Object.defineProperty(HTMLVideoElement.prototype,'cancelVideoFrameCallback',{configurable:true,value:vi.fn()});
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    const bitmap=vi.fn().mockResolvedValue({close:vi.fn()});vi.stubGlobal('createImageBitmap',bitmap);
    await session.start();const worker=TestWorker.instances[0]!,time=performance.now();
    callback?.(time,{} as VideoFrameCallbackMetadata);await Promise.resolve();
    worker.onmessage?.({data:{type:'result',landmarks:[],timestampMs:time}} as MessageEvent);
    callback?.(time+20,{} as VideoFrameCallbackMetadata);await Promise.resolve();expect(bitmap).toHaveBeenCalledTimes(1);
    const sent=worker.postMessage.mock.calls.find(([m])=>m.type==='frame')![0] as unknown as {timestampMs:number};
    worker.onmessage?.({data:{type:'frame-done',timestampMs:sent.timestampMs}} as MessageEvent);
    callback?.(time+40,{} as VideoFrameCallbackMetadata);await Promise.resolve();expect(bitmap).toHaveBeenCalledTimes(2);
    session.dispose();
  });

  it('restarts a hung tracker locally and stops cleanly when bounded recovery is exhausted', async () => {
    vi.useFakeTimers();
    const { stream, track } = streamWithTrack();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const onError = vi.fn();
    const { session } = setup(getUserMedia, { onError });
    let frameCallback: VideoFrameRequestCallback | undefined;
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: vi.fn((callback: VideoFrameRequestCallback) => { frameCallback = callback; return 12; }),
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLVideoElement.prototype, 'readyState', { configurable: true, get: () => HTMLMediaElement.HAVE_CURRENT_DATA });
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }));

    await session.start();
    for (let recovery = 0; recovery <= 2; recovery++) {
      frameCallback?.(performance.now(), {} as VideoFrameCallbackMetadata);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(3_000);
      if (recovery < 2) {
        expect(session.status).toBe('searching');
        expect(track.stop).not.toHaveBeenCalled();
        expect(TestWorker.instances).toHaveLength(recovery + 2);
        expect(TestWorker.instances.at(-1)!.postMessage.mock.calls[0]![0]).toEqual(expect.objectContaining({type:'init',delegate:'CPU'}));
      }
    }

    expect(session.status).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('could not recover after 2 local restarts') }));
    expect(track.stop).toHaveBeenCalledTimes(1);
    session.dispose();
    expect(TestWorker.instances.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true);
    vi.useRealTimers();
  });

  it('bounds hand graph compilation separately and restores the normal inference watchdog',async()=>{
    vi.useFakeTimers();
    const {stream} =streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream),{handInteraction:{}});
    let callback:VideoFrameRequestCallback|undefined;
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:vi.fn((next:VideoFrameRequestCallback)=>{callback=next;return 17;})});
    Object.defineProperty(HTMLVideoElement.prototype,'cancelVideoFrameCallback',{configurable:true,value:vi.fn()});
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({close:vi.fn()}));
    await session.start();const worker=TestWorker.instances[0]!;
    callback?.(performance.now(),{} as VideoFrameCallbackMetadata);await Promise.resolve();
    worker.onmessage?.({data:{type:'hand-loading'}} as MessageEvent);
    await vi.advanceTimersByTimeAsync(4000);expect(TestWorker.instances).toHaveLength(1);
    worker.onmessage?.({data:{type:'hand-ready',startupMs:4000}} as MessageEvent);
    await vi.advanceTimersByTimeAsync(3001);expect(TestWorker.instances).toHaveLength(2);
    session.dispose();
  });
  it('does not let repeated hand-loading packets renew the initialization deadline',async()=>{
    vi.useFakeTimers();
    const {stream} =streamWithTrack(),{session}=setup(vi.fn().mockResolvedValue(stream),{handInteraction:{}});
    let callback:VideoFrameRequestCallback|undefined;
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:vi.fn((next:VideoFrameRequestCallback)=>{callback=next;return 18;})});
    Object.defineProperty(HTMLVideoElement.prototype,'cancelVideoFrameCallback',{configurable:true,value:vi.fn()});
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>HTMLMediaElement.HAVE_CURRENT_DATA});
    vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({close:vi.fn()}));
    await session.start();const worker=TestWorker.instances[0]!;
    callback?.(performance.now(),{} as VideoFrameCallbackMetadata);await Promise.resolve();
    worker.onmessage?.({data:{type:'hand-loading'}} as MessageEvent);
    await vi.advanceTimersByTimeAsync(11000);worker.onmessage?.({data:{type:'hand-loading'}} as MessageEvent);
    await vi.advanceTimersByTimeAsync(1001);expect(TestWorker.instances).toHaveLength(2);
    session.dispose();
  });
  it('restarts a crashed worker without reacquiring the local camera', async () => {
    const { stream, track } = streamWithTrack();
    const onError = vi.fn();
    const { session } = setup(vi.fn().mockResolvedValue(stream), { onError });
    await session.start();
    const failedWorker = TestWorker.instances[0]!;
    failedWorker.onerror?.();
    await Promise.resolve();

    expect(TestWorker.instances).toHaveLength(2);
    expect(failedWorker.terminate).toHaveBeenCalledTimes(1);
    expect(session.status).toBe('searching');
    expect(track.stop).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    session.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(TestWorker.instances[1]!.terminate).toHaveBeenCalledTimes(1);
    session.dispose();
  });

  it('stops a stream that resolves after camera start was cancelled', async () => {
    const { stream, track } = streamWithTrack();
    let resolvePermission!: (value: MediaStream) => void;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { resolvePermission = resolve; }));
    const { session } = setup(getUserMedia);

    const starting = session.start();
    session.stop();
    resolvePermission(stream);
    await starting;

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(TestWorker.instances).toHaveLength(0);
    expect(session.status).toBe('idle');
    session.dispose();
  });

  it('reports denied camera access and permits cleanup', async () => {
    const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    const onError = vi.fn();
    const getUserMedia = vi.fn().mockRejectedValue(denied);
    const container = document.createElement('div');
    document.body.append(container);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    vi.stubGlobal('Worker', TestWorker);
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn()} as unknown as ReturnType<HTMLCanvasElement['getContext']>);
    const session = createVirtualTryOn({ container, glassesUrl: '/glasses.glb', onError });

    await expect(session.start()).rejects.toThrow('Permission denied');
    expect(session.status).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code:'camera-access-blocked',name:'NotAllowedError',cause:denied}));
    session.dispose();
  });
});
