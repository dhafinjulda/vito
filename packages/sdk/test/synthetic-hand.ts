/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import type {TrackedHand,GripFinger} from '../src/interaction/HandGrip';

/** Synthetic articulated fixture only; never derived from a person. */
export function syntheticHand(x=.5,y=.5,finger:GripFinger='index',handedness='Right',open=false):TrackedHand{
  const p=Array.from({length:21},()=>({x,y,z:0}));
  const set=(i:number,dx:number,dy:number)=>{p[i]={x:x+dx,y:y+dy,z:0};};
  set(0,0,.12);set(1,-.06,.1);set(2,-.05,.06);set(3,-.025,.02);set(4,open?-.1:-.004,open?-.02:0);
  const fingers:readonly [GripFinger,number,number,number,number,number][]=[['index',5,-.05,.07,-.055,-.055],['middle',9,0,.04,0,-.085],['ring',13,.025,.06,.05,-.06],['little',17,.05,.07,.095,-.01]];
  for(const [name,base,bx,by,tx,ty] of fingers){set(base,bx,by);const ex=!open&&name===finger ? .004 : tx,ey=!open&&name===finger?0:ty;set(base+1,bx+(ex-bx)/3,by+(ey-by)/3);set(base+2,bx+2*(ex-bx)/3,by+2*(ey-by)/3);set(base+3,ex,ey);}
  return {landmarks:p,handedness};
}
