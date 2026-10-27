import {firstOutOfPlay,inPlayTerritory} from './stadium-layout.js?v=109';
import {BASES,FIELDERS,FIELD,runnerArrival,fielderTravel,fielderDistance} from './field.js?v=109';
function reach(i,p,air){
 const [x,z]=FIELDERS[i],reaction=FIELD.reaction+(i>=4?.12:0),radius=air?1.1:.75;
 return reaction+fielderTravel(Math.max(0,Math.hypot(p.x-x,p.z-z)-radius));
}
export function fieldBall(trace){
 const firstGround=trace.firstBounce?.t??Infinity,dead=firstOutOfPlay(trace.samples);
 for(const p of trace.samples){
  if(dead&&p.t>=dead.t)break;
  if(!inPlayTerritory(p))continue;
  if(p.t<.12||p.t>=firstGround||p.y>.0366+2.7||p.y<.25)continue;
  for(let i=0;i<FIELDERS.length;i++)if(reach(i,p,true)<=p.t)return {caught:true,fielder:i,time:p.t,point:p};
 }
 for(const p of trace.samples){
  if(dead&&p.t>=dead.t)break;
  if(!inPlayTerritory(p))continue;
  if(p.t<firstGround||p.y>1.0)continue;
  for(let i=0;i<FIELDERS.length;i++)if(reach(i,p,false)<=p.t)return {caught:false,fielder:i,time:p.t,point:p};
 }
 if(dead)return {caught:false,outOfPlay:true,time:dead.t,point:dead};
 const point=trace.samples.at(-1);let fielder=0,time=Infinity;
 FIELDERS.forEach((_,i)=>{const arrival=Math.max(point.t,reach(i,point,false));if(arrival<time){fielder=i;time=arrival;}});
 return {caught:false,fielder,time,point};
}
const pointAtBase=base=>({x:BASES[base][0],y:1.25,z:BASES[base][2]});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const defensiveHome=i=>i===8?[0,18.44]:i===7?[0,-2]:FIELDERS[i];
const supportArrival=(i,p)=>{const [x,z]=defensiveHome(i);return FIELD.reaction+fielderTravel(Math.hypot(p.x-x,p.z-z));};
// A shared throw plan drives both the race against the runner and the animation.
export function throwPlan(fielding,base){
 const source={x:fielding.point.x,y:1.3,z:fielding.point.z},target=pointAtBase(base),d=distance(source,target);
 const relay=fielding.fielder>=4&&d>60?(source.x<0?2:3):null;
 const candidates=base===1?[0,2,3,1]:base===3?[1,3,2,0]:base===4?[7]:[source.x<0?3:2,source.x<0?2:3,0,1];
 const receiver=candidates.find(i=>i!==fielding.fielder&&i!==relay);
 const assignments=[{fielder:receiver,point:target,role:'receive'}],legs=[];
 let from=source,release=fielding.time+(fielding.fielder>=4?.9:.5);
 if(relay!==null){
  const u=Math.min(35,d*.45)/d,cut={x:target.x+(source.x-target.x)*u,y:1.3,z:target.z+(source.z-target.z)*u};
  const flight=distance(from,cut)/FIELD.throwSpeed;
  release=Math.max(release,supportArrival(relay,cut)-flight);
  legs.push({from,to:cut,release,arrival:release+flight,receiver:relay});
  assignments.push({fielder:relay,point:cut,role:'relay'});from=cut;release+=flight+.55;
 }
 const flight=distance(from,target)/FIELD.throwSpeed;
 release=Math.max(release,supportArrival(receiver,target)-flight);
 legs.push({from,to:target,release,arrival:release+flight,receiver});
 // The other middle infielder covers second or backs up the receiving base.
 const occupied=new Set([fielding.fielder,...assignments.map(a=>a.fielder)]);
 for(const i of [0,1,2,3,7]){
  if(occupied.has(i))continue;
  let point;
  if(i===0)point=pointAtBase(1);else if(i===1)point=pointAtBase(3);else if(i===7)point=pointAtBase(4);
  else if(base!==2&&!assignments.some(a=>a.role==='cover-second')){point=pointAtBase(2);assignments.push({fielder:i,point,role:'cover-second'});continue;}
  else {const length=Math.max(.01,d);point={x:target.x+(target.x-source.x)/length*5,y:0,z:target.z+(target.z-source.z)/length*5};}
  assignments.push({fielder:i,point,role:'cover'});
 }
 return {fielding,source,target,receiver,relay,assignments,legs,arrival:legs.at(-1).arrival};
}
export function throwPosition(plan,t){
 let from=plan.fielding.point;
 for(const leg of plan.legs){
  if(t<leg.release){
   if(leg===plan.legs[0]){const u=Math.max(0,Math.min(1,(t-plan.fielding.time)/(leg.release-plan.fielding.time)));return {x:leg.from.x,y:from.y+(leg.from.y-from.y)*u,z:leg.from.z};}
   return {...leg.from};
  }
  if(t<=leg.arrival){const u=(t-leg.release)/Math.max(.001,leg.arrival-leg.release);return {x:leg.from.x+(leg.to.x-leg.from.x)*u,y:leg.from.y+(leg.to.y-leg.from.y)*u+Math.sin(u*Math.PI)*1.5,z:leg.from.z+(leg.to.z-leg.from.z)*u};}
  from=leg.to;
 }
 return {...plan.target};
}
export function returnTime(fielding,base){return throwPlan(fielding,base).arrival;}
export function awardBases(fielding){
 const returns=[0,1,2,3,4].map(b=>b?returnTime(fielding,b):0),runner=[0,1,2,3].map(b=>b?runnerArrival(b):0);
 if(returns[1]<runner[1]-.08)return {out:true,bases:0,throwBase:1,returns,runner};
 let bases=1;
 if(runner[2]+.30<returns[2])bases=2;
 // The runner commits to third only with a clear safety margin over the throw.
 if(bases===2&&runner[3]+.85<returns[3])bases=3;
 return {bases,throwBase:Math.min(4,bases+1),returns,runner};
}

