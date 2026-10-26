import {TIMING,timingGrade,meetTarget,MEET} from './contact-window.js?v=101';
import * as T from './vendor/three.module.min.js';
import {BAT,SWING,swingPose,batRadius,batVelocity} from './swing.js?v=101';
import {pitchState,CONTACT_Z} from './pitch.js?v=101';
import {BALL} from './trajectory.js?v=101';
const V=p=>new T.Vector3(p.x,p.y,p.z),clamp=T.MathUtils.clamp;
// Never silently move the target. UI rejects points beyond the player's reach.
export function reachableAim(aim){return !!aim&&Number.isFinite(aim.x)&&Number.isFinite(aim.y)&&aim.x>=-.85&&aim.x<=1.05&&aim.y>=.2&&aim.y<=1.95;}
export function swingTarget(aim){return {x:aim.x,y:aim.y,z:CONTACT_Z};}
// Distance to the union of tapered axial spheres. Minimizing each profile section
// also respects the taper normal, rather than treating the handle as a thick barrel.
export function separationAt(ms,error,pitch,aim){
 const pose=swingPose(ms/SWING.duration,aim),axis=new T.Vector3(0,1,0).applyQuaternion(pose.rotation);
 const state=pitchState(pitch,error+ms),ball=V(state.position),relative=ball.clone().sub(pose.grip),projection=relative.dot(axis);
 const radial2=Math.max(0,relative.lengthSq()-projection*projection);let best=null;
 for(let i=1;i<BAT.profile.length;i++){
  const [a,ra]=BAT.profile[i-1],[b,rb]=BAT.profile[i],slope=(rb-ra)/(b-a);
  const along=clamp(projection+slope*Math.sqrt(radial2/Math.max(.01,1-slope*slope)),a,b);
  const point=pose.grip.clone().addScaledVector(axis,along),delta=ball.clone().sub(point),distance=delta.length(),radius=batRadius(along);
  const gap=distance-radius-BALL.radius;
  if(!best||gap<best.gap)best={ms,gap,pose,axis,along,point,ball,radius,normal:delta.divideScalar(Math.max(1e-12,distance)),incoming:V(state.velocity)};
 }
 return best;
}
// Fixed time intervals plus interval minimization/root finding catch collisions
// between display frames, including grazing contacts. No render-FPS dependency.
export function sweepContact(error,pitch,rawAim,{step=.5}={}){
 const aim=swingTarget(rawAim),at=t=>separationAt(t,error,pitch,aim);
 let previous=at(0),closest=previous,impact=null;
 for(let t=step;t<=SWING.duration*.84+1e-6;t+=step){
  const current=at(t);if(current.gap<closest.gap)closest=current;
  let minimum=current;
  if(Math.min(previous.gap,current.gap)<.09){
   let lo=t-step,hi=t;
   for(let j=0;j<12;j++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(at(a).gap<at(b).gap)hi=b;else lo=a;}
   const inner=at((lo+hi)/2);if(inner.gap<minimum.gap)minimum=inner;if(inner.gap<closest.gap)closest=inner;
  }
  if(minimum.gap<=0){
   let lo=t-step,hi=minimum.ms;
   for(let j=0;j<16;j++){const mid=(lo+hi)/2;if(at(mid).gap<=0)hi=mid;else lo=mid;}
   const candidate=at(hi),velocity=batVelocity(hi,aim,candidate.along);
   if(candidate.incoming.clone().sub(velocity).dot(candidate.normal)<0){impact={...candidate,batVelocity:velocity};break;}
  }
  previous=current;
 }
 const sample=impact||closest;
 return {...sample,hit:!!impact,aim,inputError:error,timingError:error+SWING.impactDelay,batVelocity:sample.batVelocity||batVelocity(sample.ms,aim,sample.along)};
}

// Feedback has a different reference from the nearest-distance search. A miss
// always shows the forward pass through the aimed point at the plate, never the
// backswing or follow-through. The ball is sampled at that SAME instant.
export function swingReview(contact,pitch){
 if(contact.hit)return {...contact,reviewKind:'impact'};
 return {...separationAt(SWING.impactDelay,contact.inputError,pitch,contact.aim),
  hit:false,aim:contact.aim,inputError:contact.inputError,timingError:contact.timingError,reviewKind:'zone-pass'};
}

// The one visible aiming bat is also the entire release-time collision volume.
// Do not sweep invisible poses or sample future ball positions.
export function releaseContact(error,pitch,rawAim){
 const aim=swingTarget(rawAim),g=separationAt(SWING.impactDelay,error-SWING.impactDelay,pitch,aim);
 const velocity=batVelocity(g.ms,aim,g.along),relative=g.incoming.clone().sub(velocity);
 // At exact centre overlap the geometric normal is undefined; use approach.
 if(g.normal.lengthSq()<.5)g.normal.copy(relative).normalize().negate();
 // A release snapshot can already overlap; orient the impulse against approach.
 if(relative.dot(g.normal)>0)g.normal.negate();
 const hit=g.gap<=0;
 return {...g,hit,aim,inputError:error,timingError:error,ballError:error,releaseInstant:true,
  reviewKind:hit?'impact':'zone-pass',batVelocity:velocity};
}

// The visible meet ellipse defines input assistance. The raw pointer remains
// the cursor centre; the single bat previews the assisted target before release.
// Actual impact still solves the unchanged bat surface and pitch trajectory.
export function assistedContact(error,pitch,rawAim){
 const grade=timingGrade(error),meet=meetTarget(rawAim,pitch);
 if(grade==='miss'||!meet.inside)return {...releaseContact(error,pitch,rawAim),hit:false,reviewKind:'zone-pass',assisted:true,timingGrade:grade,missReason:grade==='miss'?'timing':'aim',meet};
 const physicalError=-SWING.impactDelay+error*TIMING.physicalScale;
 const g=sweepContact(physicalError,pitch,meet.aim);
 const review=g.hit?g:swingReview(g,pitch);
 const edge=Math.max(0,(meet.distance-MEET.inner)/(1-MEET.inner));
 return {...g,...(!g.hit?review:{}),inputError:error,timingError:error,meet,
  physicalError,ballError:physicalError+(g.hit?g.ms:SWING.impactDelay),assisted:true,
  timingGrade:grade,timingEfficiency:(1-TIMING.powerLoss*(Math.abs(error)/TIMING.weak)**1.5)*(1-.12*edge*edge),
  reviewKind:g.hit?'impact':'zone-pass',missReason:g.hit?null:'aim'};
}
