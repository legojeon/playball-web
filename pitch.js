import {ASSIST,inContactWindow} from './contact-window.js?v=108';
export const CONTACT_Z=.35;
export const ZONE={halfWidth:.41,bottom:.60,top:1.44};
const BALL_RADIUS=.041;
export const TYPES=[
 {name:'FOUR-SEAM',ko:'직구',low:142,high:156,curve:0,arc:.16},
 {name:'CHANGEUP',ko:'체인지업',low:124,high:136,curve:.14,arc:.22},
 {name:'CURVEBALL',ko:'커브',low:120,high:132,curve:-.5,arc:.48},
 {name:'SLIDER',ko:'슬라이더',low:130,high:143,curve:.6,arc:.16}
];
export function inZone(x,y){return Math.abs(x)<=ZONE.halfWidth+BALL_RADIUS&&y>=ZONE.bottom-BALL_RADIUS&&y<=ZONE.top+BALL_RADIUS;}
export function generatePitch(clock,rng=Math.random){
 const type=TYPES[Math.floor(rng()*TYPES.length)];const speed=type.low+Math.floor(rng()*(type.high-type.low+1));
 let x=(rng()-.5)*.5,y=.74+rng()*.58;
 // 56% central strikes, 30% borderline (half either side), 14% clear misses.
 // All labels still come from inZone; no random umpire calls or enlarged zone.
 const location=rng();
 if(location<.30){
  const side=Math.floor(rng()*4),offset=(rng()-.5)*.10;
  // Sample around the ball-centre limit, including the ball radius used by ABS.
  // Stay clear of corners so the other axis never silently decides the call.
  if(side<2){x=(side===0?-1:1)*(ZONE.halfWidth+BALL_RADIUS+offset);y=ZONE.bottom+.06+(y-.74)/.58*(ZONE.top-ZONE.bottom-.12);}
  else{x=x/.25*(ZONE.halfWidth-.06);y=side===2?ZONE.top+BALL_RADIUS+offset:ZONE.bottom-BALL_RADIUS-offset;}
 }else if(location<.44){
  const side=Math.floor(rng()*4),miss=rng();
  if(side===0)x=-(.56+miss*.33);
  // Most inside misses stay between the zone and the batter. Only 22% of
  // inside misses use the deep-miss range; actual body contact still decides HBP.
  else if(side===1)x=miss<.22?.56+(miss/.22)*.33:.48+((miss-.22)/.78)*.06;
  else y=side===2?1.68+miss*.2:.3+miss*.14;
 }
 // Hold the set position briefly after ready; keep the throwing motion unchanged.
 const windup=1000+rng()*280,windupAt=clock+350;
 return {...type,speed,x,y,isStrike:inZone(x,y),windup,windupAt,start:windupAt+windup,duration:(17-CONTACT_Z)*3600/speed,swung:false,lastRenderedError:-Infinity};
}

// Body lies beside the plate. A wide pitch alone is never a hit-by-pitch.
export function hitsBatter(p){
 const z=p.release?.z||17;const t=z/(z-CONTACT_Z);
 const x=(p.release?.x||0)*(1-t)+p.x*t+p.curve*Math.sin(Math.PI*t)*.7;
 const y=(p.release?.y||1.85)*(1-t)+p.y*t+Math.sin(Math.PI*t)*p.arc;
 return !p.isStrike && x>=.60 && x<=1.16 && y>=.38 && y<=1.67;
}
export function takenPitch(p){
 if(p.swung)return {strike:true,label:'STRIKE',detail:p.missedDetail||'헛스윙'};
 if(p.isStrike)return {strike:true,label:'STRIKE',detail:'루킹 스트라이크'};
 if(hitsBatter(p))return {hbp:true,label:'HIT BY PITCH',detail:'몸에 맞는 공 · 1루로 출루'};
 return {ball:true,label:'BALL',detail:'잘 골랐어요 · 존 밖의 공'};
}

// Allow the full late-contact window, and never discard an accepted swing.
export function canTakePitch(p,time){return !p.pending&&(p.lastRenderedError??Infinity)>=0&&time>=p.start+p.duration+ASSIST.late+ASSIST.expiryGrace;}

// One continuous pitch path for rendering, collision and approach velocity.
export function pitchState(p,error){
 const r=p.release||{x:0,y:1.85,z:17},duration=p.duration||(r.z-CONTACT_Z)*3600/(p.speed||145);
 const u=1+error/duration,s=Math.sin(Math.PI*u),c=Math.cos(Math.PI*u),curve=p.curve||0,arc=p.arc||0,k=1000/duration;
 return {position:{x:r.x+(p.x-r.x)*u+curve*s*.7,y:r.y+(p.y-r.y)*u+s*arc,z:r.z+(CONTACT_Z-r.z)*u},
 velocity:{x:(p.x-r.x+curve*Math.PI*c*.7)*k,y:(p.y-r.y+Math.PI*c*arc)*k,z:(CONTACT_Z-r.z)*k}};
}
export function pitchVisual(p,time){
 const error=time-p.start-p.duration,point=pitchState(p,error).position;
 return {t:(time-p.start)/p.duration,error,visible:time>=p.start&&point.z> -1.3,opacity:1,ready:inContactWindow(error)};
}

// A miss is decided at release, but its call waits until the rendered ball has
// actually crossed the zone. The clock mapping also includes delayed input replay.
export function missCallTime(gameTime,releaseError){return gameTime+Math.max(0,-releaseError);}
export function canResolvePending(p,time){return !!p.pending&&time>=p.pending.at&&(p.lastRenderedError??-Infinity)>=(p.pending.ballError==null?0:p.pending.ballError-1e-7);}
