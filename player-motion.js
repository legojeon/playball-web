import * as T from './vendor/three.module.min.js';
const V=(x,y,z)=>new T.Vector3(x,y,z),ease=T.MathUtils.smoothstep;
export const handPoint=(p,side)=>{p.updateMatrixWorld(true);return p.userData.hands[side].getWorldPosition(new T.Vector3());};
// Two-bone arm solve. Targets are world positions; the elbow bends outward/forward.
export function reachHand(p,side,target){
 const {torso,limbs,elbows}=p.userData,arm=limbs[side?3:1],elbow=elbows[side];
 p.updateMatrixWorld(true);const end=torso.worldToLocal(target.clone()),root=arm.position.clone(),delta=end.sub(root),d=T.MathUtils.clamp(delta.length(),.025,.569),axis=delta.normalize();
 const hint=V(side?.7:-.7,-.3,.75),bend=hint.addScaledVector(axis,-hint.dot(axis)).normalize();
 const along=(.28**2-.29**2+d*d)/(2*d),height=Math.sqrt(Math.max(0,.28**2-along**2)),joint=root.clone().addScaledVector(axis,along).addScaledVector(bend,height),wrist=root.clone().addScaledVector(axis,d);
 arm.quaternion.setFromUnitVectors(V(0,-1,0),joint.clone().sub(root).normalize());
 elbow.quaternion.copy(arm.quaternion).invert().multiply(new T.Quaternion().setFromUnitVectors(V(0,-1,0),wrist.sub(joint).normalize()));
 p.updateMatrixWorld(true);return handPoint(p,side);
}
const local=(p,v)=>{p.updateMatrixWorld(true);return p.localToWorld(V(...v));};
const mix=(a,b,u)=>a.map((v,i)=>T.MathUtils.lerp(v,b[i],u));
export function poseBench(s,p,index){
 s.poseRunning(p,0,false);const {limbs,knees,torso,hips,head}=p.userData;
 // Seat top .43m: pelvis just above it, horizontal thighs, soles on the floor.
 hips.position.y=.49;torso.position.y=.52;torso.rotation.x=.10+(index%3)*.035;
 for(const [j,i]of [0,2].entries()){limbs[i].rotation.set(-1.50,0,(j?1:-1)*.12);knees[j].rotation.set(1.50,0,0);}
 head.rotation.set(-.06,(index%3-1)*.16,0);
 for(const side of [0,1])reachHand(p,side,local(p,[side?.19:-.19,.53,.27+(index%2)*.03]));
}
// The same pose is sampled for contact, glove-to-hand transfer and release anchors.
// u=0 receive; .36 both hands meet; .72 arm loaded; 1 release; 1.55 follow-through.
export function poseTransfer(s,p,u,{incoming,outgoing,catchPoint,ground=false}){
 s.poseRunning(p,0,false);const {limbs,knees,hips,torso,head}=p.userData;
 const gather=ease(u,0,.36),load=ease(u,.36,.77),snap=ease(u,.77,1),follow=ease(u,1,1.55),turn=ease(u,0,.70),low=(ground?1:0)*(1-gather);
 p.rotation.set(0,incoming+Math.atan2(Math.sin(outgoing-incoming),Math.cos(outgoing-incoming))*turn,0);
 limbs[0].rotation.set(-1.15*low-.20*load+.12*snap,0,-.07);limbs[2].rotation.set(-1.15*low+.18*load+.30*follow,0,.07);
 knees.forEach(k=>k.rotation.set(2.30*low+.23*(1-low),0,0));limbs[0].position.x=-.105-.07*low;limbs[2].position.x=.105+.07*low;
 torso.rotation.set(.78*low+.08*load+.28*follow,.40*load-.65*snap-.25*follow,-.05*snap);
 hips.rotation.set(0,.18*load-.40*snap,0);head.rotation.set(-torso.rotation.x*.65,-torso.rotation.y*.7,0);s.plantAthleteFeet(p);
 // Hips lead the shoulder turn. The hands meet at the chest before separating.
 const chest=local(p,[0,1.07,.30]),glove=catchPoint.clone().lerp(chest,gather);
 if(u>.36)glove.copy(local(p,mix([0,1.07,.30],[-.19,1.04,.14],Math.max(load,follow))));
 const pocket=reachHand(p,0,glove);
 let hand;
 if(u<=.36){const offset=local(p,[.13*(1-gather),.12*(1-gather),0]).sub(local(p,[0,0,0]));hand=pocket.clone().add(offset);}
 else if(u<=.77)hand=chest.clone().lerp(local(p,[.43,1.46,-.18]),load);
 else if(u<=1)hand=local(p,[.43,1.46,-.18]).lerp(local(p,[.18,1.54,.43]),snap);
 else hand=local(p,[.18,1.54,.43]).lerp(local(p,[-.28,.89,.39]),follow);
 const throwing=reachHand(p,1,hand);
 return {glove:pocket,hand:throwing,ball:u<.36?pocket:throwing};
}
// Sampling must not leave a future pose in a paused or skipped frame.
export function samplePose(p,fn){
 const nodes=[p,p.userData.hips,p.userData.torso,p.userData.head,...p.userData.limbs,...p.userData.knees,...p.userData.elbows,...p.userData.hands];
 const saved=nodes.map(n=>[n.position.clone(),n.rotation.clone()]);
 try{return fn();}finally{nodes.forEach((n,i)=>{n.position.copy(saved[i][0]);n.rotation.copy(saved[i][1]);});p.updateMatrixWorld(true);}
}

