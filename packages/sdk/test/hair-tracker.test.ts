/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect,vi,afterEach} from 'vitest';
const create=vi.hoisted(()=>vi.fn());
vi.mock('@mediapipe/tasks-vision',()=>({ImageSegmenter:{createFromOptions:create}}));
import {HairTracker} from '../src/tracking/HairTracker';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();create.mockReset();});
function task(labels=['background','hair']) {
  return {close:vi.fn(),getLabels:()=>labels,segmentForVideo:vi.fn((_bitmap:unknown,_time:number,callback:(value:unknown)=>void)=>callback({confidenceMasks:[null,{width:2,height:2,getAsFloat32Array:()=>new Float32Array([0,0.5,1,0.25])}]}))};
}
function blankCanvas(){vi.stubGlobal('OffscreenCanvas',class {width=640;height=360;getContext(){return {fillStyle:'',fillRect(){}};}});vi.stubGlobal('createImageBitmap',vi.fn(async()=>({close:vi.fn()})));}
describe('local optional hair task',()=>{
  it('closes a repeatedly over-budget graph and discards the final confidence buffer',async()=>{
    blankCanvas();const tracker=new HairTracker(),native=task();create.mockResolvedValue(native);await tracker.initialize({} as never,'/hair.tflite','GPU');
    const now=vi.spyOn(performance,'now');
    for(let i=0;i<4;i++)now.mockReturnValueOnce(i*1000).mockReturnValueOnce(i*1000+100);
    try {for(let i=1;i<4;i++)expect(tracker.sample({} as ImageBitmap,i*1000)).not.toBeNull();expect(()=>tracker.sample({} as ImageBitmap,4000)).toThrow('budget');expect(native.close).toHaveBeenCalledOnce();expect(tracker.sample({} as ImageBitmap,5000)).toBeNull();}
    finally {now.mockRestore();tracker.close();}
  });
  it('does not create until enabled, warms then returns bounded confidence copies and throttles inference',async()=>{
    blankCanvas();const tracker=new HairTracker(),native=task();create.mockResolvedValue(native);
    expect(create).not.toHaveBeenCalled();expect(await tracker.initialize({} as never,'/hair.tflite','GPU')).toBe(true);
    const mask=tracker.sample({} as ImageBitmap,1000)!;expect([...mask.data]).toEqual([0,128,255,64]);
    expect(tracker.sample({} as ImageBitmap,1100)).toBeNull();expect(tracker.sample({} as ImageBitmap,1400)).not.toBeNull();
    tracker.close();expect(native.close).toHaveBeenCalledTimes(1);expect(tracker.sample({} as ImageBitmap,2000)).toBeNull();
  });
  it('rejects models without hair labels and closes late creation after the bounded deadline',async()=>{
    blankCanvas();const tracker=new HairTracker(),wrong=task(['background','person']);create.mockResolvedValueOnce(wrong);
    expect(await tracker.initialize({} as never,'/wrong.tflite','GPU')).toBe(false);expect(wrong.close).toHaveBeenCalledOnce();
    vi.useFakeTimers();let resolve!:(value:ReturnType<typeof task>)=>void;
    create.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const pending=tracker.initialize({} as never,'/hair.tflite','GPU');await vi.advanceTimersByTimeAsync(8001);expect(await pending).toBe(false);
    const late=task();resolve(late);await Promise.resolve();await Promise.resolve();expect(late.close).toHaveBeenCalledOnce();tracker.close();
  });
});
