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
  const NativeWorker=window.Worker,gum=navigator.mediaDevices.getUserMedia,texImage=WebGL2RenderingContext.prototype.texImage2D,canvasContext=HTMLCanvasElement.prototype.getContext;
  let inject=false,thrown=0;
  WebGL2RenderingContext.prototype.texImage2D=function(...args){if(inject&&args.some(arg=>arg instanceof HTMLVideoElement)&&thrown++===0)throw Error('Injected video texture failure');return texImage.apply(this,args);};
  const fixture=syntheticFrame(0,0,0,1280,720,30),workers=[],errors=[];
  const code=`let face=${JSON.stringify(fixture)},cost=8;onmessage=({data:m})=>{if(m.type==='init'){postMessage({type:'face-ready'});postMessage({type:'ready',protocolVersion:7,delegate:'GPU',handTracking:m.handModelAssetPath?'ready':'disabled',hairTracking:m.hairModelAssetPath?'ready':'disabled'});}if(m.type==='mode'){face=m.face;cost=m.cost;}if(m.type==='frame'){postMessage({type:'result',landmarks:face.landmarks,faceMatrix:face.matrix,timestampMs:m.timestampMs,faceInferenceMs:cost});m.bitmap.close();postMessage({type:'frame-done',timestampMs:m.timestampMs});}};`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  window.Worker=class extends NativeWorker {constructor(){super(url);workers.push(this);}postMessage(m,t){if(m.type==='init')this.init=m;super.postMessage(m,t);}};
  HTMLCanvasElement.prototype.getContext=function(type,opts){return canvasContext.call(this,type,type==='webgl2'?{...opts,preserveDrawingBuffer:true}:opts);};
  const source=document.createElement('canvas');source.width=1280;source.height=720;const ctx=source.getContext('2d');
  const pump=setInterval(()=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,1280,720);},33);
  const host=document.createElement('div');host.style.cssText='width:640px;height:360px';document.body.append(host);let tracks=[],health;
  navigator.mediaDevices.getUserMedia=async()=>{const stream=source.captureStream(30);tracks=stream.getTracks();return stream;};
  const session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',fit:getDemoFit(),onError:e=>errors.push(e.message),onTrackingHealthChange:h=>health=h});
  const delay=ms=>new Promise(r=>setTimeout(r,ms));const report={date:'2026-10-13',cameraRequested:false,synthetic:true};
  const framePixels=()=>{const gl=session.canvas.getContext('webgl2'),bytes=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,bytes);let frame=0,opaque=0;for(let i=0;i<bytes.length;i+=4){if(bytes[i+3])opaque++;if(bytes[i+3]&&Math.max(Math.abs(bytes[i]-128),Math.abs(bytes[i+1]-128),Math.abs(bytes[i+2]-128))>8)frame++;}return {frame,opaque};};
  try {
    await session.start();const until=performance.now()+5000;while(session.status!=='tracking'&&performance.now()<until)await delay(50);await delay(500);
    report.initial={status:session.status,pixels:framePixels(),previewHidden:session.video.style.opacity==='0',init:{adaptive:workers[0].init.adaptiveQuality,prewarm:workers[0].init.prewarmOptional,hands:!!workers[0].init.handModelAssetPath,hair:!!workers[0].init.hairModelAssetPath}};
    workers[0].postMessage({type:'mode',face:fixture,cost:100});await delay(4200);report.largePressure={width:health.inputWidth,status:session.status};
    workers[0].postMessage({type:'mode',face:syntheticFrame(84,0,0,1280,720,30),cost:100});await delay(1000);report.profileProtected={width:health.inputWidth,status:session.status};
    workers[0].postMessage({type:'mode',face:syntheticFrame(0,0,0,1280,720,100),cost:100});await delay(1000);report.smallProtected={width:health.inputWidth,status:session.status};
    inject=true;
    const fallbackUntil=performance.now()+2000;while(health.cameraCompositing!=='fallback'&&performance.now()<fallbackUntil)await delay(50);await delay(300);
    report.fallback={injected:thrown>0,reason:health.featureFallback,mode:health.cameraCompositing,previewRestored:session.video.style.opacity==='1',status:session.status,pixels:framePixels(),errors};
    session.dispose();report.cleaned=tracks.every(t=>t.readyState==='ended')&&host.children.length===0;
    report.pass=report.initial.status==='tracking'&&report.initial.pixels.frame>100&&report.initial.previewHidden&&report.initial.init.adaptive&&report.initial.init.prewarm&&!report.initial.init.hands&&report.largePressure.width===480&&report.profileProtected.width===640&&report.smallProtected.width===640&&report.fallback.injected&&report.fallback.mode==='fallback'&&report.fallback.previewRestored&&report.fallback.status==='tracking'&&report.fallback.pixels.frame>30&&!errors.length&&report.cleaned;
    report.limitations='Public SDK defaults on actual synthetic video/GLB/WebGL with synthetic recognition. No live recognition, hair accuracy, physical optical/contact or mobile acceptance.';return report;
  } finally {session.dispose();clearInterval(pump);host.remove();source.width=source.height=0;window.Worker=NativeWorker;navigator.mediaDevices.getUserMedia=gum;WebGL2RenderingContext.prototype.texImage2D=texImage;HTMLCanvasElement.prototype.getContext=canvasContext;URL.revokeObjectURL(url);}
})
