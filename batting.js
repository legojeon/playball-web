import {BALL,traceBall,isFairBall} from './trajectory.js?v=113';
import {BAT} from './swing.js?v=113';
import {sweepContact,swingReview,assistedContact} from './collision.js?v=113';
import {fieldBall,awardBases,throwPlan} from './fielding.js?v=113';
export {FIELDERS} from './field.js?v=113';
export const contactGeometry=sweepContact;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),radians=Math.PI/180;
// Material response: preserve sweet-spot power, with less rebound and spin transfer.
// These affect the outgoing vector/rotation, never the final hit label or base award.
export const IMPACT={restitutionFloor:.18,restitutionBarrel:.29,tangentialGrip:.85};
export function exitState(error,pitch,g){
 const barrel=Math.exp(-(((g.along-BAT.sweet)/.19)**2));
 const effectiveMass=1/(1/BAT.mass+(g.along-BAT.center)**2/BAT.inertia),restitution=IMPACT.restitutionFloor+IMPACT.restitutionBarrel*barrel;
 const relative=g.incoming.clone().sub(g.batVelocity),closing=relative.dot(g.normal);
 const impulse=-(1+restitution)*Math.min(0,closing)/(1+BALL.mass/effectiveMass)*(g.timingEfficiency??1);
 const velocity=g.incoming.clone().addScaledVector(g.normal,impulse);
 // A bounded tangential impulse transfers some sliding energy into ball spin.
 const tangent=relative.clone().addScaledVector(g.normal,-closing),slip=tangent.length();
 const friction=Math.min(.12*impulse,slip/3.5*IMPACT.tangentialGrip),delta=tangent.clone().multiplyScalar(slip? -friction/slip:0);
 velocity.add(delta);
 const spinVector=g.normal.clone().multiplyScalar(-BALL.radius).cross(delta).multiplyScalar(2.5/(BALL.radius**2));
 const horizontal=Math.hypot(velocity.x,velocity.z),spin=horizontal?-(spinVector.x*velocity.z-spinVector.z*velocity.x)/horizontal*30/Math.PI:0;
 const speed=velocity.length()*3.6,launch=Math.atan2(velocity.y,horizontal)/radians,spray=Math.atan2(velocity.x,velocity.z)/radians;
 const efficiency=clamp(-closing/Math.max(.001,relative.length()),0,1),quality=barrel*efficiency;
 const contactType=g.timingGrade==='weak'?'타이밍 빗맞음':efficiency<.45?'스침':barrel<.45?'배트 끝·손잡이':quality>.85?'정타':'빗맞음';
 return {velocity:velocity.toArray(),speed,launch,spray,spin:clamp(spin,-5000,5000),quality,contactType};
}
export function contact(error,pitch,aim,{instant=false}={}){
 const g=instant?assistedContact(error,pitch,aim):sweepContact(error,pitch,aim);
 if(!g.hit){const review=instant?g:swingReview(g,pitch);return {strike:true,label:'STRIKE',contact:g,review,detail:g.missReason==='timing'?'헛스윙 · 타이밍 허용 범위를 벗어났습니다':(g.meet&&!g.meet.inside?'헛스윙 · 공이 접촉 보조 범위 밖입니다':`헛스윙 · 공과 배트가 닿지 않았습니다`)};}
 const exit=exitState(error,pitch,g),trace=traceBall(g.ball,exit.velocity,exit.spin);
 const type=exit.launch<10?'ground':exit.launch<25?'line':exit.launch>55?'pop':'fly';
 return resolveBatted(exit,trace,g,type);
}
export function resolveBatted(exit,trace,g,type=exit.launch<10?'ground':exit.launch<25?'line':exit.launch>55?'pop':'fly'){
 const last=trace.samples.at(-1),batted={...exit,...trace,type,x:last.x,z:last.z,distance:trace.carry,flight:trace.firstBounce?.t??trace.duration,contact:g};
 const detail=`${exit.contactType} · ${Math.round(exit.speed)}km/h · 발사각 ${Math.round(exit.launch)}°`;
 const fielding=fieldBall(trace);
 // Once a ball leaves the playing enclosure it cannot be caught in the seats,
 // nor become live again if a later simulated sample comes back inside.
 const decisionTrace=fielding.outOfPlay?{...trace,samples:[...trace.samples.filter(p=>p.t<fielding.time),fielding.point],firstBounce:trace.firstBounce?.t<=fielding.time?trace.firstBounce:null}:trace;
 // A catch in foul territory is still an out. Test catches before dead balls.
 if(fielding.caught){
  batted.fielding=fielding;batted.fielder=fielding.fielder;batted.caught=true;batted.animationTime=fielding.time;
  return {out:true,label:!isFairBall(decisionTrace,fielding)?'FOUL OUT':{ground:'LINE OUT',line:'LINE OUT',pop:'POP OUT',fly:'FLY OUT'}[type],detail:'바운드 전에 포구 · '+detail,batted};
 }
 if(!isFairBall(decisionTrace,fielding)){batted.animationTime=fielding.outOfPlay?Math.min(trace.duration,fielding.time+.25):Math.min(2.4,trace.duration);return {foul:true,label:'FOUL',detail:(fielding.outOfPlay?'관중석·경기장 밖 파울 · ':'파울 지역 타구 · ')+detail,batted};}
 if(trace.homeRun){batted.animationTime=trace.duration;return {bases:4,label:'HOME RUN',detail:'바운드 없이 담장을 넘겼습니다 · '+detail,batted};}
 if(fielding.outOfPlay){batted.groundRuleDouble=true;batted.animationTime=fielding.time;return {bases:2,label:'GROUND RULE DOUBLE',detail:'페어 타구가 경기장 밖으로 나갔습니다 · '+detail,batted};}
 if(trace.groundRuleDouble){batted.animationTime=trace.duration;return {bases:2,label:'GROUND RULE DOUBLE',detail:'바운드 후 담장 밖 · 인정 2루타 · '+detail,batted};}
 batted.fielding=fielding;batted.fielder=fielding.fielder;batted.caught=false;
 const award=awardBases(fielding);batted.award=award;batted.throwBase=award.throwBase;batted.throwPlan=throwPlan(fielding,award.throwBase);batted.returnAt=batted.throwPlan.arrival;batted.animationTime=batted.returnAt;
 if(award.out)return {out:true,label:'GROUND OUT',detail:'주자보다 송구가 먼저 1루 도착 · '+detail,batted};
 return {bases:award.bases,label:['','SINGLE','DOUBLE','TRIPLE'][award.bases],detail:(award.bases===3?'송구보다 먼저 3루 도착':award.bases===2?'2루까지 진루':'1루 출루')+' · '+detail,batted};
}
