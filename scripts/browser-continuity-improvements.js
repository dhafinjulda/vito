/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page=>page.evaluate(async()=>{
  const {createVirtualTryOn}=await import('/@fs/C:/Projects/VTO/packages/sdk/dist/vto-sdk.js');
  const {syntheticFrame}=await import('/@fs/C:/Projects/VTO/packages/sdk/test/synthetic-frame.ts');
  const {getDemoFit}=await import('/src/demo-assets.ts');
  const fixtures={landscape:syntheticFrame(0,0,0,1280,720,30),portrait:syntheticFrame(0,0,0,720,1280,30)};
  const NativeWorker=window.Worker,gum=navigator.mediaDevices.getUserMedia,context=HTMLCanvasElement.prototype.getContext,fetchOriginal=window.fetch;
  const workerCode=`const fixtures=${JSON.stringify(fixtures)};let hold=false,pending=null,budget=false;
    function deliver(m){const f=m.bitmap.height>m.bitmap.width?fixtures.portrait:fixtures.landscape;
      postMessage({type:'result',landmarks:f.landmarks,faceMatrix:f.matrix,timestampMs:m.timestampMs,faceInferenceMs:8});
      if(budget){budget=false;postMessage({type:'hand-unavailable',reason:'budget'});}
      m.bitmap.close();postMessage({type:'frame-done',timestampMs:m.timestampMs});}
    onmessage=({data:m})=>{if(m.type==='init'){postMessage({type:'ready',protocolVersion:8,delegate:'GPU',handTracking:m.handModelAssetPath?'ready':'disabled',hairTracking:'disabled'});}
      if(m.type==='hold')hold=true;
      if(m.type==='budget')budget=true;
      if(m.type==='release'){hold=!!m.keepHolding;if(pending){deliver(pending);pending=null;}}
      if(m.type==='frame'){if(hold){pending=m;postMessage({type:'captured',width:m.bitmap.width,height:m.bitmap.height,timestampMs:m.timestampMs});}else deliver(m);}};`;
  const url=URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'})),workers=[];
  window.Worker=class extends NativeWorker{constructor(){super(url);workers.push(this);this.captured=[];this.addEventListener('message',({data:m})=>{if(m.type==='captured')this.captured.push({width:m.width,height:m.height});});}};
  HTMLCanvasElement.prototype.getContext=function(type,opts){return context.call(this,type,type==='webgl2'?{...opts,preserveDrawingBuffer:true}:opts);};
  const source=document.createElement('canvas');source.width=1280;source.height=720;
  const ctx=source.getContext('2d'),host=document.createElement('div');host.style.cssText='width:640px;height:360px';document.body.append(host);
  const pump=setInterval(()=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,source.width,source.height);},33);
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(predicate,label)=>{const end=performance.now()+6000;while(!predicate()&&performance.now()<end)await delay(25);if(!predicate())throw Error(`Timeout: ${label}`);};
  let cameraCalls=0,session,health,interaction,releaseOld;const allTracks=[],errors=[];
  navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.audio!==false)throw Error('Audio enabled');cameraCalls++;const s=source.captureStream(30);allTracks.push(...s.getTracks());return s;};
  const framePixels=()=>{const gl=session.canvas.getContext('webgl2'),p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);let n=0;for(let i=3;i<p.length;i+=4)if(p[i])n++;return n;};
  const report={date:'2026-10-13',synthetic:true,physicalCameraRequested:false,resizes:[]};
  try {
    session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',fit:getDemoFit(),cameraCompositing:false,hairOcclusion:false,handInteraction:{},onTrackingHealthChange:h=>health=h,onInteractionChange:s=>interaction=s,onError:e=>errors.push(e.message)});
    await session.start();await until(()=>session.status==='tracking'&&framePixels()>0,'initial glasses');
    report.initial={status:session.status,pixels:framePixels()};
    for(const [width,height] of [[720,1280],[1280,720]]) {
      const worker=workers.at(-1),before=worker.captured.length;worker.postMessage({type:'hold'});
      await until(()=>worker.captured.length>before,'old capture held');
      source.width=width;source.height=height;
      await until(()=>session.video.videoWidth===width&&session.video.videoHeight===height,'source geometry changed');
      await until(()=>session.status==='searching'&&framePixels()===0,'old fit invalidated');
      worker.postMessage({type:'release',keepHolding:true});
      await until(()=>worker.captured.length>before+1,'new geometry captured');await delay(50);
      const ignored=session.status==='searching'&&framePixels()===0;
      worker.postMessage({type:'release',keepHolding:false});
      await until(()=>session.status==='tracking'&&framePixels()>0,'new fit resumed');
      report.resizes.push({source:[width,height],input:worker.captured.at(-1),oldResultIgnored:ignored,status:session.status,pixels:framePixels(),cameraCalls,restarts:health.restarts});
    }
    workers.at(-1).postMessage({type:'budget'});
    await until(()=>health.featureFallback==='hand-budget','hand budget reported');
    session.setPlacement('head');await delay(150);
    report.handFallback={reason:health.featureFallback,availability:interaction.availability,placement:interaction.placement,status:session.status,pixels:framePixels(),restarts:health.restarts};
    session.setPlacement('face');
    let failed=false;try{await session.setGlasses('/missing-continuity-sku.glb');}catch{failed=true;}
    await delay(100);report.failedReplacement={rejected:failed,status:session.status,pixels:framePixels()};
    session.stop();await session.start();await until(()=>session.status==='tracking'&&framePixels()>0,'restart with retained asset');
    report.restart={status:session.status,pixels:framePixels(),cameraCalls};
    session.stop();
    const bytes=await (await fetchOriginal('/glasses.glb')).arrayBuffer();
    window.fetch=(input,init)=>{
      const path=new URL(typeof input==='string'?input:input.url,location.href).pathname;
      if(path==='/held-continuity-sku.glb')return new Promise(resolve=>{releaseOld=()=>resolve(new Response(bytes,{headers:{'Content-Type':'model/gltf-binary'}}));});
      return fetchOriginal(input,init);
    };
    const obsolete=session.setGlasses('/held-continuity-sku.glb');
    await until(()=>!!releaseOld,'old asset request stalled');
    const starting=session.start();await delay(150);const waiting=session.status==='requesting-camera';
    await session.setGlasses('/glasses.glb');await starting;
    await until(()=>session.status==='tracking'&&framePixels()>0,'latest asset unblocks startup');
    const beforeObsolete=framePixels();releaseOld();await obsolete;await delay(100);
    report.latestAsset={waited:waiting,status:session.status,pixelsBeforeObsolete:beforeObsolete,pixelsAfterObsolete:framePixels(),cameraCalls};
    session.dispose();report.cleanup={tracksEnded:allTracks.every(t=>t.readyState==='ended'),elementsRemoved:host.children.length===0};
    report.errors=errors;
    report.pass=report.initial.pixels>0&&report.resizes.every(r=>r.oldResultIgnored&&r.status==='tracking'&&r.pixels>0&&r.cameraCalls===1&&r.restarts===0)&&report.handFallback.availability==='unavailable'&&report.handFallback.placement==='head'&&report.handFallback.status==='tracking'&&report.handFallback.pixels>0&&report.failedReplacement.rejected&&report.failedReplacement.pixels>0&&report.restart.pixels>0&&report.latestAsset.waited&&report.latestAsset.pixelsBeforeObsolete>0&&report.latestAsset.pixelsAfterObsolete>0&&report.cleanup.tracksEnded&&report.cleanup.elementsRemoved&&!errors.length;
    report.limitations='Built public SDK, actual GLB/WebGL/video/canvas stream with synthetic recognition and injected hand budget packet. Native inference budget is covered separately by worker tests; no physical camera/mobile/recognition/contact acceptance.';
    return report;
  } finally {releaseOld?.();session?.dispose();clearInterval(pump);source.width=source.height=0;host.remove();window.Worker=NativeWorker;navigator.mediaDevices.getUserMedia=gum;HTMLCanvasElement.prototype.getContext=context;window.fetch=fetchOriginal;URL.revokeObjectURL(url);}
})