// Force-play routes share their start/end positions and clock with the runners.
export function forceRunnerStart(base){return base===0?{x:0,z:0}:{x:BASES[base][0]+(base===2?1.8:base===1?.5:-.5),z:BASES[base][2]-.25};}
export function forceRunnerTime(from,to){const a=forceRunnerStart(from),b=pointAtBase(to);return .4+distance(a,b)/FIELD.runnerSpeed;}
export function groundForcePlay(result,state){
 const b=result.batted,f=b?.fielding;
 if(state.outs>=3||!state.bases[0]||!f||f.caught||b.type!=='ground'||f.fielder>=4||result.foul||result.bases===4||b.groundRuleDouble)return null;
 // Compare real throw/receiver arrival against each forced runner. Prefer the
 // quickest sure out, breaking close choices toward the lead runner.
 const choices=[];
 for(let base=2;base<=4;base++){
  if(!state.bases.slice(0,base-1).every(Boolean))continue;
  const plan=throwPlan(f,base);
  if(plan.arrival>=forceRunnerTime(base-1,base))continue;
  const receiver=[0,2,3,1].find(i=>i!==plan.receiver&&i!==f.fielder),from=pointAtBase(base),to=pointAtBase(1),flight=distance(from,to)/FIELD.throwSpeed;
  const release=Math.max(plan.arrival+.24,supportArrival(receiver,to)-flight),arrival=release+flight;
  choices.push({base,plan,second:{from,to,release,arrival,receiver},doublePlay:state.outs<2&&arrival<forceRunnerTime(0,1)});
 }
 choices.sort((a,b)=>Number(b.doublePlay)-Number(a.doublePlay)||(a.plan.arrival-a.base*.08)-(b.plan.arrival-b.base*.08));
 if(!choices.length)return null;
 // With no outs and the bases loaded, stop the run at home when possible.
 const selected=state.outs===0?choices.find(c=>c.base===4)??choices[0]:choices[0];
 const {base,plan}=selected,forceAt=plan.arrival,pivot=plan.receiver;
 let throws=plan,doublePlay=false;
 if(state.outs<2){
  const {from,to,release,arrival,receiver}=selected.second;
  doublePlay=arrival<forceRunnerTime(0,1);
  const assignments=plan.assignments.filter(a=>a.fielder!==receiver);assignments.push({fielder:receiver,point:to,role:'receive'});
  throws={...plan,target:to,receiver,relay:pivot,assignments,legs:[...plan.legs,{from,to,release,arrival,receiver}],arrival};
 }
 const runners=[];
 for(let from=1;from<=3;from++)if(state.bases[from-1]){
  const forced=state.bases.slice(0,from).every(Boolean),to=forced?from+1:from,out=from===base-1;
  runners.push({from,to,out,outAt:out?forceAt:null,arrival:to===from?0:forceRunnerTime(from,to)});
 }
 runners.push({from:0,to:1,out:doublePlay,outAt:doublePlay?throws.arrival:null,arrival:forceRunnerTime(0,1)});
 const name=base===4?'홈':`${base}루`;
 return {outs:doublePlay?2:1,forceBase:base,throwBase:throws===plan?base:1,forceAt,finishAt:throws.arrival,throwPlan:throws,runners,doublePlay,
  label:doublePlay?'DOUBLE PLAY':state.outs===2?'FORCE OUT':"FIELDER’S CHOICE",detail:doublePlay?`${name} 포스 아웃 → 1루 아웃 · 병살`:`${name} 포스 아웃${state.outs===2?' · 이닝 종료':' · 타자는 1루 세이프'}`};
}

