async page=>{
  const results=[];
  const reverse=new URL(page.url()).searchParams.has('reverse');
  for(const [width,height] of reverse?[[256,256],[640,360],[640,360],[256,256]]:[[640,360],[256,256],[256,256],[640,360]]){
    results.push(await page.evaluate(({width,height})=>new Promise(resolve=>{
      const worker=new Worker('/@fs/C:/Projects/VTO/.benchmarks/hair-warmup/worker.js');
      const finish=value=>{clearTimeout(timer);worker.terminate();resolve(value);};
      const timer=setTimeout(()=>finish({pass:false,width,height,error:'Experiment deadline'}),45000);
      worker.onmessage=e=>finish(e.data);worker.onerror=e=>finish({pass:false,width,height,error:e.message});
      worker.postMessage({width,height});
    }),{width,height}));
  }
  return {pass:results.every(r=>r.pass&&r.samples.length===3&&r.samples.every(s=>s.width===640&&s.height===360&&Number.isFinite(s.inferenceMs))),reverse,results,scope:'Source-level HairTracker experiment; ABBA warmup order, reversed via ?reverse, with three 640x360 synthetic blank inferences each. Retained browser HTTP/GPU caches within each browser, uncontrolled network and shared driver caches, GPU requested with existing CPU fallback. No face/camera, appearance acceptance or production change. Wall timings include mask copy, not GPU completion.'};
}
