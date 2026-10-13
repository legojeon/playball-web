import {FIELD,BASES} from './field.js?v=89';
export const BALL={mass:.145,radius:.0366};
const AIR=1.2,AREA=Math.PI*BALL.radius**2,K=.5*AIR*AREA/BALL.mass;
export function sampleTrajectory(samples,time){
 if(time<=0)return samples[0];if(time>=samples.at(-1).t)return samples.at(-1);
 let lo=0,hi=samples.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid].t<=time)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],u=(time-a.t)/(b.t-a.t);
 return {t:time,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};
}
export function traceBall(origin,velocity,spin=0,{dt=1/120,maxTime=14,drag=.35,wall=true}={}){
 let {x,y,z}=origin,[vx,vy,vz]=velocity,t=0,rolling=false,firstBounce=null,homeRun=false,groundRuleDouble=false,wallHit=false,maxHeight=y;
 const samples=[{t,x,y,z}];
 for(let step=0;t<maxTime;step++){
  const previous={t,x,y,z},speed=Math.hypot(vx,vy,vz),horizontal=Math.hypot(vx,vz);
  if(rolling){
   const next=Math.max(0,horizontal-3.8*dt),ratio=horizontal?next/horizontal:0;vx*=ratio;vz*=ratio;vy=0;
  }else{
   const s=BALL.radius*Math.abs(spin)*Math.PI/30*Math.exp(-t/25)/Math.max(speed,.1);
   const lift=spin===0?0:Math.min(.30,s/(.4+2.32*s))*K*speed*speed*Math.sign(spin);
   const dragFactor=K*drag*speed;
   const ax=-dragFactor*vx-(horizontal?lift*vx/horizontal*vy/Math.max(speed,.1):0);
   const az=-dragFactor*vz-(horizontal?lift*vz/horizontal*vy/Math.max(speed,.1):0);
   const ay=-9.81-dragFactor*vy+lift*horizontal/Math.max(speed,.1);
   vx+=ax*dt;vy+=ay*dt;vz+=az*dt;
  }
  x+=vx*dt;y+=vy*dt;z+=vz*dt;t+=dt;maxHeight=Math.max(maxHeight,y);
  if(y<BALL.radius){
   if(firstBounce===null)firstBounce={t,x,y:BALL.radius,z};y=BALL.radius;
   if(Math.abs(vy)<1.3){rolling=true;vy=0;}else{vy=Math.abs(vy)*.32;vx*=.76;vz*=.76;}
  }
  const radius=Math.hypot(x,z);
  if(wall&&fairTerritory({x,z})&&radius>=FIELD.fence&&!wallHit){
   const oldRadius=Math.hypot(previous.x,previous.z),u=(FIELD.fence-oldRadius)/(radius-oldRadius);
   const crossHeight=previous.y+(y-previous.y)*Math.max(0,Math.min(1,u));
   if(crossHeight>FIELD.fenceHeight){homeRun=!firstBounce;groundRuleDouble=!!firstBounce;samples.push({t,x,y,z});break;}
   const nx=x/radius,nz=z/radius,normal=vx*nx+vz*nz;vx-=1.35*normal*nx;vz-=1.35*normal*nz;
   x=nx*(FIELD.fence-.03);z=nz*(FIELD.fence-.03);wallHit=true;
  }
  if(step%2===1)samples.push({t,x,y,z});
  if(rolling&&Math.hypot(vx,vz)<.4)break;
 }
 if(samples.at(-1).t<t)samples.push({t,x,y,z});
 return {samples,firstBounce,homeRun,groundRuleDouble,wallHit,maxHeight,duration:t,carry:firstBounce?Math.hypot(firstBounce.x-origin.x,firstBounce.z-origin.z):Math.hypot(x-origin.x,z-origin.z)};
}

export const fairTerritory=p=>p.z>=0&&Math.abs(p.x)<=p.z;
// First landing beyond 1st/3rd, first touch, or a grounder's passage past the
// bases decides fair/foul. Launch direction alone ignores the contact offset.
export function isFairBall(trace,fielding=null){
 const baseZ=BASES[1][2],bounce=trace.firstBounce;
 if(fielding?.caught)return fairTerritory(fielding.point);
 if(bounce&&bounce.z>=baseZ)return fairTerritory(bounce);
 const samples=trace.samples;
 if(bounce){
  for(let i=1;i<samples.length;i++){
   const a=samples[i-1],b=samples[i];
   if(b.t<bounce.t)continue;
   if(fielding&&fielding.time<=b.t)return fairTerritory(fielding.point);
   if(a.z<baseZ&&b.z>=baseZ){const u=(baseZ-a.z)/(b.z-a.z);return fairTerritory({x:a.x+(b.x-a.x)*u,z:baseZ});}
  }
 }
 return fairTerritory(fielding&&fielding.time<samples.at(-1).t?fielding.point:samples.at(-1));
}
