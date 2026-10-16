/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { FitState, GlassesAsset, GlassesFit,CameraCalibration,VirtualTryOnOptions } from '../types';
import {CameraBackground} from './CameraBackground';
import {installLensOptics,type LensOpticsHandle} from './LensOptics';
import {HairMask} from './HairMask';
import {physicalAssetScale,scaleCameraCalibration,validateCameraCalibration} from '../glasses/calibration';
import {readEmbeddedGlassesMetadata} from '../glasses/asset-metadata';
import type { FaceLandmark3D } from '../glasses/pose';
import { coverCameraFov, fitFace, resolveFit, writeFaceVertices, type Projection, type FacePose } from '../glasses/fitting';
import { FACE_TRIANGLES } from '../glasses/face-topology';
import { PoseSmoother } from '../glasses/PoseSmoother';
import { HeadOccluder } from './HeadOccluder';
import { installTempleEffects, type TempleEffectsHandle } from './TempleEffects';
import { applyLocalAmbientEstimate, LocalAmbientEstimator, type LocalAmbientEstimate } from './LocalAmbientEstimator';
import { placedGlassesPose } from '../interaction/placement';
import type { GrabContext, HeldPose, TrackedHand } from '../interaction/HandGrip';
import { unprojectGrip } from '../interaction/HandGrip';
import { HandOccluder } from './HandOccluder';
import { PosePresentation } from '../glasses/PosePresentation';

export interface RendererOptions { fit?: Partial<GlassesFit>; cameraFov?: number; faceOcclusion?: boolean; smoothing?: boolean; ambientLighting?: boolean; presentation?: 'auto'|'direct'|'interpolated'|'predicted';cameraCalibration?:CameraCalibration;faceReferenceEyeSpanCm?:number;lensOptics?:VirtualTryOnOptions['lensOptics'];hairOcclusion?:boolean }
export interface HandOcclusionSample {hand:TrackedHand;depth:number;anchorZ?:number}

