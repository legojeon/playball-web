import * as T from './vendor/three.module.min.js';
const V=(...p)=>new T.Vector3(...p);
// Metres and milliseconds. The visible mesh and collision solver share this profile.
export const BAT={profile:[[-.12,.018],[.16,.016],[.48,.034],[.82,.034]],sweet:.68,mass:.88,inertia:.055,center:.50};
export const RELEASE_ARC={start:85,end:135};
export const SWING={duration:500,contact:.22,impactDelay:110,scale:1,gripY:0,sweetY:BAT.sweet,angularSpeed:48,attack:8*Math.PI/180};
const axisAt=angle=>V(-Math.cos(angle),Math.sin(angle)*Math.sin(SWING.attack),Math.sin(angle)*Math.cos(SWING.attack));
function activePose(ms,aim){
 const angle=.15+(ms-SWING.impactDelay)*SWING.angularSpeed/1000,axis=axisAt(angle);
 const grip=V(aim.x,aim.y,aim.z).addScaledVector(axisAt(.15),-BAT.sweet);
 return {grip,rotation:new T.Quaternion().setFromUnitVectors(V(0,1,0),axis),turn:1.45+(ms-SWING.impactDelay)*.014};
}
// A rotating barrel, with no pause at contact. Touch starts the forward swing.
export function swingPose(sw,aim){
 const ms=T.MathUtils.clamp(sw,0,1)*SWING.duration;
 if(ms>=65&&ms<=155)return activePose(ms,aim);
 const ready={grip:V(.95,1.35,-.75),rotation:new T.Quaternion().setFromUnitVectors(V(0,1,0),V(.2,.96,-.2).normalize()),turn:0};
 const finish={grip:V(.48,1.48,-.55),rotation:new T.Quaternion().setFromUnitVectors(V(0,1,0),V(-.28,.75,-.60).normalize()),turn:2.35};
 const a=ms<65?ready:activePose(155,aim),b=ms<65?activePose(65,aim):finish;
 const u=T.MathUtils.smoothstep(ms,ms<65?0:155,ms<65?65:400);
 return {grip:a.grip.clone().lerp(b.grip,u),rotation:a.rotation.clone().slerp(b.rotation,u),turn:T.MathUtils.lerp(a.turn,b.turn,u)};
}
export function batPoint(ms,aim,along){
 const pose=swingPose(ms/SWING.duration,aim);
 return pose.grip.clone().addScaledVector(V(0,1,0).applyQuaternion(pose.rotation),along);
}
export function batVelocity(ms,aim,along){return batPoint(ms+.05,aim,along).sub(batPoint(ms-.05,aim,along)).multiplyScalar(10000);}
export function batRadius(along){
 const a=BAT.profile;for(let i=1;i<a.length;i++)if(along<=a[i][0])return T.MathUtils.lerp(a[i-1][1],a[i][1],T.MathUtils.clamp((along-a[i-1][0])/(a[i][0]-a[i-1][0]),0,1));
 return a.at(-1)[1];
}
export function makeBatShape(material){
 const group=new T.Group();
 BAT.profile.slice(1).forEach(([end,r],i)=>{const [start,r0]=BAT.profile[i],m=new T.Mesh(new T.CylinderGeometry(r,r0,end-start,20),material);m.position.y=(start+end)/2;group.add(m);});
 for(const [s,r]of [BAT.profile[0],BAT.profile.at(-1)]){const m=new T.Mesh(new T.SphereGeometry(r,20,12),material);m.position.y=s;group.add(m);}
 // A contrasting band identifies the aim point on the barrel in live and ghost meshes.
 const band=new T.Mesh(new T.CylinderGeometry(batRadius(BAT.sweet)+.0002,batRadius(BAT.sweet)+.0002,.018,20),material.clone());
 band.material.color.set('#244b51');band.onBeforeRender=()=>{band.material.opacity=material.opacity;};band.position.y=BAT.sweet;group.add(band);
 return group;
}
// Two rigid arm segments; the elbow bends outside the hands' path.
export function armElbow(shoulder,wrist,pole,upper=.38,lower=.40){
 const delta=wrist.clone().sub(shoulder),distance=delta.length(),axis=delta.clone().normalize();
 const d=Math.max(.021,Math.min(upper+lower-.001,distance));
 // Shoulder translation represents a small torso lean for extreme reaches.
 const root=distance>d?shoulder.clone().addScaledVector(axis,distance-d):shoulder.clone();
 const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const bend=pole.clone().sub(root).addScaledVector(axis,-pole.clone().sub(root).dot(axis));
 if(bend.lengthSq()<1e-8)bend.set(0,-1,0);bend.normalize();
 return {root,elbow:root.clone().addScaledVector(axis,along).addScaledVector(bend,height)};
}
