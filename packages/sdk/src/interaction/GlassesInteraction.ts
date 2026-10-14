/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import type {GlassesInteractionState,GlassesPlacement} from '../types';
import {HandGrip,TwoHandGrip,sampleHandGrips,unprojectGrip,type FingerHandSample,type GrabContext,type HeldPose,type TrackedHand} from './HandGrip';
import {HandIdentity} from './HandIdentity';

interface Observation {id:string;hand:TrackedHand;samples:FingerHandSample[]}
interface Owner {id:string;hand:TrackedHand;sample:FingerHandSample}
interface Candidate {time:number;context:GrabContext;owner:Owner;contact:NonNullable<ReturnType<GrabContext['contactAt']>>}
export interface ContactHand {hand:TrackedHand;depth:number;anchorZ:number}
const EMPTY:readonly ContactHand[]=[];

/** Contact-gated rigid manipulation. Histories and identities are transient. */
export class GlassesInteraction {
  private state:GlassesInteractionState;
  private readonly identities=new HandIdentity();
  private candidate:Candidate|null=null;
  private receiving:Candidate|null=null;
  private owners:Owner[]=[];
  private grip:HandGrip|null=null;
  private pair:TwoHandGrip|null=null;
  private held:HeldPose|null=null;
  private occlusion:readonly ContactHand[]=EMPTY;
  private lastTime=-Infinity;
  private lastHandAt=-Infinity;
  private settling:{from:HeldPose;started:number;mount:GlassesPlacement;outcome:'mounted'|'release-near-face'}|null=null;
  constructor(enabled:boolean){this.state={availability:enabled?'loading':'disabled',phase:'idle',placement:'face',progress:0,handVisible:false,grippingHands:0,contactFingers:0,feedback:'search-hand'};}
  snapshot():GlassesInteractionState{return {...this.state};}
  get heldPose(){return this.held;}
  get occludingHands(){return this.occlusion;}
  get occludingHand(){return this.occlusion[0]??null;}
  setAvailability(availability:GlassesInteractionState['availability']){this.cancel();this.identities.reset();this.state.availability=availability;this.state.handVisible=false;this.state.contactFingers=0;}
  setPlacement(placement:GlassesPlacement){this.cancel();this.state.placement=placement;this.state.progress=placement==='head'?1:0;this.state.feedback='mounted';}
  reset(){this.setPlacement('face');this.identities.reset();this.state.feedback='search-hand';this.state.handVisible=false;this.state.contactFingers=0;this.lastTime=this.lastHandAt=-Infinity;}
  onFaceLost(){if(this.state.phase==='idle'){this.setPlacement('face');this.state.contactFingers=0;this.state.feedback='search-hand';}}
  private cancel(){this.state.phase='idle';this.candidate=this.receiving=null;this.grip=this.pair=null;this.owners=[];this.held=null;this.occlusion=EMPTY;this.settling=null;this.state.grippingHands=0;this.state.feedback='search-hand';this.state.progress=this.state.placement==='head'?1:0;}
  tick(time:number,context?:GrabContext|null){
    if(this.settling){
      if(context===undefined)return;
      const target=this.settling.mount==='head'?context?.head:context?.face;
      if(!target){this.cancel();return;}
      const t=Math.max(0,Math.min(1,(time-this.settling.started)/200)),ease=t*t*(3-2*t),from=this.settling.from;
      this.held={position:from.position.clone().lerp(target.position,ease),rotation:from.rotation.clone().slerp(target.rotation,ease),scale:target.scale};
      if(t===1){const {mount,outcome}=this.settling;this.setPlacement(mount);this.state.feedback=outcome;}
      return;
    }
    if(time-this.lastHandAt>450&&(this.state.handVisible||this.state.phase!=='idle')){this.cancel();this.identities.reset();this.state.handVisible=false;this.state.contactFingers=0;}
  }
  private contact(observation:Observation,context:GrabContext):{owner:Owner;contact:Candidate['contact']}|null{
    for(const sample of [...observation.samples].sort((a,b)=>a.pinch-b.pinch)){
      if(sample.pinch>=.45)continue;
      const contact=context.contactAt(sample.point);
      if(contact)return {owner:{id:observation.id,hand:observation.hand,sample},contact};
    }
    return null;
  }
  private makeCandidate(owner:Owner,contact:Candidate['contact'],context:GrabContext,time:number):Candidate{
    return {owner,contact,time,context:{...context,asset:{position:context.asset.position.clone(),rotation:context.asset.rotation.clone(),scale:context.asset.scale}}};
  }
  private resolveOwner(owner:Owner,observations:Observation[],context:GrabContext):Owner|null{
    const current=observations.find(o=>o.id===owner.id);if(!current)return null;
    const locked=current.samples.find(s=>s.finger===owner.sample.finger);
    if(locked&&locked.pinch<=.7)return {id:owner.id,hand:current.hand,sample:locked};
    return this.contact(current,context)?.owner??(locked?{id:owner.id,hand:current.hand,sample:locked}:null);
  }
  private single(owner:Owner,depth:number,context:GrabContext,time:number){
    this.grip=new HandGrip(this.held!,unprojectGrip(owner.sample.point,depth,context.projection),owner.sample,context.projection,time);
    this.pair=null;this.owners=[owner];this.state.grippingHands=1;this.receiving=null;
  }
  private release(context:GrabContext,receivedAt:number){
    const held=this.held!;
    const faceDistance=context.face?.position.distanceTo(held.position)??Infinity,headDistance=context.head?.position.distanceTo(held.position)??Infinity;
    const faceEligible=faceDistance<6&&!!context.face&&held.rotation.angleTo(context.face.rotation)<55*Math.PI/180;
    const headEligible=headDistance<6&&!!context.head&&held.rotation.angleTo(context.head.rotation)<85*Math.PI/180;
    const mount=headEligible&&(!faceEligible||headDistance<faceDistance)?'head':faceEligible?'face':null;
    const destination=mount??this.state.placement,target=destination==='head'?context.head:context.face;
    if(target){this.settling={from:held,started:receivedAt,mount:destination,outcome:mount?'mounted':'release-near-face'};this.grip=this.pair=null;this.owners=[];this.occlusion=EMPTY;this.state.grippingHands=0;this.state.phase='settling';this.state.placement=destination;this.state.progress=destination==='head'?1:0;this.state.feedback=mount?'mounting':'release-near-face';}
    else{this.setPlacement(this.state.placement);this.state.feedback='release-near-face';}
  }
  private writeOcclusion(observations:Observation[],context:GrabContext){
    if(this.state.phase==='settling'){this.occlusion=EMPTY;return;}
    const result:ContactHand[]=[];let fingers=0;
    for(const observation of observations){
      let touch:Candidate['contact']|null=null,touchZ=0;
      for(const tip of [4,8,12,16,20]){const point=observation.hand.landmarks[tip]!,at=context.contactAt(point);if(at){fingers++;if(!touch){touch=at;touchZ=point.z;}}}
      const slot=this.owners.findIndex(o=>o.id===observation.id),owner=this.owners[slot];
      if(owner){const depth=this.pair?this.pair.depths[slot]!:(this.grip?.depth??-context.asset.position.z);result.push({hand:owner.hand,depth,anchorZ:owner.sample.point.z});}
      else if(touch&&context.asset.position.z<0)result.push({hand:observation.hand,depth:-touch.z,anchorZ:touchZ});
    }
    this.state.contactFingers=Math.min(10,fingers);this.occlusion=result.length?result:EMPTY;
  }
  update(hands:TrackedHand[],time:number,context:GrabContext|null,receivedAt=time):GlassesInteractionState{
    if(time===this.lastTime)return this.snapshot();
    if(!Number.isFinite(time)||time<this.lastTime){this.reset();return this.snapshot();}
    this.tick(receivedAt,context);if(this.settling)return this.snapshot();this.lastTime=time;
    if(this.state.availability!=='ready'||!context){this.tick(receivedAt);return this.snapshot();}
    const aspect=context.projection.videoWidth/context.projection.videoHeight;
    const observations=this.identities.update(hands,time,aspect).map(({id,hand})=>({id,hand,samples:sampleHandGrips(hand,aspect)})).filter(o=>o.samples.length>0);
    this.state.handVisible=observations.length>0;
    if(!this.grip&&!this.pair){
      const match=observations.map(o=>this.contact(o,context)).find(m=>m!==null),previous=this.candidate;
      const fallback=previous&&observations.find(o=>o.id===previous.owner.id)?.samples.find(s=>s.finger===previous.owner.sample.finger&&s.pinch<.45);
      if(!match&&!(previous&&fallback&&time-previous.time<=250&&Math.hypot(fallback.point.x-previous.owner.sample.point.x,fallback.point.y-previous.owner.sample.point.y)<.07)){
        this.cancel();this.state.feedback=observations.some(o=>o.samples.some(s=>s.pinch<.45))?'near-frame':'open-to-grab';
      }else{
        const owner=match?.owner??{...previous!.owner,sample:fallback!};
        if(!previous||previous.owner.id!==owner.id||previous.owner.sample.finger!==owner.sample.finger){this.candidate=this.makeCandidate(owner,match!.contact,context,time);this.state.phase='grabbing';}
        else if(time-previous.time>=80){const contact=match?.contact??previous.contact;this.grip=new HandGrip(match?context.asset:previous.context.asset,contact,match?owner.sample:previous.owner.sample,context.projection,time);this.owners=[owner];this.held=this.grip.update(owner.sample,context.projection,time);this.state.phase='dragging';this.state.grippingHands=1;this.state.feedback='held';this.candidate=null;}
      }
      if(observations.length)this.lastHandAt=time;
      this.writeOcclusion(observations,context);return this.snapshot();
    }
    const oldOwners=this.owners,depths=this.pair?this.pair.depths:[this.grip!.depth];
    const resolved=oldOwners.map(o=>this.resolveOwner(o,observations,context));
    const valid=resolved.map((owner,index)=>({owner,index})).filter(v=>v.owner&&v.owner.sample.pinch<=.7);
    if(!valid.length){
      if(resolved.some(o=>o!==null))this.release(context,receivedAt);else this.tick(receivedAt);
      this.writeOcclusion(observations,context);return this.snapshot();
    }
    this.lastHandAt=time;
    let handoff=false;
    if(this.pair&&valid.length===1){const {owner,index}=valid[0]!;this.single(owner!,depths[index]!,context,time);handoff=index===1;}
    else if(valid.some(({owner,index})=>owner!.sample.finger!==oldOwners[index]!.sample.finger)){
      if(this.pair){const a=valid[0]!.owner!,b=valid[1]!.owner!;this.pair=new TwoHandGrip(this.held!,[unprojectGrip(a.sample.point,depths[0]!,context.projection),unprojectGrip(b.sample.point,depths[1]!,context.projection)],[a.sample,b.sample],context.projection,time);this.owners=[a,b];}
      else this.single(valid[0]!.owner!,depths[0]!,context,time);
    }else this.owners=valid.map(v=>v.owner!);
    if(this.pair){this.held=this.pair.update([this.owners[0]!.sample,this.owners[1]!.sample],context.projection,time);this.state.feedback='held-two-hands';}
    else{
      const owner=this.owners[0]!;this.held=this.grip!.update(owner.sample,context.projection,time);this.state.feedback=handoff?'handoff':'held';
      const other=observations.find(o=>o.id!==owner.id),touch=other?this.contact(other,context):null;
      if(!touch)this.receiving=null;
      else if(!this.receiving||this.receiving.owner.id!==touch.owner.id||this.receiving.owner.sample.finger!==touch.owner.sample.finger)this.receiving=this.makeCandidate(touch.owner,touch.contact,context,time);
      else if(time-this.receiving.time>=80){
        const anchor=unprojectGrip(owner.sample.point,this.grip!.depth,context.projection);
        if(anchor.distanceTo(touch.contact)>.8){this.pair=new TwoHandGrip(this.held!,[anchor,touch.contact],[owner.sample,touch.owner.sample],context.projection,time);this.owners=[owner,touch.owner];this.state.grippingHands=2;this.state.feedback='held-two-hands';this.receiving=null;}
      }
    }
    this.writeOcclusion(observations,context);return this.snapshot();
  }
}
