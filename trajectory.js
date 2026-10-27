import {FIELD,BASES} from './field.js?v=113';
export const BALL={mass:.145,radius:.0366};
// Match the visible dirt apron, grass diamond and warning track. Coefficients
// are game-tuned: shallow skips retain speed, grass absorbs more than dirt.
export function groundSurface(x,z){
 const diamond=Math.abs(x)+Math.abs(z-20)<15;
 const apron=z>=18.44?Math.hypot(x,z-18.44)<26.5:z>=-4&&Math.abs(x)<26.5*(z+4)/22.44;
 const mound=Math.hypot(x,z-18.44),home=Math.hypot(x,z+.2)<4,track=Math.hypot(x,z)>106;
 const cutout=BASES.slice(1,4).some(([bx,,bz])=>Math.hypot(x-bx,z-bz)<2.15),dirt=(apron&&!diamond)||mound<2.6||home||track||cutout;
 let height=diamond?.03:apron?.015:track?-.015:-.024;
 if(home)height=.021;if(cutout)height=.032;
 if(mound<2.6){const profile=[[0,.28],[1.3,.28],[1.8,.24],[2.25,.12],[2.6,.024]];const i=profile.findIndex(([r])=>r>=mound),a=profile[Math.max(0,i-1)],b=profile[i];height=a[1]+(b[1]-a[1])*(b[0]===a[0]?0:(mound-a[0])/(b[0]-a[0]));}
 return dirt?{restitution:.42,friction:.32,rolling:3.8,height}:{restitution:.34,friction:.40,rolling:5.2,height};
}
const AIR=1.2,AREA=Math.PI*BALL.radius**2,K=.5*AIR*AREA/BALL.mass;
export function sampleTrajectory(samples,time){
 if(time<=0)return samples[0];if(time>=samples.at(-1).t)return samples.at(-1);
 let lo=0,hi=samples.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid].t<=time)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],u=(time-a.t)/(b.t-a.t);
 return {t:time,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};
}
export function traceBall(origin,velocity,spin=0,{dt=1/120,maxTime=14,drag=.35,wall=true}={}){
 let {x,y,z}=origin,[vx,vy,vz]=velocity,t=0,rolling=false,firstBounce=null,homeRun=false,groundRuleDouble=false,wallHit=false,maxHeight=y,flightSpin=spin;
 const samples=[{t,x,y,z}],bounces=[];
 const record=point=>{if(point.t>samples.at(-1).t+1e-10)samples.push(point);};
 for(let step=0;t<maxTime;step++){
  const previous={t,x,y,z},speed=Math.hypot(vx,vy,vz),horizontal=Math.hypot(vx,vz);
  if(rolling){
   const next=Math.max(0,horizontal-groundSurface(x,z).rolling*dt),ratio=horizontal?next/horizontal:0;vx*=ratio;vz*=ratio;vy=0;
  }else{
   const s=BALL.radius*Math.abs(flightSpin)*Math.PI/30*Math.exp(-t/25)/Math.max(speed,.1);
   const lift=flightSpin===0?0:Math.min(.30,s/(.4+2.32*s))*K*speed*speed*Math.sign(flightSpin);
   const dragFactor=K*drag*speed;
   const ax=-dragFactor*vx-(horizontal?lift*vx/horizontal*vy/Math.max(speed,.1):0);
   const az=-dragFactor*vz-(horizontal?lift*vz/horizontal*vy/Math.max(speed,.1):0);
   const ay=-9.81-dragFactor*vy+lift*horizontal/Math.max(speed,.1);
   vx+=ax*dt;vy+=ay*dt;vz+=az*dt;
  }
  x+=vx*dt;y+=vy*dt;z+=vz*dt;t+=dt;maxHeight=Math.max(maxHeight,y);
  if(y<BALL.radius&&!rolling){
   // Insert the actual ground contact between regular samples. Interpolating
   // across an omitted impact otherwise makes the ball appear to hover/bend.
   const u=Math.max(0,Math.min(1,(previous.y-BALL.radius)/(previous.y-y))),impact={t:previous.t+dt*u,x:previous.x+(x-previous.x)*u,y:BALL.radius,z:previous.z+(z-previous.z)*u};
   firstBounce??=impact;record(impact);
   const ground=groundSurface(impact.x,impact.z),down=Math.abs(vy),horizontalSpeed=Math.hypot(vx,vz),up=down*ground.restitution;
   // Ground deformation adds a small surface loss; the main friction impulse
   // grows with impact angle. Shallow grounders retain more forward speed.
   const loss=Math.min(horizontalSpeed*.24,horizontalSpeed*ground.friction*.15+ground.friction*(1+ground.restitution)*down),ratio=horizontalSpeed?1-loss/horizontalSpeed:0;
   vx*=ratio;vz*=ratio;rolling=up<.55;vy=rolling?0:up;flightSpin*=.4;
   bounces.push({...impact,incoming:down,outgoing:vy,speedBefore:horizontalSpeed,speedAfter:Math.hypot(vx,vz),rolling});
   const remaining=dt*(1-u);x=impact.x+vx*remaining;z=impact.z+vz*remaining;y=BALL.radius+vy*remaining;
  }
  const radius=Math.hypot(x,z);
  if(wall&&fairTerritory({x,z})&&radius>=FIELD.fence&&!wallHit){
   const oldRadius=Math.hypot(previous.x,previous.z),u=(FIELD.fence-oldRadius)/(radius-oldRadius);
   const crossHeight=previous.y+(y-previous.y)*Math.max(0,Math.min(1,u));
   if(crossHeight>FIELD.fenceHeight){homeRun=!firstBounce;groundRuleDouble=!!firstBounce;samples.push({t,x,y,z});break;}
   const nx=x/radius,nz=z/radius,normal=vx*nx+vz*nz;vx-=1.35*normal*nx;vz-=1.35*normal*nz;
   x=nx*(FIELD.fence-.03);z=nz*(FIELD.fence-.03);wallHit=true;
  }
  if(step%2===1)record({t,x,y,z});
  if(rolling&&Math.hypot(vx,vz)<.4)break;
 }
 if(samples.at(-1).t<t)samples.push({t,x,y,z});
 return {samples,bounces,firstBounce,homeRun,groundRuleDouble,wallHit,maxHeight,duration:t,carry:firstBounce?Math.hypot(firstBounce.x-origin.x,firstBounce.z-origin.z):Math.hypot(x-origin.x,z-origin.z)};
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
