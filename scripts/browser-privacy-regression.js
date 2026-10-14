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
  const observe=request=>requests.push({method:request.method(),url:request.url(),bodyBytes:request.postDataBuffer()?.length??0});
  page.on('request',observe);
  try {
    const runtime=await page.evaluate(async()=>{
      const {createVirtualTryOn}=await import('/@fs/C:/Projects/VTO/packages/sdk/dist/vto-sdk.js');
      const original=navigator.mediaDevices.getUserMedia,source=document.createElement('canvas');source.width=1280;source.height=720;
      const context=source.getContext('2d'),host=document.createElement('div');host.style.cssText='width:640px;height:400px';document.body.append(host);
      const pump=setInterval(()=>{context.fillStyle='#808080';context.fillRect(0,0,1280,720);},33);
      let tracks=[],health;
      navigator.mediaDevices.getUserMedia=async()=>{const stream=source.captureStream(30);tracks=stream.getTracks();return stream;};
      const session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',onTrackingHealthChange:value=>health=value});
      try {
        await session.start();await new Promise(resolve=>setTimeout(resolve,5000));
        const received=health?.resultsReceived??0;session.dispose();
        return {resultsReceived:received,tracksStopped:tracks.every(track=>track.readyState==='ended'),elementsRemoved:host.children.length===0,pass:received>=50&&tracks.every(track=>track.readyState==='ended')&&host.children.length===0};
      } finally {session.dispose();navigator.mediaDevices.getUserMedia=original;clearInterval(pump);source.width=source.height=0;host.remove();}
    });
    const nonReadRequests=requests.filter(request=>request.method!=='GET'&&request.method!=='HEAD'||request.bodyBytes>0);
    return {date:'2026-10-13',cameraRequested:false,runtime,requests,nonReadRequests,pass:runtime.pass&&nonReadRequests.length===0,limitations:'Synthetic blank stream and native face worker only. Observed HTTP requests have methods/URLs/body sizes; no response payload, camera image or face data stored. Does not certify unrelated hosting code or future live/device integrations.'};
  } finally {page.off('request',observe);}
}