// All nine defenders have a role. Required receivers retain the exact route
// used by throwPlan; other players react to contact, then back up the throw.
export function defenseAssignments(hit){
 const f=hit.fielding;if(!f)return [];
 const plan=hit.caught?null:(hit.throwPlan||throwPlan(f,hit.throwBase));
 const assignments=plan?[...plan.assignments]:[0,1,2,3,7].map(i=>({fielder:i,point:pointAtBase(i===0?1:i===1?3:i===7?4:2),role:'cover'}));
 if(hit.caught){const middle=assignments.find(a=>a.fielder===(f.point.x<0?2:3));middle.point={x:f.point.x*.35,y:0,z:35+(f.point.z-35)*.3};middle.role='cutoff';}
 const occupied=new Set([f.fielder,...assignments.map(a=>a.fielder)]),target=plan?.target??pointAtBase(2);
 const backup=([...Array(7).keys()].filter(i=>i>=4&&i!==f.fielder)).sort((a,b)=>distance({x:FIELDERS[a][0],z:FIELDERS[a][1]},f.point)-distance({x:FIELDERS[b][0],z:FIELDERS[b][1]},f.point))[0];
 for(const i of [4,5,6,8]){
  if(occupied.has(i))continue;
  const [x,z]=defensiveHome(i);let point,next,role;
  if(i===8){
   role='backup-base';const d=Math.max(1,distance(f.point,target));
   point={x:f.point.x*.12,y:0,z:18.44+(f.point.z-18.44)*.12};
   next={x:target.x+(target.x-f.point.x)/d*6,y:0,z:target.z+(target.z-f.point.z)/d*6};
  }else if(i===backup){
   role='backup-ball';const d=Math.max(1,Math.hypot(f.point.x,f.point.z));
   point={x:f.point.x+f.point.x/d*8,y:0,z:f.point.z+f.point.z/d*8};
   const radius=Math.hypot(point.x,point.z);if(radius>FIELD.fence-2){point.x*= (FIELD.fence-2)/radius;point.z*= (FIELD.fence-2)/radius;}
   if(!inPlayTerritory(point))point={x:x+(f.point.x-x)*.7,y:0,z:z+(f.point.z-z)*.7};
   next={x:point.x+(target.x-point.x)*.24,y:0,z:point.z+(target.z-point.z)*.24};
  }else{role='shade';point={x:x+(f.point.x-x)*.28,y:0,z:z+(f.point.z-z)*.28};next={x:point.x+(target.x-point.x)*.12,y:0,z:point.z+(target.z-point.z)*.12};}
  assignments.push({fielder:i,point,next:hit.caught?null:next,role});
 }
 return assignments.filter(a=>a.fielder!==f.fielder);
}
export function defensePosition(assignment,fielding,t){
 const [x,z]=defensiveHome(assignment.fielder),start={x,z};
 const toward=(a,b,seconds)=>{const length=distance(a,b),travel=Math.min(length,fielderDistance(seconds)),u=length?travel/length:1;return {x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,moving:u>0&&u<1,travel};};
 const switchAt=fielding.time+.25;
 if(assignment.next&&t>switchAt){const pivot=toward(start,assignment.point,switchAt-FIELD.reaction);const next=toward(pivot,assignment.next,t-switchAt);next.travel+=pivot.travel;return next;}
 return toward(start,assignment.point,t-FIELD.reaction);
}

