/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
export type SessionStatus = 'idle' | 'requesting-camera' | 'loading-tracker' | 'searching' | 'tracking' | 'paused' | 'error' | 'disposed';
export type GlassesPlacement = 'face' | 'head';
export type RuntimeTimingName='captureDraw'|'bitmap'|'faceInference'|'handInference'|'hairInference'|'fit'|'renderSubmission'|'captureToSubmission'|'resultAge'|'renderInterval';
export interface TimingDistribution {samples:number;meanMs:number|null;p50Ms:number|null;p95Ms:number|null}
/** Software timing/count aggregates only; GPU execution and physical sensor/display latency are not measured. */
export interface RuntimePerformance {
  windowMs:number;
  observedMs:number;
  rates:{captureHz:number|null;faceHz:number|null;handHz:number|null;renderHz:number|null;animationHz:number|null;cameraHz:number|null};
  timings:Record<RuntimeTimingName,TimingDistribution>;
}
/** Transient runtime counters only; contains no face/hand coordinates or poses. */
export interface TrackingHealth {
  phase: 'stopped' | 'starting' | 'running' | 'recovering' | 'failed';
  delegate: 'GPU' | 'CPU' | null;
  framesSent: number;
  resultsReceived: number;
  restarts: number;
  lastLatencyMs: number | null;
  inputWidth: number;
  inputHeight: number;
  /** Present only when runtime diagnostics are subscribed. Five-second window. */
  performance?: RuntimePerformance;
  pixelRatio?: number;
  /** Start-to-tracker-ready including camera permission, playback and model loading. */
  startupMs?: number;
  /** Optional hand graph download/initialization/warmup in the worker clock. */
  handStartupMs?:number;
  hairTracking?:'disabled'|'loading'|'ready'|'unavailable';
  hairStartupMs?:number;
  cameraCompositing?:'disabled'|'active'|'fallback';
  featureFallback?:'device-or-asset'|'optional-startup'|'worker-recovery'|'hand-budget'|'hand-failure'|'hair-budget'|'hair-failure'|'render-budget'|'render-failure';
}
export interface GlassesInteractionState {
  availability: 'disabled' | 'loading' | 'ready' | 'unavailable';
  phase: 'idle' | 'grabbing' | 'dragging' | 'settling';
  placement: GlassesPlacement;
  /** Mounted endpoint: 0 face, 1 crown. Does not constrain free hand motion. */
  progress: number;
  handVisible: boolean;
  /** Contact-gated owners; no hand coordinates or persistent identity. */
  grippingHands:0|1|2;
  /** Fingertips currently near the GLB, from both hands; bounded 0..10. */
  contactFingers:number;
  feedback: 'search-hand' | 'open-to-grab' | 'near-frame' | 'held' | 'held-two-hands' | 'handoff' | 'mounted' | 'mounting' | 'release-near-face';
}

export interface GlassesFit {
  /** Distance between the reference outer-eye anchors, in GLB model units. */
  referenceEyeSpan: number;
  /** Visual size adjustment. This is not a physical face measurement. */
  scale: number;
  /** Model-local bridge adjustment in GLB units: right, up, toward viewer. */
  offset: [number, number, number];
  /** Asset alignment correction in radians (XYZ). */
  rotation: [number, number, number];
}

export interface GlassesAsset {
  url: string;
  fit?: Partial<GlassesFit>;
  /** Explicit front-width calibration; this metadata does not certify a SKU. */
  physicalFit?:{frontWidthMm:number;modelFrontWidth:number;source:'supplier'|'measured'|'approximation'};
}

/** Intrinsics for an undistorted source image, in source pixels. Not inferred
 * from a generic face. Aspect-changing crop requires a different calibration. */
export interface CameraCalibration {imageWidth:number;imageHeight:number;fx:number;fy:number;cx:number;cy:number}

export interface FitState {
  visible: boolean;
  source: 'face-matrix' | 'landmarks';
  yawDegrees: number;
  pitchDegrees: number;
  /** Approximate camera-to-nose-bridge depth in cm, assuming the canonical face size and cameraFov. Not a measured distance. */
  estimatedDistanceCm: number;
  guidance: 'ready' | 'move-closer' | 'center-face' | 'turn-slightly';
}

