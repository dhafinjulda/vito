async page=>{
  const results=[];
  for(const mode of ['prepared-start','portrait-start','concurrent-start','cancel-warmup']){
    results.push(await page.evaluate(async mode=>{
      const {createVirtualTryOn}=await import('/@fs/C:/Projects/VTO/packages/sdk/dist/vto-sdk.js');
      const nativeGum=navigator.mediaDevices.getUserMedia,NativeWorker=window.Worker;
      let cameraCalls=0,workers=0,terminated=0,health,session,track,preparedWithoutCamera=false;
      const host=document.createElement('div');host.style.cssText='width:640px;height:360px';document.body.append(host);
      const source=document.createElement('canvas');source.width=mode==='portrait-start'?720:1280;source.height=mode==='portrait-start'?1280:720;const ctx=source.getContext('2d');
      const draw=()=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,source.width,source.height);};draw();const pump=setInterval(draw,33);
      const errors=[],stages=[];
      window.Worker=class extends NativeWorker{constructor(...args){super(...args);workers++;}terminate(){terminated++;super.terminate();}};
      navigator.mediaDevices.getUserMedia=async options=>{if(options.audio!==false)throw Error('Audio requested');cameraCalls++;const stream=source.captureStream(30);track=stream.getTracks()[0];return stream;};
      try{
        session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',cacheRuntimeAssets:true,onError:e=>errors.push(e.message),onTrackingHealthChange:h=>health=h,onReadinessChange:stage=>{stages.push(stage);if(mode==='cancel-warmup'&&stage==='warming-tracker')session.stop();}});
        const prep=session.prepare();if(session.prepare()!==prep)throw Error('Preparation not shared');
        if(mode==='cancel-warmup'){
          let rejected=false;try{await prep;}catch{rejected=true;}
          session.dispose();return {mode,pass:rejected&&cameraCalls===0&&workers===1&&terminated===1&&host.children.length===0&&!errors.length,rejected,cameraCalls,workers,terminated,stages,errors};
        }
        let start;
        if(mode==='concurrent-start')start=session.start();
        await prep;preparedWithoutCamera=mode==='concurrent-start'||cameraCalls===0;
        if(!start)start=session.start();await start;
        await new Promise(r=>setTimeout(r,1000));
        const summary={mode,preparedWithoutCamera,cameraCalls,workers,results:health.resultsReceived,preparation:health.preparation,startup:health.startup,stages,errors};
        session.dispose();summary.terminated=terminated;summary.cleaned=track?.readyState==='ended'&&host.children.length===0;
        summary.pass=preparedWithoutCamera&&cameraCalls===1&&workers===1&&terminated===1&&summary.cleaned&&!errors.length&&summary.results>0&&summary.preparation?.reused===true&&summary.startup.firstFitSubmissionMs===null&&(mode!=='portrait-start'||Number.isFinite(summary.preparation.activationWarmupMs));
        return summary;
      }catch(error){return {mode,pass:false,error:String(error),cameraCalls,workers,terminated,stages,errors};}
      finally{session?.dispose();track?.stop();clearInterval(pump);host.remove();source.width=source.height=0;window.Worker=NativeWorker;navigator.mediaDevices.getUserMedia=nativeGum;}
    },mode));
  }
  return {pass:results.every(r=>r.pass),results,scope:'Public SDK prepare/start, actual native worker, resolved default effects/hands off, synthetic blank local video only. No physical camera/person data, recognized fit, activated hair masks, device or speedup acceptance. SDK module is preloaded; cache/GPU/network uncontrolled.'};
}
