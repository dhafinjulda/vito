/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {afterEach,describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import type {GlassesFit} from '../src/types';
import {readEmbeddedGlassesMetadata} from '../src/glasses/asset-metadata';
import {DEFAULT_FIT,resolveFit} from '../src/glasses/fitting';
import {GlassesRenderer} from '../src/rendering/GlassesRenderer';

function metadata() {
  return {vtoGlasses:{sdk:{version:1,units:'meters',pivot:'nose-bridge',fit:{referenceEyeSpan:.09,scale:1,offset:[0,0,.003],rotation:[0,0,0]},physicalFit:{frontWidthMm:140,modelFrontWidth:.14,source:'approximation'}}}};
}
function scene(data:unknown={}) {
  const root=new THREE.Group();root.userData=data as Record<string,unknown>;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.14,.04,.003),new THREE.MeshStandardMaterial());root.add(mesh);
  const geometryDisposed=vi.spyOn(mesh.geometry,'dispose'),materialDisposed=vi.spyOn(mesh.material,'dispose');
  return {root,geometryDisposed,materialDisposed};
}
afterEach(()=>vi.unstubAllGlobals());
function renderer(initial:Partial<GlassesFit>={}) {
  // Exercise the actual asynchronous loader/commit without a browser WebGL
  // constructor. All scene/material disposal remains the real implementation.
  vi.stubGlobal('document',{baseURI:'https://test.invalid/'});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}));
  const target=Object.create(GlassesRenderer.prototype) as GlassesRenderer;
  const parseAsync=vi.fn(),state={disposed:false,loadRevision:0,initialAssetLoaded:false,initialFitOverrides:initial,fit:resolveFit(initial),assetScale:null as number|null,current:null as THREE.Group|null,options:{},hairMask:null,optics:null,compositingFallback:false,hairFallback:false,scene:new THREE.Scene(),loader:{parseAsync},smoother:{reset:vi.fn()},reapplyFrame:vi.fn(),contactBounds:[]};
  Object.assign(target,state);
  return {target,parseAsync,get state(){return target as unknown as typeof state;}};
}

describe('generated GLB embedded SDK contract',()=>{
  it('adopts a copied bounded metre fit without importing the generator',()=>{
    const input=metadata(),result=readEmbeddedGlassesMetadata(input)!;
    expect(result.fit).toEqual({referenceEyeSpan:.09,scale:1,offset:[0,0,.003],rotation:[0,0,0]});
    expect(result.physicalFit).toEqual({frontWidthMm:140,modelFrontWidth:.14,source:'approximation'});
    input.vtoGlasses.sdk.fit.offset[2]=.02;input.vtoGlasses.sdk.physicalFit.frontWidthMm=180;
    expect(result.fit.offset[2]).toBe(.003);expect(result.physicalFit.frontWidthMm).toBe(140);
  });
  it('does not infer a contract from ordinary GLB extras',()=>{
    for(const data of [undefined,null,[],{}, {vtoGlasses:{recipe:{type:'round'}}},{vtoGlasses:null},{other:{sdk:{version:1}}}])expect(readEmbeddedGlassesMetadata(data)).toBeNull();
  });
  it.each([
    ['unsupported version',(sdk:any)=>{sdk.version=2;}],
    ['unsupported units',(sdk:any)=>{sdk.units='centimeters';}],
    ['unsupported pivot',(sdk:any)=>{sdk.pivot='scene-center';}],
    ['missing fit',(sdk:any)=>{delete sdk.fit;}],
    ['missing physical fit',(sdk:any)=>{delete sdk.physicalFit;}],
    ['non-finite reference',(sdk:any)=>{sdk.fit.referenceEyeSpan=Infinity;}],
    ['wrong reference units',(sdk:any)=>{sdk.fit.referenceEyeSpan=9;}],
    ['reference too small',(sdk:any)=>{sdk.fit.referenceEyeSpan=.001;}],
    ['visual scale out of bounds',(sdk:any)=>{sdk.fit.scale=5;}],
    ['numeric string',(sdk:any)=>{sdk.fit.scale='1';}],
    ['non-array offset',(sdk:any)=>{sdk.fit.offset={0:0,1:0,2:0,length:3};}],
    ['wrong offset length',(sdk:any)=>{sdk.fit.offset=[0,0];}],
    ['unbounded offset',(sdk:any)=>{sdk.fit.offset=[0,0,1];}],
    ['unbounded rotation',(sdk:any)=>{sdk.fit.rotation=[0,0,9];}],
    ['non-finite rotation',(sdk:any)=>{sdk.fit.rotation=[NaN,0,0];}],
    ['invalid front width',(sdk:any)=>{sdk.physicalFit.frontWidthMm=400;}],
    ['wrong model units',(sdk:any)=>{sdk.physicalFit.modelFrontWidth=14;}],
    ['zero model width',(sdk:any)=>{sdk.physicalFit.modelFrontWidth=0;}],
    ['invalid provenance',(sdk:any)=>{sdk.physicalFit.source='certified';}],
  ])('rejects declared %s',(_label,mutate)=>{
    const data=metadata();mutate(data.vtoGlasses.sdk);expect(()=>readEmbeddedGlassesMetadata(data)).toThrow('embedded glasses SDK contract');
  });
  it('rejects a declared null or missing-value contract',()=>{
    expect(()=>readEmbeddedGlassesMetadata({vtoGlasses:{sdk:null}})).toThrow();
    expect(()=>readEmbeddedGlassesMetadata({vtoGlasses:{sdk:undefined}})).toThrow();
  });
  it('copies only safe fitting fields and ignores unrelated URLs',()=>{
    const data=metadata();Object.assign(data.vtoGlasses.sdk,{url:'https://invalid.example/model.glb',script:'ignored'});
    Object.assign(data.vtoGlasses.sdk.fit,{url:'https://invalid.example/calibration'});
    expect(Object.keys(readEmbeddedGlassesMetadata(data)!)).toEqual(['fit','physicalFit']);
    expect(Object.keys(readEmbeddedGlassesMetadata(data)!.fit)).toEqual(['referenceEyeSpan','scale','offset','rotation']);
  });
});

