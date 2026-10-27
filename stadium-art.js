import * as T from './vendor/three.module.min.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
import {BASES,FIELD} from './field.js?v=107';
import {bowlSections} from './stadium-layout.js?v=107';
// Deterministic, locally generated surfaces: no network textures or runtime noise shaders.
export function parkNoise(n){let x=(n+0x6d2b79f5)|0;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;}
export function surfacePixels(kind,size=256){
 const data=new Uint8ClampedArray(size*size*4),base=kind==='grass'?[55,91,47]:kind==='dirt'?[151,109,76]:kind==='concrete'?[150,153,147]:[86,103,94];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,n=parkNoise(i+kind.length*7919),broad=Math.sin(x*.047)*Math.sin(y*.031),stripe=kind==='grass'?((Math.floor((x+y)/32)%2)?1.06:.93):1;
  const grain=(n-.5)*(kind==='dirt'?32:18)+broad*5;
  for(let c=0;c<3;c++)data[i*4+c]=Math.round(base[c]*stripe+grain);
  data[i*4+3]=255;
 }
 return data;
}
const textures=new Map();
export function parkTexture(kind){
 if(textures.has(kind))return textures.get(kind);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),pixels=c.createImageData(256,256);pixels.data.set(surfacePixels(kind));c.putImageData(pixels,0,0);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.setScalar(1/(kind==='grass'?64:8));texture.anisotropy=4;textures.set(kind,texture);return texture;
}
export function groundUV(mesh){
 mesh.updateMatrixWorld(true);const g=mesh.geometry,p=g.attributes.position,uv=new Float32Array(p.count*2),v=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);uv[i*2]=v.x;uv[i*2+1]=-v.z;}
 g.setAttribute('uv',new T.BufferAttribute(uv,2));return mesh;
}
export function softShadowTexture(){
 if(textures.has('shadow'))return textures.get('shadow');
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d'),g=c.createRadialGradient(32,32,4,32,32,32);g.addColorStop(0,'rgba(0,0,0,.48)');g.addColorStop(.45,'rgba(0,0,0,.28)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64);const t=new T.CanvasTexture(canvas);textures.set('shadow',t);return t;
}
function joined(parts){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;}
export function seatGeometry(){
 const base=new T.BoxGeometry(.47,.07,.43),back=new T.BoxGeometry(.47,.42,.065);back.rotateX(.12);back.translate(0,.22,.20);
 const support=new T.BoxGeometry(.07,.36,.07);support.translate(0,-.18,.1);return joined([base,back,support]);
}
export function spectatorGeometry(){
 const g=new T.LatheGeometry([[-.25,.12],[-.16,.16],[.08,.19],[.18,.16],[.23,.06]].map(([y,r])=>new T.Vector2(r,y)),6);g.scale(1,1,.68);return g;
}
export const CROWD_COLORS=['#eee7d9','#243848','#854238','#a7b2ad','#c4b39c','#323d42','#c16a58','#e4dfcf','#60798a','#695c66'];
export function addParkDetails(s){
 const concrete=new T.MeshStandardMaterial({color:'#c3c0b3',roughness:1,map:parkTexture('concrete')});
 const sections=bowlSections(),stairs=new T.InstancedMesh(new T.BoxGeometry(1,1,1),concrete,sections.length*28),dummy=new T.Object3D(),lines=[];let n=0;
 const line=(a,b)=>lines.push(...a,...b);
 for(const section of sections){
  const a=Math.atan2(section.normal[0],section.normal[1]);
  for(let row=0;row<14;row++)for(let half=0;half<2;half++){
   const upper=row>=7,offset=5+row*1.25+(upper?2:0)+(half-.5)*.625,p=section.edge(offset)[0],y=1.8+row*.90+(upper?2:0)+half*.45;
   dummy.position.set(p[0],y,p[1]);dummy.rotation.set(0,a,0);dummy.scale.set(1.05,.45,.66);dummy.updateMatrix();stairs.setMatrixAt(n++,dummy.matrix);
  }
  // Concourse rails and roof trusses use a single line batch.
  for(const [offset,y]of [[12.8,9.4],[22,17]]){const [p,q]=section.edge(offset);line([p[0],y,p[1]],[q[0],y,q[1]]);for(const r of [p,q])line([r[0],y-1,r[1]],[r[0],y,r[1]]);}
  const front=section.edge(0)[0];if(front[1]<58){const [p,q]=section.edge(11),[r,t]=section.edge(25);line([p[0],22.32,p[1]],[r[0],22.32,r[1]]);line([q[0],22.32,q[1]],[t[0],22.32,t[1]]);line([p[0],22.32,p[1]],[t[0],22.32,t[1]]);}
 }
 stairs.instanceMatrix.needsUpdate=true;stairs.name='seating-aisle-steps';s.scene.add(stairs);
 const rails=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(lines,3)),new T.LineBasicMaterial({color:'#67777b'}));rails.name='concourse-and-roof-rails';s.scene.add(rails);
 const pads=new T.InstancedMesh(new T.BoxGeometry(1.73,3.74,.20),new T.MeshStandardMaterial({color:'#23463e',roughness:.93}),96);
 for(let i=0;i<24;i++)for(let j=0;j<4;j++){const a=-Math.PI/4+(i+.5)/24*Math.PI/2,offset=(j-1.5)*1.82;dummy.position.set(Math.sin(a)*(FIELD.fence-.72)+Math.cos(a)*offset,2,Math.cos(a)*(FIELD.fence-.72)-Math.sin(a)*offset);dummy.rotation.set(0,a,0);dummy.scale.set(1,1,1);dummy.updateMatrix();pads.setMatrixAt(i*4+j,dummy.matrix);}
 pads.instanceMatrix.needsUpdate=true;pads.name='outfield-wall-padding';s.scene.add(pads);
 // Backstop mesh stays behind the batter, clear of the pitch and aim view.
 const net=[];for(let x=-10;x<=10;x+=.5)net.push(x,1,-16,x,7,-16);for(let y=1;y<=7;y+=.5)net.push(-10,y,-16,10,y,-16);
 const backstop=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(net,3)),new T.LineBasicMaterial({color:'#596b70',transparent:true,opacity:.24}));backstop.name='backstop-net';s.scene.add(backstop);
 // Small rounded base cutouts and the pitcher's approach scuff.
 for(const [x,,z]of BASES.slice(1,4)){const circle=s.mesh(new T.CircleGeometry(2.15,40),s.materials.dirt,x,.032,z);circle.rotation.x=-Math.PI/2;groundUV(circle);}
 const scuff=s.mesh(new T.CircleGeometry(.75,32),new T.MeshStandardMaterial({color:'#ac8661',roughness:1,map:parkTexture('dirt')}),0,.292,18.4);scuff.rotation.x=-Math.PI/2;scuff.scale.set(.6,1.2,1);groundUV(scuff);
 for(const side of [-1,1]){const z=9,x=side*16;s.stripe([x-1,z-2],[x-1,z+2],.07,s.materials.line,.048);s.stripe([x-1,z-2],[x+1,z-2],.07,s.materials.line,.048);s.stripe([x-1,z+2],[x+1,z+2],.07,s.materials.line,.048);}
 const sky=new T.Mesh(new T.SphereGeometry(230,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#76a5cc')},bottom:{value:new T.Color('#d9e3df')}},vertexShader:'varying float height;void main(){height=normalize(position).y;vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=clip.xyww;}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying float height;void main(){gl_FragColor=vec4(mix(bottom,top,pow(max(height,0.0),0.55)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));sky.position.z=35;sky.renderOrder=-10;sky.name='daylight-sky';s.scene.add(sky);
}
