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
// Wrist offsets are local to the forearm. Never aim the glove at the camera,
// player forward vector or world axes; the whole mitt follows the arm's rotation.
export function presentGlove(p,{low=false,weight=1}={}){
 const hand=p.userData.hands?.[0];if(!hand)return;
 const bend=.22*(1-Number(low)),q=new T.Quaternion().setFromEuler(new T.Euler(bend,-.15,0));
 hand.quaternion.slerp(q,weight);p.updateMatrixWorld(true);
}
// Low balls meet the fingertip edge; raised catches use the pocket center.
export function glovePoint(p,low=0){p.updateMatrixWorld(true);const edge=p.userData.gloveType==='first'?.29:p.userData.gloveType==='catcher'?.25:.245;return p.userData.hands[0].localToWorld(V(0,-.13-(edge-.13)*low,.052));}
export function reachGlove(p,target,low=0){
 const wrist=handPoint(p,0);
 for(let i=0;i<5;i++){presentGlove(p,{low});wrist.add(target.clone().sub(glovePoint(p,low)));reachHand(p,0,wrist);}
 presentGlove(p,{low});return glovePoint(p,low);
}
export function poseCatcher(s,p,time){
 if(!p.userData.hips||!p.userData.hands)return;
 s.poseRunning(p,0,false);
 const {hips,torso,head,limbs,knees}=p.userData,hipY=.43+.003*Math.sin(time*1.7),lower=Math.hypot(.41,.055);
 hips.position.y=hipY;torso.position.y=hipY+.03;torso.rotation.x=.23;head.rotation.x=-.16;
 for(const [j,i]of [0,2].entries()){
  const z=.26,down=hipY-.06,d=Math.hypot(z,down);
  limbs[i].position.x=(j?1:-1)*.23;
  limbs[i].rotation.x=-Math.atan2(z,down)-Math.acos((.32**2+d*d-lower**2)/(2*.32*d));
  knees[j].rotation.x=Math.PI-Math.acos((.32**2+lower**2-d*d)/(2*.32*lower))+Math.atan2(.055,.41);
 }
 reachHand(p,0,local(p,[-.04,.86,.43]));
 // Bare hand stays protected behind the right thigh instead of hanging in front.
 reachHand(p,1,local(p,[.23,.53,-.09]));presentGlove(p);
}
const mix=(a,b,u)=>a.map((v,i)=>T.MathUtils.lerp(v,b[i],u));
// Fixed snapshots of distinct dugout activities; baked once for mobile rendering.
export const BENCH_POSES=['lean','watch','chat','relax','clasp','applaud','hands-on-hips','cheer'];
export function poseBench(s,p,index){
 s.poseRunning(p,0,false);const {limbs,knees,torso,hips,head}=p.userData;
 const kind=((index%8)+8)%8,seated=kind<6;
 p.userData.benchPose=BENCH_POSES[kind];
 if(seated){
  hips.position.y=.49;torso.position.y=.52;
  const lean=[.30,.07,.16,-.06,.26,.12][kind],turn=[0,-.12,.40,-.18,.06,.10][kind];
  torso.rotation.set(lean,turn,kind===3?-.06:0);head.rotation.set(-lean*.65,kind===2?.28:-turn*.5,0);
  // Independently placed feet: splayed knees and one foot tucked back slightly.
  for(const [j,i]of [0,2].entries()){
   const z=.29+((kind+j)%3)*.045,down=.43,lower=Math.hypot(.41,.055),d=Math.hypot(z,down);
   limbs[i].position.x=(j?1:-1)*(.15+(kind===0?.035:0));
   limbs[i].rotation.set(-Math.atan2(z,down)-Math.acos((.32**2+d*d-lower**2)/(2*.32*d)),0,0);
   knees[j].rotation.set(Math.PI-Math.acos((.32**2+lower**2-d*d)/(2*.32*lower))+Math.atan2(.055,.41),0,0);
  }
 }else{
  torso.rotation.set(.06,kind===6?-.10:.14,0);head.rotation.set(-.05,-torso.rotation.y*.6,0);
 }
 const hands=[
  [[-.18,.59,.34],[.18,.59,.34]], // forearms on thighs
  [[-.18,.56,.23],[.18,.56,.25]], // sitting upright
  [[-.18,.57,.29],[.26,.91,.27]], // talking with a teammate
  [[-.30,.48,-.05],[.19,.55,.28]], // one hand braced on seat
  [[-.04,.62,.39],[.04,.62,.39]], // hands clasped between knees
  [[-.045,.99,.36],[.045,.99,.36]], // hands together to applaud
  [[-.25,.91,.03],[.25,.91,.03]], // standing, hands on hips
  [[-.30,1.64,.18],[.26,1.10,.26]], // one arm raised to cheer
 ][kind];
 for(const side of [0,1])reachHand(p,side,local(p,hands[side]));
}