describe('renderer embedded metadata lifecycle',()=>{
  it('aborts a superseded fetch without installing it or disturbing the latest asset',async()=>{
    const {target,parseAsync,state}=renderer(),latest=scene(metadata());
    let signal:AbortSignal|undefined;
    vi.mocked(fetch).mockImplementationOnce((_url,options)=>new Promise((_resolve,reject)=>{
      signal=options!.signal!;signal.addEventListener('abort',()=>reject(signal!.reason),{once:true});
    }));
    parseAsync.mockResolvedValue({scene:latest.root});
    const old=target.load('old.glb'),current=target.load('new.glb');
    await Promise.all([old,current]);expect(signal!.aborted).toBe(true);
    expect(state.current).toBe(latest.root);expect(parseAsync).toHaveBeenCalledOnce();
  });
  it('invalidates a parse that finishes after timeout cancellation and disposes its geometry',async()=>{
    const {target,parseAsync,state}=renderer(),late=scene(metadata());
    let finish!:(value:{scene:THREE.Group})=>void;
    parseAsync.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const pending=target.load('late.glb');await vi.waitFor(()=>expect(parseAsync).toHaveBeenCalledOnce());
    target.cancelPendingLoad();finish({scene:late.root});await pending;
    expect(state.current).toBeNull();expect(late.geometryDisposed).toHaveBeenCalledOnce();expect(late.materialDisposed).toHaveBeenCalledOnce();
  });
  it('adopts generated URL metadata, consumes initial overrides once, and prioritizes per-asset fields',async()=>{
    const {target,parseAsync,state}=renderer({scale:1.2,offset:[0,.001,.002]});
    const first=scene(metadata());parseAsync.mockResolvedValueOnce({scene:first.root});
    await target.load({url:'initial.glb',fit:{scale:1.4}});
    expect(state.fit).toEqual({referenceEyeSpan:.09,scale:1.4,offset:[0,.001,.002],rotation:[0,0,0]});expect(state.assetScale).toBeCloseTo(100);
    target.setFit({scale:2,offset:[0,.02,0]});
    const nextData=metadata();nextData.vtoGlasses.sdk.fit.referenceEyeSpan=.1;nextData.vtoGlasses.sdk.fit.offset=[0,0,.004];
    const second=scene(nextData);parseAsync.mockResolvedValueOnce({scene:second.root});await target.load('next.glb');
    expect(state.fit).toEqual({referenceEyeSpan:.1,scale:1,offset:[0,0,.004],rotation:[0,0,0]});expect(state.current).toBe(second.root);
    expect(first.geometryDisposed).toHaveBeenCalledTimes(1);expect(first.materialDisposed).toHaveBeenCalledTimes(1);
  });
  it('per-asset physical calibration wins over embedded approximation',async()=>{
    const {target,parseAsync,state}=renderer(),model=scene(metadata());parseAsync.mockResolvedValue({scene:model.root});
    await target.load({url:'generated.glb',fit:{offset:[0,.002,0]},physicalFit:{frontWidthMm:150,modelFrontWidth:.14,source:'measured'}});
    expect(state.assetScale).toBeCloseTo(15/.14);expect(state.fit.referenceEyeSpan).toBe(.09);expect(state.fit.offset).toEqual([0,.002,0]);
  });
  it('ordinary string loads preserve current fit while descriptor fit retains legacy defaults',async()=>{
    const {target,parseAsync,state}=renderer({referenceEyeSpan:2,scale:1.3,offset:[0,.1,.2]});
    parseAsync.mockResolvedValueOnce({scene:scene().root});await target.load('ordinary.glb');expect(state.fit.referenceEyeSpan).toBe(2);expect(state.fit.scale).toBe(1.3);
    target.setFit({scale:1.5});parseAsync.mockResolvedValueOnce({scene:scene().root});await target.load('ordinary-next.glb');expect(state.fit.scale).toBe(1.5);
    parseAsync.mockResolvedValueOnce({scene:scene().root});await target.load({url:'ordinary-override.glb',fit:{scale:1.7}});
    expect(state.fit).toEqual({...DEFAULT_FIT,scale:1.7});expect(state.assetScale).toBeNull();
  });
  it('rejects malformed contract before altering current scene, fit or readiness even with overrides',async()=>{
    const {target,parseAsync,state}=renderer({scale:1.2}),valid=scene();parseAsync.mockResolvedValueOnce({scene:valid.root});await target.load('valid.glb');
    const fit=state.fit,reapplyCount=state.reapplyFrame.mock.calls.length,badData=metadata();badData.vtoGlasses.sdk.units='centimeters';
    const rejected=scene(badData);parseAsync.mockResolvedValueOnce({scene:rejected.root});
    await expect(target.load({url:'bad.glb',fit:{referenceEyeSpan:.09},physicalFit:{frontWidthMm:140,modelFrontWidth:.14,source:'supplier'}})).rejects.toThrow('embedded glasses SDK contract');
    expect(state.current).toBe(valid.root);expect(state.fit).toBe(fit);expect(state.assetScale).toBeNull();expect(state.reapplyFrame.mock.calls.length).toBe(reapplyCount);
    expect(state.scene.children).toContain(valid.root);expect(valid.geometryDisposed).not.toHaveBeenCalled();
    expect(rejected.geometryDisposed).toHaveBeenCalledTimes(1);expect(rejected.materialDisposed).toHaveBeenCalledTimes(1);
  });
  it('failed first load does not consume explicit initial fit overrides',async()=>{
    const {target,parseAsync,state}=renderer({scale:1.2}),bad=scene({vtoGlasses:{sdk:{version:2}}});parseAsync.mockResolvedValueOnce({scene:bad.root});
    await expect(target.load('bad.glb')).rejects.toThrow();expect(state.initialAssetLoaded).toBe(false);
    parseAsync.mockResolvedValueOnce({scene:scene(metadata()).root});await target.load('good.glb');expect(state.fit.scale).toBe(1.2);
  });
  it('disposes a stale resolved load and adopts only the latest generated fit',async()=>{
    const {target,parseAsync,state}=renderer();let complete!:(value:{scene:THREE.Group})=>void;
    parseAsync.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));const pending=target.load('old.glb');
    const latest=scene(metadata());parseAsync.mockResolvedValueOnce({scene:latest.root});await target.load('new.glb');
    const stale=scene(metadata());complete({scene:stale.root});await pending;
    expect(state.current).toBe(latest.root);expect(stale.geometryDisposed).toHaveBeenCalledTimes(1);expect(stale.materialDisposed).toHaveBeenCalledTimes(1);
  });
});
