/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerRequest } from '../src/tracking/protocol';
import { TRACKER_PROTOCOL_VERSION } from '../src/tracking/protocol';

const mocks=vi.hoisted(()=>({faceCreate:vi.fn(),handCreate:vi.fn(),hairCreate:vi.fn(),files:vi.fn()}));
vi.mock('@mediapipe/tasks-vision',()=>({FaceLandmarker:{createFromOptions:mocks.faceCreate},HandLandmarker:{createFromOptions:mocks.handCreate},ImageSegmenter:{createFromOptions:mocks.hairCreate},FilesetResolver:{forVisionTasks:mocks.files}}));
vi.mock('../src/tracking/runtime-assets',()=>({prepareRuntimeAssets:async(files:unknown,path:string)=>({files,modelAssetPath:path,dispose(){}})}));
let scope:{onmessage:((e:{data:WorkerRequest})=>Promise<void>)|null;postMessage:ReturnType<typeof vi.fn>;close:ReturnType<typeof vi.fn>};
let face:{detectForVideo:ReturnType<typeof vi.fn>;close:ReturnType<typeof vi.fn>};
let hand:{detectForVideo:ReturnType<typeof vi.fn>;close:ReturnType<typeof vi.fn>};
const init=(enabled:boolean)=>({type:'init',modelAssetPath:'/face.task',wasmRoot:'/wasm',handModelAssetPath:enabled?'/hand.task':undefined} as Extract<WorkerRequest,{type:'init'}>);
const frame=(time:number)=>({type:'frame',bitmap:{close:vi.fn()} as unknown as ImageBitmap,timestampMs:time} as Extract<WorkerRequest,{type:'frame'}>);
const enableHands=()=>scope.onmessage!({data:{type:'enable-hands'}});