// One full left/right sprint cycle spans this travelled distance. Short contact
// phases alternate with flight; recovery folds the heel before driving the knee.
export const RUN_STRIDE=2.6;
const RUN_CONTACT=.24;
const recovery=[
 [.24,-.374,.06,-RUN_STRIDE,0], [.40,-.23,.43,2.0,.7],
 [.65,.35,.32,.9,-1.0], [.84,.40,.15,-.5,-.9], [1,.25,.06,-RUN_STRIDE,0],
];
function runFoot(phase){
 if(phase<=RUN_CONTACT)return {z:.25-RUN_STRIDE*phase,y:.06};
 const i=recovery.findIndex(k=>k[0]>=phase),a=recovery[i-1],b=recovery[i],span=b[0]-a[0],u=(phase-a[0])/span;
 const h00=2*u**3-3*u**2+1,h10=u**3-2*u**2+u,h01=-2*u**3+3*u**2,h11=u**3-u**2;
 return {z:h00*a[1]+h10*span*a[3]+h01*b[1]+h11*span*b[3],y:h00*a[2]+h10*span*a[4]+h01*b[2]+h11*span*b[4]};
}
export function sprintPose(p,step,weight){
 const {limbs,knees,elbows,hips,torso,head}=p.userData;
 const cycle=((step/(Math.PI*2))%1+1)%1,half=cycle%.5;
 const lift=half<RUN_CONTACT?.06*Math.sin(Math.PI*half/RUN_CONTACT)**2:.10*Math.sin(Math.PI*(half-RUN_CONTACT)/(.5-RUN_CONTACT))**2;
 const hipY=.68+lift,lower=Math.hypot(.41,.055);
 hips.position.y=T.MathUtils.lerp(.79,hipY,weight);torso.position.y=hips.position.y+.03;
 // Keep the pelvis square while a foot is planted; shoulders provide counter-rotation.
 hips.rotation.set(0,0,0);torso.rotation.set(.28*weight,Math.sin(step)*.13*weight,Math.sin(step)*.035*weight);
 head.rotation.set(-.15*weight,-torso.rotation.y*.7,-torso.rotation.z*.5);
 for(const [j,i]of [0,2].entries()){
  const phase=(cycle+j*.5)%1,foot=runFoot(phase),down=hipY-foot.y,d=T.MathUtils.clamp(Math.hypot(foot.z,down),.025,.729);
  const thigh=-Math.atan2(foot.z,down)-Math.acos(T.MathUtils.clamp((.32**2+d*d-lower**2)/(2*.32*d),-1,1));
  const knee=Math.PI-Math.acos(T.MathUtils.clamp((.32**2+lower**2-d*d)/(2*.32*lower),-1,1))+Math.atan2(.055,.41);
  limbs[i].rotation.set(thigh*weight,0,0);knees[j].rotation.set(knee*weight,0,0);
  // Bent elbows swing opposite the leg, close to the ribs rather than sideways.
  const pump=-Math.sin(step+j*Math.PI);
  limbs[i+1].rotation.set((.10+.70*pump)*weight,0,(j?-1:1)*.06*weight);
  elbows[j].rotation.set((-1.20+.22*pump)*weight,0,0);
 }
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
 const gloveLow=(ground?1:1-ease(catchPoint.y-p.position.y,.65,1.05))*(1-gather),pocket=reachGlove(p,glove,gloveLow);
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
export function posePrepared(s,p,time,{runner=false,intensity=.45,offset=0,look=0,role='infield'}={}){
 const {limbs,knees,elbows,hips,torso,head}=p.userData;
 if(!hips||!torso||knees?.length!==2||!head)return;
 s.poseRunning(p,0,false);
 const outfield=role==='outfield',corner=role==='corner';
 const breath=Math.sin(time*1.8+offset),load=Math.sin(time*1.05+offset),hipY=(outfield?.75:.715)-(runner?.035:outfield?.03:corner?.065:.05)*intensity+.007*breath;
 hips.position.set(0,hipY,0);hips.rotation.set(0,0,0);torso.position.set(0,hipY+.03,0);
 const lower=Math.hypot(.41,.055),soleAngle=Math.atan2(.055,.41);
 for(const [j,i]of [0,2].entries()){
  const z=runner?.26+(j?-.04:.04):.28,down=hipY-.06,d=Math.hypot(z,down);
  limbs[i].position.set((j?1:-1)*(runner?.18:outfield?.19:corner?.245:.23),0,0);
  const thigh=-Math.atan2(z,down)-Math.acos(T.MathUtils.clamp((.32**2+d*d-lower**2)/(2*.32*d),-1,1));
  const knee=Math.PI-Math.acos(T.MathUtils.clamp((.32**2+lower**2-d*d)/(2*.32*lower),-1,1))+soleAngle;
  limbs[i].rotation.set(thigh,0,0);knees[j].rotation.set(knee,0,0);
 }
 torso.rotation.set((runner?.13:outfield?.10:.18)+(outfield?.07:.12)*intensity,T.MathUtils.clamp(look,-.7,.7)*.25,load*.012);
 for(const [j,i]of [1,3].entries()){
  limbs[i].rotation.set(runner?(j?.12:-.16):-.32-.12*intensity,0,(j?-1:1)*(runner?.08:.12));
  elbows[j].rotation.set(runner?-.95+load*.035: -.58-.15*intensity,0,0);
 }
 head.rotation.set(-torso.rotation.x*.75,T.MathUtils.clamp(look-torso.rotation.y,-1.1,1.1),-torso.rotation.z*.6);
 if(!runner){
  const y=outfield?.91:corner?.62:.68,z=outfield?.34:.44;
  reachHand(p,0,local(p,[-.12,y,z]));reachHand(p,1,local(p,[.15,y+.06,z-.035]));
  presentGlove(p,{low:!outfield});
 }
 const nodes=[hips,torso,head,...limbs,...knees,...elbows,...(p.userData.hands||[])];
 p.userData.preparedPose??=nodes.map(node=>({node,position:new T.Vector3(),rotation:new T.Quaternion()}));
 for(const saved of p.userData.preparedPose){saved.position.copy(saved.node.position);saved.rotation.copy(saved.node.quaternion);}
}
