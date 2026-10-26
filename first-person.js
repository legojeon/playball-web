import * as T from './vendor/three.module.min.js';
// Normalized lengths retain the existing shoulder/elbow/wrist IK endpoints.
export function battingArmGeometry(sleeve){
 const rings=sleeve?[[-.5,.93],[-.45,1.02],[-.18,1.12],[.22,1.25],[.40,1.15],[.50,.75]]:
 [[-.5,.70],[-.42,.73],[-.10,.94],[.20,1.15],[.38,1.07],[.50,.92]];
 const points=[new T.Vector2(0,-.5),...rings.map(([y,r])=>new T.Vector2(r,y)),new T.Vector2(0,.5)];
 return new T.LatheGeometry(points,20);
}
export function makeBattingGlove(material,hand){
 const glove=new T.Group();glove.name='batting-glove';
 const palm=new T.Mesh(new T.SphereGeometry(1,20,12),material);palm.scale.set(.045,.046,.021);palm.position.z=.040;glove.add(palm);
 // Four individually curled fingers wrap around the unchanged bat handle.
 for(let i=0;i<4;i++){
  const y=-.031+i*.021,points=[[-.039,y,.042],[-.044,y,.012],[-.025,y,-.034],[.014,y,-.039],[.037,y,-.012]];
  const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  glove.add(new T.Mesh(new T.TubeGeometry(path,16,.0095,8,false),material));
 }
 const side=hand===0?1:-1,thumb=new T.CatmullRomCurve3([new T.Vector3(.04,side*.026,.043),new T.Vector3(.052,side*.012,.020),new T.Vector3(.027,-side*.012,-.008)]);
 glove.add(new T.Mesh(new T.TubeGeometry(thumb,12,.013,10,false),material));
 return glove;
}
