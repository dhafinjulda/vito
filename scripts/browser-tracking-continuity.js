/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page => {
  // Vanilla dev server + playwright-cli run-code --filename=scripts/browser-tracking-continuity.js
  // Uses the built public SDK and ACTUAL emitted MediaPipe worker. No physical camera.
  return page.evaluate(async()=>{
    const sdkUrl=performance.getEntriesByType('resource').find(r=>r.name.includes('/packages/sdk/dist/vto-sdk.js')).name;
    const {createVirtualTryOn}=await import(sdkUrl);
    const oldWorker=window.Worker,oldGum=navigator.mediaDevices.getUserMedia;
    const packets=[],urls=[];let health;
    window.Worker=class extends oldWorker {constructor(url,options){super(url,options);urls.push(String(url));this.addEventListener('message',({data:m})=>packets.push({type:m.type,timestamp:m.timestampMs,protocolVersion:m.protocolVersion,delegate:m.delegate,handTracking:m.handTracking}));}};
    const source=document.createElement('canvas');source.width=1280;source.height=720;const context=source.getContext('2d');
    const pump=setInterval(()=>{context.fillStyle='#808080';context.fillRect(0,0,1280,720);},33);
    navigator.mediaDevices.getUserMedia=async()=>source.captureStream(30);
    const host=document.createElement('div');host.style.cssText='width:640px;height:360px';document.body.append(host);
    let session;
    try {
      session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',cacheRuntimeAssets:true,onTrackingHealthChange:h=>health=h});
      await session.start();await new Promise(r=>setTimeout(r,7000));
      const sources=await Promise.all(urls.map(async url=>{const t=await fetch(url,{cache:'no-store'}).then(r=>r.text());return {url,hasCompletion:t.includes('frame-done'),hasDelegate:t.includes('delegate:')};}));
      const packetCounts=packets.reduce((a,p)=>({...a,[p.type]:(a[p.type]??0)+1}),{});
      const pass=health.phase==='running'&&health.restarts===0&&packetCounts.result>=50&&packetCounts['frame-done']>=50&&packets.find(p=>p.type==='ready').protocolVersion===8&&sources.every(s=>s.hasCompletion&&/face-worker-[\w-]+\.js/.test(s.url));
      if(!pass)throw new Error(`Actual-worker continuity failed: ${JSON.stringify({health,packetCounts,sources})}`);
      return {date:'2026-10-13',cameraRequested:false,pass,status:session.status,health,packetCounts,firstPackets:packets.slice(0,8),sources,limitations:'Actual MediaPipe only receives synthetic blank canvas video. Verifies IPC/frame continuity and versioned delivery, not recognition of a person or device performance.'};
    }finally{session?.dispose();source.width=source.height=0;clearInterval(pump);host.remove();window.Worker=oldWorker;navigator.mediaDevices.getUserMedia=oldGum;}
  });
}
