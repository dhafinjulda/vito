/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page => {
  // playwright-cli run-code --filename=scripts/browser-tracker-recovery.js
  // Deliberately lose one synthetic bitmap to exercise the SDK's inference
  // watchdog, actual CPU recovery graph and continued local video processing.
  return page.evaluate(async()=>{
    const sdkUrl=performance.getEntriesByType('resource').find(r=>r.name.includes('/packages/sdk/dist/vto-sdk.js')).name;
    const {createVirtualTryOn}=await import(sdkUrl);
    const oldWorker=window.Worker,oldGum=navigator.mediaDevices.getUserMedia;
    const packets=[],urls=[],phases=[];let health,dropped=0;
    window.Worker=class extends oldWorker {
      constructor(url,options){super(url,options);this.first=urls.length===0;urls.push(String(url));this.addEventListener('message',({data:m})=>packets.push({type:m.type,timestamp:m.timestampMs,protocolVersion:m.protocolVersion,delegate:m.delegate,handTracking:m.handTracking}));}
      postMessage(message,transfer){if(this.first&&message.type==='frame'){message.bitmap.close();dropped++;return;}super.postMessage(message,transfer);}
    };
    const source=document.createElement('canvas');source.width=1280;source.height=720;const context=source.getContext('2d');
    const pump=setInterval(()=>{context.fillStyle='#808080';context.fillRect(0,0,1280,720);},33);
    navigator.mediaDevices.getUserMedia=async()=>source.captureStream(30);
    const host=document.createElement('div');host.style.cssText='width:640px;height:360px';document.body.append(host);
    let session;
    try {
      session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',cacheRuntimeAssets:true,onTrackingHealthChange:h=>{health=h;if(phases.at(-1)!==h.phase)phases.push(h.phase);}});
      await session.start();await new Promise(r=>setTimeout(r,9000));
      const sources=await Promise.all(urls.map(async url=>{const t=await fetch(url,{cache:'no-store'}).then(r=>r.text());return {url,hasCompletion:t.includes('frame-done'),hasDelegate:t.includes('delegate:')};}));
      const packetCounts=packets.reduce((a,p)=>({...a,[p.type]:(a[p.type]??0)+1}),{});
      const pass=health.phase==='running'&&health.delegate==='CPU'&&health.restarts===1&&dropped===1&&phases.includes('recovering')&&packetCounts.result>=50&&packetCounts['frame-done']>=50&&packets.filter(p=>p.type==='ready').at(-1).delegate==='CPU';
      if(!pass)throw new Error(`Actual-worker continuity failed: ${JSON.stringify({health,packetCounts,sources})}`);
      return {date:'2026-10-13',cameraRequested:false,pass,status:session.status,health,packetCounts,dropped,phases,firstPackets:packets.slice(0,8),sources,limitations:'Actual MediaPipe CPU recovery receives synthetic blank video; the first GPU frame is deliberately dropped. No physical camera, hardware GPU stall, face recognition or device performance acceptance.'};
    }finally{session?.dispose();source.width=source.height=0;clearInterval(pump);host.remove();window.Worker=oldWorker;navigator.mediaDevices.getUserMedia=oldGum;}
  });
}
