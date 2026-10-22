import {teamTheme} from './teams.js?v=97';
import {followAim} from './contact-window.js?v=97';
import * as T from './vendor/three.module.min.js';
import {PitchFrames,planePoint,screenPoint,DISPLAY_BALL_RADIUS} from './aiming.js?v=97';
import {feedbackOpacity,swingFeedbackOpacity} from './feedback.js?v=97';
import {CONTACT_Z,ZONE,pitchVisual,pitchState} from './pitch.js?v=97';
import {SWING,swingPose,armElbow,makeBatShape} from './swing.js?v=97';
import {BASES,FIELDERS,FIELD,runnerArrival,fielderDistance} from './field.js?v=97';
import {throwPlan,throwPosition,defensiveHome,forceRunnerStart,defenseAssignments,defensePosition} from './fielding.js?v=97';
import {sampleTrajectory} from './trajectory.js?v=97';
export {BASES} from './field.js?v=97';
import {FOUL_BOUNDARY,DUGOUT,boundaryPoint,bowlSections,dugoutPose,fieldOutline} from './stadium-layout.js?v=97';
const V=(x,y,z)=>new T.Vector3(x,y,z);
const stand=n=>[BASES[n][0]+(n===2?1.8:n===1?.5:-.5),.04,BASES[n][2]-.25];
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.9,...extra});
export const STADIUM_TOUR={orbit:8000,settle:1600,duration:9600};
// CSS-pixel readability for batted/returned balls; physics and pitched-ball size
// remain unchanged. Limit world enlargement and ease it in after impact.
export const BATTED_BALL_VIEW={nearScale:1.35,minDiameter:4.8,farDiameter:2.2,maxScale:12,easeMs:180};
export function battedBallScale(depth,height,fov){
 const diameter=DISPLAY_BALL_RADIUS*height/(Math.max(.1,depth)*Math.tan(fov*Math.PI/360));
 const minimum=T.MathUtils.lerp(BATTED_BALL_VIEW.minDiameter,BATTED_BALL_VIEW.farDiameter,T.MathUtils.smoothstep(depth,20,85));
 return T.MathUtils.clamp(minimum/diameter,BATTED_BALL_VIEW.nearScale,BATTED_BALL_VIEW.maxScale);
}
export class Stadium {
 constructor(canvas,{onFieldCatch}={}){
  this.onFieldCatch=onFieldCatch;
  this.canvas=canvas;this.inputFrames=new PitchFrames();this.scene=new T.Scene();this.scene.background=new T.Color('#b8d3d1');this.scene.fog=new T.Fog('#b8d3d1',100,210);
  this.camera=new T.PerspectiveCamera(86,1,.08,250);this.playPosition=V(0,1.65,-1.65);this.stancePosition=V(.55,1.65,-1.65);this.camera.position.copy(this.playPosition);this.camera.lookAt(0,(ZONE.bottom+ZONE.top)/2,CONTACT_Z);this.playView=this.camera.quaternion.clone();this.stanceAt=null;
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.scene.add(new T.HemisphereLight('#f2f3de','#577450',2.3));const sun=new T.DirectionalLight('#ffe4b9',2.8);sun.position.set(-30,60,-10);this.scene.add(sun);
  this.materials={grass:mat('#538769'),dirt:mat('#bd9473'),line:mat('#f2ebcf'),jersey:mat('#ecebde'),helmet:mat('#243e51'),skin:mat('#c79975'),pants:mat('#dddcca'),shoe:mat('#24383b'),runner:mat('#c8323b')};
  this.materials.runnerHelmet=this.materials.helmet.clone();
  this.makeField();this.makeStadium();this.makeBackStands();this.pitcher=this.makePlayer(false);this.pitcher.position.set(0,.23,18.44);this.pitcher.rotation.y=Math.PI;this.pitcher.scale.setScalar(1.15);this.scene.add(this.pitcher);
  this.pitcherFootShadows=[0,1].map(()=>{const m=this.mesh(new T.CircleGeometry(.18,18),this.shadowMat.clone());m.rotation.x=-Math.PI/2;return m;});
  this.fielders=[];for(const [x,z] of FIELDERS){const p=this.makePlayer(false);p.position.set(x,0,z);p.rotation.y=Math.PI;this.scene.add(p);this.fielders.push(p);}
  this.catcher=this.makePlayer(false);this.catcher.position.set(0,0,-2);this.scene.add(this.catcher);
  this.runners=Array.from({length:4},()=>{const p=this.makePlayer(true);p.visible=false;p.scale.setScalar(1.18);this.scene.add(p);return p;});
  const ballMat=mat('#fffbe7',{roughness:.75,transparent:true});this.ball=new T.Group();this.ball.add(new T.Mesh(new T.SphereGeometry(DISPLAY_BALL_RADIUS,16,12),ballMat));
  for(const s of [-1,1]){const curve=new T.EllipseCurve(0,0,.074,.076,-1.5,1.5,false);const pts=curve.getPoints(25).map(p=>V(s*(p.x-.029)*.446,p.y*.446,.044*.446));this.ball.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#b14c40',transparent:true})));}
  this.ballMaterials=this.ball.children.map(o=>o.material);this.ball.visible=false;this.scene.add(this.ball);
  this.makeZone();this.makeBat();this.makeSwingMark();this.makeBatterBody();this.moves=[];this.staticBases=[false,false,false];this.hit=null;
  this.labelEls=[1,2,3].map(n=>document.getElementById('runner'+n));
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
 }
 mesh(geo,material,x=0,y=0,z=0,parent=this.scene){const m=new T.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;}
 box(w,h,d,material,x,y,z,parent){return this.mesh(new T.BoxGeometry(w,h,d),material,x,y,z,parent);}
 flatShape(points,material,y=.015){const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const mesh=this.mesh(new T.ShapeGeometry(shape),material,0,y,0);mesh.rotation.x=-Math.PI/2;return mesh;}
 stripe(a,b,width,material,y=.035){const mid=V((a[0]+b[0])/2,y,(a[1]+b[1])/2),length=Math.hypot(a[0]-b[0],a[1]-b[1]);const m=this.box(width,.015,length,material,...mid.toArray());m.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);return m;}
 makeField(){
  const m=this.materials;
  this.mesh(new T.PlaneGeometry(450,450),mat('#7a8580'),0,-.04,40).rotation.x=-Math.PI/2;
  const turf=document.createElement('canvas');turf.width=turf.height=512;const tc=turf.getContext('2d');tc.fillStyle='#52834b';tc.fillRect(0,0,512,512);tc.fillStyle='#659654';for(let i=-512;i<1024;i+=64){tc.beginPath();tc.moveTo(i,0);tc.lineTo(i+32,0);tc.lineTo(i+544,512);tc.lineTo(i+512,512);tc.fill();}
  const grassTexture=new T.CanvasTexture(turf);grassTexture.colorSpace=T.SRGBColorSpace;
  grassTexture.wrapS=grassTexture.wrapT=T.RepeatWrapping;grassTexture.repeat.set(1/160,1/160);
  this.flatShape(fieldOutline(),mat('#ffffff',{map:grassTexture}),-.024);
  const foulTrack=mat('#a95f4c');for(let i=0;i<FOUL_BOUNDARY.length-1;i++)this.flatShape([boundaryPoint(i,-2.6),boundaryPoint(i+1,-2.6),boundaryPoint(i+1),boundaryPoint(i)],foulTrack,-.008);
  this.mesh(new T.RingGeometry(106,110,96,1,Math.PI*1.25,Math.PI*.5),mat('#bc9969'),0,-.015,0).rotation.x=-Math.PI/2;
  this.flatShape([[0,-4],[23,20],[0,45],[-23,20]],m.dirt);
  this.flatShape([[0,5],[15,20],[0,35],[-15,20]],m.grass,.03);
  const homeCircle=this.mesh(new T.CircleGeometry(4,40),m.dirt,0,.021,-.2);homeCircle.rotation.x=-Math.PI/2;
  const mound=this.mesh(new T.CylinderGeometry(2,2.4,.28,40),mat('#cca783'),0,.14,18.44);this.box(.65,.035,.14,m.line,0,.3,18.8);
  for(let i=1;i<4;i++){const [x,,z]=BASES[i];const b=this.box(.65,.15,.65,m.line,x,.1,z);b.rotation.y=Math.PI/4;}
  for(const side of [-1,1]){this.stripe([0,0],[side*FIELD.fence/Math.sqrt(2),FIELD.fence/Math.sqrt(2)],.09,m.line);this.stripe([side*.45,-1.85],[side*1.55,-1.85],.035,m.line);this.stripe([side*1.55,-1.85],[side*1.55,.35],.035,m.line);this.stripe([side*.45,.35],[side*1.55,.35],.035,m.line);}
  this.flatShape([[-.3,.4],[.3,.4],[.3,0],[0,-.28],[-.3,0]],m.line,.04);
  const shadowMat=new T.MeshBasicMaterial({color:'#1c3a34',transparent:true,opacity:.22,depthWrite:false});
  this.shadowMat=shadowMat;
 }
 stadiumSign(text,w,h,x,y,z,angle=0,color='#d7e4cf',background='#1b3933',parent=this.scene){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle=background;c.fillRect(0,0,1024,256);c.fillStyle=color;c.font='bold 80px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,512,128,980);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const mesh=this.mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}),x,y,z,parent);mesh.rotation.y=angle+Math.PI;return mesh;
 }
 makeStadium(){
  const wall=mat('#173f34'),concrete=mat('#aeb6ad'),dark=mat('#203c38'),sand=mat('#c8b286');
  const seats=new T.InstancedMesh(new T.BoxGeometry(.8,.7,.7),mat('#426c58'),24*6*12),dummy=new T.Object3D();let n=0;
  const fans=new T.InstancedMesh(new T.CylinderGeometry(.19,.24,.6,5),mat('#bc3b43'),24*6*12),heads=new T.InstancedMesh(new T.SphereGeometry(.15,6,4),mat('#c99e7a'),24*6*12);let crowd=0;
  const spectator=(x,y,z,a,index)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,a,0);dummy.updateMatrix();fans.setMatrixAt(crowd,dummy.matrix);fans.setColorAt(crowd,new T.Color(['#bd3442','#ece3d1','#344c64','#d0be95','#bc3945'][(index*7+index%3)%5]));dummy.position.y+=.43;dummy.updateMatrix();heads.setMatrixAt(crowd,dummy.matrix);crowd++;};
  for(let i=0;i<24;i++){
   const a=-Math.PI/4+(i+.5)/24*Math.PI/2,x=Math.sin(a)*FIELD.fence,z=Math.cos(a)*FIELD.fence;
   const panel=this.box(7.3,4,1.2,wall,x,2,z);panel.rotation.y=a;
   const rail=this.box(7.3,.18,1.3,sand,x,4.08,z);rail.rotation.y=a;
   const greenZone=a>.35&&a<.80;
   if(greenZone){
    // Asymmetric lawn/terrace zone in left field, instead of a uniform seat ring.
    for(let row=0;row<4;row++){const r=115+row*2.6;const terrace=this.box(8.5,1.1,3,mat(row%2?'#568455':'#648d59'),Math.sin(a)*r,3.3+row*1.0,Math.cos(a)*r);terrace.rotation.y=a;for(let col=0;col<8;col++){const offset=(col-3.5)*.95;spectator(Math.sin(a)*r+Math.cos(a)*offset,4.45+row,Math.cos(a)*r-Math.sin(a)*offset,a,i+row+col);}}
    for(const offset of [-3,3]){const r=121,xx=Math.sin(a)*r+Math.cos(a)*offset,zz=Math.cos(a)*r-Math.sin(a)*offset;this.box(1.4,.15,1,sand,xx,6,zz);this.box(.15,1,.15,dark,xx,5.5,zz);}
   }else{
    for(let row=0;row<6;row++){
     const r=115+row*1.9,y=3+row*1.2;const tier=this.box(8.5,1.2,2.1,concrete,Math.sin(a)*r,y,Math.cos(a)*r);tier.rotation.y=a;
     for(let col=0;col<12;col++){const b=a+(col-5.5)*.0053;dummy.position.set(Math.sin(b)*r,y+.95,Math.cos(b)*r);dummy.rotation.set(0,b,0);dummy.updateMatrix();seats.setMatrixAt(n,dummy.matrix);seats.setColorAt(n,new T.Color(row===2||row===5?'#c9b146':col%5===0?'#9daba0':'#326c56'));spectator(dummy.position.x,y+1.2,dummy.position.z,b,i+row+col);n++;}
    }
   }
   if(i%3===0)this.stadiumSign(['HOME TEAM','PLAY BALL','BASEBALL CLUB','GO TEAM'][i/3%4|0],6.5,1.15,x*.992,2.2,z*.992,a,'#e9e5c8','#1c493c');
  }
  seats.count=n;fans.count=heads.count=crowd;this.scene.add(seats,fans,heads);
  // Large centre-field board: aligned with home plate and the pitcher.
  const board=new T.Group();board.name='centre-field-scoreboard';board.position.set(0,0,124);this.scene.add(board);
  this.scoreboardFrame=mat('#96363b',{fog:false});this.box(62,27,2,this.scoreboardFrame,0,25,0,board);
  this.box(60,25,2.1,new T.MeshBasicMaterial({color:'#10232b',fog:false}),0,25,-.12,board);
  for(const x of [-23,23])this.box(1.2,12,1.2,dark,x,6,.4,board);
  this.makeScoreboard(board);
  this.box(24,7,2,dark,0,6,112);this.stadiumSign('110',5,1.8,0,4,110.8,0,'#f1e3ac','#183e33');
  // A low building and white peaked canopy beyond the right-field terraces.
  const building=mat('#a8b5b5'),roof=mat('#e2e8df');this.box(52,14,16,building,-77,9,132);
  for(let i=0;i<7;i++){
   const x=-99+i*7;this.box(4.8,8,.3,mat('#5b7478'),x,10,123.8);this.mesh(new T.ConeGeometry(6,7,4),roof,x,21,132).rotation.y=Math.PI/4;
  }
  for(const side of [-1,1]){const x=side*110/Math.sqrt(2),z=110/Math.sqrt(2);this.box(.16,18,.16,mat('#dfb936'),x,9,z);}
  for(const x of [-75,75])for(const z of [50,112]){this.box(.45,30,.45,dark,x,15,z);this.box(10,2.8,.6,dark,x,29,z);for(let i=0;i<6;i++)this.box(1.1,1,.2,new T.MeshBasicMaterial({color:'#fff4d0'}),x-4+i*1.6,29,z-.4);}
  const cloudMat=new T.MeshBasicMaterial({color:'#dae4d9'});for(let i=0;i<9;i++){const cloud=this.mesh(new T.SphereGeometry(1,12,8),cloudMat,-110+i*28,43+(i%3)*7,155);cloud.scale.set(12,2.4,4);}
 }
 makeScoreboard(board){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=850;
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());
  const face=this.mesh(new T.PlaneGeometry(60,25),new T.MeshBasicMaterial({map:texture,fog:false}),0,25,-1.23,board);face.rotation.y=Math.PI;
  this.scoreboard={canvas,texture,key:null};this.updateScoreboard({runs:0,balls:0,strikes:0,outs:0,bases:[false,false,false]});
 }
 updateScoreboard(state){
  if(!this.scoreboard)return;
  const theme=this.teamTheme||teamTheme(null);this.scoreboard.state={...state,bases:[...state.bases]};
  const {canvas,texture}=this.scoreboard,key=JSON.stringify([state.inning||1,state.runs,state.balls,state.strikes,state.outs,...state.bases,state.batterName||'',state.teamName||'',state.average||'',theme.primary]);if(this.scoreboard.key===key)return;this.scoreboard.key=key;
  const c=canvas.getContext('2d'),text=(str,x,y,size,color='#ffffff',align='left')=>{c.fillStyle=color;c.font=`bold ${size}px sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillText(str,x,y);};
  c.fillStyle=theme.ink;c.fillRect(0,0,2048,850);c.fillStyle=theme.primary;c.fillRect(0,0,2048,145);text(state.teamName?`${state.teamName}  ·  ${state.average}`:'PLAY BALL!',1024,74,state.teamName?66:92,theme.onPrimary,'center');
  // Familiar scoreboard labels with plain numerals; player gets a dedicated strip.
  text('INNING',330,235,54,theme.light,'center');text(String(state.inning||1),330,340,154,'#ffffff','center');
  text('RUNS',330,480,54,theme.light,'center');
  const runsValue=String(state.runs);c.font='bold 190px sans-serif';
  const scoreSize=Math.min(190,190*560/Math.max(1,c.measureText(runsValue).width));
  text(runsValue,330,600,scoreSize,'#ffffff','center');
  c.strokeStyle='#76515b';c.lineWidth=4;c.beginPath();c.moveTo(660,200);c.lineTo(660,680);c.stroke();
  for(const [label,count,max,y,color]of[['B',state.balls,3,285,'#79d992'],['S',state.strikes,2,455,'#ffd35d'],['O',state.outs,2,625,'#ff7676']]){
   text(label,750,y,104,color);for(let i=0;i<max;i++){c.beginPath();c.arc(960+i*130,y,42,0,Math.PI*2);c.fillStyle=i<count?color:'#44363c';c.fill();c.strokeStyle=i<count?color:'#79636b';c.lineWidth=4;c.stroke();}
  }
  const diamond=(x,y,size,lit)=>{c.beginPath();c.moveTo(x,y-size);c.lineTo(x+size,y);c.lineTo(x,y+size);c.lineTo(x-size,y);c.closePath();c.fillStyle=lit?'#ffdb70':'#44363c';c.fill();c.strokeStyle=lit?'#fff0ad':'#79908a';c.lineWidth=5;c.stroke();};
  c.strokeStyle='#79636b';c.beginPath();c.moveTo(1670,280);c.lineTo(1890,460);c.lineTo(1670,640);c.lineTo(1450,460);c.closePath();c.stroke();
  diamond(1890,460,52,state.bases[0]);diamond(1670,280,52,state.bases[1]);diamond(1450,460,52,state.bases[2]);diamond(1670,640,25,false);
  text('1',1980,460,43,'#ffffff','center');text('2',1670,198,43,'#ffffff','center');text('3',1360,460,43,'#ffffff','center');
  c.fillStyle=theme.deep;c.fillRect(0,720,2048,130);
  if(state.batterName){
   c.font='bold 86px sans-serif';const width=c.measureText(state.batterName).width;
   text(state.batterName,1024,787,Math.min(86,86*1850/Math.max(1,width)),'#ffffff','center');
  }
  texture.needsUpdate=true;
 }
 makeBackStands(){
  const group=new T.Group();group.name='landers-inspired-infield-bowl';this.scene.add(group);this.backStands=group;
  const sections=bowlSections(),rows=10,columns=10,dummy=new T.Object3D();
  const concrete=mat('#b1b8ae'),dark=mat('#284b3f'),roofMat=mat('#d2dbd6',{side:T.DoubleSide}),ribbonMat=mat('#a2323b');this.stadiumRibbon=ribbonMat;
  const steps=new T.InstancedMesh(new T.BoxGeometry(1,1,1),concrete,sections.length*rows);
  const seats=new T.InstancedMesh(new T.BoxGeometry(.58,.65,.65),mat('#386a55'),sections.length*rows*columns);
  const fans=new T.InstancedMesh(new T.CylinderGeometry(.17,.22,.52,5),mat('#bc3b43'),sections.length*rows*columns);
  const heads=new T.InstancedMesh(new T.SphereGeometry(.13,6,4),mat('#c99e7a'),sections.length*rows*columns);let seat=0,step=0;
  const quad=(edge0,edge1,y,material)=>{const [a,b]=edge0,[c,d]=edge1,geo=new T.BufferGeometry().setFromPoints([V(a[0],y,a[1]),V(b[0],y,b[1]),V(d[0],y,d[1]),V(a[0],y,a[1]),V(d[0],y,d[1]),V(c[0],y,c[1])]);geo.computeVertexNormals();group.add(new T.Mesh(geo,material));};
  for(const [i,section] of sections.entries()){
   const {normal}=section,angle=Math.atan2(normal[0],normal[1]),place=(offset)=>{const [a,b]=section.edge(offset);return {x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,width:Math.hypot(b[0]-a[0],b[1]-a[1])};};
   const front=place(0);
   // Leave the dugout mouth open; its back wall continues the enclosure.
   const [wa,wb]=section.edge(),tx=(wb[0]-wa[0])/front.width,tz=(wb[1]-wa[1])/front.width;let spans=[[0,front.width]];
   for(const side of [-1,1]){const p=dugoutPose(side),cx=p.x-p.normal[0]*DUGOUT.depth/2,cz=p.z-p.normal[1]*DUGOUT.depth/2;
    if(Math.abs((cx-wa[0])*normal[0]+(cz-wa[1])*normal[1])<.01){const mid=(cx-wa[0])*tx+(cz-wa[1])*tz,lo=mid-DUGOUT.length/2,hi=mid+DUGOUT.length/2;spans=spans.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([a,b])=>b>a));}
   }
   for(const [a,b]of spans){const t=(a+b)/2,wall=this.box(b-a+.04,1.5,.45,dark,wa[0]+tx*t,.75,wa[1]+tz*t,group);wall.rotation.y=angle;}
   for(let row=0;row<rows;row++){
    const upper=row>=5,offset=5+row*1.8+(upper?2:0),y=2+row*1.45+(upper?3:0),p=place(offset);
    dummy.position.set(p.x,y,p.z);dummy.rotation.set(0,angle,0);dummy.scale.set(p.width+.12,1.45,2);dummy.updateMatrix();steps.setMatrixAt(step++,dummy.matrix);
    const [a,b]=section.edge(offset);
    for(let col=0;col<columns;col++){
     const u=(col+.5)/columns;dummy.position.set(a[0]+(b[0]-a[0])*u,y+1,a[1]+(b[1]-a[1])*u);dummy.scale.set(1,1,1);dummy.updateMatrix();seats.setMatrixAt(seat,dummy.matrix);seats.setColorAt(seat,new T.Color(row===3||row===7?'#d5b747':'#32624c'));
     dummy.position.y=y+1.2;dummy.updateMatrix();fans.setMatrixAt(seat,dummy.matrix);fans.setColorAt(seat,new T.Color(['#b63843','#e2d9bd','#324859','#c6cabe','#a5343c'][(i+row+col)%5]));
     dummy.position.y=y+1.6;dummy.updateMatrix();heads.setMatrixAt(seat,dummy.matrix);seat++;
    }
   }
   const p=place(14),ledge=this.box(p.width+.1,2.8,3.1,dark,p.x,10.2,p.z,group);ledge.rotation.y=angle;
   const r=place(12.35),ribbon=this.box(r.width+.1,.6,.2,ribbonMat,r.x,11.1,r.z,group);ribbon.rotation.y=angle;
   quad(section.edge(0),section.edge(5),.02,concrete);
   if(front.z<58){
    quad(section.edge(11),section.edge(25),22.5,roofMat);
    const [a,b]=section.edge(23);for(const q of [a,b])this.box(.22,24,.22,dark,q[0],12,q[1],group);
    const l=place(11),light=this.box(l.width*.85,.38,.38,new T.MeshBasicMaterial({color:'#fff0c8'}),l.x,22.3,l.z,group);light.rotation.y=angle;
   }
  }
  for(const mesh of [steps,seats,fans,heads]){mesh.instanceMatrix.needsUpdate=true;group.add(mesh);}
  for(let i=0;i<7;i++)this.box(.10,5,.10,dark,-9+i*3,2.5,-16,group);this.box(18,.08,.08,dark,0,5,-16,group);
  // Fixed world dimensions, baseline-parallel and recessed under front seating.
  for(const side of [-1,1]){
   const p=dugoutPose(side),g=new T.Group();g.name=side<0?'first-base-dugout':'third-base-dugout';g.position.set(p.x,0,p.z);g.rotation.y=p.angle;group.add(g);
   this.box(DUGOUT.length,DUGOUT.height,.3,dark,0,DUGOUT.height/2,DUGOUT.depth/2,g);
   this.box(DUGOUT.length,.22,DUGOUT.depth,ribbonMat,0,DUGOUT.height,0,g);
   for(const x of [-DUGOUT.length/2,DUGOUT.length/2])this.box(.25,DUGOUT.height,DUGOUT.depth,dark,x,DUGOUT.height/2,0,g);
   this.box(DUGOUT.length-1,.25,.65,mat('#778879'),0,.55,1.25,g);
   const home=side<0;
   const sign=this.stadiumSign(home?'HOME TEAM':'AWAY TEAM',DUGOUT.length-1,.6,0,DUGOUT.height+.13,-DUGOUT.depth/2-.02,0,'#fff3dd',home?'#a2323b':'#243e51',g);if(home)this.homeDugoutSign=sign;
   this.populateDugout(g,home);
  }
 }
 populateDugout(group,home){
  const player=this.makePlayer(home),parts=[];
  player.traverse(part=>{if(part.isMesh)parts.push({part,matrices:[]});});
  // Bake the bench poses into shared instances: eight players cost one draw per
  // model part, rather than eight complete animated player models on mobile.
  for(let i=0;i<8;i++){
   const seated=i<6;
   player.position.set(seated?-6+i*2.4:i===6?-7.5:7.5,seated?-.115:0,seated?1.2:-.8);
   player.rotation.y=Math.PI+(seated?0:i===6?-.2:.2);
   this.poseRunning(player,0,false);
   const {limbs,knees,elbows,head}=player.userData;
   if(seated){
    for(const leg of [limbs[0],limbs[2]])leg.rotation.x=-Math.PI/2;
    for(const knee of knees)knee.rotation.x=Math.PI/2;
    for(const arm of [limbs[1],limbs[3]])arm.rotation.x=-.28;
    for(const elbow of elbows)elbow.rotation.x=-1.05;
   }else for(const elbow of elbows)elbow.rotation.x=-.4;
   head.rotation.y=(i%3-1)*.12;
   player.children.at(-1).position.y=.025-player.position.y;
   player.updateMatrixWorld(true);
   for(const item of parts)item.matrices.push(item.part.matrixWorld.clone());
  }
  const roster=new T.Group();roster.name=home?'home-bench-players':'away-bench-players';
  for(const {part,matrices} of parts){
   const batch=new T.InstancedMesh(part.geometry,part.material,matrices.length);
   matrices.forEach((matrix,i)=>batch.setMatrixAt(i,matrix));batch.instanceMatrix.needsUpdate=true;
   roster.add(batch);
  }
  group.add(roster);
 }
 setTeam(team){
  const theme=this.teamTheme=teamTheme(team);this.scoreboardFrame?.color.set(theme.primary);this.stadiumRibbon?.color.set(theme.primary);
  if(this.scoreboard?.state)this.updateScoreboard({...this.scoreboard.state,teamName:team?.name||''});
  this.materials.runner.color.set(team?.primary||'#c8323b');
  this.materials.runnerHelmet.color.set(team?.secondary||'#243e51');
  const texture=this.homeDugoutSign?.material.map,canvas=texture?.image;
  if(canvas){const c=canvas.getContext('2d');c.fillStyle=theme.primary;c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle=theme.onPrimary;c.font='bold 80px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(team?.name||'HOME TEAM',canvas.width/2,canvas.height/2,canvas.width-50);texture.needsUpdate=true;}
 }
 makePlayer(runner){
  const m=this.materials,p=new T.Group();const jersey=runner?m.runner:m.jersey,helmet=runner?(m.runnerHelmet||m.helmet):m.helmet;
  const torso=new T.Group();torso.position.y=.82;p.add(torso);
  const hips=new T.Group();hips.position.y=.79;p.add(hips);
  const shirt=this.mesh(new T.CylinderGeometry(.23,.19,.58,10),jersey,0,.24,0,torso);shirt.scale.z=.70;
  this.box(.39,.045,.25,helmet,0,-.02,0,torso);
  // The shirt front and shoulder width make the trunk's side-on rotation readable.
  for(let i=0;i<3;i++)this.mesh(new T.SphereGeometry(.016,6,5),helmet,0,.16+i*.1,.154,torso);
  this.box(.12,.045,.018,helmet,.1,.34,.16,torso);
  this.mesh(new T.CylinderGeometry(.075,.09,.14,8),m.skin,0,.56,0,torso);
  const head=new T.Group();head.position.y=.75;torso.add(head);
  this.mesh(new T.SphereGeometry(.17,12,8),m.skin,0,0,0,head);
  this.mesh(new T.SphereGeometry(.183,12,8,0,Math.PI*2,0,Math.PI/2),helmet,0,.07,0,head);
  this.box(.27,.04,.19,helmet,0,.07,.16,head);
  const limbs=[],elbows=[],knees=[],hands=[];
  for(const side of [-1,1]){
   const leg=new T.Group();leg.position.set(side*.105,0,0);hips.add(leg);
   this.mesh(new T.CylinderGeometry(.077,.065,.32,7),m.pants,0,-.16,0,leg);
   const knee=new T.Group();knee.position.y=-.32;leg.add(knee);
   this.mesh(new T.CylinderGeometry(.065,.055,.32,7),m.pants,0,-.16,0,knee);
   this.box(.15,.10,.27,m.shoe,0,-.36,.055,knee);limbs.push(leg);knees.push(knee);
   const arm=new T.Group();arm.position.set(side*.22,.45,0);torso.add(arm);
   this.mesh(new T.CylinderGeometry(.075,.063,.28,7),jersey,0,-.14,0,arm);
   const elbow=new T.Group();elbow.position.y=-.28;arm.add(elbow);
   this.mesh(new T.CylinderGeometry(.063,.048,.29,7),m.skin,0,-.145,0,elbow);
   const hand=new T.Group();hand.position.y=-.29;elbow.add(hand);this.mesh(new T.SphereGeometry(.059,8,7),m.skin,0,0,0,hand);
   limbs.push(arm);elbows.push(elbow);hands.push(hand);
  }
  p.userData={limbs,elbows,knees,hands,torso,hips,head};
  const shadow=this.mesh(new T.CircleGeometry(.35,16),this.shadowMat,0,.025,0,p);shadow.rotation.x=-Math.PI/2;shadow.scale.set(1,1.7,1);
  if(!runner)this.mesh(new T.SphereGeometry(.13,8,7),mat('#8b6248'),0,0,.035,hands[0]);
  return p;
 }
 makeZone(){
  const {halfWidth:w,bottom,top}=ZONE,height=top-bottom,center=(bottom+top)/2;
  const points=[[-w,bottom,0],[w,bottom,0],[w,top,0],[-w,top,0],[-w,bottom,0]].map(p=>V(...p));
  this.zone=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#ecf5d7',transparent:true,opacity:0,depthTest:false}));this.zone.renderOrder=20;this.scene.add(this.zone);
  this.zoneFill=this.mesh(new T.PlaneGeometry(w*2,height),new T.MeshBasicMaterial({color:'#d9f3c5',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false,depthTest:false}),0,center,0);this.zoneFill.renderOrder=19;
  const grid=[];for(const x of [-w/3,w/3])grid.push(V(x,bottom,0),V(x,top,0));for(const y of [bottom+height/3,bottom+height*2/3])grid.push(V(-w,y,0),V(w,y,0));
  this.zoneGrid=new T.LineSegments(new T.BufferGeometry().setFromPoints(grid),new T.LineBasicMaterial({color:'#eaf5db',transparent:true,opacity:0,depthTest:false}));this.zoneGrid.renderOrder=21;this.scene.add(this.zoneGrid);
  this.pitchGhost=new T.Group();this.pitchGhost.visible=false;
  this.ghostMaterial=new T.MeshBasicMaterial({color:'#f5db81',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false,depthTest:false});
  const ghost=this.mesh(new T.CircleGeometry(.008,20),this.ghostMaterial,0,0,0,this.pitchGhost);ghost.renderOrder=24;
  const ring=this.mesh(new T.RingGeometry(DISPLAY_BALL_RADIUS*.88,DISPLAY_BALL_RADIUS,32),this.ghostMaterial,0,0,0,this.pitchGhost);ring.renderOrder=24;this.scene.add(this.pitchGhost);
  this.trail=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#f5db81',transparent:true,opacity:0,depthTest:false}));this.trail.renderOrder=22;this.scene.add(this.trail);
  this.zone.position.z=CONTACT_Z;this.zoneFill.position.z+=CONTACT_Z;this.zoneGrid.position.z=CONTACT_Z;
  this.lastPitchMark=null;
 }
 makeBat(){
  this.bat=makeBatShape(mat('#cfa568'));const glove=mat('#dfe7d1');this.grips=[];
  for(let i=0;i<2;i++){const g=this.mesh(new T.SphereGeometry(.047,10,8),glove,0,-.065+i*.095,.012,this.bat);g.scale.set(1.3,1,.9);this.grips.push(g);}
  this.scene.add(this.bat);this.scene.add(this.camera);this.bat.visible=false;
  this.aimPreview=new T.Group();this.aimPreview.visible=false;this.scene.add(this.aimPreview);
  const material=new T.MeshBasicMaterial({color:'#77e6ff',transparent:true,opacity:.33,depthWrite:false,depthTest:false});
  const bat=makeBatShape(material);bat.renderOrder=25;this.aimPreview.add(bat);
  this.aimPreviewPoses=[{bat,ms:SWING.impactDelay}];

 }
 setAimPreview(aim){
  this.rawPreviewAim=aim?{x:aim.x,y:aim.y,z:CONTACT_Z}:null;
  this.updateAimPreview();
 }
 updateAimPreview(){
  if(!this.aimPreview)return;
  const raw=this.rawPreviewAim;
  this.aimPreview.visible=!!raw;
  if(!raw)return;
  const aim=raw;
  for(const {bat,ms}of this.aimPreviewPoses){const pose=swingPose(ms/SWING.duration,aim);bat.position.copy(pose.grip);bat.quaternion.copy(pose.rotation);}
 }
 assistAim(raw){return this.guidedPitch?followAim(raw,this.guidedPitch,this.aimReferences||[]):raw;}
 updateBattingGuide(pitch,phase,time){
  this.guidedPitch=pitch&&phase==='pitch'&&!pitch.swung&&time>=pitch.start?pitch:null;
  const rect=this.canvas?.getBoundingClientRect?.()||{left:0,top:0,width:this.w,height:this.h};
  this.aimReferences=this.guidedPitch&&this.inputFrames?this.inputFrames.references(pitch,performance.now(),rect):[];
  this.updateAimPreview();
 }
 makeSwingMark(){
  this.swingMark=new T.Group();this.swingMark.visible=false;this.scene.add(this.swingMark);
  const material=color=>new T.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false,depthTest:false});
  this.swingBatMaterial=material('#77e6ff');this.swingBallMaterial=material('#ffe18a');
  this.swingGhostBat=makeBatShape(this.swingBatMaterial);this.swingMark.add(this.swingGhostBat);
  this.swingGhostBall=new T.Mesh(new T.SphereGeometry(DISPLAY_BALL_RADIUS,20,14),this.swingBallMaterial);this.swingMark.add(this.swingGhostBall);
  this.swingGapMaterial=new T.LineBasicMaterial({color:'#ff8e83',transparent:true,opacity:0,depthTest:false});
  this.swingGap=new T.Line(new T.BufferGeometry(),this.swingGapMaterial);this.swingMark.add(this.swingGap);
  this.swingMark.traverse(o=>o.renderOrder=30);this.lastSwingMark=null;
  this.reviewScene=new T.Scene();this.reviewScene.background=new T.Color('#123436');this.reviewCamera=new T.PerspectiveCamera(45,1.5,.01,100);
  this.reviewBat=makeBatShape(this.swingBatMaterial);this.reviewBall=this.swingGhostBall.clone();this.reviewGap=this.swingGap.clone();
  this.reviewScene.add(this.reviewBat,this.reviewBall,this.reviewGap);
 }
 showSwingMark(g,time){
  if(!g)return;
  this.lastSwingMark={g,start:time};this.swingGhostBat.position.copy(g.pose.grip);this.swingGhostBat.quaternion.copy(g.pose.rotation);
  this.swingGhostBall.position.copy(g.ball);this.swingBallMaterial.color.set(g.hit?'#ffe18a':'#ff8e83');
  this.swingGap.geometry.dispose();this.swingGap.geometry=new T.BufferGeometry().setFromPoints([g.point.clone().addScaledVector(g.normal,g.radius),g.ball.clone().addScaledVector(g.normal,-DISPLAY_BALL_RADIUS)]);
  this.reviewBat.position.copy(g.pose.grip);this.reviewBat.quaternion.copy(g.pose.rotation);this.reviewBall.position.copy(g.ball);this.reviewGap.geometry=this.swingGap.geometry;
  const ends=[g.pose.grip.clone().addScaledVector(g.axis,-.14),g.pose.grip.clone().addScaledVector(g.axis,.86),g.ball],bounds=new T.Box3().setFromPoints(ends),center=bounds.getCenter(V(0,0,0));
  const span=Math.max(.65,bounds.getSize(V(0,0,0)).length());
  this.reviewCamera.position.copy(center).add(V(span*.95,span*.55,-span*1.05));this.reviewCamera.lookAt(center);this.reviewCamera.updateMatrixWorld();
 }
 clearSwingMark(){this.lastSwingMark=null;if(this.swingMark)this.swingMark.visible=false;}
 drawSwingMark(time){
  if(!this.swingMark)return;
  const mark=this.lastSwingMark,alpha=mark?swingFeedbackOpacity(time-mark.start):0;this.swingMark.visible=alpha>0;
  this.swingBatMaterial.opacity=alpha*.48;this.swingBallMaterial.opacity=alpha*.85;this.swingGapMaterial.opacity=mark&&!mark.g.hit?alpha*.8:0;
 }
 makeBatterBody(){
  // Feet remain in the right-handed box, beside (never on) home plate.
  this.batterBody=new T.Group();this.scene.add(this.batterBody);
  const m=this.materials;
  const segment=(a,b,r,material,parent)=>{const v=V(...b).sub(V(...a)),mesh=this.mesh(new T.CylinderGeometry(r,r,v.length(),10),material,0,0,0,parent);mesh.position.copy(V(...a).add(V(...b)).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(V(0,1,0),v.normalize());return mesh;};
  for(const [z,kneeZ] of [[-1.22,-1.08],[-.37,-.55]]){
   segment([.84,.85,-.82],[.87,.47,kneeZ],.10,m.pants,this.batterBody);
   segment([.87,.47,kneeZ],[.86,.16,z],.085,m.pants,this.batterBody);
   this.box(.34,.13,.19,m.shoe,.78,.105,z,this.batterBody);
   this.box(.13,.02,.17,m.line,.72,.177,z,this.batterBody);
   const sh=this.mesh(new T.CircleGeometry(.21,18),this.shadowMat,.8,.048,z,this.batterBody);sh.rotation.x=-Math.PI/2;
  }
  this.forearms=[0,1].map(()=>[this.mesh(new T.CylinderGeometry(1,1,1,10),m.runner||m.jersey,0,0,0,this.scene),this.mesh(new T.CylinderGeometry(1,1,1,10),m.skin,0,0,0,this.scene)]);
 }
 beginStance(time){this.manualLook=null;this.stanceAt=time;this.followRun=null;this.followRotation=null;this.followReturn=null;if(this.staticBases)this.setBases(this.staticBases);}
 beginTour(time){this.beginStance(time);this.tourAt=time;}
 tourView(time){
  const elapsed=Math.max(0,time-this.tourAt),u=T.MathUtils.smoothstep(elapsed,0,STADIUM_TOUR.orbit),angle=u*Math.PI*2;
  this.camera.position.set(Math.sin(angle)*65,30+Math.sin(u*Math.PI)*6,40-Math.cos(angle)*65);
  this.camera.lookAt(0,3,35);
  if(elapsed>STADIUM_TOUR.orbit){
   const settle=T.MathUtils.smoothstep(elapsed-STADIUM_TOUR.orbit,0,STADIUM_TOUR.settle);
   const entryView=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(this.stancePosition,V(.36,.04,-.78),this.camera.up));
   this.camera.position.lerp(this.stancePosition,settle);this.camera.quaternion.slerp(entryView,settle);
  }
 }
 updateView(time,phase){
  this.batterBody.visible=phase==='stance'||phase==='intro'&&time-this.tourAt>=STADIUM_TOUR.duration-300;
  this.camera.position.copy(this.playPosition);this.camera.quaternion.copy(this.playView);
  if(phase==='intro')this.tourView(time);
  else if(phase==='stance'&&this.stanceAt!==null){
   const u=T.MathUtils.smoothstep(time-this.stanceAt,650,1900);
   this.camera.position.copy(this.stancePosition).lerp(this.playPosition,u);
   this.camera.lookAt(.36,.04,-.78);this.camera.quaternion.slerp(this.playView,u);
  }
  this.camera.updateMatrixWorld(true);
  for(const [id,point]of[['plate-tag',V(0,.08,.10)],['feet-tag',V(.84,.18,-1.1)]]){
   const el=document.getElementById(id);if(!el)continue;el.hidden=phase!=='stance';
   if(!el.hidden){point.project(this.camera);el.style.left=((point.x+1)*this.w/2)+'px';el.style.top=((1-point.y)*this.h/2)+'px';el.style.opacity=String(1-T.MathUtils.smoothstep(time-this.stanceAt,900,1600));}
  }
 }
 lookAround(dx,dy){
  if(!this.followRun)return;
  if(!this.manualLook){const d=this.camera.getWorldDirection(V(0,0,0));this.manualLook={yaw:Math.atan2(d.x,d.z),elevation:Math.asin(d.y)};}
  const sensitivity=this.camera.fov*Math.PI/180/Math.max(1,this.h);
  this.manualLook.yaw+=dx*sensitivity;
  this.manualLook.elevation=T.MathUtils.clamp(this.manualLook.elevation+dy*sensitivity,-Math.PI*5/12,Math.PI*5/12);
 }
 updateFollowView(time,phase){
  if(!this.playView||!this.playPosition)return;
  const run=phase==='result'?this.followRun:null;
  const active=phase==='result'&&(run||this.hit&&time>=this.hit.start);
  let heading=0;
  if(run){
   const t=this.runningProgress(run,time);
   const eye=this.runningPoint(run,t);eye.y+=this.playPosition.y-.04;
   if(run.eyeOffset)eye.addScaledVector(run.eyeOffset,1-T.MathUtils.smoothstep(time-run.start,0,480));
   // Use the very same route and clock as the batter-runner; no extra camera race.
   const leaving=run.departure?1:T.MathUtils.smoothstep(time-run.start,0,run.delay);
   this.camera.position.copy(this.playPosition).lerp(eye,leaving);
   const ahead=this.runningPoint(run,Math.min(1,t+.002)),behind=this.runningPoint(run,Math.max(0,t-.002));
   heading=Math.atan2(ahead.x-behind.x,ahead.z-behind.z);
   if(run.departure||this.moves?.length)run.player.visible=false;
   else if(!run.out&&run.to<4&&this.runners?.[run.to-1])this.runners[run.to-1].visible=false;
  }
  const dt=Math.max(0,time-(this.followTime??time))/1000;this.followTime=time;
  if(active){
   this.followReturn=null;
   this.followRotation??=this.playView.clone();
   // Follow the position drawHit actually rendered, including bounces and throws.
   // On a hit, look from the runner's eye. After the ball disappears, face the route.
   const followingBall=!run?.departure&&this.hit&&(!run||this.ball.visible);
   const d=followingBall?this.ball.position.clone().sub(this.camera.position):V(Math.sin(heading)*10,-1,Math.cos(heading)*10);
   if(d.length()>2.5){
    const relative=Math.atan2(Math.sin(Math.atan2(d.x,d.z)-heading),Math.cos(Math.atan2(d.x,d.z)-heading));
    const limit=run?Math.PI*5/9:Math.PI*5/12;
    const yaw=heading+T.MathUtils.clamp(relative,-limit,limit);
    const ballElevation=Math.atan2(d.y,Math.hypot(d.x,d.z));
    // Keep the ball in the upper part of the view so the horizon provides scale.
    const headElevation=ballElevation>0?Math.max(ballElevation*.60,ballElevation-(this.camera.fov/2-12)*Math.PI/180):ballElevation;
    const elevation=T.MathUtils.clamp(headElevation,-Math.PI/9,Math.PI*13/36);
    const target=V(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)).add(this.camera.position);
    this.camera.lookAt(target);
    this.followRotation.slerp(this.camera.quaternion,1-Math.exp(-8*dt));
   }
   this.camera.quaternion.copy(this.followRotation);
  }else if(this.followRotation&&['result','ready','over'].includes(phase)){
   this.followReturn??={start:time,rotation:this.followRotation.clone()};
   const u=T.MathUtils.smoothstep(time-this.followReturn.start,0,400);
   this.camera.quaternion.copy(this.followReturn.rotation).slerp(this.playView,u);
   if(u===1){this.followRotation=null;this.followReturn=null;}
  }else{this.followRotation=null;this.followReturn=null;}
  if(active&&run&&this.manualLook){
   const {yaw,elevation}=this.manualLook;
   this.camera.lookAt(this.camera.position.clone().add(V(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation))));
   this.followRotation.copy(this.camera.quaternion);
  }
  this.camera.updateMatrixWorld(true);
 }
 updateBallDisplay(time,phase){
  this.ball.scale.setScalar(1);
  if(phase!=='result'||!this.hit||!this.ball.visible)return;
  const depth=-this.ball.position.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
  const target=battedBallScale(depth,this.h,this.camera.fov),u=T.MathUtils.smoothstep(time-this.hit.start,0,BATTED_BALL_VIEW.easeMs);
  this.ball.scale.setScalar(1+(target-1)*u);
 }
 renderFirstPersonScene(phase){
  const hidden=[],hide=object=>{if(object?.visible){hidden.push(object);object.visible=false;}};
  if(phase==='result'&&this.followRun){
   // A base receiver and the runner camera can occupy the same bag. Suppress
   // only camera-intersecting models for this render, without moving physics.
   for(const player of [this.pitcher,this.catcher,...(this.fielders||[]),...(this.runners||[]),...(this.departurePool||[])]){
    if(!player?.visible)continue;
    const dx=player.position.x-this.camera.position.x,dz=player.position.z-this.camera.position.z;
    if(Math.hypot(dx,dz)<.85&&this.camera.position.y>=player.position.y-.1&&this.camera.position.y<player.position.y+2.3)hide(player);
   }
   // Batting arms are anchored at home, so do not view them from inside as
   // the eye transitions out of the batting box into the runner's route.
   if(this.camera.position.distanceTo(this.playPosition)>.15){hide(this.bat);for(const arm of this.forearms||[])for(const part of arm)hide(part);}
  }
  try{this.renderer.render(this.scene,this.camera);}finally{for(const object of hidden)object.visible=true;}
 }
 updateArms(turn){
  this.bat.updateMatrixWorld(true);
  this.grips.forEach((grip,i)=>{
   const wrist=grip.getWorldPosition(new T.Vector3()),side=i===0?1:-1;
   const shoulder=V(.75+Math.sin(turn)*side*.22,1.30,-.52+Math.cos(turn)*side*.22);
   const {root,elbow}=armElbow(shoulder,wrist,V(1.2,.65,i===0?-.2:-.85));
   const joints=[root,elbow,wrist];this.forearms[i].forEach((mesh,j)=>{const v=joints[j+1].clone().sub(joints[j]);mesh.position.copy(joints[j]).add(joints[j+1]).multiplyScalar(.5);mesh.scale.set(j===0?.065:.047,v.length(),j===0?.065:.047);mesh.quaternion.setFromUnitVectors(V(0,1,0),v.normalize());});
  });
 }
 zoneCenterScreen(){return screenPoint(V(0,(ZONE.bottom+ZONE.top)/2,CONTACT_Z),this.canvas.getBoundingClientRect(),this.camera);}
 aimAt(clientX,clientY){return planePoint(clientX,clientY,this.canvas.getBoundingClientRect(),this.camera);}
 tapContact(pitch,x,y,inputAt){return this.inputFrames.contact(pitch,x,y,this.canvas.getBoundingClientRect(),inputAt);}
 setSwingAim(aim,intent=0){this.swingAim=aim;this.swingIntent=intent;}
 posePitcher(t){
  // Hip rotation leads the chest. The throwing elbow circles behind the trunk,
  // then leads the hand through a three-quarter arm slot and across the body.
  // Each arm direction is expressed in the rotating chest's local coordinates.
  const poses=[
   {t:0,travel:0,hip:1.05,chest:1.12,lean:0,lift:0,knee:.1,back:0,arm:[.12,-.23,.10],fore:[-.18,.12,.22],glove:[-.1,-.20,.15],gf:[.12,.17,.20]},
   {t:.30,travel:0,hip:1.32,chest:1.48,lean:-.04,lift:-1.30,knee:1.8,back:.05,arm:[.12,-.23,.10],fore:[-.18,.12,.22],glove:[-.1,-.20,.15],gf:[.12,.17,.20]},
   {t:.52,travel:.15,hip:1.02,chest:1.38,lean:0,lift:-1.0,knee:1.0,back:.12,arm:[.14,-.23,-.12],fore:[.08,-.17,-.22],glove:[-.20,.02,.20],gf:[-.10,.08,.26]},
   {t:.73,travel:.47,hip:.40,chest:1.05,lean:.04,lift:-.82,knee:.4,back:.34,arm:[.26,.07,-.17],fore:[0,.24,-.18],glove:[-.20,.07,.20],gf:[-.10,.02,.27]},
   {t:.88,travel:.68,hip:-.10,chest:.56,lean:.12,lift:-.65,knee:.24,back:.52,arm:[.28,.04,-.05],fore:[-.02,.13,-.29],glove:[-.13,-.15,.20],gf:[.15,.10,.20]},
   {t:1,travel:.82,hip:-.33,chest:-.12,lean:.22,lift:-.56,knee:.2,back:.64,arm:[.10,.24,.16],fore:[-.015,.04,.29],glove:[-.08,-.24,.10],gf:[.16,.12,.18]},
   {t:1.18,travel:.89,hip:-.50,chest:-.70,lean:.48,lift:-.35,knee:.18,back:1.05,arm:[-.17,-.05,.24],fore:[-.22,-.19,.08],glove:[-.1,-.24,.08],gf:[.12,.18,.15]},
   {t:1.48,travel:.86,hip:-.56,chest:-.83,lean:.55,lift:-.26,knee:.12,back:1.42,arm:[-.18,-.20,.08],fore:[-.08,-.25,-.10],glove:[-.1,-.24,.08],gf:[.12,.18,.15]},
   {t:1.85,travel:.6,hip:-.2,chest:-.3,lean:.22,lift:-.16,knee:.1,back:.5,arm:[.08,-.27,.06],fore:[-.1,-.19,.19],glove:[-.1,-.24,.08],gf:[.12,.18,.15]},
   {t:2.35,travel:0,hip:1.05,chest:1.12,lean:0,lift:0,knee:.1,back:0,arm:[.12,-.23,.10],fore:[-.18,.12,.22],glove:[-.1,-.20,.15],gf:[.12,.17,.20]}
  ];
  t=Math.max(0,Math.min(2.35,t));let i=0;while(i<poses.length-2&&t>poses[i+1].t)i++;
  const a=poses[i],b=poses[i+1],u=T.MathUtils.smoothstep(t,a.t,b.t),v={};
  for(const k of Object.keys(a))v[k]=Array.isArray(a[k])?a[k].map((n,j)=>T.MathUtils.lerp(n,b[k][j],u)):T.MathUtils.lerp(a[k],b[k],u);
  const p=this.pitcher,{limbs:l,elbows:e,knees:k,torso,hips,head}=p.userData;
  p.position.set(0,.23,18.44-v.travel);p.rotation.set(0,Math.PI,0);
  hips.rotation.y=v.hip;torso.rotation.set(v.lean,v.chest,-.05*Math.sin(Math.min(1,t)*Math.PI));head.rotation.y=-v.chest*.85;
  l[0].rotation.set(v.lift,0,-.10);k[0].rotation.x=v.knee;l[2].rotation.set(v.back,0,.12);k[1].rotation.x=.10+v.back*.45;
  const direction=(key)=>{
   const down=V(0,-1,0),qa=new T.Quaternion().setFromUnitVectors(down,V(...a[key]).normalize());
   const qb=new T.Quaternion().setFromUnitVectors(down,V(...b[key]).normalize());return qa.slerp(qb,u);
  };
  const arm=(upper,elbow,key,fore)=>{
   upper.quaternion.copy(direction(key));elbow.quaternion.copy(upper.quaternion).invert().multiply(direction(fore));
  };
  arm(l[3],e[1],'arm','fore');arm(l[1],e[0],'glove','gf');
  // Keep the supporting sole on the mound as the stride lowers the hips.
  p.updateMatrixWorld(true);
  const soles=k.map(j=>j.localToWorld(V(0,-.41,.055)));
  const clearance=Math.min(...soles.map(f=>f.y-(Math.hypot(f.x,f.z-18.44)<2?.28:.035)));
  p.position.y-=clearance;
  this.pitcherFootShadows?.forEach((shadow,i)=>{const f=soles[i],ground=Math.hypot(f.x,f.z-18.44)<2?.28:.035;shadow.position.set(f.x,ground+.008,f.z);shadow.material.opacity=.3*Math.max(0,1-(f.y-clearance-ground)/.5);});

 }
 releasePoint(){this.posePitcher(1);this.pitcher.updateMatrixWorld(true);return this.pitcher.userData.hands[1].getWorldPosition(new T.Vector3());}
 resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;this.w=w;this.h=h;this.camera.aspect=w/h;this.camera.fov=w/h<.65?82:68;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
 setBases(bases){this.staticBases=[...bases];this.moves=[];this.runners.forEach((p,i)=>{p.visible=i<3&&bases[i];if(p.visible){p.position.set(...stand(i+1));p.rotation.y=Math.PI;}this.poseRunning(p,0,false);});}
 runningMove(player,from,to,walk,time){
  const path=[from===0?V(0,.04,0):V(...stand(from))];
  if(to!==from){
   for(let base=from+1;base<to;base++)path.push(V(BASES[base][0],.04,BASES[base][2]));
   path.push(to===4?V(0,.04,0):V(...stand(to)));
  }
  const lengths=path.slice(1).map((point,i)=>point.distanceTo(path[i]));
  const distance=lengths.reduce((a,b)=>a+b,0),speed=walk?FIELD.jogSpeed:FIELD.runnerSpeed;
  const delay=distance>0?400:0;
  const travel=from===0&&!walk?(runnerArrival(to)*1000-delay):distance/speed*1000+Math.max(0,to-from-1)*120;
  return {player,from,to,path,lengths,distance,walk,start:time,delay,travel:Math.max(1,travel),duration:Math.max(1,delay+travel)};
 }
 run(before,after,amount,walk,time){
  this.staticBases=[...after];this.moves=[];let index=0;
  before.forEach((exists,i)=>{if(!exists)return;let end=Math.min(4,i+1+amount);if(walk){const forced=before.slice(0,i+1).every(Boolean);end=forced?i+2:i+1;}this.moves.push(this.runningMove(this.runners[index++],i+1,end,walk,time));});
  this.moves.push(this.runningMove(this.runners[index],0,walk?1:amount,walk,time));
  this.followRun=this.moves.at(-1);
  this.runners.forEach(p=>p.visible=false);for(const move of this.moves){move.player.visible=true;move.player.position.copy(move.path[0]);}
  return Math.max(0,...this.moves.map(move=>move.duration));
 }
 runForcePlay(play,after,time,inningOver=false){
  this.staticBases=[...after];this.moves=[];this.runners.forEach(p=>p.visible=false);
  play.runners.forEach((r,i)=>{
   const move=this.runningMove(this.runners[i],r.from,r.to,false,time),start=forceRunnerStart(r.from),target=BASES[r.to];
   if(r.to!==r.from){move.path=[V(start.x,.04,start.z),V(target[0],.04,target[2])];move.lengths=[move.path[0].distanceTo(move.path[1])];move.distance=move.lengths[0];move.travel=r.arrival*1000-move.delay;move.duration=r.arrival*1000;}
   move.out=r.out;move.retire=inningOver||r.out;if(r.out)move.stopAt=time+r.outAt*1000;if(inningOver)move.stopAt=Math.min(move.stopAt??Infinity,time+play.finishAt*1000);
   move.player.visible=true;move.player.position.copy(move.path[0]);this.moves.push(move);if(r.from===0)this.followRun=move;
  });
  return Math.max(...this.moves.map(move=>{
   if(move.from===0&&move.retire){const exit=this.departurePlan(move,move.stopAt);return exit.start+exit.duration-time;}
   return Math.min(move.duration,(move.stopAt??Infinity)-time);
  }));
 }
 runningProgress(move,time){return T.MathUtils.clamp((Math.min(time,move.stopAt??Infinity)-move.start-move.delay)/move.travel,0,1);}
 poseRunning(player,step,moving=true,walk=false){
  // limbs are [left leg, left arm, right leg, right arm]. Opposite arm leads.
  const {limbs,knees=[],elbows=[],torso,hips}=player.userData;
  const phases=[0,Math.PI,Math.PI,0],amplitude=walk?.42:.60;
  limbs.forEach((limb,i)=>{limb.rotation.x=moving?Math.sin(step+phases[i])*amplitude:0;});
  knees.forEach((k,i)=>k.rotation.x=moving?.12+Math.max(0,-Math.sin(step+i*Math.PI))*(walk?.35:.8):0);
  elbows.forEach(e=>e.rotation.x=moving?-(walk?.4:1.0):0);
  if(torso)torso.rotation.set(moving?(walk?.04:.12):0,moving?Math.sin(step)*.06:0,0);
  if(hips)hips.rotation.y=moving?-Math.sin(step)*.04:0;
 }
 runningPoint(move,t){
  let distance=move.distance*Math.max(0,Math.min(1,t));
  for(let i=0;i<move.lengths.length;i++){
   const length=move.lengths[i];
   if(distance<=length)return move.path[i].clone().lerp(move.path[i+1],length?distance/length:1);
   distance-=length;
  }
  return move.path.at(-1).clone();
 }
 departurePlan(move,time){
  if(move.exit)return move.exit;
  const p=dugoutPose(-1),front=V(p.x-p.normal[0]*(DUGOUT.depth/2+1),.04,p.z-p.normal[1]*(DUGOUT.depth/2+1));
  const path=[this.runningPoint(move,this.runningProgress(move,time)),front,V(p.x,.04,p.z)];
  const lengths=path.slice(1).map((v,i)=>v.distanceTo(path[i])),distance=lengths.reduce((a,b)=>a+b,0),delay=240,travel=distance/4.2*1000;
  // Very early catches can happen before the eye has left the batting box.
  const eyeOffset=move.from===0&&this.playPosition?V(this.playPosition.x,.04,this.playPosition.z).sub(path[0]).multiplyScalar(1-T.MathUtils.smoothstep(time-move.start,0,move.delay)):null;
  return move.exit={path,lengths,distance,start:time,delay,travel,duration:delay+travel,departure:true,eyeOffset};
 }
 retireRunner(move,time){
  if(move.departed)return;
  move.departed=true;
  this.departures??=[];this.departurePool??=[];
  let player=this.departurePool.find(p=>!p.userData.departing);
  if(!player){player=this.makePlayer(true);player.scale.setScalar(1.18);this.scene?.add(player);this.departurePool.push(player);}
  player.userData.departing=true;player.visible=true;player.rotation.copy(move.player.rotation);
  const exit=this.departurePlan(move,time);exit.player=player;exit.rotation=player.rotation.y;
  player.position.copy(exit.path[0]);
  this.departures.push(exit);
  if(this.followRun===move)this.followRun=exit;
 }
 retireBatter(time){
  const move=this.runningMove(this.runners[3],0,0,true,time);
  move.path[0].set(this.playPosition.x,.04,this.playPosition.z);
  this.followRun=move;
  this.retireRunner(move,time);
  return move.exit.duration;
 }
 clearDepartures(){for(const p of this.departurePool??[]){p.visible=false;p.userData.departing=false;}this.departures=[];}
 updateDepartures(time){
  this.departures=(this.departures??[]).filter(move=>{
   const t=this.runningProgress(move,time),p=move.player;
   p.visible=t<1;
   p.position.copy(this.runningPoint(move,t));
   const ahead=this.runningPoint(move,Math.min(1,t+.003));
   const moving=time>move.start+move.delay&&t<1;
   const yaw=Math.atan2(ahead.x-p.position.x,ahead.z-p.position.z),turn=T.MathUtils.smoothstep(time-move.start,0,480);
   p.rotation.y=move.rotation+Math.atan2(Math.sin(yaw-move.rotation),Math.cos(yaw-move.rotation))*turn;
   const step=move.distance*t/3.6*Math.PI*2;
   this.poseRunning(p,step,moving,true);
   if(moving)p.position.y+=Math.abs(Math.sin(step))*.025;
   if(t===1){p.visible=false;p.userData.departing=false;return false;}
   return true;
  });
 }
 updateRunners(time){
  this.updateDepartures(time);
  if(!this.moves.length)return;
  let done=true;
  for(const move of this.moves){
   const t=this.runningProgress(move,time),end=move.retire?move.stopAt:Math.min(move.start+move.duration,move.stopAt??Infinity),finished=time>=end;if(!finished)done=false;
   const pos=this.runningPoint(move,t);move.player.position.copy(pos);
   if(!finished&&time>move.start+move.delay&&t<1&&move.distance>0){
    const ahead=this.runningPoint(move,Math.min(1,t+.003));move.player.rotation.y=Math.atan2(ahead.x-pos.x,ahead.z-pos.z);
    // Stride follows distance travelled, so jogs and longer routes stay natural.
    const step=move.distance*t/(move.walk?3.6:4)*Math.PI*2;
    this.poseRunning(move.player,step,true,move.walk);
    move.player.position.y+=Math.abs(Math.sin(step))*.045;
   }else this.poseRunning(move.player,0,false);
   if((move.out||move.retire)&&finished){this.retireRunner(move,end);move.player.visible=false;}
   else if(t>=1&&move.to>=4)move.player.visible=false;
  }
  if(done)this.setBases(this.staticBases);
 }
 runnerAt(progress){progress=Math.max(0,Math.min(4,progress));const a=Math.min(4,Math.floor(progress)),b=Math.min(4,a+1),f=progress-a;return V(BASES[a][0]+(BASES[b][0]-BASES[a][0])*f,.04,BASES[a][2]+(BASES[b][2]-BASES[a][2])*f);}
 pitchPosition(p,t){const q=pitchState(p,(t-1)*p.duration).position;return V(q.x,q.y,q.z);}
 hitBall(p,time,batted){
  this.defenseReturn=null;
  const h=this.hit={...batted,start:time,catchIndex:0,catchEvents:[]};
  if(batted.fielding&&!batted.caught)h.throwPlan??=throwPlan(batted.fielding,batted.throwBase);
  // Use the rendered pickup/throw plan and the pausable game clock, not timers.
  if(h.fielding){h.catchEvents.push({at:h.fielding.time,point:h.fielding.point});if(!h.caught)h.catchEvents.push(...h.throwPlan.legs.map(leg=>({at:leg.arrival,point:leg.to})));}
  return batted.animationTime*1000;
 }
 runOut(time,batted=null){
  const player=this.runners[3];player.visible=true;
  const move=this.runningMove(player,0,1,false,time);move.out=true;
  const outTime=batted?(batted.caught?batted.fielding?.time??batted.animationTime:batted.returnAt??batted.animationTime):move.duration/1000;
  move.stopAt=time+Math.max(0,outTime*1000);move.duration=Math.max(0,move.stopAt-time);
  this.moves=[move];this.followRun=move;
  return move.duration+this.departurePlan(move,move.stopAt).duration;
 }
 emitCatchSounds(h,time){
  if(!h)return;
  // Evaluate after the runner camera moves; consume final catches even if drawHit cleaned up.
  const t=(time-h.start)/1000;
  while(h.catchIndex<h.catchEvents?.length&&t+1e-9>=h.catchEvents[h.catchIndex].at){
   const {point}=h.catchEvents[h.catchIndex++],eye=this.camera.position;
   this.onFieldCatch?.(Math.hypot(point.x-eye.x,point.y-eye.y,point.z-eye.z));
  }
 }
 drawHit(time){
  const h=this.hit,elapsed=(time-h.start)/1000;
  // Render the decisive contact at least once, even across a dropped frame.
  const t=h.announcementAt!==undefined&&!h.announced?Math.min(elapsed,h.announcementAt):elapsed,fielding=h.fielding;
  h.renderedThrough=t;
  if(t>h.animationTime+.25){this.hit=null;return;}
  const point=sampleTrajectory(h.samples,Math.min(t,fielding?.time??Infinity));
  this.ball.position.set(point.x,point.y,point.z);this.ball.rotation.x=t*35;this.ball.visible=t<h.animationTime;
  if(!fielding)return;
  this.drawSupportDefense(h,t);
  const f=this.fielders[fielding.fielder],base=FIELDERS[fielding.fielder],target=fielding.point;
  const distance=Math.hypot(target.x-base[0],target.z-base[1]);
  const progress=Math.min(1,fielderDistance(t-FIELD.reaction-(fielding.fielder>=4?.12:0))/Math.max(.01,distance));
  f.position.set(base[0]+(target.x-base[0])*progress,0,base[1]+(target.z-base[1])*progress);
  f.rotation.y=Math.atan2(target.x-base[0],target.z-base[1]);
  if(progress>0&&progress<1)this.poseRunning(f,distance*progress/4*Math.PI*2,true);
  if(t<fielding.time)return;
  if(fielding.caught){this.ball.visible=false;f.userData.limbs[1].rotation.x=-2.5;return;}
  const plan=h.throwPlan||throwPlan(fielding,h.throwBase),ball=throwPosition(plan,t);
  this.ball.position.set(ball.x,ball.y,ball.z);
  f.rotation.y=Math.atan2(plan.legs[0].to.x-target.x,plan.legs[0].to.z-target.z);
  f.userData.limbs[3].rotation.x=t<plan.legs[0].release?-1.5:-.5;
  for(const l of plan.legs){
   const receiver=l.receiver===7?this.catcher:this.fielders[l.receiver];if(!receiver)continue;
   if(t>=l.arrival-.18){receiver.userData.limbs[1].rotation.x=-1.7;receiver.rotation.y=Math.atan2(l.from.x-l.to.x,l.from.z-l.to.z);}
  }
  if(plan.relay!==null&&plan.legs[1]&&t>=plan.legs[1].release){const relay=this.defensivePlayer(plan.relay);relay.rotation.y=Math.atan2(plan.target.x-relay.position.x,plan.target.z-relay.position.z);relay.userData.limbs[3].rotation.x=-1.8;}

 }
 defensivePlayer(i){return i===8?this.pitcher:i===7?this.catcher:this.fielders[i];}
 drawSupportDefense(hit,t){
  const f=hit.fielding;
  hit.defenseAssignments??=defenseAssignments(hit);
  for(const a of hit.defenseAssignments){
   const player=this.defensivePlayer(a.fielder);if(!player)continue;
   const pos=defensePosition(a,f,t),target=a.next&&t>f.time+.25?a.next:a.point;
   player.position.set(pos.x,0,pos.z);
   player.rotation.y=Math.atan2(pos.moving?target.x-pos.x:this.ball.position.x-pos.x,pos.moving?target.z-pos.z:this.ball.position.z-pos.z);
   this.poseRunning(player,pos.travel/4*Math.PI*2,pos.moving);
   if(pos.moving)player.position.y+=Math.abs(Math.sin(pos.travel/4*Math.PI*2))*.035;
   if(a.fielder===8)this.pitcherFootShadows?.forEach(shadow=>shadow.visible=false);
  }
 }
 rememberDefense(time){
  this.defenseReturn={time,players:[]};
  for(let i=0;i<9;i++){const p=this.defensivePlayer(i);if(p)this.defenseReturn.players.push({i,position:p.position.clone()});}
 }
 returnDefense(time,phase){
  const back=this.defenseReturn;if(!back)return;
  let done=true;
  for(const {i,position}of back.players){
   if(i===8&&['windup','pitch'].includes(phase))continue;
   const p=this.defensivePlayer(i),[x,z]=defensiveHome(i),d=Math.hypot(x-position.x,z-position.z);
   const duration=i===8?1500:Math.max(800,d/5.5*1000),u=T.MathUtils.clamp((time-back.time)/duration,0,1);
   if(u<1)done=false;
   p.position.copy(position).lerp(V(x,i===8?.23:0,z),u);
   p.rotation.y=u<1?Math.atan2(x-position.x,z-position.z):Math.PI;
   this.poseRunning(p,d*u/3.6*Math.PI*2,u<1&&d>.1,true);
   if(i===8)this.pitcherFootShadows?.forEach(shadow=>shadow.visible=u===1);
  }
  if(done)this.defenseReturn=null;
 }
 completePlay(time){
  // State was already saved at resolution; skipping only settles presentation.
  for(const move of this.moves){if((move.out||move.retire)&&!move.departed){const at=move.stopAt??time;this.retireRunner(move,at);this.departures.at(-1).start=time;}}
  this.hit=null;this.setBases(this.staticBases);this.followRun=null;this.manualLook=null;
  if(this.defenseReturn)this.defenseReturn.time=time;
 }
 showPitchMark(p,time,review=null){
  // Sample exactly the same trajectory as the moving ball, on the zone plane.
  // A swing shares its snapshot clock and lifetime; result resolution must not reset it.
  this.lastPitchMark={start:review?time:Math.max(time,p.start+p.duration),strike:p.isStrike,review};
  const point=pitchState(p,0).position;this.pitchGhost.position.set(point.x,point.y,point.z);
  const color=p.isStrike?'#ffe399':'#8be6ef';this.ghostMaterial.color.set(color);this.trail.material.color.set(color);
  const points=Array.from({length:14},(_,i)=>this.pitchPosition(p,.94+i*.06/13));
  this.trail.geometry.dispose();this.trail.geometry=new T.BufferGeometry().setFromPoints(points);
 }
 clearPitchMark(){this.lastPitchMark=null;this.pitchGhost.visible=false;this.zone.material.opacity=0;this.zoneGrid.material.opacity=0;this.zoneFill.material.opacity=0;this.trail.material.opacity=0;}
 poseBat(sw,phase){
  const aim=this.swingAim||{x:0,y:1.02,z:CONTACT_Z};
  const visible=phase!=='stance'&&sw>=0&&sw<.84;
  this.bat.visible=visible;this.forearms.flat().forEach(m=>m.visible=visible);
  const pose=swingPose(sw>=0&&sw<1?sw:0,aim);
  this.bat.quaternion.copy(pose.rotation);
  this.bat.position.copy(pose.grip).addScaledVector(V(0,1,0).applyQuaternion(pose.rotation),-SWING.gripY*SWING.scale);
  if(visible)this.updateArms(pose.turn);
 }
 draw({time,phase,pitch,swingAt,paused}){
  if(this.hit?.announcementAt!==undefined&&!this.hit.announced)time=Math.min(time,this.hit.start+this.hit.announcementAt*1000);
  this.updateView(time,phase);
  const mark=this.lastPitchMark,markAlpha=mark?(mark.review?swingFeedbackOpacity:feedbackOpacity)(time-mark.start):0;
  const swingAlpha=this.lastSwingMark?swingFeedbackOpacity(time-this.lastSwingMark.start):0;
  const ready=phase==='pitch'&&pitch&&!pitch.swung&&pitchVisual(pitch,time).ready;
  this.zone.material.opacity=Math.max(ready?.22:phase==='pitch'?.07:0,markAlpha*.88,swingAlpha*.45);this.zoneFill.material.opacity=markAlpha*.10;this.zoneGrid.material.opacity=markAlpha*.24;
  this.pitchGhost.visible=markAlpha>0;this.ghostMaterial.opacity=markAlpha*.88;this.trail.material.opacity=markAlpha*(swingAlpha?.14:.32);
  this.poseBat((time-swingAt)/SWING.duration,phase);
  this.posePitcher(pitch? (time<pitch.start?(time-pitch.windupAt)/pitch.windup:1+(time-pitch.start)/650):0);
  this.ball.visible=false;this.ballMaterials.forEach(m=>m.opacity=1);
  if(phase==='windup'){this.ball.visible=true;this.pitcher.updateMatrixWorld(true);this.pitcher.userData.hands[1].getWorldPosition(this.ball.position);}
  if(pitch&&(phase==='pitch'||phase==='result'&&pitch.missedFlight)){
   const clock=pitch.motion?pitch.motion.inputTime+time-pitch.motion.start:time;
   const capped=pitch.pending?.result?.batted?Math.min(clock,pitch.start+pitch.duration+pitch.pending.ballError):clock;
   const visual=pitchVisual(pitch,capped);this.ball.visible=visual.visible;
   pitch.lastRenderedError=visual.error;
   this.ball.position.copy(this.pitchPosition(pitch,visual.t));this.ball.rotation.set(visual.t*26,visual.t*15,0);
  }
  this.fielders.forEach((f,i)=>{f.position.set(FIELDERS[i][0],0,FIELDERS[i][1]);this.poseRunning(f,0,false);});
  if(this.catcher){this.catcher.position.set(0,0,-2);this.poseRunning(this.catcher,0,false);}
  const soundingHit=this.hit;
  if(this.hit)this.drawHit(time);
  if(this.hit)this.rememberDefense(time);else this.returnDefense(time,phase);
  this.updateRunners(time);
  this.updateFollowView(time,phase);
  this.emitCatchSounds(soundingHit,time);
  this.updateBallDisplay(time,phase);
  const pitchLabel=typeof document!=='undefined'?document.getElementById('pitch-mark-label'):null;
  if(pitchLabel){
   pitchLabel.hidden=!this.pitchGhost.visible;
   if(this.pitchGhost.visible){
    const point=screenPoint(this.pitchGhost.position,{left:0,top:0,width:this.w,height:this.h},this.camera);
    const review=mark.review,error=review?(review.ballError??review.inputError+review.ms):null;
    const predicted=review&&(review.hit?error<0:error+time-mark.start<0);
    pitchLabel.textContent=predicted?'○ 존 예상 통과':'○ 존 통과';
    pitchLabel.style.left=(point.x+12)+'px';pitchLabel.style.top=(point.y-18)+'px';
    pitchLabel.style.opacity=markAlpha;pitchLabel.hidden=point.depth< -1||point.depth>1;
   }
  }
  this.labelEls.forEach((el,i)=>{if(!el)return;if(!this.staticBases[i]||this.moves.length||phase==='result'&&!this.followRun?.out&&this.followRun?.to===i+1){el.style.display='none';return;}const point=V(stand(i+1)[0],2.5,stand(i+1)[2]).project(this.camera);if(Math.abs(point.x)>1||Math.abs(point.y)>1){el.style.display='none';return;}el.style.display='block';el.style.left=((point.x+1)*this.w/2)+'px';el.style.top=((-point.y+1)*this.h/2)+'px';});
  if(phase==='pitch'&&pitch&&!pitch.swung)this.inputFrames.record(pitch,time,performance.now(),this.ball.position,this.camera,this.ball.visible);
  this.updateBattingGuide(pitch,phase,time);
  this.drawSwingMark(time);
  this.renderer.setViewport(0,0,this.w,this.h);this.renderer.setScissorTest(false);this.renderFirstPersonScene(phase);
  const reviewVisible=this.swingMark?.visible;
  const label=typeof document!=='undefined'?document.getElementById('review-label'):null;if(label){label.hidden=!reviewVisible;if(reviewVisible)label.textContent=this.lastSwingMark.g.hit?(this.lastSwingMark.g.assisted?'보정 접촉 · 측면':'접촉 순간 · 측면'):'타격 지점 통과 · 측면';}
  if(reviewVisible&&this.reviewScene){
   const w=Math.min(180,this.w*.42),h=w/1.5,x=this.w-w-12,y=this.h-174-h;
   this.renderer.setViewport(x,y,w,h);this.renderer.setScissor(x,y,w,h);this.renderer.setScissorTest(true);
   this.renderer.render(this.reviewScene,this.reviewCamera);this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.w,this.h);
  }

 }
}
