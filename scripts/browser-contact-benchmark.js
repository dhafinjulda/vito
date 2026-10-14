/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page=>{
  return await page.evaluate(async()=>{
    const THREE=await import('/@fs/C:/Projects/VTO/node_modules/three/build/three.module.js');
    const {GlassesRenderer}=await import('/@fs/C:/Projects/VTO/packages/sdk/src/rendering/GlassesRenderer.ts');
    const {syntheticFrame}=await import('/@fs/C:/Projects/VTO/packages/sdk/test/synthetic-frame.ts');
    const {unprojectGrip}=await import('/@fs/C:/Projects/VTO/packages/sdk/src/interaction/HandGrip.ts');
    const canvas=document.createElement('canvas');canvas.style.cssText='width:640px;height:400px';document.body.append(canvas);
    const renderer=new GlassesRenderer(canvas,{smoothing:false,ambientLighting:false}),runs=[];
    try {
      for(const asset of ['/glasses.glb','/glasses-alt.glb','/round-spectacles.glb']) {
        await renderer.load(asset);const frame=syntheticFrame(45,-20);renderer.setPose(frame.landmarks,1280,720,frame.matrix);renderer.render(true);
        const model=renderer.scene.children.find(node=>node.isGroup&&node!==renderer.headOccluder&&node!==renderer.handOccluder);
        const context=renderer.getGrabContext(),projection=context.projection;
        // Original fallback transcribed for matched geometry. Both paths run on
        // this same current renderer, not different drivers or GLB instances.
        function originalContact(point) {
          const ray=new THREE.Raycaster(),near=unprojectGrip(point,1,projection);ray.ray.origin.set(0,0,0);ray.ray.direction.copy(near).normalize();
          const hit=ray.intersectObject(model,true)[0];if(hit)return hit.point;
          let closest=null,best=1.4;
          model.traverse(node=>{
            if(!node.isMesh)return;
            const box=new THREE.Box3().setFromObject(node),center=box.getCenter(new THREE.Vector3());if(center.z>=-5)return;
            const projected=unprojectGrip(point,-center.z,projection),contact=box.clampPoint(projected,new THREE.Vector3()),distance=projected.distanceTo(contact);
            if(distance<best){best=distance;closest=contact;}
          });return closest;
        }
        const points=[{x:0.02,y:0.02},{x:0.48,y:0.46},{x:0.53,y:0.5},{x:0.57,y:0.47}];
        let maxContactErrorCm=0,mismatches=0;
        for(const point of points) {
          const a=originalContact(point),b=context.contactAt(point);
          if(Boolean(a)!==Boolean(b))mismatches++;else if(a&&b)maxContactErrorCm=Math.max(maxContactErrorCm,a.distanceTo(b));
        }
        const durations={original:[],cached:[]};
        for(let batch=-5;batch<50;batch++)for(const mode of batch%2?['original','cached']:['cached','original']) {
          const fn=mode==='original'?originalContact:context.contactAt,start=performance.now();
          for(let i=0;i<20;i++)fn(points[i%points.length]);
          if(batch>=0)durations[mode].push((performance.now()-start)/20);
        }
        const stats=values=>({meanMs:values.reduce((a,b)=>a+b,0)/values.length,p95Ms:[...values].sort((a,b)=>a-b)[Math.ceil(values.length*0.95)-1],batches:values.length,callsPerBatch:20});
        runs.push({asset,original:stats(durations.original),cached:stats(durations.cached),maxContactErrorCm,mismatches,pass:mismatches===0&&maxContactErrorCm<1e-6});
      }
      return {date:'2026-10-13',cameraRequested:false,synthetic:true,runs,pass:runs.every(run=>run.pass),scope:'CPU contact microbenchmark, actual GLBs on shared synthetic scene; original fallback transcribed, warmup 5 batches, alternated 50 matched batches. Batch-normalized duration p95 is not individual-call p95, GPU execution or live fitting latency.'};
    } finally {renderer.dispose();canvas.remove();}
  });
}
