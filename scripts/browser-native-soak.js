/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page=>{
  // This isolated test tab disables development HMR; production SDK behavior is
  // unchanged. Source edits in other pages must not interrupt a long soak.
  await page.route('**/@vite/client',route=>route.fulfill({status:200,contentType:'text/javascript',body:'export function createHotContext(){return {data:{},accept(){},dispose(){},prune(){},on(){},off(){},send(){},invalidate(){}}};export function updateStyle(){};export function removeStyle(){};export function injectQuery(url){return url};'}));
  await page.goto(page.url());
  return await page.evaluate(async()=>{
    const sdkUrl=new URLSearchParams(location.search).get('sdk');
    if(!sdkUrl)throw new Error('Supply the frozen SDK URL as ?sdk= before running soak.');
    const {createVirtualTryOn}=await import(sdkUrl);
    const state=window.vtoSoak={phase:'starting',elapsedMs:0,checkpoints:[],error:null,health:null,result:null};
    const originalWorker=window.Worker,originalMedia=navigator.mediaDevices.getUserMedia;
    let worker,completions=0,terminated=0,handResolve,handReject,nativeHandsReady=false,handState='loading',protocol;
    const workerUrls=[];
    window.Worker=class extends originalWorker {
      constructor(url,options){super(url,options);worker=this;workerUrls.push(String(url));this.addEventListener('message',({data})=>{if(data.type==='ready'){protocol=data.protocolVersion;handState=data.handTracking;}if(data.type==='frame-done')completions++;if(data.type==='hand-ready'){nativeHandsReady=true;handState='ready';handResolve?.();}if(data.type==='hand-unavailable'){handState='unavailable';handReject?.(new Error('Native hands unavailable.'));}});}
      terminate(){terminated++;super.terminate();}
    };
    const source=document.createElement('canvas');source.width=1280;source.height=720;
    const context=source.getContext('2d'),host=document.createElement('div');host.style.cssText='width:640px;height:400px';document.body.append(host);
    const pump=setInterval(()=>{context.fillStyle='#808080';context.fillRect(0,0,1280,720);},33);
    let tracks=[];
    navigator.mediaDevices.getUserMedia=async()=>{const stream=source.captureStream(30);tracks=stream.getTracks();return stream;};
    const session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',handInteraction:{},ambientLighting:false,cacheRuntimeAssets:true,onTrackingHealthChange:health=>state.health=health});
    const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    void (async()=>{
      try {
        await session.start();
        if(!nativeHandsReady&&handState==='loading')await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('Hand graph startup timeout.')),30000);
          handResolve=()=>{clearTimeout(timer);resolve();};handReject=error=>{clearTimeout(timer);reject(error);};
          worker.postMessage({type:'enable-hands'});
        });
        handResolve=handReject=null;
        await delay(5000);state.phase='running';
        const started=performance.now(),initialCompletions=completions;
        let previous=initialCompletions,nextCheckpoint=60000;
        while(performance.now()-started<600000) {
          await delay(500);state.elapsedMs=performance.now()-started;
          if(state.health?.phase==='failed')throw new Error('SDK failed during soak.');
          if(state.elapsedMs>=nextCheckpoint) {
            state.checkpoints.push({elapsedMs:state.elapsedMs,completed:completions-initialCompletions,advanced:completions>previous,health:state.health});
            previous=completions;nextCheckpoint+=60000;
          }
        }
        const finalHealth=state.health;
        session.dispose();
        state.result={date:'2026-10-13',cameraRequested:false,sdk:sdkUrl,protocol,measuredMs:state.elapsedMs,completed:completions-initialCompletions,workerUrls,terminated,tracksStopped:tracks.every(track=>track.readyState==='ended'),elementsRemoved:host.children.length===0,health:finalHealth,
          pass:state.checkpoints.every(check=>check.advanced)&&state.checkpoints.length>=10&&finalHealth.phase==='running'&&finalHealth.restarts===0&&terminated===1&&tracks.every(track=>track.readyState==='ended')&&host.children.length===0,
          scope:'One 10-minute public SDK session, actual native face/hand graphs, blank synthetic stream. Explicit harness hand activation. Checks temporal buffer/runtime continuity and disposal only; no recognition, valid-fit rendering, heap snapshot or physical-device acceptance.'};
        state.phase='complete';
      } catch(error){state.phase='failed';state.error=String(error);}
      finally {session.dispose();clearInterval(pump);source.width=source.height=0;host.remove();window.Worker=originalWorker;navigator.mediaDevices.getUserMedia=originalMedia;handResolve=handReject=null;}
    })();
    return {started:true,cameraRequested:false,durationMs:600000};
  });
}
