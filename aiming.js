import {followAim,TIMING} from './contact-window.js?v=96';
import * as T from './vendor/three.module.min.js';
import {CONTACT_Z} from './pitch.js?v=96';
export const DISPLAY_BALL_RADIUS=.0366;
const plane=new T.Plane(new T.Vector3(0,0,1),-CONTACT_Z);
// client coordinates and DOMRect are both CSS pixels. Never multiply by DPR.
export function planePoint(x,y,rect,camera){
 if(!(rect.width>0&&rect.height>0))return null;
 const ndc=new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);
 const ray=new T.Raycaster();ray.setFromCamera(ndc,camera);
 return ray.ray.intersectPlane(plane,new T.Vector3());
}
export function screenPoint(world,rect,camera){
 const p=world.clone().project(camera);
 return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,depth:p.z};
}
export function localPoint(x,y,element){
 const r=element.getBoundingClientRect();
 return {x:(x-r.left)*element.clientWidth/r.width,y:(y-r.top)*element.clientHeight/r.height};
}
// A small history survives queued input events. It contains rendered positions,
// not positions predicted again when the event handler eventually runs.
export class PitchFrames {
 constructor(){this.frames=[];}
 clear(){this.frames=[];}
 record(pitch,time,at,ball,camera,visible=true){
  this.frames.push({pitch,time,at,ball:ball.clone(),camera:camera.clone(),visible});
  while(this.frames.length>128||this.frames.length>1&&at-this.frames[0].at>1000)this.frames.shift();
 }
 pick(pitch,inputAt){
  for(let i=this.frames.length-1;i>=0;i--){const f=this.frames[i];
   if(f.pitch===pitch&&f.at<=inputAt){return inputAt-f.at<=250?f:null;}
  }
  return null;
 }
 references(pitch,inputAt,rect){
  const refs=[];
  for(const f of this.frames){
   if(f.pitch!==pitch||!f.visible||f.at>inputAt||inputAt-f.at>TIMING.weak+1e-7)continue;
   const q=screenPoint(f.ball,rect,f.camera);
   if(q.depth< -1||q.depth>1||q.x<rect.left||q.x>rect.left+rect.width||q.y<rect.top||q.y>rect.top+rect.height)continue;
   const p=planePoint(q.x,q.y,rect,f.camera);if(p)refs.push(p);
  }
  return refs;
 }
 contact(pitch,x,y,rect,inputAt){
  let frame=this.pick(pitch,inputAt);if(!frame)return null;
  // Compositors can still show a preceding submitted frame. Reconcile only
  // touches on the actually rendered ball sphere, within two recent frames;
  // ordinary off-ball aim keeps the latest frame and its original error.
  const index=this.frames.indexOf(frame);
  for(let i=index;i>=Math.max(0,index-2);i--){
   const candidate=this.frames[i];
   if(candidate.pitch!==pitch||!candidate.visible||inputAt-candidate.at>75)continue;
   const ndc=new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),ray=new T.Raycaster();
   ray.setFromCamera(ndc,candidate.camera);
   if(ray.ray.intersectsSphere(new T.Sphere(candidate.ball,DISPLAY_BALL_RADIUS))){frame=candidate;break;}
  }
  const aim=planePoint(x,y,rect,frame.camera),shown=screenPoint(frame.ball,rect,frame.camera);
  const seen=planePoint(shown.x,shown.y,rect,frame.camera);
  const visible=frame.visible&&shown.depth>=-1&&shown.depth<=1&&seen!==null;
  return {frame,visible,error:frame.time+Math.max(0,inputAt-frame.at)-pitch.start-pitch.duration,shown,
   offset:{x:x-shown.x,y:y-shown.y},
   battingAim:followAim(aim,pitch,this.references(pitch,inputAt,rect)),
   // Raw pointer position remains available for the visible input envelope.
   aim:aim?{x:aim.x,y:aim.y,z:CONTACT_Z}:null};
 }
}
