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
  const fixture=syntheticFrame(),NativeWorker=window.Worker,originalGum=navigator.mediaDevices.getUserMedia;
  const workerUrl=URL.createObjectURL(new Blob([`const face=${JSON.stringify({landmarks:fixture.landmarks,matrix:fixture.matrix})};onmessage=({data:m})=>{if(m.type==='init')postMessage({type:'ready',protocolVersion:7,delegate:'CPU',handTracking:'disabled'});if(m.type==='frame'){postMessage({type:'result',landmarks:face.landmarks,faceMatrix:face.matrix,timestampMs:m.timestampMs});m.bitmap.close();postMessage({type:'frame-done',timestampMs:m.timestampMs});}};`],{type:'text/javascript'}));
  let sent=0;window.Worker=class extends NativeWorker {constructor(){super(workerUrl);}postMessage(m,t){if(m.type==='frame')sent++;super.postMessage(m,t);}};
  const source=document.createElement('canvas');source.width=1280;source.height=720;const ctx=source.getContext('2d'),host=document.createElement('div');host.style.cssText='width:640px;height:360px';document.body.append(host);
  let pump;const resume=()=>pump=setInterval(()=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,1280,720);},33);resume();
  let tracks=[],health;const statuses=[];navigator.mediaDevices.getUserMedia=async()=>{const s=source.captureStream(30);tracks=s.getTracks();return s;};
  const session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',cameraCompositing:false,hairOcclusion:false,onStatusChange:(s,m)=>statuses.push({s,m}),onTrackingHealthChange:h=>health=h});
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  try {
    await session.start();const deadline=performance.now()+5000;
    while(session.status!=='tracking'&&performance.now()<deadline)await delay(50);
    const acquired=session.status==='tracking';clearInterval(pump);
    await delay(400);const freezeCount=sent,clock=session.video.currentTime;
    await delay(1100);const frozen={sentDelta:sent-freezeCount,clockDelta:session.video.currentTime-clock,status:session.status};
    resume();await delay(700);const resumed={sentDelta:sent-freezeCount,status:session.status,restarts:health.restarts};
    session.dispose();
    return {date:'2026-10-13',cameraRequested:false,synthetic:true,acquired,frozen,resumed,statuses,tracksStopped:tracks.every(t=>t.readyState==='ended'),pass:acquired&&frozen.sentDelta===0&&frozen.status==='searching'&&resumed.status==='tracking'&&resumed.sentDelta>5&&resumed.restarts===0&&tracks.every(t=>t.readyState==='ended'),limitations:'Synthetic face packets, actual canvas video/rVFC/public SDK. Tests frozen decoded picture despite advancing playback time, not hardware camera disconnection.'};
  } finally {session.dispose();clearInterval(pump);host.remove();source.width=source.height=0;window.Worker=NativeWorker;navigator.mediaDevices.getUserMedia=originalGum;URL.revokeObjectURL(workerUrl);}
})