export interface VirtualTryOnOptions {
  /** Element that receives the SDK-managed video and transparent WebGL canvas. */
  container: HTMLElement;
  /** GLB URL. Its pivot belongs at the nose bridge, with local +X along the eyes, +Y up, and +Z toward the camera. */
  glassesUrl: string;
  /** Override when self-hosting the MediaPipe WASM runtime. */
  wasmRoot?: string;
  /** Override when self-hosting the pinned Face Landmarker model. */
  modelAssetPath?: string;
  /** Cache only the SDK's pinned MediaPipe model/WASM assets in CacheStorage for warm offline starts. Defaults to false. */
  cacheRuntimeAssets?: boolean;
  /** Mirror the preview for a front-facing camera. Defaults to true. */
  mirror?: boolean;
  fit?: Partial<GlassesFit>;
  /** Approximate vertical field of view of the uncropped camera frame. Default 63 degrees. */
  cameraFov?: number;
  cameraCalibration?:CameraCalibration;
  /** Optional user-provided outer-eye reference (cm), not pupillary distance.
   * Transient only; do not persist a biometric fitting profile. */
  faceReferenceEyeSpanCm?:number;
  /** Local video compositing, default true; DOM preview and original lenses are fallback. */
  cameraCompositing?:boolean;
  /** Semantic lens-* meshes only; requires cameraCompositing. Rendering optics,
   * not prescription-lens simulation. Thickness is a supplied approximation. */
  lensOptics?:false|{ior?:number;thicknessMm?:number;transmission?:number};
  /** Optional hair-only mask on semantic rear temples. No anatomical ear/depth
   * segmentation. Default auto for capable devices/semantic assets, false to disable.
   * Model is prepared during explicit camera startup before live frames. */
  hairOcclusion?:false|{modelAssetPath?:string};
  /** Depth-only face mesh plus approximate head/ear volumes hide rear temples. Default true. */
  faceOcclusion?: boolean;
  /** Motion-adaptive pose smoothing. Default true. */
  smoothing?: boolean;
  /** Default auto: bounded prediction on consistent matrix motion, otherwise direct.
   * Explicit interpolation adds up to 50 ms delay. Prediction is capped at 30 ms. */
  presentation?: 'auto' | 'direct' | 'interpolated' | 'predicted';
  /** Experimental measured-budget input (480/640) and DPR (1/1.5) adaptation.
   * Default true with small/lost-face protection and hysteresis. */
  adaptiveQuality?:boolean;
  /** Estimate a subtle light tint from a downsampled local video border. Default true. */
  ambientLighting?: boolean;
  /** Opt-in local contact controller. Model is prepared at startup in the shared worker. */
  handInteraction?: { modelAssetPath?: string };
  onInteractionChange?: (state: GlassesInteractionState) => void;
  onFitStateChange?: (state: FitState) => void;
  onStatusChange?: (status: SessionStatus, message?: string) => void;
  onError?: (error: Error) => void;
  /** Optional local runtime diagnostics. Do not persist histories. */
  onTrackingHealthChange?: (health: TrackingHealth) => void;
}

export interface VirtualTryOn {
  readonly video: HTMLVideoElement;
  readonly canvas: HTMLCanvasElement;
  readonly status: SessionStatus;
  /** Requests camera permission and starts local face tracking. Must follow a user gesture. */
  start(): Promise<void>;
  /** Stops camera tracks and frame processing; safe to call more than once. */
  stop(): void;
  /** Replaces the current GLB. */
  setGlasses(asset: string | GlassesAsset): Promise<void>;
  /** Adjusts the current asset fit without reloading the GLB. */
  setFit(fit: Partial<GlassesFit>): void;
  /** Face or approximate crown placement; also serves as a keyboard/button alternative to hand gestures. */
  setPlacement(placement: GlassesPlacement): void;
  /** Releases camera, worker, renderer, loaded model and event listeners. */
  dispose(): void;
}
