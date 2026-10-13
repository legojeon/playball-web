import {firstOutOfPlay,inPlayTerritory} from './stadium-layout.js?v=89';
import {BASES,FIELDERS,FIELD,runnerArrival,fielderTravel} from './field.js?v=89';
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
export const defensiveHome=i=>i===7?[0,-2]:FIELDERS[i];
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
 if(state.outs>=2||!state.bases[0]||!f||f.caught||b.type!=='ground'||f.fielder>=4||result.foul||result.bases===4||b.groundRuleDouble)return null;
 const plan=throwPlan(f,2),forceAt=plan.arrival,runnerAtSecond=forceRunnerTime(1,2);
 // A tie is safe; never manufacture a force out from a slow pickup/throw.
 if(forceAt>=runnerAtSecond)return null;
 const pivot=plan.receiver,receiver=[0,2,3,1].find(i=>i!==pivot&&i!==f.fielder),from=pointAtBase(2),to=pointAtBase(1),flight=distance(from,to)/FIELD.throwSpeed;
 const release=Math.max(forceAt+.24,supportArrival(receiver,to)-flight),arrival=release+flight;
 const doublePlay=arrival<forceRunnerTime(0,1);
 const assignments=plan.assignments.filter(a=>a.fielder!==receiver);assignments.push({fielder:receiver,point:to,role:'receive'});
 const throws={...plan,target:to,receiver,relay:pivot,assignments,legs:[...plan.legs,{from,to,release,arrival,receiver}],arrival};
 const runners=[];
 for(let base=1;base<=3;base++)if(state.bases[base-1]){
  const forced=state.bases.slice(0,base).every(Boolean),to=forced?base+1:base;
  runners.push({from:base,to,out:base===1,outAt:base===1?forceAt:null,arrival:to===base?0:forceRunnerTime(base,to)});
 }
 runners.push({from:0,to:1,out:doublePlay,outAt:doublePlay?arrival:null,arrival:forceRunnerTime(0,1)});
 return {outs:doublePlay?2:1,forceAt,finishAt:arrival,throwPlan:throws,runners,doublePlay,
  label:doublePlay?'DOUBLE PLAY':"FIELDER’S CHOICE",detail:doublePlay?'2루 포스 아웃 → 1루 아웃 · 병살':'2루 포스 아웃 · 타자는 1루 세이프'};
}
