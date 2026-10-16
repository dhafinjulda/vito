/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page=>page.evaluate(async()=>{
  const {createVirtualTryOn}=await import('/@fs/C:/Projects/VTO/packages/sdk/dist/vto-sdk.js');
  const {syntheticFrame}=await import('/@fs/C:/Projects/VTO/packages/sdk/test/synthetic-frame.ts');
  const {syntheticHand}=await import('/@fs/C:/Projects/VTO/packages/sdk/test/synthetic-hand.ts');
  const {getDemoFit}=await import('/src/demo-assets.ts');
  const THREE=await import('/@id/three'),NativeWorker=window.Worker,gum=navigator.mediaDevices.getUserMedia,updateWorld=THREE.Object3D.prototype.updateMatrixWorld,context=HTMLCanvasElement.prototype.getContext;
  const fixture=syntheticFrame(0,0,0,1280,720,45),workers=[];
  const code=`let hands=[],face=true;const fixture=${JSON.stringify(fixture)};onmessage=({data:m})=>{if(m.type==='init')postMessage({type:'ready',protocolVersion:8,delegate:'GPU',handTracking:m.handModelAssetPath?'ready':'disabled',hairTracking:'disabled'});if(m.type==='mode'){hands=m.hands;face=m.face;}if(m.type==='frame'){postMessage({type:'result',landmarks:face?fixture.landmarks:null,faceMatrix:face?fixture.matrix:null,timestampMs:m.timestampMs,faceInferenceMs:8});postMessage({type:'hand-result',hands,timestampMs:m.timestampMs,handInferenceMs:8});m.bitmap.close();postMessage({type:'frame-done',timestampMs:m.timestampMs});}};`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  window.Worker=class extends NativeWorker{constructor(){super(url);workers.push(this);}};
  HTMLCanvasElement.prototype.getContext=function(type,opts){return context.call(this,type,type==='webgl2'?{...opts,preserveDrawingBuffer:true}:opts);};
  let scene,object,hideMasks=false,renderCalls=0,names=[];const maskedVisibility=new Map(),camera=new THREE.PerspectiveCamera(63,1280/720,.05,500);
  THREE.Object3D.prototype.updateMatrixWorld=function(force){const result=updateWorld.call(this,force);if(this.isScene){let rim;this.traverse(n=>{if(n.name==='rim-left')rim=n;});if(rim){renderCalls++;scene=this;object=rim;while(object.parent&&object.parent!==this)object=object.parent;
      const masks=this.children.filter(n=>n.children.some(child=>child.isInstancedMesh&&child.count===21));if(hideMasks){for(const mask of masks){if(!maskedVisibility.has(mask))maskedVisibility.set(mask,mask.visible);mask.visible=false;}}else{for(const [mask,visible]of maskedVisibility)mask.visible=visible;maskedVisibility.clear();}}}return result;};
  const source=document.createElement('canvas');source.width=1280;source.height=720;const ctx=source.getContext('2d'),host=document.createElement('div');host.style.cssText='width:640px;height:360px';document.body.append(host);
  const pump=setInterval(()=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,1280,720);},33);let tracks=[],calls=0,state,health;const errors=[];
  navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.audio!==false)throw Error('Audio enabled');calls++;const stream=source.captureStream(30);tracks=stream.getTracks();return stream;};
  const delay=ms=>new Promise(r=>setTimeout(r,ms));const until=async(fn,label)=>{const end=performance.now()+4000;while(!fn()&&performance.now()<end)await delay(20);if(!fn())throw Error(`Timeout ${label}: ${JSON.stringify(state)}`);};
  const report={date:'2026-10-13',synthetic:true,physicalCameraRequested:false,graspCases:[]};let session;
  const mode=(hands,face=true)=>workers.at(-1).postMessage({type:'mode',hands,face});
  const pixels=()=>{const gl=session.canvas.getContext('webgl2'),p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);let count=0;for(let i=3;i<p.length;i+=4)if(p[i])count++;return count;};
  const pose=()=>({position:object.position.clone(),rotation:object.quaternion.clone(),scale:object.scale.x});
  const point=name=>{const node=scene.getObjectByName(name),box=new THREE.Box3().setFromObject(node),at=box.getCenter(new THREE.Vector3());at.y=box.max.y;at.project(camera);return {x:(at.x+1)/2,y:(1-at.y)/2};};
  try{
    session=createVirtualTryOn({container:host,glassesUrl:'/glasses.glb',fit:getDemoFit(),handInteraction:{},cameraCompositing:false,hairOcclusion:false,onInteractionChange:s=>state=s,onTrackingHealthChange:h=>health=h,onError:e=>errors.push(e.message)});
    await session.start();await until(()=>session.status==='tracking'&&object&&pixels()>0,'initial glasses');
    const left=point('rim-left'),right=point('rim-right');report.initial={pixels:pixels()};
    for(const handedness of ['Left','Right'])for(const finger of ['index','middle','ring','little']){
      mode([]);await delay(180);session.setPlacement('face');await delay(100);const at=handedness==='Left'?left:right;
      mode([syntheticHand(at.x,at.y,finger,handedness)]);await until(()=>state.grippingHands===1,'finger grasp');
      report.graspCases.push({handedness,finger,owners:state.grippingHands,pixels:pixels(),contacts:state.contactFingers});
    }
    mode([]);await delay(180);session.setPlacement('face');await delay(100);
    const donor=syntheticHand(left.x,left.y,'index','Right'),receiver=syntheticHand(right.x,right.y,'middle','Left');mode([donor]);await until(()=>state.grippingHands===1,'donor');const before=pose();
    mode([donor,receiver]);await until(()=>state.grippingHands===2,'second contact/dwell');const joined=pose();
    report.join={positionJump:joined.position.distanceTo(before.position),rotationJump:joined.rotation.angleTo(before.rotation),scale:joined.scale,pixels:pixels()};
    const movedA=syntheticHand(left.x+.02,left.y-.02,'index','Right'),movedB=syntheticHand(right.x+.02,right.y+.02,'middle','Left');mode([movedA,movedB]);await delay(250);const moved=pose();
    report.twoHandMotion={positionDelta:moved.position.distanceTo(joined.position),rotationDelta:moved.rotation.angleTo(joined.rotation),scale:moved.scale,owners:state.grippingHands};
    mode([movedA,movedB],false);await delay(150);const masked=pixels(),maskGroups=scene.children.filter(n=>n.children.some(child=>child.isInstancedMesh&&child.count===21));
    hideMasks=true;await delay(150);const unmasked=pixels();hideMasks=false;await delay(100);
    report.occlusion={groups:maskGroups.length,visible:maskGroups.filter(n=>n.visible).length,masked,unmasked,faceLost:session.status==='searching',owners:state.grippingHands};
    const transferStart=pose();mode([syntheticHand(left.x+.02,left.y-.02,'index','Right',true),movedB],false);await until(()=>state.grippingHands===1,'handoff');const transferred=pose();
    report.handoff={positionJump:transferred.position.distanceTo(transferStart.position),rotationJump:transferred.rotation.angleTo(transferStart.rotation),feedback:state.feedback,pixels:pixels()};
    mode([syntheticHand(right.x+.04,right.y+.02,'middle','Left')],false);await delay(200);report.receiverMotion=pose().position.distanceTo(transferred.position);
    mode([],true);session.setPlacement('face');await until(()=>session.status==='tracking'&&state.grippingHands===0&&pixels()>0,'rendered return');
    report.returned={pixels:pixels(),owners:state.grippingHands};session.dispose();report.cleaned=tracks.every(t=>t.readyState==='ended')&&host.children.length===0;
    report.errors=errors;report.restarts=health.restarts;report.cameraCalls=calls;
    report.pass=report.graspCases.length===8&&report.graspCases.every(r=>r.owners===1&&r.pixels>0)&&report.join.positionJump<1e-6&&report.join.rotationJump<1e-6&&report.twoHandMotion.positionDelta>.2&&report.twoHandMotion.rotationDelta>.1&&Math.abs(report.twoHandMotion.scale-report.join.scale)<1e-9&&report.occlusion.groups===2&&report.occlusion.visible===2&&report.occlusion.masked>0&&report.occlusion.unmasked>report.occlusion.masked&&report.occlusion.faceLost&&report.occlusion.owners===2&&report.handoff.positionJump<.05&&report.handoff.rotationJump<.02&&report.handoff.pixels>0&&report.receiverMotion>.2&&report.returned.pixels>0&&report.cleaned&&!errors.length&&report.restarts===0&&calls===1;
    report.limitations='Built public SDK with synthetic local worker recognition, actual GLB contacts/video/WebGL and two-hand masks. GPU prototype observation reads only synthetic object transforms. No physical camera, native hand accuracy, real depth or live grasp acceptance.';return report;
  }catch(e){report.error=e.message;report.state=state;report.status=session?.status;report.pixels=session?pixels():0;report.renderCalls=renderCalls;report.sceneNames=names;report.pass=false;return report;}
  finally{session?.dispose();clearInterval(pump);source.width=source.height=0;host.remove();window.Worker=NativeWorker;navigator.mediaDevices.getUserMedia=gum;THREE.Object3D.prototype.updateMatrixWorld=updateWorld;HTMLCanvasElement.prototype.getContext=context;URL.revokeObjectURL(url);}
})
