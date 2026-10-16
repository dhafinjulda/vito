import {FilesetResolver} from '@mediapipe/tasks-vision';
import {HairTracker} from '../packages/sdk/src/tracking/HairTracker';

// Synthetic experiment only. Return software timings/dimensions, never mask data.
self.onmessage=async({data:{width,height}})=>{
  const tracker=new HairTracker();
  try {
    const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
    const ready=await tracker.initialize(files,'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite','GPU',width,height);
    if(!ready)throw Error('Hair initialization unavailable');
    const samples=[];
    for(let i=1;i<=3;i++){
      const canvas=new OffscreenCanvas(640,360),context=canvas.getContext('2d')!;
      context.fillStyle='#808080';context.fillRect(0,0,640,360);
      const bitmap=await createImageBitmap(canvas);
      try {
        const start=performance.now(),mask=tracker.sample(bitmap,i*2000);
        samples.push({wallMs:performance.now()-start,inferenceMs:mask?.inferenceMs,width:mask?.width,height:mask?.height});
        mask?.data.fill(0);
      } finally {bitmap.close();canvas.width=canvas.height=0;}
    }
    self.postMessage({pass:true,width,height,startup:tracker.startupTimings,samples});
  }catch(error){self.postMessage({pass:false,width,height,error:String(error)});}
  finally{tracker.close();self.close();}
};
