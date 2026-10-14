/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page=>page.evaluate(async()=>{
  const {GlassesRenderer}=await import('/@fs/C:/Projects/VTO/packages/sdk/src/rendering/GlassesRenderer.ts');
  const {syntheticFrame}=await import('/@fs/C:/Projects/VTO/packages/sdk/test/synthetic-frame.ts');
  const context=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,opts){return context.call(this,type,type==='webgl2'?{...opts,preserveDrawingBuffer:true}:opts);};
  const canvases=[],renderers=[];
  const make=async referenceEyeSpan=>{const c=document.createElement('canvas');c.style.cssText='width:640px;height:360px';document.body.append(c);canvases.push(c);const r=new GlassesRenderer(c,{fit:{referenceEyeSpan},smoothing:false,hairOcclusion:true});renderers.push(r);await r.load('/glasses.glb');return r;};
  const pixels=r=>{const gl=r.renderer.getContext(),p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  try {
    const live=await make(1.45),bindings=[],materials=new Set();
    live.current.traverse(node=>{for(const m of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){if(materials.has(m))continue;materials.add(m);const compile=m.onBeforeCompile;m.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);if(shader.uniforms.uVtoFadeRange)bindings.push(shader.uniforms);};}});
    const frame=syntheticFrame(70,-20),at=performance.now();live.setPose(frame.landmarks,1280,720,frame.matrix,at);
    const confidence=new Uint8Array(16).fill(255);live.setHairMask(confidence,4,4,at);live.render(true,at);
    const firstVersions=[...materials].map(m=>m.version);
    // Three.js internally toggles transparent double-sided lens passes. Measure
    // this with a control draw so its version bumps are not blamed on setFit.
    live.render(true,at);const versions=[...materials].map(m=>m.version),programsBefore=live.renderer.info.programs.length;
    live.setFit({referenceEyeSpan:2.9});const versionsAfterUpdate=[...materials].map(m=>m.version);live.render(true,at+1);const actual=pixels(live);
    const expected=await make(2.9);expected.setPose(frame.landmarks,1280,720,frame.matrix,at);expected.render(true,at+1);const initial=pixels(expected);
    let difference=0,visible=0;for(let i=0;i<actual.length;i++){difference+=Math.abs(actual[i]-initial[i]);if(i%4===3&&actual[i])visible++;}
    const ranges=bindings.map(u=>({fade:u.uVtoFadeRange.value.toArray(),rear:u.uVtoHairRearZ?.value}));
    const afterRender=[...materials].map(m=>m.version);
    const report={date:'2026-10-13',synthetic:true,cameraRequested:false,bindings:ranges,maskCleared:confidence.every(v=>v===0),setFitVersionsStable:versionsAfterUpdate.every((v,i)=>v===versions[i]),controlDrawVersionChanges:versions.map((v,i)=>v-firstVersions[i]),fitDrawVersionChanges:afterRender.map((v,i)=>v-versionsAfterUpdate[i]),programsBefore,programsAfter:live.renderer.info.programs.length,visiblePixels:visible,meanByteDifference:difference/actual.length,webglErrors:[live.renderer.getContext().getError(),expected.renderer.getContext().getError()]};
    report.pass=ranges.length>0&&ranges.every(u=>Math.abs(u.fade[0]+3.18)<1e-9&&Math.abs(u.fade[1]+2.22)<1e-9&&Math.abs(u.rear+.2)<1e-9)&&report.maskCleared&&report.setFitVersionsStable&&report.controlDrawVersionChanges.every((v,i)=>v===report.fitDrawVersionChanges[i])&&report.programsBefore===report.programsAfter&&visible>100&&report.meanByteDifference<.5&&report.webglErrors.every(e=>e===0);
    report.limitations='Internal renderer integration with actual GLB/GPU and synthetic canonical pose. Live unit adjustment is compared to loading the same calibration initially. No physical fit, camera or subject accuracy acceptance.';return report;
  }finally{for(const r of renderers)r.dispose();for(const c of canvases)c.remove();HTMLCanvasElement.prototype.getContext=context;}
})
