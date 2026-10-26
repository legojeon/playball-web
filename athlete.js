import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
// The authored bind pose uses the same named joints as the game's release rig.
export const ATHLETE_JOINTS={torso:[0,.82,0],hips:[0,.79,0],head:[0,1.57,0],
 'leg.L':[-.105,.79,0],'knee.L':[-.105,.47,0],'leg.R':[.105,.79,0],'knee.R':[.105,.47,0],
 'arm.L':[-.22,1.27,0],'elbow.L':[-.22,.99,0],'hand.L':[-.22,.70,0],
 'arm.R':[.22,1.27,0],'elbow.R':[.22,.99,0],'hand.R':[.22,.70,0]};
let loading;
export function prepareAthlete(gltf){
 gltf.scene.updateMatrixWorld(true);const parts=[];
 gltf.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const joints=mesh.skeleton.bones.map(b=>b.userData.name||b.name);
  if(joints.some(name=>!ATHLETE_JOINTS[name]))throw new Error('Unknown athlete joint');
  parts.push({geometry,joints,material:mesh.material,name:mesh.material.name.split('.')[0]});
 });
 if(!parts.length)throw new Error('Athlete skin unavailable');
 return parts;
}
export function loadAthletes(){
 return loading??=Promise.all(['athlete.glb','athlete-low.glb'].map(file=>new GLTFLoader().loadAsync(new URL('./models/'+file,import.meta.url).href).then(prepareAthlete))).then(([near,far])=>({near,far}));
}
function jointMap(player){
 const {torso,hips,head,limbs,knees,elbows,hands}=player.userData;
 return {torso,hips,head,'leg.L':limbs[0],'leg.R':limbs[2],'arm.L':limbs[1],'arm.R':limbs[3],
 'knee.L':knees[0],'knee.R':knees[1],'elbow.L':elbows[0],'elbow.R':elbows[1],'hand.L':hands[0],'hand.R':hands[1]};
}
export function attachAthlete(player,assets,materials,home){
 if(player.userData.athlete)return;
 const old=[];player.traverse(m=>{if(m.isMesh&&m!==player.userData.shadow)old.push(m);});
 for(const m of old){m.removeFromParent();m.geometry.dispose();}
 const bones=jointMap(player),groups=[],skeletons=new Map();
 for(const parts of [assets.near,assets.far]){
  const group=new T.Group();group.name='athlete-skin';
  for(const part of parts){
   if(home&&part.name==='glove')continue;
   const material=part.name==='jersey'?materials[home?'runner':'jersey']:part.name==='trim'?(home?materials.runnerHelmet||materials.helmet:materials.helmet):part.material;
   const mesh=new T.SkinnedMesh(part.geometry,material);
   const key=part.joints.join('|');
   if(!skeletons.has(key)){
    const inverses=part.joints.map(name=>new T.Matrix4().makeTranslation(...ATHLETE_JOINTS[name]).invert());
    skeletons.set(key,new T.Skeleton(part.joints.map(name=>bones[name]),inverses));
   }
   mesh.bind(skeletons.get(key),new T.Matrix4());
   mesh.frustumCulled=false;mesh.name=part.name;group.add(mesh);
  }
  player.add(group);groups.push(group);
 }
 player.userData.athlete={near:groups[0],far:groups[1]};groups[1].visible=false;
}
export function athleteLOD(player,camera){
 const skin=player.userData.athlete;if(!skin)return;
 const far=player.position.distanceToSquared(camera.position)>32*32;
 skin.near.visible=!far;skin.far.visible=far;
}
// Static bench poses share a mesh per material; skinning is baked only at load.
export function bakeAthlete(player){
 const result=[];player.updateMatrixWorld(true);
 for(const mesh of player.userData.athlete.far.children){
  mesh.skeleton.update();const geometry=mesh.geometry.clone(),position=geometry.attributes.position;
  const point=new T.Vector3();
  for(let i=0;i<position.count;i++){
   point.fromBufferAttribute(position,i);mesh.applyBoneTransform(i,point).applyMatrix4(mesh.matrixWorld);position.setXYZ(i,point.x,point.y,point.z);
  }
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();result.push({geometry,material:mesh.material,name:mesh.name});
 }
 return result;
}
export function mergeBench(poses){
 const group=new T.Group();group.userData.players=poses.length;
 for(let i=0;i<poses[0].length;i++){
  const geometries=poses.map(p=>p[i].geometry),geometry=mergeGeometries(geometries);
  group.add(new T.Mesh(geometry,poses[0][i].material));geometries.forEach(g=>g.dispose());
 }
 return group;
}
