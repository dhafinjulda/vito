async page=>{
  // This exercises the existing built worker, not a public prepare() API.
  const results=[];
  for(const mode of ['prepare-activate','cancel-loading','dispose-prepared']){
    results.push(await page.evaluate(async mode=>{
      const original=navigator.mediaDevices.getUserMedia;
      let cameraCalls=0,worker,timer,terminated=false,profile,readyAt=null,frames=0;
      navigator.mediaDevices.getUserMedia=async()=>{cameraCalls++;throw Error('Preparation requested camera');};
      const started=performance.now();
      const terminate=()=>{if(!terminated){terminated=true;worker?.terminate();}};
      try{
        const manifest=await fetch('/@fs/C:/Projects/VTO/docs/evidence/smoothness-shopper-prepare-geometry-manifest.json').then(r=>r.json());
        const built=manifest.files.find(f=>/dist\/assets\/face-worker-.*\.js$/.test(f.path)).path;
        const path=manifest.sdkModulePath.replace(/vto-sdk\.js$/, '')+'assets/'+built.split('/').pop();
        worker=new Worker('/@fs/C:/Projects/VTO/'+path);
        const outcome=await new Promise((resolve,reject)=>{
          timer=setTimeout(()=>reject(Error('Preparation deadline')),45000);
          worker.onerror=()=>reject(Error('Worker failure'));
          worker.onmessage=async({data})=>{
            try{
              if(data.type==='error')throw Error(data.message);
              if(data.type==='startup-profile')profile=data.timings;
              if(data.type==='startup-stage'&&mode==='cancel-loading'){
                terminate();resolve({cancelled:true});return;
              }
              if(data.type==='ready'){
                readyAt=performance.now()-started;
                if(mode==='dispose-prepared'){terminate();resolve({prepared:true});return;}
                const canvas=new OffscreenCanvas(640,360),ctx=canvas.getContext('2d');
                ctx.fillStyle='#808080';ctx.fillRect(0,0,640,360);
                const bitmap=await createImageBitmap(canvas);canvas.width=canvas.height=0;
                try{worker.postMessage({type:'frame',bitmap,timestampMs:1000},[bitmap]);frames++;}
                catch(error){bitmap.close();throw error;}
              }
              // Do not persist result packets, landmarks, or masks, even synthetic.
              if(data.type==='frame-done')resolve({activated:true,firstCompletionMs:performance.now()-started-readyAt});
            }catch(error){reject(error);}
          };
          worker.postMessage({type:'init',wasmRoot:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',hairModelAssetPath:'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite',prewarmOptional:true,cacheRuntimeAssets:true,inputWidth:640,inputHeight:360});
        });
        terminate();
        return {mode,pass:cameraCalls===0&&terminated&&frames===(mode==='prepare-activate'?1:0),cameraCalls,terminated,frames,readyAt,profile,...outcome};
      }catch(error){return {mode,pass:false,error:String(error),cameraCalls};}
      finally{clearTimeout(timer);terminate();navigator.mediaDevices.getUserMedia=original;}
    },mode));
  }
  return {pass:results.every(r=>r.pass),results,scope:'Actual built classic worker preparation proof, explicit hair enabled, no SDK session or public prepare API, camera acquisition replaced with a failing counter. One blank synthetic activation bitmap only; no recognition/appearance/device acceptance. Initial and prepared disposal terminate dedicated workers. No raw results persisted.'};
}
