import * as T from './vendor/three.module.min.js';
import {inZone} from './pitch.js?v=90';
import {Stadium} from './stadium.js?v=90';
import {bindReleaseInput} from './input.js?v=90';
import {assistedContact,reachableAim} from './collision.js?v=90';
import {localPoint,screenPoint} from './aiming.js?v=90';
const $=id=>document.getElementById(id),scene=new Stadium($('field'));
const targets=[[0,1.02],[-.25,.72],[.25,1.32],[-.25,1.32],[.25,.72],[0,1.32],[0,.72]];
let mode='fixed',index=0,pitch,heldTime=null,lastPaint=-Infinity,done=false;
function next(){
 const [x,y]=targets[index++%targets.length],start=performance.now()+800;
 pitch={x,y,isStrike:inZone(x,y),start,duration:16.65*3600/115,windupAt:start-800,windup:800,speed:115,curve:.3,arc:.16,release:{x:.15,y:1.85,z:17},swung:false};
 controls.cancel();scene.setAimPreview(null);done=false;heldTime=null;lastPaint=-Infinity;scene.inputFrames.clear();scene.clearPitchMark();scene.clearSwingMark();
 $('ball-mark').hidden=$('tap-mark').hidden=true;
 $('result').textContent=mode==='fixed'?'누른 채 조준하고 손을 떼세요':mode==='late'?'누르고 떼서 늦은 스윙을 확인하세요':'공이 가까워지면 손을 떼세요';
 $('metrics').textContent=mode==='fixed'?'위치 검사 · 공 중심 통과 기준 0ms로 고정':mode==='approach'?'접근하는 공 검사 · 통과 70ms 전의 보이는 공을 겨냥하세요':mode==='late'?'늦은 타격 검사 · 중심 통과 기준 +70ms로 고정':'움직이는 공 검사 · 손을 떼면 해당 시각에서 멈춥니다';
}
function mark(id,x,y){const p=localPoint(x,y,$('check'));$(id).style.left=p.x+'px';$(id).style.top=p.y+'px';$(id).hidden=false;}
const controls=bindReleaseInput($('field'),{onAim:(x,y)=>{if(done)return false;const aim=scene.aimAt(x,y);scene.setAimPreview(reachableAim(scene.assistAim(aim))?aim:null);return true;},onRelease:(x,y,at)=>{
 if(done)return;
 const tap=scene.tapContact(pitch,x,y,at);if(!tap){$('result').textContent='공이 화면에 나온 뒤 눌러주세요';return;}
 if(!reachableAim(tap.battingAim)){$('result').textContent='타격 범위 밖 · 존 주변을 터치하세요';return;}
 done=true;pitch.swung=true;
 const inputError=mode==='moving'?tap.error:mode==='late'?70:mode==='approach'?-70:0;
 const g=assistedContact(inputError,pitch,tap.battingAim);
 const hit=g.hit,review=g;heldTime=pitch.start+pitch.duration+inputError;
 pitch.checkSwingAt=heldTime-review.ms;scene.setSwingAim(g.aim);scene.showSwingMark(review,heldTime);scene.showPitchMark(pitch,heldTime,review);
 const rect=$('field').getBoundingClientRect(),shown=tap.shown,visible=tap.visible&&shown.x>=rect.left&&shown.x<=rect.right&&shown.y>=rect.top&&shown.y<=rect.bottom;
 if(visible)mark('ball-mark',shown.x,shown.y);else $('ball-mark').hidden=true;mark('tap-mark',x,y);
 $('result').textContent=hit?'접촉 성공':'접촉하지 않음';
 const center=screenPoint(new T.Vector3(tap.aim.x,tap.aim.y,.35),$('field').getBoundingClientRect(),tap.frame.camera),aimError=Math.hypot(center.x-x,center.y-y);
 const delay=Math.max(0,performance.now()-at),gap=Math.hypot(x-shown.x,y-shown.y);
 $('metrics').textContent=`터치↔미트 중심 위치 ${aimError.toFixed(2)} CSS px\n보이는 공과 터치 거리 ${visible?gap.toFixed(1)+' CSS px':'공이 화면 밖으로 지났습니다'}\n판정 타이밍 ${Math.round(inputError)}ms · 입력 처리 지연 ${delay.toFixed(1)}ms\n${hit?'미트·시간 보정 후 배트 표면 접촉':'타격 지점 통과 때 공과 '+Math.round(Math.max(0,review.gap)*100)+'cm 차이'} · 판정 잔상 고정`;
 lastPaint=-Infinity;
},onCancel:()=>scene.setAimPreview(null)});
$('next').onclick=next;$('approach').onclick=()=>{mode='approach';next();};$('late').onclick=()=>{mode='late';next();};$('fixed').onclick=()=>{mode='fixed';next();};$('moving').onclick=()=>{mode='moving';next();};$('fps').onchange=next;
next();
function draw(wall){
 if(wall-lastPaint>=1000/Number($('fps').value)-.5){
  lastPaint=wall;const time=heldTime??(mode==='moving'?wall:pitch.start+pitch.duration+(mode==='late'?70:mode==='approach'?-70:0)),phase=time<pitch.start?'windup':'pitch';
  scene.draw({time,phase,pitch,swingAt:pitch.checkSwingAt??-1e6});
  const r=$('field').getBoundingClientRect();$('device').textContent=`${Math.round(r.width)} × ${Math.round(r.height)} CSS px · DPR ${devicePixelRatio} · v37\n${mode==='fixed'?'고정 공':mode==='approach'?'접근 공 −70ms':mode==='late'?'늦은 스윙 검사':`갱신 상한 ${$('fps').value}fps (실제 속도는 기기에 따라 다름)`}`;
 }
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
