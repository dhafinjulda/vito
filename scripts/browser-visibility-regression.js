/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page => {
  // Run against the Vanilla dev server with:
  // playwright-cli -s=visibility-regression run-code --filename=scripts/browser-visibility-regression.js
  return await page.evaluate(async () => {
    const sdkUrl=performance.getEntriesByType('resource').find(r=>r.name.includes('/packages/sdk/dist/vto-sdk.js'))?.name;
    if(!sdkUrl)throw new Error('Open the Vanilla Vite dev page before this check.');
    const {createVirtualTryOn}=await import(sdkUrl);
    const {syntheticFrame}=await import(new URL('../test/synthetic-frame.ts',sdkUrl).href);
    const {getDemoFit}=await import('/src/demo-assets.ts');
    const fixture=syntheticFrame();
    const NativeWorker=window.Worker,originalMedia=navigator.mediaDevices.getUserMedia;
    const originalGetContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,options){return originalGetContext.call(this,type,type==='webgl2'||type==='webgl'?{...options,preserveDrawingBuffer:true}:options);};
    const workers=[];
    const code=`let delay=40,hasFace=true,hands=false,paused=false;const fixture=${JSON.stringify({landmarks:fixture.landmarks,matrix:fixture.matrix})};
      onmessage=({data:m})=>{if(m.type==='mode'){delay=m.delay;hasFace=m.hasFace;paused=!!m.paused;return;}
      if(m.type==='init'){postMessage({type:'ready',protocolVersion:8,delegate:m.delegate,handTracking:m.handModelAssetPath?'loading':'disabled'});return;}
      if(m.type==='enable-hands'){setTimeout(()=>{hands=true;postMessage({type:'hand-ready'});},750);return;}
      if(m.type==='frame'){if(paused){m.bitmap.close();return;}const face=hasFace;setTimeout(()=>{postMessage({type:'result',landmarks:face?fixture.landmarks:null,faceMatrix:face?fixture.matrix:null,timestampMs:m.timestampMs});if(hands)postMessage({type:'hand-result',hands:[],timestampMs:m.timestampMs});m.bitmap.close();postMessage({type:'frame-done',timestampMs:m.timestampMs});},delay);}};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    window.Worker=class extends NativeWorker{constructor(){super(url);workers.push(this);}};
    const source=document.createElement('canvas');source.width=1280;source.height=720;
    const ctx=source.getContext('2d');let color=0;
    const pump=setInterval(()=>{ctx.fillStyle=`rgb(${color++%120},90,90)`;ctx.fillRect(0,0,1280,720);},33);
    const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:640px;height:360px;z-index:9999';document.body.append(host);
    const runs=[];let session;
    function visiblePixels() {
      const gl=session.canvas.getContext('webgl2');const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])count++;return count;
    }
    try {
      for(const presentation of ['auto','direct','interpolated','predicted'])for(const handInteraction of [undefined,{}]) {
        let tracks=[];navigator.mediaDevices.getUserMedia=async()=>{const s=source.captureStream(30);tracks=s.getTracks();return s;};
        const statuses=[],errors=[];let availability='disabled';
        session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',fit:getDemoFit(),cameraCompositing:false,hairOcclusion:false,presentation,handInteraction,onStatusChange:(s,m)=>statuses.push({s,m}),onError:e=>errors.push(e.message),onInteractionChange:s=>availability=s.availability});
        await session.start();
        const firstStarted=performance.now();
        while((session.status!=='tracking'||visiblePixels()===0)&&performance.now()-firstStarted<2000)await new Promise(r=>setTimeout(r,50));
        const firstPixels=visiblePixels();
        runs.push({presentation,hands:!!handInteraction,phase:'face-before-hands',firstVisibleMs:performance.now()-firstStarted,status:session.status,availability,visiblePixels:firstPixels,pass:session.status==='tracking'&&firstPixels>0&&(!handInteraction||availability==='loading')});
        for(const delay of [40,250,500]) {
          workers.at(-1).postMessage({type:'mode',delay,hasFace:true});
          await new Promise(r=>setTimeout(r,1200));
          const pixels=visiblePixels();
          runs.push({presentation,hands:!!handInteraction,phase:'visible-face',delay,status:session.status,visiblePixels:pixels,availability,errors:[...errors],lastStatus:statuses.at(-1),pass:session.status==='tracking'&&pixels>0&&!errors.length});
        }
        workers.at(-1).postMessage({type:'mode',delay:40,hasFace:false});await new Promise(r=>setTimeout(r,700));
        const missingPixels=visiblePixels();
        runs.push({hands:!!handInteraction,phase:'no-face',status:session.status,visiblePixels:missingPixels,pass:session.status==='searching'&&missingPixels===0});
        workers.at(-1).postMessage({type:'mode',delay:40,hasFace:true});await new Promise(r=>setTimeout(r,300));
        const recoveredPixels=visiblePixels();
        runs.push({hands:!!handInteraction,phase:'reacquire',status:session.status,visiblePixels:recoveredPixels,pass:session.status==='tracking'&&recoveredPixels>0});
        workers.at(-1).postMessage({type:'mode',delay:40,hasFace:true,paused:true});await new Promise(r=>setTimeout(r,1200));
        const expiredPixels=visiblePixels();
        runs.push({hands:!!handInteraction,phase:'expired-face',status:session.status,visiblePixels:expiredPixels,pass:session.status==='searching'&&expiredPixels===0});
        session.stop();const stopped=tracks.every(t=>t.readyState==='ended');
        runs.push({hands:!!handInteraction,phase:'stop',stopped,status:session.status,pass:stopped&&session.status==='idle'});session.dispose();session=null;
      }
      const pass=runs.every(r=>r.pass);
      if(!pass)throw new Error(`Visibility regression: ${JSON.stringify(runs.filter(r=>!r.pass))}`);
      return {url:location.href,cameraRequested:false,userAgent:navigator.userAgent,pass,runs,limitations:'Synthetic face results from a local classic worker plus canvas captureStream through the built public SDK, actual video callbacks, GLB and WebGL readback. No real camera or MediaPipe face recognition acceptance.'};
    } finally {session?.dispose();clearInterval(pump);host.remove();source.width=source.height=0;window.Worker=NativeWorker;navigator.mediaDevices.getUserMedia=originalMedia;HTMLCanvasElement.prototype.getContext=originalGetContext;URL.revokeObjectURL(url);}
  });
}
