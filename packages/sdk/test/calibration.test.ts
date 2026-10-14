/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {describe,it,expect} from 'vitest';
import {cameraCalibrationFromReference,scaleCameraCalibration,physicalAssetScale} from '../src/glasses/calibration';
import {projectFacePoint,fitFace,DEFAULT_FIT,writeFaceVertices,coverCameraFov} from '../src/glasses/fitting';
import {unprojectGrip} from '../src/interaction/HandGrip';
import {syntheticFrame} from './synthetic-frame';
import {CANONICAL_EYE_SPAN_CM} from '../src/glasses/face-topology';

describe('explicit local calibration',()=>{
  it('computes intrinsics from a known planar reference, scales same-aspect dimensions and rejects invalid crops',()=>{
    const k=cameraCalibrationFromReference({imageWidth:1280,imageHeight:720,spanPx:200,spanCm:10,distanceCm:40});
    expect(k.fx).toBe(800);expect(scaleCameraCalibration(k,640,360).fx).toBe(400);
    expect(()=>scaleCameraCalibration(k,640,480)).toThrow('aspect');
    expect(()=>cameraCalibrationFromReference({imageWidth:1280,imageHeight:720,spanPx:NaN,spanCm:10,distanceCm:40})).toThrow();
  });
  it('unprojects off-centre principal points and non-square focal lengths consistently for face/contact',()=>{
    const projection={videoWidth:1280,videoHeight:720,width:400,height:600,fov:63,intrinsics:{imageWidth:1280,imageHeight:720,fx:800,fy:900,cx:620,cy:340}};
    const point={x:0.6,y:0.4,z:0};
    const face=projectFacePoint(point,0,45,projection),hand=unprojectGrip(point,45,projection);
    expect(face.distanceTo(hand)).toBeLessThan(1e-8);
    expect(face.x).toBeCloseTo((768-620)*45/800);expect(face.y).toBeCloseTo((340-288)*45/900);
    const landmarks=Array.from({length:468},()=>point),vertices=new Float32Array(468*3);
    writeFaceVertices(vertices,landmarks,45,projection);
    expect(vertices[0]).toBeCloseTo(face.x,5);expect(vertices[1]).toBeCloseTo(face.y,5);
  });
  it('matches the legacy projection for centred square-pixel calibration including cover crop',()=>{
    const focal=720/(2*Math.tan(63*Math.PI/360));
    const p={videoWidth:1280,videoHeight:720,width:400,height:600,fov:coverCameraFov(63,1280,720,400,600)};
    const k={imageWidth:1280,imageHeight:720,fx:focal,fy:focal,cx:640,cy:360};
    const frame=syntheticFrame(30,-20),a=fitFace(frame.landmarks,frame.matrix,p,DEFAULT_FIT)!,b=fitFace(frame.landmarks,frame.matrix,{...p,intrinsics:k},DEFAULT_FIT)!;
    expect(a.position.distanceTo(b.position)).toBeLessThan(1e-6);expect(a.faceDepth).toBeCloseTo(b.faceDepth,5);
  });
  it('keeps a dimension-calibrated GLB scale independent of face reference and distance',()=>{
    const assetScale=physicalAssetScale({frontWidthMm:140,modelFrontWidth:2.8,source:'supplier'})!;
    expect(assetScale).toBe(5);
    const frame=syntheticFrame(),p={videoWidth:1280,videoHeight:720,width:640,height:360,fov:63};
    const canonical=fitFace(frame.landmarks,frame.matrix,p,DEFAULT_FIT,CANONICAL_EYE_SPAN_CM,assetScale)!;
    const larger=fitFace(frame.landmarks,frame.matrix,p,DEFAULT_FIT,CANONICAL_EYE_SPAN_CM*1.1,assetScale)!;
    expect(larger.scale).toBe(canonical.scale);expect(larger.faceDepth/canonical.faceDepth).toBeCloseTo(1.1);
    expect(()=>physicalAssetScale({frontWidthMm:NaN,modelFrontWidth:1,source:'measured'})).toThrow();
  });
});
