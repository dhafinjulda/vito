/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page => {
  const errors=[],writes=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method()))writes.push(request.url());});
  await page.addInitScript(()=>{
    window.__studioTest={cameraCalls:0,tracks:[],downloads:[],urls:new Map(),exportDelay:0};
    navigator.mediaDevices.getUserMedia=async()=>{window.__studioTest.cameraCalls++;throw Error('Unexpected camera request before explicit start');};
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),click=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=blob=>{const url=create(blob);window.__studioTest.urls.set(url,blob);return url;};
    URL.revokeObjectURL=url=>{window.__studioTest.urls.delete(url);revoke(url);};
    HTMLAnchorElement.prototype.click=function(){
      if(this.download&&window.__studioTest.urls.has(this.href)) window.__studioTest.downloads.push({name:this.download,blob:window.__studioTest.urls.get(this.href)});
      else click.call(this);
    };
    const read=FileReader.prototype.readAsArrayBuffer;
    FileReader.prototype.readAsArrayBuffer=function(blob){
      if(window.__studioTest.exportDelay){const ms=window.__studioTest.exportDelay;setTimeout(()=>read.call(this,blob),ms);}
      else read.call(this,blob);
    };
  });
  await page.goto('http://127.0.0.1:5174/');
  await page.evaluate(()=>localStorage.removeItem('vto-asset-studio-generation-v1'));
  await page.reload();
  const ready=async()=>page.waitForFunction(()=>document.querySelector('#asset-ready').textContent==='Siap untuk SDK'&&!document.querySelector('#download').disabled,{},{timeout:12000});
  const state=()=>page.evaluate(()=>({ready:document.querySelector('#asset-ready').textContent,title:document.querySelector('#preview-title').textContent,width:document.querySelector('#side-width').textContent,description:document.querySelector('#description').value,error:document.querySelector('#form-errors').textContent,cameraCalls:window.__studioTest.cameraCalls,downloadDisabled:document.querySelector('#download').disabled}));
  const report={date:'2026-10-13',url:'http://127.0.0.1:5174/',synthetic:true,physicalCameraRequested:false,examples:[]};
  let phase='generation';
  try {
  await ready(); report.initial=await state();
  for(const button of ['Bulat hitam','Metal emas','Cat-eye coklat']) {
    const start=Date.now();await page.getByRole('button',{name:button,exact:true}).click();await ready();
    report.examples.push({...await state(),generationMs:Date.now()-start});
  }
  await page.locator('#download').click();
  await page.locator('.delivery summary').click();
  await page.locator('#download-recipe').click();await page.locator('#download-manifest').click();
  report.downloads=await page.evaluate(async()=>{
    const [glb,recipe,manifest]=window.__studioTest.downloads;
    const buffer=await glb.blob.arrayBuffer(),header=new DataView(buffer),json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,header.getUint32(12,true))).trim());
    return {names:window.__studioTest.downloads.map(d=>d.name),glbBytes:glb.blob.size,magic:header.getUint32(0,true),embedded:json.scenes[json.scene??0].extras.vtoGlasses.sdk,recipe:JSON.parse(await recipe.blob.text()),manifest:JSON.parse(await manifest.blob.text())};
  });
  const before=await state();
  await page.locator('#description').fill('Kacamata aviator titanium 52-18-140');await page.locator('#generate').click();
  await page.waitForFunction(()=>!!document.querySelector('#form-errors').textContent);
  report.invalid={...await state(),previousModelPreserved:(await state()).title===before.title};
  await page.getByRole('button',{name:'Bulat hitam',exact:true}).click();await ready();
  await page.locator('#advanced-controls summary').click();
  await page.locator('[data-dimension="frameWidth"]').fill('99');await page.locator('#apply-details').click();
  await page.waitForFunction(()=>!!document.querySelector('#form-errors').textContent);
  report.invalidDimensions=await state();
  await page.locator('[data-dimension="frameWidth"]').fill('155');await page.locator('#apply-details').click();await ready();
  report.advanced=await state();
  await page.locator('#advanced-controls summary').click();
  await page.evaluate(()=>window.__studioTest.exportDelay=350);
  await page.getByRole('button',{name:'Metal emas',exact:true}).click();
  await page.locator('#generation-cancel').click();
  await page.waitForFunction(()=>document.querySelector('#generation-state').textContent.includes('dibatalkan'));
  await page.waitForTimeout(850);
  report.cancelled=await state();
  await page.getByRole('button',{name:'Bulat hitam',exact:true}).click();
  await page.getByRole('button',{name:'Cat-eye coklat',exact:true}).click();await ready();await page.waitForTimeout(900);
  report.latestWins=await state();
  await page.evaluate(()=>window.__studioTest.exportDelay=0);
  // Drive the Studio's actual explicit-start button with a synthetic local source.
  await page.evaluate(async()=>{
    const {syntheticFrame}=await import('/@fs/C:/Projects/VTO/packages/sdk/test/synthetic-frame.ts');
    const f=syntheticFrame(0,0,0,1280,720,40);
    const code=`const f=${JSON.stringify(f)};onmessage=({data:m})=>{if(m.type==='init'){postMessage({type:'face-ready'});postMessage({type:'ready',protocolVersion:8,delegate:'GPU',handTracking:'disabled',hairTracking:'disabled'});}if(m.type==='frame'){postMessage({type:'result',landmarks:f.landmarks,faceMatrix:f.matrix,timestampMs:m.timestampMs,faceInferenceMs:8});m.bitmap.close();postMessage({type:'frame-done',timestampMs:m.timestampMs});}};`;
    const native=window.Worker,url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    window.__studioTest.workerUrl=url;
    window.Worker=class extends native{constructor(){super(url);window.__studioTest.worker=this;this.addEventListener('message',({data})=>{window.__studioTest.lastPacket=data.type;window.__studioTest.packetCount=(window.__studioTest.packetCount??0)+1;});}};
    const source=document.createElement('canvas');source.width=1280;source.height=720;const ctx=source.getContext('2d');
    window.__studioTest.pump=setInterval(()=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,source.width,source.height);},33);
    navigator.mediaDevices.getUserMedia=async constraints=>{
      if(constraints.audio!==false)throw Error('Audio must be false');window.__studioTest.cameraCalls++;
      const stream=source.captureStream(30);window.__studioTest.tracks.push(...stream.getTracks());return stream;
    };
  });
  report.beforeStartCameraCalls=await page.evaluate(()=>window.__studioTest.cameraCalls);
  phase='camera-start';
  await page.locator('#camera-start').click();
  await page.waitForFunction(()=>document.querySelector('#camera-state').textContent.includes('Wajah dilacak'),{},{timeout:12000});
  await page.waitForTimeout(1000);
  await page.waitForFunction(()=>document.querySelector('#camera-state').textContent.includes('Wajah dilacak'),{},{timeout:12000});
  report.cameraStarted=await page.evaluate(()=>({state:document.querySelector('#camera-state').textContent,cameraCalls:window.__studioTest.cameraCalls,elements:document.querySelectorAll('#camera-mount video,#camera-mount canvas').length,canvasHeight:document.querySelector('#camera-mount canvas').getBoundingClientRect().height,packets:window.__studioTest.packetCount}));
  report.continuity=[];
  for(let i=0;i<12;i++) {
    await page.waitForTimeout(250);
    report.continuity.push(await page.evaluate(()=>({tracking:document.querySelector('#camera-state').textContent.includes('Wajah dilacak'),packets:window.__studioTest.packetCount,time:document.querySelector('#camera-mount video').currentTime})));
  }
  phase='live-swap';
  await page.getByRole('button',{name:'Metal emas',exact:true}).click();await ready();await page.waitForTimeout(650);
  report.liveSwap={...await state(),cameraCalls:await page.evaluate(()=>window.__studioTest.cameraCalls)};
  await page.locator('#camera-stop').click();
  report.cleanup=await page.evaluate(()=>({tracksEnded:window.__studioTest.tracks.every(track=>track.readyState==='ended'),elements:document.querySelector('#camera-mount').childElementCount,state:document.querySelector('#camera-state').textContent}));
  await page.evaluate(()=>{clearInterval(window.__studioTest.pump);URL.revokeObjectURL(window.__studioTest.workerUrl);});
  await page.reload();await ready();report.restore=await state();
  phase='layout';
  // Bounded screenshot round: desktop and mobile, same stable result, no camera.
  await page.setViewportSize({width:1360,height:900});await page.screenshot({path:'docs/evidence/m12-studio-desktop.png',fullPage:true});
  report.desktop=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,advancedOpen:document.querySelector('#advanced-controls').open}));
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/evidence/m12-studio-mobile.png',fullPage:true});
  report.mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,width:innerWidth}));
  report.pageErrors=errors;report.writeRequests=writes;
  report.pass=report.initial.ready==='Siap untuk SDK'&&report.examples.every(e=>e.ready==='Siap untuk SDK'&&!e.error)&&report.downloads.magic===0x46546c67&&report.downloads.embedded.units==='meters'&&report.invalid.previousModelPreserved&&report.invalid.downloadDisabled&&!!report.invalidDimensions.error&&report.advanced.width==='155 mm'&&report.cancelled.ready==='Hasil sebelumnya'&&report.latestWins.description.includes('cat-eye')&&report.latestWins.title.toLowerCase().includes('cat-eye')&&report.beforeStartCameraCalls===0&&report.cameraStarted.cameraCalls===1&&report.liveSwap.cameraCalls===1&&report.cleanup.tracksEnded&&report.cleanup.elements===0&&!report.desktop.overflow&&!report.mobile.overflow&&!errors.length&&!writes.length;
  report.pass=report.pass&&report.cameraStarted.canvasHeight>0&&report.continuity.filter(sample=>sample.tracking).length>=9&&report.continuity.at(-1).packets>report.cameraStarted.packets+20;
  return report;
  } catch(error) { return {...report,phase,pass:false,error:error instanceof Error?error.message:String(error),pageErrors:errors,writeRequests:writes}; }
  finally {
    await page.evaluate(()=>{if(window.__studioTest){clearInterval(window.__studioTest.pump);window.__studioTest.tracks.forEach(track=>track.stop());}});
  }
}
