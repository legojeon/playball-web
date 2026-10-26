// Shared rendered/physical boundary. Photo-based, not a surveyed replica.
// The fair-field fence retains FIELD dimensions.
import {FIELD} from './field.js?v=102';
const pole=FIELD.fence/Math.sqrt(2);
const half=[[pole,pole],[65,51],[45,27],[27,9],[16,-7],[8,-15],[0,-17]];
export const FOUL_BOUNDARY=[...half,...half.slice(0,-1).reverse().map(([x,z])=>[-x,z])];
export const DUGOUT={length:18,depth:4.5,height:2.1};
const normals=FOUL_BOUNDARY.slice(1).map((p,i)=>{const a=FOUL_BOUNDARY[i],dx=p[0]-a[0],dz=p[1]-a[1],d=Math.hypot(dx,dz);return [-dz/d,dx/d];});
export function boundaryPoint(index,offset=0){
 const p=FOUL_BOUNDARY[index],a=normals[Math.max(0,index-1)],b=normals[Math.min(index,normals.length-1)],den=1+a[0]*b[0]+a[1]*b[1];
 return [p[0]+offset*(a[0]+b[0])/den,p[1]+offset*(a[1]+b[1])/den];
}
export function bowlSections(){
 const result=[];
 for(let i=0;i<normals.length;i++){
  const a=FOUL_BOUNDARY[i],b=FOUL_BOUNDARY[i+1],count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8);
  for(let j=0;j<count;j++)result.push({segment:i,normal:normals[i],edge(offset=0){const p=boundaryPoint(i,offset),q=boundaryPoint(i+1,offset),at=t=>p.map((v,k)=>v+(q[k]-v)*t);return [at(j/count),at((j+1)/count)];}});
 }
 return result;
}
export function dugoutPose(side){
 const normal=[side/Math.sqrt(2),-1/Math.sqrt(2)];
 return {x:side*36+normal[0]*DUGOUT.depth/2,z:18+normal[1]*DUGOUT.depth/2,angle:Math.atan2(normal[0],normal[1]),normal};
}
export function fieldOutline(){
 const arc=Array.from({length:65},(_,i)=>{const a=-Math.PI/4+i/64*Math.PI/2;return [Math.sin(a)*FIELD.fence,Math.cos(a)*FIELD.fence];});
 return [...arc,...FOUL_BOUNDARY.slice(1,-1)];
}

const PLAYABLE_OUTLINE=fieldOutline();
export function inPlayTerritory(p){
 if(!Number.isFinite(p.x)||!Number.isFinite(p.z))return false;
 // Use the exact circular wall in fair territory, not its rendered polygon chords.
 if(p.z>=Math.abs(p.x))return Math.hypot(p.x,p.z)<=FIELD.fence+1e-7;
 let inside=false;
 for(let i=0,j=PLAYABLE_OUTLINE.length-1;i<PLAYABLE_OUTLINE.length;j=i++){
  const [ax,az]=PLAYABLE_OUTLINE[j],[bx,bz]=PLAYABLE_OUTLINE[i],dx=bx-ax,dz=bz-az;
  const u=((p.x-ax)*dx+(p.z-az)*dz)/(dx*dx+dz*dz);
  if(u>=0&&u<=1&&Math.hypot(p.x-ax-u*dx,p.z-az-u*dz)<1e-7)return true;
  if((az>p.z)!==(bz>p.z)&&p.x<(bx-ax)*(p.z-az)/(bz-az)+ax)inside=!inside;
 }
 return inside;
}
export function firstOutOfPlay(samples){
 for(let i=0;i<samples.length;i++){
  const b=samples[i];if(inPlayTerritory(b))continue;
  if(!i)return {...b};
  const a=samples[i-1];let lo=0,hi=1;
  const at=u=>({t:a.t+(b.t-a.t)*u,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u});
  for(let step=0;step<24;step++){const mid=(lo+hi)/2;if(inPlayTerritory(at(mid)))lo=mid;else hi=mid;}
  return at(hi);
 }
 return null;
}
