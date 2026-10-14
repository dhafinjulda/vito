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
    const host=document.createElement('div');host.style.cssText='width:640px;height:400px;position:fixed;top:0;left:0';document.body.append(host);
    const canvas=document.createElement('canvas');canvas.style.cssText='width:640px;height:400px';host.append(canvas);
    const renderer=new GlassesRenderer(canvas,{smoothing:false,presentation:'interpolated',ambientLighting:false});
    const runs=[];
    try {
      for(const asset of ['/glasses.glb','/glasses-alt.glb','/round-spectacles.glb']) {
        await renderer.load(asset);
        const base=performance.now()+100;
        const first=syntheticFrame(0,0,0,1280,720,45),second=syntheticFrame(30,-40,0,1280,720,48);
        renderer.setPose(first.landmarks,1280,720,first.matrix,base);renderer.render(false,base,0);
        const reference=renderer.getGrabContext();
        const a=fitFace(first.landmarks,first.matrix,reference.projection,resolveFit()),b=fitFace(second.landmarks,second.matrix,reference.projection,resolveFit());
        renderer.setPose(second.landmarks,1280,720,second.matrix,base+50);renderer.render(false,base+75,0.075);
        const current=renderer.getGrabContext(),expectedHead=a.headPosition.clone().lerp(b.headPosition,0.5),expectedRotation=a.headRotation.clone().slerp(b.headRotation,0.5);
        renderer.scene.updateMatrixWorld(true);
        const attribute=renderer.occluder.geometry.attributes.position;
        const maskBridge=b.headPosition.clone().set(attribute.getX(168),attribute.getY(168),attribute.getZ(168)).applyMatrix4(renderer.occluder.matrixWorld);
        const errors={maskBridgeCm:maskBridge.distanceTo(renderer.headOccluder.position),headCm:renderer.headOccluder.position.distanceTo(expectedHead),headRadians:renderer.headOccluder.quaternion.angleTo(expectedRotation),assetRadians:current.asset.rotation.angleTo(expectedRotation)};
        const coherence=errors.maskBridgeCm<1e-4&&errors.headCm<1e-6&&errors.headRadians<1e-6&&errors.assetRadians<1e-6;
        const before=current.asset.position.clone();renderer.render(false,base+95,0.075);
        const frozenMedia=renderer.getGrabContext().asset.position.distanceTo(before)<1e-8;
        renderer.render(false,base+100,0.1);
        const stoppedDuplicate=!renderer.render(false,base+120,0.12);
        const noExtrapolation=renderer.getGrabContext().asset.position.distanceTo(b.position)<1e-6;
        renderer.setPose(null,1280,720);renderer.render(false,base+130,0.13);
        const clearsLoss=!renderer.occluder.visible&&!renderer.headOccluder.visible&&renderer.getGrabContext().face===null;
        renderer.setPose(first.landmarks,1280,720,first.matrix,base+140);renderer.render(false,base+140,0.14);
        const reacquired=renderer.getGrabContext().face!==null&&renderer.occluder.visible;
        const error=renderer.renderer.getContext().getError();
        runs.push({asset,coherence,errors,frozenMedia,stoppedDuplicate,noExtrapolation,clearsLoss,reacquired,webglError:error,pass:coherence&&frozenMedia&&stoppedDuplicate&&noExtrapolation&&clearsLoss&&reacquired&&error===0});
      }
      return {synthetic:true,cameraRequested:false,runs,pass:runs.every(run=>run.pass)};
    } finally {renderer.dispose();host.remove();}
  });
}
