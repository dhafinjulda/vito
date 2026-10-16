async page=>{
  const results=[];
  const cases=[['NotAllowedError','Akses kamera diblokir'],['NotFoundError','Kamera tidak ditemukan'],['NotReadableError','Kamera belum dapat digunakan'],['AbortError','Kamera belum bisa dimulai'],['unsupported','Kamera memerlukan HTTPS']];
  for(const [name,copy] of cases){
    await page.goto('http://localhost:5173/');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(name=>{
      window.cameraRecoveryCheck={calls:0,audioFalse:true};
      if(name==='unsupported'){Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:undefined});return;}
      navigator.mediaDevices.getUserMedia=async options=>{
        window.cameraRecoveryCheck.calls++;window.cameraRecoveryCheck.audioFalse&&=options.audio===false;
        throw new DOMException('Controlled acquisition failure',name);
      };
    },name);
    await page.locator('#start').click();
    await page.waitForFunction(copy=>document.querySelector('#message').textContent.includes(copy),copy);
    const result=await page.evaluate(()=>({copy:document.querySelector('#message').textContent,...window.cameraRecoveryCheck,overflow:document.documentElement.scrollWidth>innerWidth}));
    result.name=name;result.startEnabled=await page.locator('#start').isEnabled();result.retryEnabled=await page.locator('#resync').isEnabled();
    result.pass=result.calls===(name==='unsupported'?0:1)&&result.audioFalse&&!result.overflow&&result.startEnabled&&result.retryEnabled;
    results.push(result);
  }
  return {pass:results.every(r=>r.pass),results,scope:'Reference UI at 390px with deliberately rejected acquisition or absent API. No camera stream requested from hardware, no native permission prompt/device qualification. Error copy and retry controls only; no personal data.'};
}