describe('optional hands in the shared face worker',()=>{
  it('warms face, hands and hair at activation geometry before acknowledging',async()=>{
    const hair={getLabels:()=>['background','hair'],close:vi.fn(),segmentForVideo:vi.fn()};mocks.hairCreate.mockResolvedValue(hair);
    await scope.onmessage!({data:{...init(true),prewarmOptional:true,hairModelAssetPath:'/hair.tflite'}});
    await scope.onmessage!({data:{type:'warmup',inputWidth:640,inputHeight:1138}});
    for(const detect of [face.detectForVideo,hand.detectForVideo,hair.segmentForVideo])expect(detect).toHaveBeenCalledWith(expect.objectContaining({width:640,height:1138}),1,...(detect===hair.segmentForVideo?[expect.any(Function)]:[]));
    expect(scope.postMessage).toHaveBeenLastCalledWith({type:'warmup-ready'});
    const bitmap=face.detectForVideo.mock.calls.at(-1)![0];expect(bitmap.close).toHaveBeenCalledOnce();
    await scope.onmessage!({data:{type:'warmup',inputWidth:640,inputHeight:1138}});
    expect(scope.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({type:'error',message:expect.stringContaining('run once')}));
  });
  it('rejects oversized warmup input and warmup after live dispatch',async()=>{
    await scope.onmessage!({data:init(false)});
    await scope.onmessage!({data:{type:'warmup',inputWidth:641,inputHeight:360}});
    expect(scope.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({type:'error',message:expect.stringContaining('geometry')}));
    await scope.onmessage!({data:frame(1000)});
    await scope.onmessage!({data:{type:'warmup',inputWidth:640,inputHeight:360}});
    expect(scope.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({type:'error',message:expect.stringContaining('precede live')}));
  });
  beforeEach(async()=>{
    vi.resetModules(); vi.clearAllMocks();
    scope={onmessage:null,postMessage:vi.fn(),close:vi.fn()}; vi.stubGlobal('self',scope);
    vi.stubGlobal('OffscreenCanvas',class {width:number;height:number;constructor(w:number,h:number){this.width=w;this.height=h;}getContext(){return {fillStyle:'',fillRect(){}};}});
    vi.stubGlobal('createImageBitmap',vi.fn(async(canvas:{width:number;height:number})=>({width:canvas.width,height:canvas.height,close:vi.fn()})));
    face={detectForVideo:vi.fn().mockReturnValue({faceLandmarks:[[{x:0.5,y:0.5,z:0}]],facialTransformationMatrixes:[{data:[]}] }),close:vi.fn()};
    hand={detectForVideo:vi.fn().mockReturnValue({landmarks:[]}),close:vi.fn()};
    mocks.files.mockResolvedValue({wasmLoaderPath:'/loader.js',wasmBinaryPath:'/runtime.wasm'});
    mocks.faceCreate.mockResolvedValue(face); mocks.handCreate.mockResolvedValue(hand);
    await import('../src/tracking/face.worker');
  });
  afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
  it('does not initialize a hand task in the default path and closes each shared bitmap once',async()=>{
    await scope.onmessage!({data:init(false)}); const input=frame(1000);
    await scope.onmessage!({data:input});
    expect(mocks.handCreate).not.toHaveBeenCalled(); expect(input.bitmap.close).toHaveBeenCalledTimes(1);
    expect(mocks.hairCreate).not.toHaveBeenCalled();
    expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'result',landmarks:[{x:0.5,y:0.5,z:0}]}));
    expect(scope.postMessage).toHaveBeenLastCalledWith({type:'frame-done',timestampMs:1000});
  });
  it('warms the live bitmap shape and skips automatic hair when face initialization falls back to CPU',async()=>{
    mocks.faceCreate.mockRejectedValueOnce(new Error('GPU unavailable')).mockResolvedValueOnce(face);
    await scope.onmessage!({data:{...init(false),prewarmOptional:true,hairAuto:true,hairModelAssetPath:'/hair.tflite',inputWidth:320,inputHeight:640}});
    expect(face.detectForVideo).toHaveBeenCalledWith(expect.objectContaining({width:320,height:640}),0);
    expect(face.detectForVideo.mock.calls[0]![0].close).toHaveBeenCalledOnce();
    expect(mocks.hairCreate).not.toHaveBeenCalled();expect(scope.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({type:'ready',delegate:'CPU',hairTracking:'unavailable'}));
    await scope.onmessage!({data:{type:'dispose'}});
  });
  it('prewarms requested graphs before ready and skips hair work for missing faces or held placement',async()=>{
    const hair={getLabels:()=>['background','hair'],close:vi.fn(),segmentForVideo:vi.fn((_image:unknown,_time:number,callback:(result:unknown)=>void)=>callback({confidenceMasks:[{}, {width:2,height:2,getAsFloat32Array:()=>new Float32Array(4)}]}))};mocks.hairCreate.mockResolvedValue(hair);
    await scope.onmessage!({data:{...init(true),prewarmOptional:true,hairModelAssetPath:'/hair.tflite'}});
    expect(scope.postMessage.mock.calls.map(([m])=>m.type)).toEqual(['startup-stage','startup-stage','startup-stage','face-ready','hand-loading','hand-ready','hair-loading','hair-ready','startup-profile','ready']);
    expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'startup-profile',timings:{filesetMs:expect.any(Number),resourcePreparationMs:expect.any(Number),faceCreationMs:expect.any(Number),faceWarmupMs:expect.any(Number),optionalWarmupMs:expect.any(Number),hairCreationMs:expect.any(Number),hairWarmupMs:expect.any(Number)}}));
    expect(scope.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({type:'ready',handTracking:'ready',hairTracking:'ready'}));
    const warmCalls=hair.segmentForVideo.mock.calls.length;face.detectForVideo.mockReturnValue({faceLandmarks:[]});
    await scope.onmessage!({data:frame(1000)});expect(hair.segmentForVideo).toHaveBeenCalledTimes(warmCalls);
    face.detectForVideo.mockReturnValue({faceLandmarks:[[{x:.5,y:.5,z:0}]],facialTransformationMatrixes:[{data:[]}]});
    await scope.onmessage!({data:{type:'hair-activity',active:false}});await scope.onmessage!({data:frame(2000)});expect(hair.segmentForVideo).toHaveBeenCalledTimes(warmCalls);
    await scope.onmessage!({data:{type:'hair-activity',active:true}});await scope.onmessage!({data:frame(3000)});expect(hair.segmentForVideo).toHaveBeenCalledTimes(warmCalls+1);
    await scope.onmessage!({data:{type:'disable-hair'}});expect(hair.close).toHaveBeenCalledTimes(1);
    await scope.onmessage!({data:{type:'dispose'}});
  });
  it('shares one frame with optional hair last and isolates segmentation errors',async()=>{
    const hair={getLabels:()=>['background','hair'],close:vi.fn(),segmentForVideo:vi.fn((_image:unknown,_time:number,callback:(result:unknown)=>void)=>callback({confidenceMasks:[{}, {width:2,height:2,getAsFloat32Array:()=>new Float32Array(4).fill(0.5)}]}))};
    mocks.hairCreate.mockResolvedValue(hair);
    await scope.onmessage!({data:{...init(true),hairModelAssetPath:'/hair.tflite'}});
    expect(mocks.hairCreate).not.toHaveBeenCalled();
    await enableHands();await scope.onmessage!({data:{type:'enable-hair'}});
    const input=frame(1000);await scope.onmessage!({data:input});
    expect(scope.postMessage.mock.calls.slice(-4).map(([m])=>m.type)).toEqual(['result','hand-result','hair-result','frame-done']);
    expect(hair.segmentForVideo).toHaveBeenLastCalledWith(input.bitmap,1000,expect.any(Function));
    expect(input.bitmap.close).toHaveBeenCalledTimes(1);
    const maskPacket=scope.postMessage.mock.calls.find(([m])=>m.type==='hair-result')!;
    expect(maskPacket[1]).toEqual([maskPacket[0].data.buffer]);
    hair.segmentForVideo.mockImplementation(()=>{throw new Error('hair failure');});
    const next=frame(2000);await scope.onmessage!({data:next});
    expect(scope.postMessage.mock.calls.slice(-4).map(([m])=>m.type)).toEqual(['result','hand-result','hair-unavailable','frame-done']);
    expect(next.bitmap.close).toHaveBeenCalledTimes(1);expect(face.close).not.toHaveBeenCalled();
    await scope.onmessage!({data:{type:'dispose'}});expect(hair.close).toHaveBeenCalledTimes(1);
  });
  it('warms locally, shares one bitmap, throttles hands, and closes both tasks on disposal',async()=>{
    await scope.onmessage!({data:init(true)});
    expect(mocks.handCreate).not.toHaveBeenCalled();
    expect(scope.postMessage).toHaveBeenLastCalledWith({type:'ready',protocolVersion:TRACKER_PROTOCOL_VERSION,delegate:'GPU',handTracking:'loading'});
    await enableHands();
    expect(hand.detectForVideo).toHaveBeenCalledWith(expect.objectContaining({width:640,height:360}),0);
    expect(scope.postMessage).toHaveBeenCalledWith({type:'hand-loading'});
    expect(scope.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({type:'hand-ready',startupMs:expect.any(Number)}));
    const input=frame(1000); await scope.onmessage!({data:input});
    expect(face.detectForVideo).toHaveBeenLastCalledWith(input.bitmap,1000); expect(hand.detectForVideo).toHaveBeenLastCalledWith(input.bitmap,1000);
    expect(input.bitmap.close).toHaveBeenCalledTimes(1);
    await scope.onmessage!({data:frame(1030)}); expect(hand.detectForVideo).toHaveBeenCalledTimes(2);
    await scope.onmessage!({data:{type:'dispose'}}); expect(face.close).toHaveBeenCalledTimes(1);expect(hand.close).toHaveBeenCalledTimes(1);
  });
  it('isolates a hand inference error from the face result without double-closing frames',async()=>{
    await scope.onmessage!({data:init(true)});await enableHands(); hand.detectForVideo.mockImplementation(()=>{throw new Error('hand fault');});
    const input=frame(1000); await scope.onmessage!({data:input});
    expect(scope.postMessage).toHaveBeenCalledWith({type:'hand-unavailable',reason:'failure'});
    expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'result',landmarks:[{x:0.5,y:0.5,z:0}]}));
    expect(scope.postMessage).toHaveBeenLastCalledWith({type:'frame-done',timestampMs:1000});
    expect(input.bitmap.close).toHaveBeenCalledTimes(1); expect(face.close).not.toHaveBeenCalled();
  });
  it('publishes face results before slow hands and keeps hand tracking enabled with adaptive cadence',async()=>{
    await scope.onmessage!({data:{...init(true),adaptiveQuality:true}});await enableHands();
    vi.spyOn(performance,'now').mockReturnValueOnce(1000).mockReturnValueOnce(1005).mockReturnValueOnce(1005).mockReturnValueOnce(1155).mockReturnValue(1200);
    await scope.onmessage!({data:frame(1000)});
    const types=scope.postMessage.mock.calls.map(([message])=>message.type);
    expect(types.slice(-3)).toEqual(['result','hand-result','frame-done']);
    expect(hand.close).not.toHaveBeenCalled();
    await scope.onmessage!({data:frame(1080)});expect(hand.detectForVideo).toHaveBeenCalledTimes(2);
    await scope.onmessage!({data:frame(1260)});expect(hand.detectForVideo).toHaveBeenCalledTimes(3);
  });
  it.each([true,false])('closes sustained over-budget hands while face and shared-frame completion continue (adaptive=%s)',async(adaptiveQuality)=>{
    await scope.onmessage!({data:{...init(true),adaptiveQuality}});await enableHands();
    let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
    face.detectForVideo.mockImplementation(()=>{clock+=5;return {faceLandmarks:[[{x:.5,y:.5,z:0}]],facialTransformationMatrixes:[{data:[]}]};});
    hand.detectForVideo.mockImplementation(()=>{clock+=150;return {landmarks:[]};});
    for(let t=1000;t<4000;t+=250) {
      const input=frame(t);await scope.onmessage!({data:input});
      expect(input.bitmap.close).toHaveBeenCalledOnce();expect(hand.close).not.toHaveBeenCalled();
    }
    const overloaded=frame(4000);await scope.onmessage!({data:overloaded});
    expect(scope.postMessage.mock.calls.slice(-3).map(([m])=>m.type)).toEqual(['result','hand-unavailable','frame-done']);
    expect(scope.postMessage).toHaveBeenCalledWith({type:'hand-unavailable',reason:'budget'});
    expect(overloaded.bitmap.close).toHaveBeenCalledOnce();expect(hand.close).toHaveBeenCalledOnce();expect(face.close).not.toHaveBeenCalled();
    const handCalls=hand.detectForVideo.mock.calls.length;
    const next=frame(4250);await scope.onmessage!({data:next});
    expect(scope.postMessage.mock.calls.slice(-2).map(([m])=>m.type)).toEqual(['result','frame-done']);
    expect(hand.detectForVideo).toHaveBeenCalledTimes(handCalls);expect(next.bitmap.close).toHaveBeenCalledOnce();
    await enableHands();expect(mocks.handCreate).toHaveBeenCalledOnce();
    // A new camera session retries its opt-in capability with a clean budget.
    await scope.onmessage!({data:{...init(true),adaptiveQuality,prewarmOptional:true}});
    expect(scope.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({type:'ready',handTracking:'ready'}));
    await scope.onmessage!({data:frame(5000)});
    expect(scope.postMessage.mock.calls.slice(-3).map(([m])=>m.type)).toEqual(['result','hand-result','frame-done']);
    expect(hand.close).toHaveBeenCalledOnce();
    await scope.onmessage!({data:{type:'dispose'}});
  });
  it('does not charge slow blank warmup or isolated live spikes to a session fallback',async()=>{
    let clock=0;vi.spyOn(performance,'now').mockImplementation(()=>clock);
    hand.detectForVideo.mockImplementation((_image:unknown,time:number)=>{clock+=time===0||time%2000===1000?600:10;return {landmarks:[]};});
    await scope.onmessage!({data:{...init(true),adaptiveQuality:true,prewarmOptional:true}});
    for(let t=1000;t<=7000;t+=250)await scope.onmessage!({data:frame(t)});
    expect(hand.close).not.toHaveBeenCalled();
    expect(scope.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({type:'hand-unavailable'}));
    expect(scope.postMessage).toHaveBeenLastCalledWith({type:'frame-done',timestampMs:7000});
    await scope.onmessage!({data:{type:'dispose'}});
  });
  it('bounds optional initialization and disposes a hand task that resolves after timeout',async()=>{
    vi.useFakeTimers(); let resolve!:(value:typeof hand)=>void;
    mocks.handCreate.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    await scope.onmessage!({data:init(true)});
    const pending=enableHands(); await vi.advanceTimersByTimeAsync(8001); await pending;
    expect(scope.postMessage).toHaveBeenLastCalledWith({type:'hand-unavailable',reason:'failure'});
    resolve(hand); await Promise.resolve(); await Promise.resolve();
    expect(hand.close).toHaveBeenCalledTimes(1); expect(face.close).not.toHaveBeenCalled();
  });
  it('keeps face inference active before and during optional hand downloads',async()=>{
    await scope.onmessage!({data:init(true)});
    expect(face.detectForVideo).toHaveBeenCalledWith(expect.objectContaining({width:640,height:360}),0);
    await scope.onmessage!({data:frame(1000)});
    expect(mocks.handCreate).not.toHaveBeenCalled();
    let resolve!:(value:typeof hand)=>void;
    mocks.handCreate.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const pending=enableHands();
    await scope.onmessage!({data:frame(1100)});
    expect(scope.postMessage).toHaveBeenLastCalledWith({type:'frame-done',timestampMs:1100});
    expect(face.detectForVideo).toHaveBeenLastCalledWith(expect.anything(),1100);
    await scope.onmessage!({data:{type:'dispose'}});
    resolve(hand);await pending;
    expect(hand.close).toHaveBeenCalledTimes(1);
    expect(scope.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({type:'hand-ready'}));
  });
  it('honors CPU recovery without retrying a stalled GPU delegate',async()=>{
    await scope.onmessage!({data:{...init(true),delegate:'CPU'}});
    expect(mocks.faceCreate).toHaveBeenCalledTimes(1);
    expect(mocks.faceCreate).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({baseOptions:expect.objectContaining({delegate:'CPU'})}));
    expect(scope.postMessage).toHaveBeenLastCalledWith({type:'ready',protocolVersion:TRACKER_PROTOCOL_VERSION,delegate:'CPU',handTracking:'loading'});
    await enableHands();
    expect(mocks.handCreate).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({baseOptions:expect.objectContaining({delegate:'CPU'})}));
  });
});