export class GlassesRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly occluder: THREE.Mesh;
  readonly headOccluder: HeadOccluder;
  readonly handOccluder:HandOccluder;
  readonly handOccluders:readonly [HandOccluder,HandOccluder];
  private heldPose:HeldPose|null=null;
  private faceMount:HeldPose|null=null;
  private headMount:HeldPose|null=null;
  private projection:Projection|null=null;
  private effectsEnabled=true;
  private current: THREE.Group | null = null;
  private templeEffects: TempleEffectsHandle | null = null;
  private visible = false;
  private placementProgress = 0;
  private disposed = false;
  private loadRevision = 0;
  private dirty = true;
  private fit: GlassesFit;
  private readonly initialFitOverrides:Partial<GlassesFit>;
  private initialAssetLoaded=false;
  private assetScale:number|null=null;
  private cameraBackground:CameraBackground|null=null;
  private optics:LensOpticsHandle|null=null;
  private compositingFallback=false;
  private hairFallback=false;
  private videoUploadFailed=false;
  private restoreUploadGuard:(()=>void)|null=null;
  private readonly hairMask:HairMask|null;
  private readonly drawingSize=new THREE.Vector2();
  private readonly loader = new GLTFLoader();
  private assetAbort:AbortController|null=null;
  private readonly smoother = new PoseSmoother();
  private readonly presentation:PosePresentation;
  private readonly referenceHead=new THREE.Matrix4();
  private readonly presentedHead=new THREE.Matrix4();
  private latestPose:FacePose|null=null;
  private presentedPose:FacePose|null=null;
  private readonly ambientEstimator = new LocalAmbientEstimator();
  private readonly ambientCanvas = document.createElement('canvas');
  private readonly ambientContext: CanvasRenderingContext2D | null;
  private ambientLight: THREE.HemisphereLight | null = null;
  private lastAmbientSampleAt = -Infinity;
  private readonly vertices = new Float32Array(468 * 3);
  private readonly faceCorrection = new THREE.Matrix4();
  private readonly rawHeadTransform = new THREE.Matrix4();
  private readonly unitScale = new THREE.Vector3(1, 1, 1);
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly contactRay=new THREE.Raycaster();
  private readonly contactHits:THREE.Intersection[]=[];
  private readonly contactBox=new THREE.Box3();
  private readonly contactCenter=new THREE.Vector3();
  private readonly contactPoint=new THREE.Vector3();
  private readonly contactCandidate=new THREE.Vector3();
  private contactBounds:Array<{mesh:THREE.Mesh;local:THREE.Box3|null}>=[];
  private lastFrame: { landmarks: FaceLandmark3D[]; width: number; height: number; matrix: number[] | null; timestamp: number;mediaTime?:number } | null = null;

  constructor(readonly canvas: HTMLCanvasElement, private readonly options: RendererOptions = {}) {
    this.fit = resolveFit(options.fit);
    this.initialFitOverrides={...options.fit,...(options.fit?.offset?{offset:[...options.fit.offset] as GlassesFit['offset']}:{}),...(options.fit?.rotation?{rotation:[...options.fit.rotation] as GlassesFit['rotation']}: {})};
    this.hairMask=options.hairOcclusion?new HairMask():null;
    if(options.cameraCalibration)validateCameraCalibration(options.cameraCalibration);
    if(options.faceReferenceEyeSpanCm!==undefined&&(!Number.isFinite(options.faceReferenceEyeSpanCm)||options.faceReferenceEyeSpanCm<3||options.faceReferenceEyeSpanCm>14))throw new Error('Invalid faceReferenceEyeSpanCm: expected outer-eye span between 3 and 14 cm.');
    this.presentation=new PosePresentation(options.presentation);
    this.ambientCanvas.width = 32;
    this.ambientCanvas.height = 24;
    this.ambientContext = this.ambientCanvas.getContext('2d', { willReadFrequently: true });
    const fov = options.cameraFov ?? 63;
    if (!Number.isFinite(fov) || fov < 35 || fov > 95) throw new Error('cameraFov must be between 35 and 95 degrees.');
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    room.dispose();
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xfff5e7, 2.2);
    key.position.set(4, 8, 10);
    const fill = new THREE.DirectionalLight(0xe5eeff, 1.2);
    fill.position.set(-6, 3, 3);
    this.scene.add(key, fill);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.vertices, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(new THREE.BufferAttribute(FACE_TRIANGLES, 1));
    const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
    this.occluder = new THREE.Mesh(geometry, material);
    this.occluder.matrixAutoUpdate=false;
    this.occluder.renderOrder = -100;
    this.occluder.frustumCulled = false;
    this.occluder.visible = false;
    this.scene.add(this.occluder);
    this.headOccluder = new HeadOccluder(material);
    this.scene.add(this.headOccluder);
    this.handOccluders=[new HandOccluder(material),new HandOccluder(material)];
    this.handOccluder=this.handOccluders[0];this.scene.add(...this.handOccluders);
    this.resize();
  }

  async load(asset: string | GlassesAsset): Promise<void> {
    if (this.disposed) throw new Error('Renderer is disposed.');
    const descriptor = typeof asset === 'string' ? { url: asset } : asset;
    const descriptorFit = descriptor.fit ? resolveFit(descriptor.fit) : null;
    const descriptorAssetScale=physicalAssetScale(descriptor.physicalFit);
    const revision = ++this.loadRevision;
    this.assetAbort?.abort();
    const abort=new AbortController();this.assetAbort=abort;
    let gltf;
    try {
      const response=await fetch(descriptor.url,{signal:abort.signal});
      if(!response.ok)throw new Error(`Glasses asset request failed (${response.status}).`);
      const bytes=await response.arrayBuffer();
      const absolute=new URL(descriptor.url,document.baseURI);
      const base=absolute.protocol==='blob:'||absolute.protocol==='data:'?'':new URL('.',absolute).href;
      gltf=await this.loader.parseAsync(bytes,base);
    } catch(error) {if(this.disposed||revision!==this.loadRevision)return;throw error;}
    finally {if(this.assetAbort===abort)this.assetAbort=null;}
    if (this.disposed || revision !== this.loadRevision) { this.disposeObject(gltf.scene); return; }
    let nextFit:GlassesFit,nextAssetScale:number|null;
    try {
      const embedded=readEmbeddedGlassesMetadata(gltf.scene.userData);
      // Explicit per-asset overrides win. Constructor adjustments apply to the
      // initial asset only; changing generated URL adopts that asset's own fit.
      const embeddedFit=embedded&&!this.initialAssetLoaded?resolveFit(this.initialFitOverrides,embedded.fit):embedded?.fit;
      nextFit=embeddedFit?resolveFit(descriptor.fit??{},embeddedFit):descriptorFit??this.fit;
      nextAssetScale=descriptorAssetScale??physicalAssetScale(embedded?.physicalFit);
    } catch(error) {this.disposeObject(gltf.scene);throw error;}
    const unitRatio=nextFit.referenceEyeSpan/1.45;
    const templeEffects = installTempleEffects(gltf.scene,{fadeStartZ:-1.35*unitRatio,fadeWidth:.48*unitRatio});
    const optics=this.options.lensOptics&&!this.compositingFallback?installLensOptics(gltf.scene,this.options.lensOptics):null;
    this.hairMask?.uninstall();this.optics?.restore();
    if (this.current) { this.scene.remove(this.current); this.disposeObject(this.current); }
    this.current = gltf.scene;
    this.templeEffects = templeEffects;
    this.optics=optics;
    if(!this.hairFallback)this.hairMask?.install(gltf.scene,nextFit.referenceEyeSpan);
    this.current.visible = false;
    this.current.traverse(node => {
      const mesh = node as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) if (material.transparent) material.depthWrite = false;
    });
    this.fit = nextFit;
    this.initialAssetLoaded=true;
    this.assetScale=nextAssetScale;
    this.scene.add(this.current);
    this.contactBounds=[];
    this.current.traverse(node=>{
      if(!(node instanceof THREE.Mesh))return;
      node.geometry.computeBoundingBox();
      const rigid=!(node instanceof THREE.SkinnedMesh)&&!node.morphTargetInfluences?.length&&node.children.length===0;
      this.contactBounds.push({mesh:node,local:rigid?node.geometry.boundingBox?.clone()??null:null});
    });
    this.smoother.reset();
    this.reapplyFrame();
  }

  setFit(adjustment: Partial<GlassesFit>): void {
    if (this.disposed) return;
    const previousReference=this.fit.referenceEyeSpan;
    this.fit = resolveFit(adjustment, this.fit);
    if(this.fit.referenceEyeSpan!==previousReference) {
      const ratio=this.fit.referenceEyeSpan/1.45;
      this.templeEffects?.setFadeRange(-1.35*ratio,.48*ratio);
      this.hairMask?.setReferenceEyeSpan(this.fit.referenceEyeSpan);
    }
    this.smoother.reset();
    this.reapplyFrame();
  }

  setPlacementProgress(progress: number, reapply = true): void {
    if (this.disposed) return;
    const next=THREE.MathUtils.clamp(progress,0,1);if(next===this.placementProgress) return;this.placementProgress=next;
    if (reapply) this.reapplyFrame();
  }

  /** Internal diagnostic control; production integrations use the SDK API. */
  setTempleEffectsEnabled(enabled: boolean): void {
    this.effectsEnabled=enabled;this.templeEffects?.setEnabled(this.heldPose?false:enabled);
    this.dirty = true;
  }

  /** Number of named GLB temple meshes that received the shader adaptation. */
  get templeEffectMeshCount(): number { return this.templeEffects?.meshCount ?? 0; }
  get pixelRatio():number {return this.renderer.getPixelRatio();}
  get cameraBackgroundReady():boolean {return this.cameraBackground?.ready??false;}
  get hasVideoUploadFailure():boolean {return this.videoUploadFailed;}
  disableCameraCompositing():void {this.compositingFallback=true;this.setCameraVideo(null);this.optics?.restore();this.optics=null;this.dirty=true;}
  disableHairOcclusion():void {this.hairFallback=true;this.hairMask?.uninstall();this.dirty=true;}
  resetFeatureFallbacks():void {
    this.compositingFallback=this.hairFallback=false;this.optics?.restore();this.optics=null;
    if(this.current){if(this.options.lensOptics)this.optics=installLensOptics(this.current,this.options.lensOptics);this.hairMask?.install(this.current,this.fit.referenceEyeSpan);}
    this.dirty=true;
  }
  /** Compile owned materials during startup, before feeding live face frames. */
  warmup():void {if(!this.disposed)this.renderer.compile(this.scene,this.camera);}
  /** Checked only after a draw; no GPU synchronization/readback. */
  get hasShaderFailure():boolean {return this.renderer.info.programs?.some(program=>(program as unknown as {diagnostics?:{runnable?:boolean}}).diagnostics?.runnable===false)??false;}
  setCameraVideo(video:HTMLVideoElement|null):void {
    this.restoreUploadGuard?.();this.restoreUploadGuard=null;this.videoUploadFailed=false;
    if(video) {
      const gl=this.renderer.getContext(),original=gl.texImage2D;
      // WebGLState catches/logs upload exceptions internally. Retain only a
      // failure flag, so the SDK can restore DOM preview without GPU readback.
      const guarded=function(this:typeof gl,...args:unknown[]) {
        try {(original as (...values:unknown[])=>void).apply(this,args);}
        catch(error){if(args.some(value=>value===video))recordFailure();throw error;}
      };
      const recordFailure=()=>{this.videoUploadFailed=true;};
      gl.texImage2D=guarded as typeof original;
      this.restoreUploadGuard=()=>{if(gl.texImage2D===guarded)gl.texImage2D=original;};
    }
    this.cameraBackground?.dispose();this.cameraBackground=video?new CameraBackground(this.scene,video):null;this.dirty=true;
  }
  setHairMask(data:Uint8Array,width:number,height:number,timestamp:number):boolean {
    const accepted=this.hairMask?.set(data,width,height,timestamp,this.latestPose)??false;
    if(accepted)this.dirty=true;else data.fill(0);return accepted;
  }
  clearHairMask():void {this.hairMask?.clear();this.dirty=true;}
  setPixelRatioCap(cap:1|1.5):void {
    const ratio=Math.min(window.devicePixelRatio||1,cap);
    if(this.disposed||ratio===this.renderer.getPixelRatio())return;
    this.renderer.setPixelRatio(ratio);this.dirty=true;
  }

  /** Internal opt-in light probe for development evaluation; pixels are never retained. */
  setLocalAmbientSample(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, timestampMs = performance.now()): LocalAmbientEstimate | null {
    const estimate = this.ambientEstimator.update(rgba, width, height, timestampMs);
    if (!estimate) return null;
    this.ambientLight ??= new THREE.HemisphereLight(0xffffff, 0x24211f, 0.2);
    if (!this.ambientLight.parent) this.scene.add(this.ambientLight);
    applyLocalAmbientEstimate(this.ambientLight, estimate);
    this.dirty = true;
    return estimate;
  }

  /** Samples a tiny camera border in memory at most twice per second; source pixels are discarded immediately. */
  updateAmbientFromVideo(video: HTMLVideoElement, timestampMs = performance.now()): void {
    if (this.options.ambientLighting === false || !this.ambientContext || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || timestampMs - this.lastAmbientSampleAt < 500) return;
    this.lastAmbientSampleAt = timestampMs;
    try {
      this.ambientContext.drawImage(video, 0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
      const pixels = this.ambientContext.getImageData(0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
      this.setLocalAmbientSample(pixels.data, pixels.width, pixels.height, timestampMs);
    } catch {
      // A failed readback disables this sample only; tracking/rendering continue.
    } finally {
      this.ambientContext.clearRect(0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
    }
  }

  /** Removes the experimental local ambient contribution and its temporal state. */
  clearLocalAmbientSample(): void {
    this.ambientEstimator.reset();
    this.lastAmbientSampleAt = -Infinity;
    this.ambientContext?.clearRect(0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
    if (this.ambientLight) this.scene.remove(this.ambientLight);
    this.ambientLight = null;
    this.dirty = true;
  }

  resize(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.projection=null;
    this.dirty = true;
    this.smoother.reset();
    this.reapplyFrame();
  }

  private reapplyFrame(): void {
    this.presentation.reset();
    const frame = this.lastFrame;
    if (frame) this.setPose(frame.landmarks, frame.width, frame.height, frame.matrix, frame.timestamp,frame.mediaTime);
  }

  getGrabContext():GrabContext|null {
    if(!this.current||!this.projection) return null;
    const rect=this.canvas.getBoundingClientRect();
    if(!rect.width||!rect.height) return null;
    const p=this.updateProjection(this.projection.videoWidth,this.projection.videoHeight,rect.width,rect.height);
    this.current.updateMatrixWorld(true);
    return {projection:p,asset:{position:this.current.position.clone(),rotation:this.current.quaternion.clone(),scale:this.current.scale.x},face:this.faceMount,head:this.headMount,
      contactAt:point=>{
        if(!this.visible) return null;
        const ray=this.contactRay,near=unprojectGrip(point,1,p);ray.ray.origin.set(0,0,0);ray.ray.direction.copy(near).normalize();
        this.contactHits.length=0;
        const hit=ray.intersectObject(this.current!,true,this.contactHits)[0];
        const hitPoint=hit?.point.clone()??null;this.contactHits.length=0;
        if(hitPoint)return hitPoint;
        let closest:THREE.Vector3|null=null,best=1.4;
        for(const {mesh,local} of this.contactBounds) {
          const box=local?this.contactBox.copy(local).applyMatrix4(mesh.matrixWorld):this.contactBox.setFromObject(mesh),center=box.getCenter(this.contactCenter);
          if(center.z>=-5)continue;
          const projected=unprojectGrip(point,-center.z,p),contact=box.clampPoint(projected,this.contactCandidate),distance=projected.distanceTo(contact);
          if(distance<best) {best=distance;this.contactPoint.copy(contact);closest=this.contactPoint;}
        }return closest?.clone()??null;
      }};
  }

  private updateProjection(videoWidth:number,videoHeight:number,width:number,height:number):Projection {
    const previous=this.projection;
    if(previous&&previous.videoWidth===videoWidth&&previous.videoHeight===videoHeight&&previous.width===width&&previous.height===height)return previous;
    const fov=coverCameraFov(this.options.cameraFov??63,videoWidth,videoHeight,width,height);
    this.camera.fov=fov;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    const intrinsics=this.options.cameraCalibration?scaleCameraCalibration(this.options.cameraCalibration,videoWidth,videoHeight):undefined;
    if(intrinsics) {
      const scale=Math.max(width/videoWidth,height/videoHeight),cx=intrinsics.cx*scale-(videoWidth*scale-width)/2,cy=intrinsics.cy*scale-(videoHeight*scale-height)/2,n=this.camera.near;
      this.camera.projectionMatrix.makePerspective(-cx/(intrinsics.fx*scale)*n,(width-cx)/(intrinsics.fx*scale)*n,cy/(intrinsics.fy*scale)*n,-(height-cy)/(intrinsics.fy*scale)*n,n,this.camera.far);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    }
    return this.projection={videoWidth,videoHeight,width,height,fov,intrinsics};
  }

  setHeldPose(pose:HeldPose|null,occludingHands?:readonly HandOcclusionSample[]|HandOcclusionSample|null):void {
    if(this.disposed)return;
    const wasHolding=!!this.heldPose;this.heldPose=pose;
    if(wasHolding!==!!pose){this.presentation.reset();if(pose)this.reapplyFrame();}
    this.templeEffects?.setEnabled(pose?false:this.effectsEnabled);
    if(pose&&this.current) {
      this.current.position.copy(pose.position);this.current.quaternion.copy(pose.rotation);this.current.scale.setScalar(pose.scale);this.current.visible=this.visible=true;
    } else if(wasHolding) {if(this.lastFrame) this.reapplyFrame();else this.hide();}
    // Contact-gated hands may cover a mounted asset before grip acquisition.
    // The controller owns contact eligibility; the renderer retains no samples.
    const samples=Array.isArray(occludingHands)?occludingHands:occludingHands?[occludingHands as HandOcclusionSample]:[];
    const p=samples.length&&this.current&&this.visible?this.getGrabContext()?.projection:null;
    this.handOccluders.forEach((occluder,index)=>{const sample=samples[index];if(p&&sample)occluder.update(sample.hand,sample.depth,p,sample.anchorZ);else occluder.clearSample();});
    this.dirty=true;
  }

  setPose(landmarks: FaceLandmark3D[] | null, videoWidth: number, videoHeight: number, matrix: number[] | null = null, timestampMs = performance.now(),mediaTime?:number): FitState | null {
    if (!landmarks || !this.current || this.disposed) { this.hide(); return null; }
    const rect = this.canvas.getBoundingClientRect();
    if (!videoWidth || !videoHeight || !rect.width || !rect.height) { this.hide(); return null; }
    const projection=this.updateProjection(videoWidth,videoHeight,rect.width,rect.height);
    const rawPose = fitFace(landmarks, matrix, projection, this.fit,this.options.faceReferenceEyeSpanCm,this.assetScale);
    if (!rawPose) { this.hide(); return null; }
    this.lastFrame = { landmarks, width: videoWidth, height: videoHeight, matrix, timestamp: timestampMs,mediaTime };
    if (!rawPose.state.visible) { this.hide(false); return rawPose.state; }
    const { pose } = this.smoother.update(rawPose, timestampMs, this.options.smoothing !== false);
    this.latestPose=pose;
    const receivedMs=Math.max(timestampMs,performance.now());
    if(!this.presentation.ingest(pose,timestampMs,receivedMs,mediaTime)){this.hide();return null;}
    // Face, skull and asset share a rigid correction; independently averaging
    // world-space mesh vertices caused temporal mask drift while turning.
    this.rawHeadTransform.compose(rawPose.headPosition, rawPose.headRotation, this.unitScale).invert();
    this.faceCorrection.compose(pose.headPosition, pose.headRotation, this.unitScale).multiply(this.rawHeadTransform);
    this.referenceHead.compose(pose.headPosition,pose.headRotation,this.unitScale).invert();
    writeFaceVertices(this.vertices, landmarks, rawPose.faceDepth, projection, 1, this.faceCorrection);
    this.occluder.geometry.attributes.position!.needsUpdate = true;
    this.occluder.visible = this.options.faceOcclusion !== false;
    if(!this.options.presentation||this.options.presentation==='direct')this.applyPresentedPose(pose);
    this.dirty = true;
    return pose.state;
  }

  private applyPresentedPose(pose:FacePose):void {
    if(!this.current)return;
    this.presentedPose=pose;
    this.faceMount??={position:new THREE.Vector3(),rotation:new THREE.Quaternion(),scale:pose.scale};
    this.faceMount.position.copy(pose.position);this.faceMount.rotation.copy(pose.rotation);this.faceMount.scale=pose.scale;
    const head=placedGlassesPose(pose,1);
    this.headMount??={position:new THREE.Vector3(),rotation:new THREE.Quaternion(),scale:pose.scale};
    this.headMount.position.copy(head.position);this.headMount.rotation.copy(head.rotation);this.headMount.scale=pose.scale;
    const placed=this.heldPose??(this.placementProgress>0?placedGlassesPose(pose,this.placementProgress):pose);
    const scale=this.heldPose?.scale??pose.scale;
    if(!this.current.position.equals(placed.position)||this.current.quaternion.angleTo(placed.rotation)>1e-7||this.current.scale.x!==scale)this.dirty=true;
    this.current.position.copy(placed.position);this.current.quaternion.copy(placed.rotation);this.current.scale.setScalar(scale);
    this.optics?.setScale(scale);
    if(this.options.presentation&&this.options.presentation!=='direct')this.presentedHead.compose(pose.headPosition,pose.headRotation,this.unitScale).multiply(this.referenceHead);
    else this.presentedHead.identity();
    if(!this.occluder.matrix.equals(this.presentedHead))this.dirty=true;
    this.occluder.matrix.copy(this.presentedHead);this.occluder.matrixWorldNeedsUpdate=true;
    this.headOccluder.update(pose);this.headOccluder.visible=this.occluder.visible;
    this.current.visible=this.visible=true;
  }

  private hide(clearFrame = true): void {
    if (this.visible) this.dirty = true;
    this.visible = !!this.heldPose;
    if(!this.heldPose)this.handOccluders.forEach(occluder=>occluder.clearSample());
    if (this.current) this.current.visible = !!this.heldPose;
    this.faceMount=this.headMount=null;
    this.occluder.visible = false;
    this.headOccluder.visible = false;
    this.hairMask?.clear();
    this.smoother.reset();
    this.presentation.reset();this.latestPose=null;
    this.presentedPose=null;
    this.occluder.matrix.identity();this.occluder.matrixWorldNeedsUpdate=true;
    if (clearFrame) this.lastFrame = null;
  }

  /** Skip duplicate draws between tracking frames; force is for renderer diagnostics. */
  render(force = false, timestampMs=performance.now(),mediaTime?:number): boolean {
    if(!this.disposed&&this.cameraBackground){const rect=this.canvas.getBoundingClientRect();if(this.cameraBackground.update(rect.width,rect.height,mediaTime??0))this.dirty=true;}
    if(!this.disposed&&this.latestPose&&this.options.presentation&&this.options.presentation!=='direct') {
      const pose=this.presentation.sample(timestampMs,mediaTime);
      if(pose)this.applyPresentedPose(pose);
    }
    if(!this.disposed&&this.projection&&this.hairMask) {
      const p=this.projection;this.renderer.getDrawingBufferSize(this.drawingSize);
      if(this.hairMask.update(timestampMs,this.presentedPose,this.visible&&!this.heldPose&&this.placementProgress<0.05,p.videoWidth,p.videoHeight,p.width,p.height,this.drawingSize))this.dirty=true;
    }
    if (!this.disposed && (this.dirty || force)) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
      return true;
    }
    return false;
  }

  cancelPendingLoad():void {this.loadRevision++;this.assetAbort?.abort();this.assetAbort=null;}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadRevision++;
    this.assetAbort?.abort();this.assetAbort=null;
    this.hide();
    this.hairMask?.uninstall();this.optics?.restore();
    if (this.current) { this.scene.remove(this.current); this.disposeObject(this.current); this.current = null; }
    this.contactBounds.length=this.contactHits.length=0;this.projection=null;
    this.templeEffects = null;
    this.optics=null;this.setCameraVideo(null);
    this.hairMask?.dispose();
    this.occluder.geometry.dispose();
    this.headOccluder.dispose();
    this.handOccluders.forEach(occluder=>occluder.dispose());this.heldPose=null;
    (this.occluder.material as THREE.Material).dispose();
    this.environment.dispose();
    this.clearLocalAmbientSample();
    this.ambientCanvas.width = 0;
    this.ambientCanvas.height = 0;
    this.scene.environment = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private disposeObject(root: THREE.Object3D): void {
    const textures = new Set<THREE.Texture>();
    root.traverse(node => {
      const mesh = node as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
    });
    textures.forEach(texture => texture.dispose());
  }
}
