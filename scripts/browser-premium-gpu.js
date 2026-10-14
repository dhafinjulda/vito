/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
async page=>page.evaluate(async()=>{
  const THREE=await import('/@id/three');
  const {CameraBackground}=await import('/@fs/C:/Projects/VTO/packages/sdk/src/rendering/CameraBackground.ts');
  const {HairMask}=await import('/@fs/C:/Projects/VTO/packages/sdk/src/rendering/HairMask.ts');
  const {GlassesRenderer}=await import('/@fs/C:/Projects/VTO/packages/sdk/src/rendering/GlassesRenderer.ts');
  const {syntheticFrame}=await import('/@fs/C:/Projects/VTO/packages/sdk/test/synthetic-frame.ts');
  const {projectFacePoint}=await import('/@fs/C:/Projects/VTO/packages/sdk/src/glasses/fitting.ts');
  const canvas=document.createElement('canvas'),source=document.createElement('canvas'),video=document.createElement('video');
  source.width=source.height=256;const ctx=source.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,256,256);
  const stream=source.captureStream(30),pump=setInterval(()=>ctx.fillRect(0,0,1,1),33);video.muted=true;video.srcObject=stream;await video.play();
  const wait=()=>new Promise(r=>video.requestVideoFrameCallback(()=>r()));
  await wait();
  const drawSource=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,256,256);};
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,20);camera.position.z=5;
  const bg=new CameraBackground(scene,video),hair=new HairMask();const materials=[],geometries=[];
  const pixel=(x,y)=>{const data=new Uint8Array(4);renderer.getContext().readPixels(x,y,1,1,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,data);return [...data];};
  const report={date:'2026-10-13',cameraRequested:false,synthetic:true};
  try {
    bg.update(256,256,video.currentTime);renderer.render(scene,camera);report.redBackground=pixel(128,128);
    const lensMaterial=new THREE.MeshPhysicalMaterial({color:'white',transmission:1,roughness:0,ior:1,thickness:0});materials.push(lensMaterial);
    const lensGeometry=new THREE.PlaneGeometry(2,2);geometries.push(lensGeometry);const lens=new THREE.Mesh(lensGeometry,lensMaterial);scene.add(lens);
    renderer.render(scene,camera);report.redTransmission=pixel(128,128);
    drawSource('lime');await wait();bg.update(256,256,video.currentTime);renderer.render(scene,camera);report.greenTransmission=pixel(128,128);
    scene.remove(lens);
    for(const [color,x,y] of [['red',0,0],['lime',128,0],['blue',0,128],['white',128,128]]){ctx.fillStyle=color;ctx.fillRect(x,y,128,128);}
    ctx.fillStyle='yellow';ctx.fillRect(0,0,24,256);ctx.fillRect(232,0,24,256);
    await wait();bg.update(256,256,video.currentTime);renderer.render(scene,camera);
    report.quadrants=[pixel(64,192),pixel(192,192),pixel(64,64),pixel(192,64)];
    renderer.setSize(128,256);bg.update(128,256,video.currentTime);renderer.render(scene,camera);
    report.cover={repeatX:scene.background.repeat.x,topLeft:pixel(10,192),topRight:pixel(118,192),bottomLeft:pixel(10,64),bottomRight:pixel(118,64)};
    renderer.setSize(256,256);bg.dispose();renderer.setClearColor('black',0);
    const root=new THREE.Group();
    for(const [x,z] of [[-.8,1],[.8,-1]]) {
      const geometry=new THREE.BoxGeometry(.7,1,.1);geometry.translate(0,0,z);geometries.push(geometry);
      const material=new THREE.MeshBasicMaterial({color:'lime'});materials.push(material);
      const mesh=new THREE.Mesh(geometry,material);mesh.name='temple-test';mesh.position.x=x;root.add(mesh);
    }
    hair.install(root);scene.add(root);
    const pose={headPosition:new THREE.Vector3(),headRotation:new THREE.Quaternion(),worldEyeSpan:8.9};
    const time=performance.now(),size=new THREE.Vector2(256,256);
    hair.set(new Uint8Array(16).fill(255),4,4,time,pose);hair.update(time,pose,true,256,256,256,256,size);renderer.render(scene,camera);
    report.hairFront=pixel(77,128);report.hairRear=pixel(179,128);
    hair.update(time+501,pose,true,256,256,256,256,size);renderer.render(scene,camera);report.expiredRear=pixel(179,128);
    hair.update(time,pose,false,256,256,256,256,size);renderer.render(scene,camera);report.heldRear=pixel(179,128);
    // Top-right confidence quadrant proves top-down mask Y and cover sampling.
    hair.set(new Uint8Array([0,0,255,255,0,0,255,255,0,0,0,0,0,0,0,0]),4,4,time,pose);hair.update(time,pose,true,256,256,256,256,size);renderer.render(scene,camera);
    report.topRear=pixel(179,154);report.bottomRear=pixel(179,102);
    report.webglError=renderer.getContext().getError();
    report.glbRuns=[];
    for(const asset of ['/glasses.glb','/glasses-alt.glb','/round-spectacles.glb']) {
      const c=document.createElement('canvas');c.style.cssText='width:640px;height:360px';document.body.append(c);
      const r=new GlassesRenderer(c,{smoothing:false,hairOcclusion:true,lensOptics:{},faceOcclusion:true});
      try {await r.load(asset);r.setCameraVideo(video);const frame=syntheticFrame(50,-20);const at=performance.now();r.setPose(frame.landmarks,1280,720,frame.matrix,at);r.setHairMask(new Uint8Array(16).fill(255),4,4,at);r.render(true,at,video.currentTime);
        const gl=r.renderer.getContext();report.glbRuns.push({asset,templeMeshes:r.templeEffectMeshCount,error:gl.getError(),programs:r.renderer.info.programs.length,shaderErrors:r.renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length});
      }finally{r.dispose();c.remove();}
    }
    const calibratedCanvas=document.createElement('canvas');calibratedCanvas.style.cssText='width:400px;height:600px';document.body.append(calibratedCanvas);
    const calibrated=new GlassesRenderer(calibratedCanvas,{smoothing:false,cameraCalibration:{imageWidth:1280,imageHeight:720,fx:800,fy:900,cx:620,cy:340}});
    try {await calibrated.load('/glasses.glb');const f=syntheticFrame();calibrated.setPose(f.landmarks,1280,720,f.matrix);const p=calibrated.getGrabContext().projection;
      const world=projectFacePoint({x:.6,y:.4,z:0},0,45,p),ndc=world.project(calibrated.camera),scale=Math.max(400/1280,600/720);
      const expected={x:(.6*1280*scale-(1280*scale-400)/2)/400*2-1,y:1-(.4*720*scale-(720*scale-600)/2)/600*2};
      report.calibratedProjectionError=Math.hypot(ndc.x-expected.x,ndc.y-expected.y);
    }finally{calibrated.dispose();calibratedCanvas.remove();}
    report.pass=report.redBackground[0]>200&&report.redTransmission[0]>150&&report.greenTransmission[1]>150&&report.redTransmission[1]<40&&report.greenTransmission[0]<40&&report.hairFront[1]>200&&report.hairRear[3]===0&&report.expiredRear[1]>200&&report.heldRear[1]>200&&report.topRear[3]<report.bottomRear[3]&&report.webglError===0&&report.glbRuns.every(r=>r.error===0&&r.shaderErrors===0)&&report.quadrants[0][0]>200&&report.quadrants[1][1]>200&&report.quadrants[2][2]>200&&report.quadrants[3].slice(0,3).every(v=>v>200)&&report.cover.repeatX===.5&&report.cover.topLeft[0]>200&&report.cover.topLeft[1]<40&&report.cover.bottomRight.slice(0,3).every(v=>v>200)&&report.calibratedProjectionError<1e-8;
    report.limitations='Synthetic GPU pixel/actual-GLB regression, no camera person or optical prescription/ear-depth acceptance.';return report;
  } finally {clearInterval(pump);hair.dispose();bg.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();renderer.dispose();renderer.forceContextLoss();for(const t of stream.getTracks())t.stop();video.srcObject=null;source.width=source.height=0;}
})
