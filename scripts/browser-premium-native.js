/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page=>{
  const requests=[];
  const observe=r=>requests.push({method:r.method(),url:r.url(),bodyBytes:r.postDataBuffer()?.length??0});page.on('request',observe);
  try {
    const runtime=await page.evaluate(async()=>{
      const {createVirtualTryOn}=await import('/@fs/C:/Projects/VTO/packages/sdk/dist/vto-sdk.js');
      const OriginalWorker=window.Worker,originalGum=navigator.mediaDevices.getUserMedia;
      let worker,health;const counts={},packets=[],errors=[],events=[];
      window.Worker=class extends OriginalWorker {constructor(url,options){super(url,options);worker=this;this.addEventListener('message',({data:m})=>{events.push(m.type);counts[m.type]=(counts[m.type]??0)+1;if(m.type==='hair-result'){packets.push({width:m.width,height:m.height,bytes:m.data.length,inferenceMs:m.inferenceMs});m.data.fill(0);}else if(['hair-ready','hair-unavailable','error'].includes(m.type))errors.push({type:m.type,message:m.message,startupMs:m.startupMs});});}};
      const source=document.createElement('canvas');source.width=1280;source.height=720;
      const ctx=source.getContext('2d'),host=document.createElement('div');host.style.cssText='width:640px;height:360px';document.body.append(host);
      const pump=setInterval(()=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,source.width,source.height);},33);
      let tracks=[],cameraCalls=0;navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.audio!==false)throw Error('Audio enabled');cameraCalls++;const stream=source.captureStream(30);tracks=stream.getTracks();return stream;};
      let session;
      try {
        const hands=new URL(location.href).searchParams.get('hands')==='1';
        session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',cameraCompositing:true,lensOptics:{},hairOcclusion:{},handInteraction:hands?{}:undefined,onTrackingHealthChange:h=>health=h});
        await session.start();
        // Blank input cannot acquire a face. Force the optional graph via IPC in
        // this test only; production initialization remains first-face gated.
        if(hands) {
          worker.postMessage({type:'enable-hands'});const until=performance.now()+14000;
          while(!counts['hand-ready']&&!counts['hand-unavailable']&&performance.now()<until)await new Promise(r=>setTimeout(r,100));
        }
        worker.postMessage({type:'enable-hair'});
        const deadline=performance.now()+16000;
        while(!counts['hair-ready']&&!counts['hair-unavailable']&&performance.now()<deadline)await new Promise(r=>setTimeout(r,100));
        await new Promise(r=>setTimeout(r,6000));
        const resizeCases=[];
        for(const [width,height] of [[720,1280],[1280,720]]) {
          const before=counts['frame-done']??0;source.width=width;source.height=height;
          const end=performance.now()+8000;
          while((session.video.videoWidth!==width||session.video.videoHeight!==height||(counts['frame-done']??0)<before+26)&&performance.now()<end)await new Promise(r=>setTimeout(r,50));
          resizeCases.push({source:[session.video.videoWidth,session.video.videoHeight],completions:(counts['frame-done']??0)-before,restarts:health.restarts,pass:session.video.videoWidth===width&&session.video.videoHeight===height&&(counts['frame-done']??0)>=before+26&&health.restarts===0});
        }
        const finalHealth=health,previewHidden=session.video.style.opacity==='0',mirrorMatches=getComputedStyle(session.video).transform===getComputedStyle(session.canvas).transform;
        session.stop();const previewRestored=session.video.style.opacity==='1';session.dispose();
        const warmedBeforeFrames=events.indexOf('hair-ready')<events.indexOf('ready')&&events.indexOf('ready')<events.indexOf('result')&&(!hands||events.indexOf('hand-ready')<events.indexOf('ready'));
        return {hands,counts,packets,cameraCalls,resizeCases,startupEvents:events.slice(0,12),warmedBeforeFrames,optionalEvents:errors,health:finalHealth,previewHidden,previewRestored,mirrorMatches,tracksStopped:tracks.every(t=>t.readyState==='ended'),elementsRemoved:host.children.length===0,
          pass:counts['hair-ready']===1&&warmedBeforeFrames&&(!hands||counts['hand-ready']===1&&counts['hand-result']>10)&&packets.length===0&&counts['frame-done']>50&&finalHealth.restarts===0&&cameraCalls===1&&resizeCases.every(r=>r.pass)&&previewHidden&&previewRestored&&mirrorMatches&&tracks.every(t=>t.readyState==='ended')&&host.children.length===0};
      }finally {session?.dispose();clearInterval(pump);source.width=source.height=0;host.remove();window.Worker=OriginalWorker;navigator.mediaDevices.getUserMedia=originalGum;}
    });
    const writes=requests.filter(r=>!['GET','HEAD'].includes(r.method)||r.bodyBytes>0);
    return {date:'2026-10-13',cameraRequested:false,synthetic:true,runtime,requests,writes,pass:runtime.pass&&writes.length===0,limitations:'Actual Face/Hand/Hair startup and native warmup on blank synthetic video. Hair inference is deliberately skipped without a face. Checks startup order, shared worker continuity, disposal and HTTP privacy; not hair accuracy, live fitting or device acceptance.'};
  }finally{page.off('request',observe);}
}
