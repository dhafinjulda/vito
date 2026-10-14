/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';

const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try {
  const {PosePresentation}=await server.ssrLoadModule('/packages/sdk/src/glasses/PosePresentation.ts');
  const truth=time=>{
    const seconds=time/1000,headPosition=new THREE.Vector3(3*Math.sin(seconds*2.4),0,-45),headRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),0.5*Math.sin(seconds*2.4));
    return {headPosition,headRotation,position:new THREE.Vector3(0,0,0.8).applyQuaternion(headRotation).add(headPosition),rotation:headRotation.clone(),scale:4,faceDepth:45,headHalfWidth:7,worldEyeSpan:8.9,state:{visible:true,source:'face-matrix',estimatedDistanceCm:45,yawDegrees:0,pitchDegrees:0,guidance:'ready'}};
  };
  const quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.ceil(q*values.length)-1];
  const runs=[];
  for(const trackingHz of [15,20,30])for(const renderHz of [30,60,90]) {
    const modes={direct:new PosePresentation(),interpolated:new PosePresentation('interpolated'),predicted:new PosePresentation('predicted')},errors={direct:[],interpolated:[],predicted:[]},steps={direct:[],interpolated:[],predicted:[]};
    const previous={},cameraDelayMs=10;
    let capture=0;
    for(let now=0;now<10000;now+=1000/renderHz) {
      while(capture+cameraDelayMs<=now+1e-7){for(const sampler of Object.values(modes))sampler.ingest(truth(capture),capture,capture+cameraDelayMs,capture/1000);capture+=1000/trackingHz;}
      for(const [mode,sampler] of Object.entries(modes)) {
        // Same unshifted clock for both candidates; no compensating truth/video delay.
        const sample=sampler.sample(now,now/1000);if(!sample)continue;
        if(now>1000) {
          errors[mode].push(sample.position.distanceTo(truth(now).position));
          if(previous[mode])steps[mode].push(sample.position.distanceTo(previous[mode]));
        }
        previous[mode]=sample.position.clone();
      }
    }
    const directP95=quantile(errors.direct,0.95),interpolatedP95=quantile(errors.interpolated,0.95),predictedP95=quantile(errors.predicted,0.95);
    runs.push({trackingHz,renderHz,directP95ErrorCm:directP95,interpolatedP95ErrorCm:interpolatedP95,errorReductionPercent:100*(1-interpolatedP95/directP95),directP95StepCm:quantile(steps.direct,0.95),interpolatedP95StepCm:quantile(steps.interpolated,0.95),extraDelayCapMs:Math.min(50,1000/trackingHz),alignmentTargetPassed:interpolatedP95<=directP95*0.75,predictedP95ErrorCm:predictedP95,predictionErrorReductionPercent:100*(1-predictedP95/directP95),predictionP95StepCm:quantile(steps.predicted,0.95),predictionHorizonCapMs:30,predictionAlignmentTargetPassed:predictedP95<=directP95*0.75});
  }
  const result={recordedDate:'2026-10-13',synthetic:true,input:'analytic sinusoidal bridge/head motion; 10 ms receipt latency; ideal continuously advancing media clock; no noise or SDK filtering',scope:'Sampler A/B only. Same timestamp ground truth, no physical video/GPU/inference. Reduced draw steps alone do not establish alignment accuracy. Real 30 Hz media clocks advance in steps.',runs,decision:'Keep direct as default. Delayed interpolation failed alignment. Media-mapped prediction is a separate opt-in candidate; synthetic improvement does not establish live alignment or recognition. No filter-cutoff change.'};
  await writeFile(new URL('../docs/evidence/smoothness-presentation-ab.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {await server.close();}