// Walking uses a planted stance and a low foot recovery arc instead of a slow run.
export function walkingLegs(p,step,weight){
 for(const [j,i]of [0,2].entries()){
  const phase=((step+j*Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2),swing=phase>Math.PI,u=swing?(phase-Math.PI)/Math.PI:phase/Math.PI;
  const z=swing?T.MathUtils.lerp(-.28,.28,ease(u,0,1)):.28-.56*u,y=.06+(swing?Math.sin(u*Math.PI)**2*.10:0),down=.72-y,d=Math.min(.729,Math.hypot(z,down));
  const thigh=-Math.atan2(z,down)-Math.acos(T.MathUtils.clamp((.32**2+d*d-.41**2)/(2*.32*d),-1,1));
  const knee=Math.PI-Math.acos(T.MathUtils.clamp((.32**2+.41**2-d*d)/(2*.32*.41),-1,1));
  p.userData.limbs[i].rotation.x=thigh*weight;p.userData.knees[j].rotation.x=knee*weight;
 }
}

// Prepared stances keep both feet anchored. Small knee/hip changes transfer
// weight without a looping run-in-place or sideways foot sliding.
export function anticipation(time,phase,pitch){
 if(phase==='pitch')return 1;
 if(phase==='windup'&&pitch)return .45+.55*ease((time-pitch.windupAt)/pitch.windup,.25,.95);
 return ['ready','stance'].includes(phase)?.45:.25;
}
export function posePrepared(s,p,time,{runner=false,intensity=.45,offset=0,look=0}={}){
 const {limbs,knees,elbows,hips,torso,head}=p.userData;
 if(!hips||!torso||knees?.length!==2||!head)return;
 s.poseRunning(p,0,false);
 const breath=Math.sin(time*1.8+offset),load=Math.sin(time*1.05+offset),hipY=.715-(runner?.035:.045)*intensity+.007*breath;
 hips.position.set(0,hipY,0);hips.rotation.set(0,0,0);torso.position.set(0,hipY+.03,0);
 const lower=Math.hypot(.41,.055),soleAngle=Math.atan2(.055,.41);
 for(const [j,i]of [0,2].entries()){
  const z=runner?.26+(j?-.04:.04):.28,down=hipY-.06,d=Math.hypot(z,down);
  limbs[i].position.set((j?1:-1)*(runner?.18:.22),0,0);
  const thigh=-Math.atan2(z,down)-Math.acos(T.MathUtils.clamp((.32**2+d*d-lower**2)/(2*.32*d),-1,1));
  const knee=Math.PI-Math.acos(T.MathUtils.clamp((.32**2+lower**2-d*d)/(2*.32*lower),-1,1))+soleAngle;
  limbs[i].rotation.set(thigh,0,0);knees[j].rotation.set(knee,0,0);
 }
 torso.rotation.set((runner?.13:.14)+.12*intensity,T.MathUtils.clamp(look,-.7,.7)*.25,load*.012);
 for(const [j,i]of [1,3].entries()){
  limbs[i].rotation.set(runner?(j?.12:-.16):-.32-.12*intensity,0,(j?-1:1)*(runner?.08:.12));
  elbows[j].rotation.set(runner?-.95+load*.035: -.58-.15*intensity,0,0);
 }
 head.rotation.set(-torso.rotation.x*.75,T.MathUtils.clamp(look-torso.rotation.y,-1.1,1.1),-torso.rotation.z*.6);
 const nodes=[hips,torso,head,...limbs,...knees,...elbows];
 p.userData.preparedPose??=nodes.map(node=>({node,position:new T.Vector3(),rotation:new T.Quaternion()}));
 for(const saved of p.userData.preparedPose){saved.position.copy(saved.node.position);saved.rotation.copy(saved.node.quaternion);}
}
