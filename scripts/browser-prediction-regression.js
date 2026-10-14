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
    const {GlassesRenderer}=await import('/@fs/C:/Projects/VTO/packages/sdk/src/rendering/GlassesRenderer.ts');
    const {syntheticFrame}=await import('/@fs/C:/Projects/VTO/packages/sdk/test/synthetic-frame.ts');
    const {fitFace,resolveFit}=await import('/@fs/C:/Projects/VTO/packages/sdk/src/glasses/fitting.ts');
    const canvas=document.createElement('canvas');canvas.style.cssText='width:640px;height:400px';document.body.append(canvas);
    const renderer=new GlassesRenderer(canvas,{smoothing:false,presentation:'predicted',ambientLighting:false}),runs=[];
    try {
      for(const asset of ['/glasses.glb','/glasses-alt.glb','/round-spectacles.glb']) {
        await renderer.load(asset);
        const warm=syntheticFrame();renderer.setPose(warm.landmarks,1280,720,warm.matrix,performance.now()-10,0);renderer.render(true);renderer.setPose(null,1280,720);
        const poses=[];
        for(let i=0;i<3;i++) {
          await new Promise(resolve=>setTimeout(resolve,50));const at=performance.now()-10;
          const frame=syntheticFrame(i*4,-10,0,1280,720,45);
          renderer.setPose(frame.landmarks,1280,720,frame.matrix,at,i*0.05);renderer.render(false,performance.now(),i*0.05);
          poses.push(fitFace(frame.landmarks,frame.matrix,renderer.getGrabContext().projection,resolveFit()));
        }
        renderer.render(false,performance.now(),0.125);renderer.scene.updateMatrixWorld(true);
        const previous=poses[1],latest=poses[2],head=latest.headPosition.clone().addScaledVector(latest.headPosition.clone().sub(previous.headPosition),0.5);
        const delta=previous.headRotation.clone().invert().multiply(latest.headRotation);
        const rotation=latest.headRotation.clone().multiply(delta.clone().identity().slerp(delta,0.5));
        const attribute=renderer.occluder.geometry.attributes.position,maskBridge=latest.headPosition.clone().set(attribute.getX(168),attribute.getY(168),attribute.getZ(168)).applyMatrix4(renderer.occluder.matrixWorld);
        const current=renderer.getGrabContext();
        const errors={headCm:renderer.headOccluder.position.distanceTo(head),headRadians:renderer.headOccluder.quaternion.angleTo(rotation),maskBridgeCm:maskBridge.distanceTo(renderer.headOccluder.position),contactAssetCm:current.face.position.distanceTo(current.asset.position),assetRadians:current.asset.rotation.angleTo(rotation)};
        const held={position:current.asset.position.clone().addScalar(1),rotation:current.asset.rotation.clone(),scale:current.asset.scale};
        renderer.setHeldPose(held);renderer.render(false,performance.now(),0.14);
        const ownerStable=renderer.getGrabContext().asset.position.distanceTo(held.position)<1e-8;
        renderer.setHeldPose(null);renderer.setPose(null,1280,720);renderer.render(false,performance.now(),0.15);
        const lossCleared=renderer.getGrabContext().face===null&&!renderer.occluder.visible&&!renderer.headOccluder.visible;
        const webglError=renderer.renderer.getContext().getError();
        runs.push({asset,errors,ownerStable,lossCleared,webglError,pass:errors.headCm<1e-6&&errors.headRadians<1e-6&&errors.maskBridgeCm<1e-4&&errors.contactAssetCm<1e-6&&errors.assetRadians<1e-6&&ownerStable&&lossCleared&&webglError===0});
      }
      return {date:'2026-10-13',cameraRequested:false,synthetic:true,runs,pass:runs.every(run=>run.pass),scope:'Predictive presentation head/asset/mask/contact/owner regression on synthetic motion and actual GLBs. No live camera, physical latency or recognition acceptance.'};
    } finally {renderer.dispose();canvas.remove();}
  });
}
