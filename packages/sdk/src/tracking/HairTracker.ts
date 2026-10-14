/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {ImageSegmenter,type FilesetResolver} from '@mediapipe/tasks-vision';
type Files=Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
export class HairTracker {
  private task:ImageSegmenter|null=null;
  private revision=0;
  private hairIndex=-1;
  private lastAt=-Infinity;
  private interval=300;
  private cost=0;
  private samples=0;
  async initialize(files:Files,path:string,delegate:'GPU'|'CPU',width=640,height=360):Promise<boolean> {
    const revision=++this.revision;let expired=false,timer:ReturnType<typeof setTimeout>;
    const create=(async()=>{
      try{return await ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:path,delegate},runningMode:'VIDEO',outputConfidenceMasks:true,outputCategoryMask:false});}
      catch {if(expired||delegate==='CPU')return null;return await ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:path,delegate:'CPU'},runningMode:'VIDEO',outputConfidenceMasks:true,outputCategoryMask:false});}
    })().then(task=>{if(expired||revision!==this.revision){task?.close();return null;}return task;});
    try {
      const task=await Promise.race([create,new Promise<null>(resolve=>{timer=setTimeout(()=>{expired=true;resolve(null);},8000);})]);
      if(!task||revision!==this.revision){task?.close();return false;}
      const index=task.getLabels().findIndex(label=>label.toLowerCase()==='hair');
      if(index<0){task.close();return false;}
      this.task=task;this.hairIndex=index;this.lastAt=-Infinity;this.interval=300;this.cost=0;this.samples=0;
      const canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d');let bitmap:ImageBitmap|undefined;
      try {if(!context)throw new Error('Hair warmup canvas unavailable.');context.fillStyle='#808080';context.fillRect(0,0,width,height);bitmap=await createImageBitmap(canvas);task.segmentForVideo(bitmap,0,()=>{});}
      finally {bitmap?.close();canvas.width=canvas.height=0;}
      return true;
    } catch {this.close();return false;}
    finally {clearTimeout(timer!);}
  }
  sample(bitmap:ImageBitmap,timestampMs:number):{data:Uint8Array;width:number;height:number;inferenceMs:number}|null {
    if(!this.task||timestampMs-this.lastAt<this.interval)return null;
    this.lastAt=timestampMs;const started=performance.now();let output:{data:Uint8Array;width:number;height:number}|null=null;
    this.task.segmentForVideo(bitmap,timestampMs,result=>{
      const mask=result.confidenceMasks?.[this.hairIndex];
      if(!mask||mask.width*mask.height>1048576)throw new Error('Invalid/oversized hair mask.');
      const values=mask.getAsFloat32Array();
      if(values.length!==mask.width*mask.height)throw new Error('Invalid hair confidence dimensions.');
      const data=new Uint8Array(values.length);
      for(let i=0;i<values.length;i++)data[i]=Math.round(Math.max(0,Math.min(1,values[i]!))*255);
      output={data,width:mask.width,height:mask.height};
      // Callback output is owned/closed by MediaPipe after this returns. Only
      // the bounded copy is transferred locally; no model output is persisted.
    });
    const inferenceMs=performance.now()-started;this.interval=Math.max(300,Math.min(1000,inferenceMs*6));
    this.cost+=(inferenceMs-this.cost)*(this.samples===0?1:0.3);this.samples++;
    if(this.samples>=4&&this.cost>75) {
      (output as {data:Uint8Array}|null)?.data.fill(0);this.close();
      const error=new Error('Hair inference exceeded the face-priority budget.');error.name='HairBudgetError';throw error;
    }
    return output?{...(output as {data:Uint8Array;width:number;height:number}),inferenceMs}:null;
  }
  close():void {this.revision++;this.task?.close();this.task=null;this.hairIndex=-1;this.lastAt=-Infinity;this.interval=300;this.cost=this.samples=0;}
}
