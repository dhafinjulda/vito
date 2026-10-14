/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import type {CameraCalibration,GlassesAsset} from '../types';

export function validateCameraCalibration(input:CameraCalibration):CameraCalibration {
  if(![input.imageWidth,input.imageHeight,input.fx,input.fy,input.cx,input.cy].every(Number.isFinite)||input.imageWidth<=0||input.imageHeight<=0||input.fx<=0||input.fy<=0||input.cx<0||input.cx>input.imageWidth||input.cy<0||input.cy>input.imageHeight)throw new Error('Invalid camera intrinsics. Supply positive source dimensions/focal lengths and a principal point inside the source image.');
  return {...input};
}
export function scaleCameraCalibration(input:CameraCalibration,width:number,height:number):CameraCalibration {
  validateCameraCalibration(input);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||Math.abs(width/height-input.imageWidth/input.imageHeight)/(input.imageWidth/input.imageHeight)>0.01)throw new Error('Camera calibration aspect ratio does not match the source video. Calibrate this camera crop/resolution.');
  const x=width/input.imageWidth,y=height/input.imageHeight;
  return {imageWidth:width,imageHeight:height,fx:input.fx*x,fy:input.fy*y,cx:input.cx*x,cy:input.cy*y};
}
/** Front-facing reference plane with known physical span/distance, not an
 * automatic face measurement. Assumes square pixels and no lens distortion. */
export function cameraCalibrationFromReference(input:{imageWidth:number;imageHeight:number;spanPx:number;spanCm:number;distanceCm:number}):CameraCalibration {
  if(![input.spanPx,input.spanCm,input.distanceCm].every(value=>Number.isFinite(value)&&value>0))throw new Error('Reference span and distance must be positive finite values.');
  const focal=input.spanPx*input.distanceCm/input.spanCm;
  return validateCameraCalibration({imageWidth:input.imageWidth,imageHeight:input.imageHeight,fx:focal,fy:focal,cx:input.imageWidth/2,cy:input.imageHeight/2});
}
export function physicalAssetScale(input:GlassesAsset['physicalFit']):number|null {
  if(!input)return null;
  if(!Number.isFinite(input.frontWidthMm)||input.frontWidthMm<40||input.frontWidthMm>250||!Number.isFinite(input.modelFrontWidth)||input.modelFrontWidth<=0||!['supplier','measured','approximation'].includes(input.source))throw new Error('Invalid physical asset calibration: front width 40–250 mm and a positive modelFrontWidth are required.');
  return input.frontWidthMm/10/input.modelFrontWidth;
}
