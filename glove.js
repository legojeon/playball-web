import * as T from './vendor/three.module.min.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
// Wrist at the origin, fingers along -Y (the forearm's authored direction).
// A concave leather pocket replaces the old solid oval and backwards fingers.
const cache=new Map(),skins=new Map();
export const gloveMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.88,side:T.DoubleSide});
export function gloveGeometry(type='field',low=false){
 const key=type+low;if(cache.has(key))return cache.get(key);
 const parts=[],n=low?12:24,rows=low?3:5,catcher=type==='catcher',first=type==='first';
 const width=catcher?.145:first?.108:.098,height=catcher?.135:first?.163:.092,cy=catcher?-.125:first?-.153:-.13;
 const leather=new T.Color('#86502c'),pocket=new T.Color('#704126'),edge=new T.Color('#b07842');
 function add(g,color){if(g.index)g=g.toNonIndexed();const c=[];for(let i=0;i<g.attributes.position.count;i++)c.push(color.r,color.g,color.b);g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.deleteAttribute('uv');parts.push(g);}
 // The inner surface dips behind the raised rim, with a separate padded back.
 for(const back of [false,true]){
  const pos=[],indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
   const r=j/rows,a=i/n*Math.PI*2;
   pos.push(Math.cos(a)*width*r,cy+Math.sin(a)*height*r,back?-.028+.09*r*r:.052+.021*r*r);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();add(g,back?leather:pocket);
 }
 function tube(points,r,color){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));add(new T.TubeGeometry(curve,points.length>10?n:Math.max(2,(points.length-1)*(low?1:2)),r,low?4:6,false),color);}
 const rim=Array.from({length:n+1},(_,i)=>{const a=i/n*Math.PI*2;return [width*Math.cos(a),cy+height*Math.sin(a),.073];});
 tube(rim,catcher?.018:.011,leather);
 if(catcher){
  // Broad padded lobes and a laced web distinguish a mitt from an oval shell.
  for(const [x,y,sx,sy]of [[-.086,-.115,.052,.104],[.088,-.10,.049,.083]]){
   const pad=new T.SphereGeometry(1,low?8:12,low?5:8);pad.scale(sx,sy,.025).translate(x,y,.074);add(pad,leather);
  }
  tube([[-.07,-.224,.077],[0,-.241,.071],[.07,-.218,.078]],.017,edge);
  for(const x of [-.045,0,.045])tube([[x-.018,-.227,.091],[x+.018,-.258,.087]],.0045,edge);
 }
 if(!catcher&&!first){
  // Four tapered finger backs, with their tips continuing away from the wrist.
  for(let i=0;i<4;i++){const x=(i-1.5)*.044,tip=-.265+Math.abs(i-1.3)*.012;tube([[x*.85,-.145,.045],[x,-.21,.05],[x*.92,tip,.058]],.024,leather);}
 }
 if(!catcher){
  tube([[.065,-.04,-.015],[.137,-.105,.015],[.135,-.168,.055]],.029,leather);
  // Open webbing connects thumb and index, with visible gaps between strands.
  for(let i=0;i<(low?2:4);i++){const u=i/3;tube([[.070,-.22+u*.045,.08],[.11,-.195+u*.035,.08],[.135,-.168+u*.025,.08]],.005,edge);}
 }
 if(!low){for(let i=0;i<n;i+=2){const a=i/n*Math.PI*2,b=a+.09;tube([[width*.91*Math.cos(a),cy+height*.91*Math.sin(a),.080],[width*1.035*Math.cos(b),cy+height*1.035*Math.sin(b),.080]],.0035,edge);}}
 // Heel strap sits over the hand rather than floating in front of the wrist.
 tube([[-.050,-.018,-.023],[0,-.004,-.045],[.050,-.018,-.023]],.014,leather);
 const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());result.computeBoundingBox();cache.set(key,result);return result;
}
export function skinnedGlove(type,low,joint){
 const key=type+low+':'+joint;if(skins.has(key))return skins.get(key);
 const g=gloveGeometry(type,low).clone().translate(-.22,.70,0),count=g.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
 for(let i=0;i<count;i++){indices[i*4]=joint;weights[i*4]=1;}
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));skins.set(key,g);return g;
}