// Home runs have no fielding/throw plan, but outfielders still read the flight.
// Keep pursuit inside the fence and decelerate once the ball clears it.
export function homeRunDefensePlans(hit){
 if(!hit.homeRun||!hit.samples?.length)return [];
 const end=hit.samples.at(-1),angle=Math.max(-Math.PI/4+.015,Math.min(Math.PI/4-.015,Math.atan2(end.x,end.z))),radius=FIELD.fence-2.2;
 const wall={x:Math.sin(angle)*radius,z:Math.cos(angle)*radius};
 const nearest=[4,5,6].sort((a,b)=>Math.hypot(FIELDERS[a][0]-wall.x,FIELDERS[a][1]-wall.z)-Math.hypot(FIELDERS[b][0]-wall.x,FIELDERS[b][1]-wall.z))[0];
 return [4,5,6].map(fielder=>{const [x,z]=FIELDERS[fielder],share=fielder===nearest?1:Math.abs(fielder-nearest)===1?.48:.22,point={x:x+(wall.x-x)*share,z:z+(wall.z-z)*share};return {fielder,point,length:Math.hypot(point.x-x,point.z-z),crossAt:end.t,primary:fielder===nearest};});
}
export function homeRunDefensePosition(plan,t){
 const [x,z]=FIELDERS[plan.fielder],reaction=FIELD.reaction+.12,cross=Math.max(0,plan.crossAt-reaction),coast=.65,after=Math.max(0,Math.min(coast,t-plan.crossAt));
 const crossingSpeed=Math.min(FIELD.fielderSpeed,FIELD.fielderAcceleration*cross);
 const raw=t<=plan.crossAt?fielderDistance(t-reaction):fielderDistance(cross)+crossingSpeed*(after-after*after/(2*coast));
 const rawSpeed=t<=plan.crossAt?Math.min(FIELD.fielderSpeed,Math.max(0,t-reaction)*FIELD.fielderAcceleration):crossingSpeed*(1-after/coast);
 // Brake over the last few metres rather than snapping to a stop at the padding.
 const brake=Math.min(2.2,plan.length),start=plan.length-brake,u=brake?Math.max(0,Math.min(1,(raw-start)/(2*brake))):1;
 const travel=raw<start?raw:start+brake*(2*u-u*u),speed=rawSpeed*(1-u),progress=plan.length?travel/plan.length:1;
 return {x:x+(plan.point.x-x)*progress,z:z+(plan.point.z-z)*progress,travel,speed,moving:speed>.02};
}
