/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
export const TRACKER_PROTOCOL_VERSION = 7;

export type WorkerRequest =
  | { type: 'init'; modelAssetPath: string; wasmRoot: string; cacheRuntimeAssets?: boolean; handModelAssetPath?: string; delegate?: 'GPU' | 'CPU'; adaptiveQuality?:boolean;hairModelAssetPath?:string;prewarmOptional?:boolean;hairAuto?:boolean;inputWidth?:number;inputHeight?:number }
  | { type: 'frame'; bitmap: ImageBitmap; timestampMs: number }
  | { type: 'enable-hands' }
  | { type: 'enable-hair' }
  | { type: 'disable-hair' }
  | { type:'hair-activity';active:boolean }
  | { type: 'hand-activity'; active:boolean }
  | { type: 'dispose' };

export type WorkerResponse =
  | { type:'face-ready' }
  | { type: 'ready'; protocolVersion: number; handTracking?: 'loading' | 'ready' | 'unavailable' | 'disabled';hairTracking?:'ready'|'unavailable'|'disabled'; delegate?: 'GPU' | 'CPU' }
  | { type: 'result'; landmarks: Array<{ x: number; y: number; z: number }> | null; faceMatrix: number[] | null; timestampMs: number; faceInferenceMs?: number; handLandmarks?: Array<{ x: number; y: number; z: number }> | null }
  | { type: 'error'; message: string }
  | { type: 'hand-result'; hands: Array<{landmarks:Array<{x:number;y:number;z:number}>;handedness:string}>; timestampMs:number; handInferenceMs?:number }
  | { type: 'frame-done'; timestampMs:number }
  | { type: 'hand-unavailable';reason?:'budget'|'failure' }
  | { type: 'hand-loading' }
  | { type: 'hand-ready'; startupMs?:number }
  | { type: 'hair-loading' }
  | { type: 'hair-ready'; startupMs:number }
  | { type: 'hair-unavailable';reason?:'budget'|'failure' }
  | { type: 'hair-result';data:Uint8Array;width:number;height:number;timestampMs:number;inferenceMs:number }
  | { type: 'disposed' };
