import {cleanClub,selectTeam,findTeam,battingAverage,recordAppearance} from './teams.js?v=114';
import {bindClubUI} from './club-ui.js?v=114';
import {tutorialHit,tutorialPitch} from './tutorial.js?v=114';
import {bindMusicMenu} from './music-menu.js?v=114';
import {readProgress,makeProgress} from './progress.js?v=114';
import {Stadium,STADIUM_TOUR} from './stadium.js?v=114';
import {generatePitch,takenPitch,CONTACT_Z,ZONE,canTakePitch,missCallTime,canResolvePending} from './pitch.js?v=114';
import {contact} from './batting.js?v=114';
import {bindReleaseInput,bindLookInput,inputTime} from './input.js?v=114';
import {reachableAim} from './collision.js?v=114';
import {SWING} from './swing.js?v=114';
import {SWING_FEEDBACK_MS,PITCH_FEEDBACK_MS,battedResultDelay} from './feedback.js?v=114';
import {groundForcePlay} from './fielding.js?v=114';
import {GameAudio} from './audio.js?v=114';
const $=id=>document.getElementById(id),R=window.BaseballRules;
let callUntil=0,battedInfoUntil=0,pitchInfoUntil=0,pendingResult=null,skipAfter=Infinity;
let scene,state=R.initial(),phase='title',paused=false,pitch=null,due=0,swingAt=-1e6,saved=false,nextPhase='ready';
const origin=performance.now();let pausedTotal=0,pauseStart=0,freeze=0;
const now=()=>paused?freeze:performance.now()-origin-pausedTotal;
const sound=new GameAudio();let inningStart={...state};let history=[],legacyHistory=[],best=0,storageOK=true;
const KEY='three-outs-nine-innings-v1',PREF_KEY='three-outs-preferences-v1';
let storedProgress=null,activeMatchId=null,club=cleanClub(null),clubUI=null,tutorial=null;
try{sound.applyPreferences(JSON.parse(localStorage.getItem(PREF_KEY)||'{}'));}catch{}
function saveSoundPreferences(){try{localStorage.setItem(PREF_KEY,JSON.stringify(sound.preferences));}catch{}}
function updateSoundSettings(){
 $('music-enabled').checked=sound.musicEnabled;$('crowd-enabled').checked=sound.crowdEnabled;
 for(const kind of ['music','crowd']){const value=Math.round(sound[kind+'Volume']*100);$(kind+'-volume').value=value;$(kind+'-level').textContent=value+'%';}
}
try{const old=JSON.parse(localStorage.getItem('three-outs-physics-v5')||'{}');legacyHistory=Array.isArray(old.records)?old.records.filter(r=>Number.isInteger(r.runs)&&r.runs>=0&&Number.isFinite(r.at)).slice(0,10):[];}catch{}
try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');storedProgress=readProgress(data.progress);club=cleanClub(data.club);history=Array.isArray(data.records)?data.records.filter(r=>r.innings===9&&Number.isInteger(r.runs)&&r.runs>=0&&Number.isFinite(r.at)).slice(0,10):[];best=Math.max(Number.isInteger(data.best)&&data.best>=0?data.best:0,...history.map(r=>r.runs));}catch{storageOK=false;}
function persist(){
 try{localStorage.setItem(KEY,JSON.stringify({best,records:history,progress:storedProgress,club}));storageOK=true;}catch{storageOK=false;}
}
function saveProgress(){
 if(tutorial||!activeMatchId)return;
 const snapshot=makeProgress(activeMatchId,state,inningStart);
 if(snapshot){storedProgress=snapshot;persist();}
}
function showStartChoices(){
 const resume=$('resume-game'),detail=$('resume-detail');
 resume.hidden=!storedProgress;detail.hidden=!storedProgress;
 if(storedProgress){const s=storedProgress.state;resume.textContent=s.outs===3?'지난 경기 이어보기 ↗':'이어하기 ↗';detail.textContent=`${s.inning}회 · ${s.runs}점 · ${s.outs}아웃`;}
 $('start').textContent=storedProgress?'새 경기':'플레이 볼! ↗';
}
function say(label){$('call').textContent=label;callUntil=label?now()+1500:0;$('feedback').hidden=!label;}
function updateTitleAudio(){
 const hint=$('title-audio-hint');
 // The inning/result screen replaces the title DOM; audio callbacks may still refresh.
 if(!hint)return;
 const hasTheme=sound.anthemTracks.length||sound.library.some(track=>track.kind==='anthem');
 hint.hidden=phase!=='title'||!hasTheme||!sound.musicEnabled||sound.musicVolume===0||sound.context?.state==='running';
}
function update(){
 updateSoundSettings();
 updateTitleAudio();
 const shown=pendingResult?.before??state;
 const shownClub=pendingResult?.beforeClub?.teamId===club.teamId?pendingResult.beforeClub:club;
 const batterName=sound.cheer?.track?.player||sound.anthem?.track?.title||'';
 scene?.updateScoreboard({...shown,batterName,teamName:findTeam(club.teamId)?.name,average:battingAverage(shownClub)});clubUI?.refresh(shownClub);
 $('sound').textContent=sound.musicEnabled?'♪':'♪̸';$('sound').setAttribute('aria-label',sound.musicEnabled?'응원가 끄기':'응원가 켜기');$('sound').setAttribute('aria-pressed',String(sound.musicEnabled));
 const runners=shown.bases.map((on,i)=>on?`${i+1}루`:'').filter(Boolean).join(' · ')||'주자 없음';
 $('game-state').textContent=`${shown.inning}회 · 누적 ${shown.runs}점 · 볼 ${shown.balls} · 스트라이크 ${shown.strikes} · 아웃 ${shown.outs} · ${runners}${batterName?` · 타석 ${batterName}`:''}`;
 $('menu').disabled=Boolean(tutorial&&tutorial.stage!=='music');
 $('pause').disabled=Boolean(tutorial&&['release','look','music'].includes(tutorial.stage))||!['intro','stance','windup','pitch','result','ready'].includes(phase);
 $('stadium-tour').hidden=phase!=='intro';$('skip-tour').disabled=paused;$('game').classList.toggle('touring',phase==='intro');
 $('ready-prompt').hidden=tutorial?true:phase!=='ready'&&!paused;
 $('ready-prompt').textContent=paused?'일시정지 · ▶로 계속':'화면을 눌러 준비';
 $('skip-result').hidden=!canSkipResult();
 $('field').style.cursor=['ready','windup','pitch'].includes(phase)&&!pitch?.swung?'crosshair':'default';
}
function enterReady(){
 releaseInput.cancel();lookInput.cancel();pendingResult=null;scene.resultPresentation=null;keyHeld=false;clearAim();pointerPosition=null;
 phase='ready';pitch=null;pitchInfoUntil=0;$('pitch-result').hidden=true;due=Infinity;swingAt=-1e6;
 scene.hit=null;scene.clearPitchMark();scene.clearSwingMark();scene.inputFrames.clear();
 say('');battedInfoUntil=0;$('batted-stats').hidden=true;update();
}
function enterStance(time){
 releaseInput.cancel();lookInput.cancel();pendingResult=null;scene.resultPresentation=null;keyHeld=false;clearAim();pointerPosition=null;
 pitch=null;pitchInfoUntil=0;$('pitch-result').hidden=true;swingAt=-1e6;phase='stance';due=time+2100;
 sound.startCheer();scene.beginStance(time);scene.inputFrames.clear();scene.hit=null;scene.clearPitchMark();scene.clearSwingMark();
 say('');update();
}
function enterTour(time){
 releaseInput.cancel();lookInput.cancel();pendingResult=null;scene.resultPresentation=null;keyHeld=false;clearAim();pointerPosition=null;pitch=null;swingAt=-1e6;
 phase='intro';pitchInfoUntil=0;$('pitch-result').hidden=true;due=time+STADIUM_TOUR.duration;
 scene.beginTour(time);scene.inputFrames.clear();scene.hit=null;scene.clearPitchMark();scene.clearSwingMark();
 say('');update();
}
async function start(mode='advance'){
 if(phase==='loading')return;
 const restoring=mode==='resume'?readProgress(storedProgress):null;
 if(mode==='resume'&&!restoring)return;
 const advancing=mode==='advance'&&phase==='over',continuing=advancing&&state.inning<9;
 phase='loading';$('start')?.setAttribute('disabled','');$('resume-game')?.setAttribute('disabled','');
 await sound.unlock();
 if(paused){pausedTotal+=performance.now()-pauseStart;paused=false;}
 sound.stop({preserveAnthem:true});
 if(restoring){state=restoring.state;inningStart=restoring.inningStart;activeMatchId=restoring.matchId;}
 else{state=advancing?R.nextInning(state):R.initial();inningStart={...state};if(!continuing)activeMatchId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;}
 pendingResult=null;scene.resultPresentation=null;lookInput.cancel();if(!continuing)scene.clearDepartures();
 saved=false;scene.setBases(state.bases);saveProgress();
 $('overlay').hidden=true;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','일시정지');say('');
 if(restoring&&state.outs>=3)finish();
 else if(restoring||continuing)enterStance(now());
 else{sound.startAnthem();enterTour(now());}
 update();
}

function windup(){pitchInfoUntil=0;$('pitch-result').hidden=true;pitch=tutorial?tutorialPitch(now()):generatePitch(now());phase='windup';say('');update();}
function release(){pitch.release=scene.releasePoint();pitch.duration=(pitch.release.z-CONTACT_Z)*3600/pitch.speed;phase='pitch';update();}
function resolve(result,error=pitch?.swingError??0,time=now()){
 pendingResult=null;scene.resultPresentation=null;
 releaseInput.cancel();keyHeld=false;clearAim();
 const before={...state,bases:[...state.bases]},beforeOuts=state.outs,beforeClub={...club};let runningTime=0,ballTime=0;
 if(!pitch.swung)scene.showPitchMark(pitch,time);
 else {const g=result.review||result.contact||result.batted?.contact;if(g){scene.showSwingMark(g,time);scene.showPitchMark(pitch,time,g);if(g.hit)swingAt=time-g.ms;}}
 const force=groundForcePlay(result,before);
 if(force){state=R.forcePlay(state,force);result={...result,label:force.label,detail:force.detail,batted:{...result.batted,throwPlan:force.throwPlan,throwBase:force.throwBase,returnAt:force.finishAt,animationTime:force.finishAt}};sound.play('bat-hit');ballTime=scene.hitBall(pitch,time,result.batted);runningTime=scene.runForcePlay(force,state.bases,time,state.outs>=3);}
 else if(result.bases){state=R.advance(state,result.bases);sound.play('bat-hit');ballTime=scene.hitBall(pitch,time,result.batted);runningTime=scene.run(before.bases,state.bases,result.bases,false,time);}
 else if(result.out){state=R.out(state);sound.play('bat-hit');ballTime=scene.hitBall(pitch,time,result.batted);runningTime=scene.runOut(time,result.batted);}
 else if(result.foul){state=R.foul(state);sound.play('bat-hit');ballTime=scene.hitBall(pitch,time,result.batted);}
 else if(result.hbp){state=R.hitByPitch(state);sound.play('ball');runningTime=scene.run(before.bases,state.bases,1,true,time);}
 else if(result.ball){state=R.ball(state);sound.play('glove');sound.play('ball',.13);if(state.walks>before.walks){result.label='BASE ON BALLS';result.detail='볼넷 · 1루로 출루합니다';runningTime=scene.run(before.bases,state.bases,1,true,time);}}
 else{state=R.strike(state);sound.play('glove');sound.play(state.outs>beforeOuts?'out':'strike',.13);if(state.outs>beforeOuts){result.label='STRIKE OUT';result.detail='삼진 아웃';runningTime=scene.retireBatter(time);}}
 if(state.runs>before.runs)result.detail+=` · +${state.runs-before.runs}점`;
 nextPhase=R.nextPhaseAfterResult(before,state);
 if(!tutorial){
  // Re-read the profile so another open tab's latest team/stat update is retained.
  try{const latest=JSON.parse(localStorage.getItem(KEY)||'{}');if(latest.club)club=cleanClub(latest.club);}catch{}
  const eventId=[activeMatchId,before.inning,before.outs,before.hits,before.walks,before.hitByPitches].join(':');
  club=recordAppearance(club,before,state,eventId);
 }else tutorial.lookAt=time+1200;
 saveProgress();
 skipAfter=runningTime>=6000?time+650:Infinity;
 phase='result';due=time+Math.max((pitch.swung?SWING_FEEDBACK_MS:PITCH_FEEDBACK_MS)+150,runningTime+450,ballTime+450);
 const b=result.batted;
 if(b&&Number.isFinite(b.speed)&&Number.isFinite(b.launch)){
  $('batted-stats').textContent=`타구 ${Math.round(b.speed)} km/h · 발사각 ${Math.round(b.launch)}°`;
  battedInfoUntil=time+ballTime;$('batted-stats').hidden=false;
 }else{battedInfoUntil=0;$('batted-stats').hidden=true;}
 $('pitch-result').textContent=`${pitch.ko} · ${Math.round(pitch.speed)} km/h`;pitchInfoUntil=time+2000;$('pitch-result').hidden=false;
 const delay=force?force.finishAt:battedResultDelay(result,runningTime);
 if(delay>0){
  const presentation=scene.resultPresentation={at:time+delay*1000,renderedThrough:-Infinity};
  pendingResult={before,beforeClub,result,at:presentation.at,presentation};
  sound.reactToPlay(before,before,{batted:b});say('');
 }else{sound.reactToPlay(before,state,result);say(result.label);}
 update();
}
function announceResult(time){
 const pending=pendingResult;
 if(!pending||time<pending.at||pending.presentation.renderedThrough+1e-6<pending.at)return;
 pendingResult=null;scene.resultPresentation=null;
 if(state.outs>pending.before.outs)sound.play('out');
 sound.reactToPlay(pending.before,state,{...pending.result,batted:undefined});
 if(Number.isFinite(skipAfter))skipAfter=time+650;
 say(pending.result.label);due=Math.max(due,time+1500);update();
}
function canSkipResult(time=now()){
 return !tutorial&&phase==='result'&&!paused&&pendingResult?.result.bases!==4&&time>=skipAfter&&due-time>350;
}
function finishResult(time){
 if(tutorial){tutorial.stage='music';setPause(true);clubUI.step('music');return;}
 lookInput.cancel();releaseInput.cancel();skipAfter=Infinity;
 if(nextPhase==='over')finish();else if(nextPhase==='stance')enterStance(time);else enterReady();
}
function skipResult(){
 const time=now();if(!canSkipResult(time))return;
 scene.completePlay(time,!!pendingResult);
 if(pendingResult){
  // Settle at the destination first, render it, then reveal the saved outcome.
  pendingResult.at=pendingResult.presentation.at=time;
  scene.draw({time,phase,pitch,swingAt,paused});announceResult(time);
  skipAfter=Infinity;due=time+1500;update();
 }else finishResult(time);
}
let pointerPosition=null;
function swing(x,y,inputAt=performance.now()){
 if(tutorial?.stage==='aim')return false;
 if(tutorial?.stage==='release'&&phase==='pitch'&&!pitch.swung){
  tutorial.stage='bat';clubUI.step(null);setPause(false);
  const time=now(),impactAt=Math.max(time,pitch.start+pitch.duration);
  pitch.swung=true;scene.setSwingAim({x:0,y:1.02,z:CONTACT_Z},0);scene.clearSwingMark();clearAim();
  swingAt=impactAt-SWING.impactDelay;pitch.pending={result:tutorialHit(),error:0,at:impactAt,ballError:0};return true;
 }
 if(paused||phase!=='pitch'||pitch.swung)return false;
 const time=now(),tap=scene.tapContact(pitch,x,y,inputAt);
 if(!tap)return false;
 const {error,battingAim:matchedAim}=tap;
 if(!reachableAim(matchedAim)){say('존 주변을 조준하세요');return false;}
 const result=contact(error,pitch,matchedAim,{instant:true});
 const g=result.contact||result.batted?.contact;
 pitch.swung=true;pitch.swingError=error;
 scene.setSwingAim(g?.aim||matchedAim||{x:pitch.x,y:pitch.y,z:CONTACT_Z},0);
 scene.clearSwingMark();clearAim();
 // A valid early release schedules the physical impact as the ball arrives.
 // A late release reconstructs that contact within the explicit 110ms assist.
 // Both use the same contact pose/ball in the animation and two-second review.
 pitch.motion={start:time,inputTime:pitch.start+pitch.duration+error};
 pitch.missedFlight=!!result.strike;
 if(result.strike){
  swingAt=time-SWING.impactDelay;pitch.pending={result,error,at:missCallTime(time,error)};
  
 }else{
  const impactAt=time+Math.max(0,g.ballError-error);swingAt=impactAt-g.ms;
  if(impactAt>time){pitch.pending={result,error,at:impactAt,ballError:g.ballError};}
  else resolve(result,error,time);
 }
 return true;
}

function escapeText(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function finish(){
 const complete=state.inning>=9;
 sound.stopCheer();phase='over';
 if(!saved){
  if(complete){
   if(!history.some(record=>record.matchId===activeMatchId)){
   best=Math.max(best,state.runs);history.unshift({matchId:activeMatchId,innings:9,runs:state.runs,hits:state.hits,homers:state.homers,walks:state.walks,hitByPitches:state.hitByPitches,at:Date.now()});history=history.slice(0,10);
   }
   storedProgress=null;persist();
  }else saveProgress();
  saved=true;sound.startAnthem();
 }
 const heading=complete?'경기 종료':`${state.inning}회 종료`;
 const summary=complete?`9회 합계 · 최고 기록 ${best}점<br>안타 ${state.hits} · 홈런 ${state.homers} · 볼넷 ${state.walks} · 사구 ${state.hitByPitches}`:sound.upcomingCheers(3).length?`<span class="on-deck-label">다음 타석</span><span class="on-deck-names">${sound.upcomingCheers(3).map(track=>`<strong>${escapeText(track.player)}</strong>`).join('')}</span>`:'다음 회에도 플레이 볼!';
 const nextLabel=complete?'다음 경기 ↗':`다음 회 진행 · ${state.inning+1}회 ↗`;
 const note=complete?(storageOK?'9회 완주 기록을 저장했습니다.':'저장 공간에 접근할 수 없어 이번 창에서만 기록을 유지합니다.'):'9회 종료 시 경기 기록을 저장합니다.';
 $('overlay').innerHTML=`<div class="intro"><div class="eyebrow">${complete?'GAME OVER':'INNING BREAK'}</div><h2>${heading}</h2><div class="result-score">${state.runs}<small>점 · ${complete?'최종':'누적'}</small></div><p>${summary}</p><button id="again" class="primary">${nextLabel}</button><button id="results-history" class="secondary">내 기록 보기</button><div class="small">${note}</div></div>`;
 $('again').onclick=()=>start();$('results-history').onclick=showHistory;$('overlay').hidden=false;update();
}

function setPause(value,keepAim=false){
 if(tutorial&&['release','look','music'].includes(tutorial.stage)&&!value)return;
 if(!['intro','stance','ready','windup','pitch','result'].includes(phase)||paused===value)return;
 if(value){lookInput.cancel();if(!keepAim){releaseInput.cancel();keyHeld=false;clearAim();}freeze=now();pauseStart=performance.now();paused=true;sound.suspend();}else{pausedTotal+=performance.now()-pauseStart;paused=false;sound.resume();}
 $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'계속하기':'일시정지');update();
}
function showHistory(){
 const list=$('record-list');list.replaceChildren();
 if(!history.length)list.textContent='9회를 완주하면 경기 기록이 남습니다.';
 const appendRecord=(r,legacy=false)=>{const row=document.createElement('div');row.className='record';const date=document.createElement('span');date.textContent=new Date(r.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});const score=document.createElement('b');score.textContent=(legacy?(r.inning?`${r.inning}회 · `:'3아웃 · '):'9회 합계 · ')+r.runs+'점';row.append(date,score);list.append(row);};
 for(const r of history)appendRecord(r);
 if(legacyHistory.length){const label=document.createElement('p');label.className='small';label.textContent='이전 회별 기록 · 경기 최고 점수와 별도';list.append(label);for(const r of legacyHistory)appendRecord(r,true);}
 $('records').showModal();
}

bindMusicMenu({sound,onOpen(){setPause(true);if(tutorial?.stage==='music'){tutorial.musicOpened=true;clubUI.step('music-files');}$('menu-dialog').close();},onChanged(){if(['title','intro','over'].includes(phase)&&sound.anthemTracks.length&&!sound.anthem)sound.startAnthem();if(paused)sound.suspend();if(phase==='over')finish();else update();}});
function unlockMenuMusic(){
 const refresh=()=>{
  if(sound.context?.state==='running'&&['title','intro','over'].includes(phase)&&sound.anthemTracks.length&&!sound.anthem)sound.startAnthem();
  update();
 };
 // Resume must be requested synchronously within the user's gesture. Safari may
 // leave it pending until the first touch; storage/decoding must still update UI.
 const unlocked=sound.unlock();
 if(sound.context)sound.context.onstatechange=refresh;
 Promise.resolve(sound.libraryReady).then(()=>update());
 Promise.resolve(sound.decoding).then(refresh).catch(()=>update());
 return Promise.resolve(unlocked).then(refresh);
}
for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,()=>{if(phase==='title')unlockMenuMusic();});
document.addEventListener('keydown',()=>{if(phase==='title')unlockMenuMusic();});
$('start').onclick=()=>start('new');$('resume-game').onclick=()=>start('resume');$('restart-game').onclick=()=>{$('menu-dialog').close();return start('new');};$('history').onclick=()=>{$('menu-dialog').close();showHistory();};$('close-records').onclick=()=>$('records').close();
$('pause').onclick=()=>setPause(!paused);$('menu').onclick=()=>{setPause(true);if(tutorial?.stage==='music')clubUI.step('music-menu');$('menu-dialog').showModal();};$('close-menu').onclick=()=>$('menu-dialog').close();
$('controls-help').onclick=()=>{if(tutorial)return;setPause(true);$('menu-dialog').close();return beginTutorial();};
$('menu-dialog').addEventListener('close',()=>{if(tutorial?.stage==='music'&&!tutorial.musicOpened)clubUI.step('music');});
$('music-dialog').addEventListener('close',()=>{if(tutorial?.stage==='music'&&tutorial.musicOpened)completeTutorial();});
$('privacy-help').onclick=()=>{setPause(true);$('menu-dialog').close();$('privacy-dialog').showModal();};$('close-privacy').onclick=()=>$('privacy-dialog').close();
$('sound').onclick=()=>{const on=sound.toggleMusic();saveSoundPreferences();if(on)unlockMenuMusic();update();};
$('music-enabled').onchange=()=>{const on=sound.setMusicEnabled($('music-enabled').checked);saveSoundPreferences();if(on)unlockMenuMusic();update();};
$('crowd-enabled').onchange=()=>{sound.setCrowdEnabled($('crowd-enabled').checked);saveSoundPreferences();updateSoundSettings();};
for(const [kind,setter] of [['music','setMusicVolume'],['crowd','setCrowdVolume']])$(kind+'-volume').oninput=()=>{sound[setter](Number($(kind+'-volume').value)/100);saveSoundPreferences();updateSoundSettings();};
$('skip-result').onclick=skipResult;
$('skip-tour').onclick=()=>{if(phase==='intro'&&!paused)enterStance(now());};
const field=$('field');
function clearAim(){scene?.setAimPreview(null);}
function aimHold(x,y){
 if((paused&&tutorial?.stage!=='release')||!['ready','windup','pitch'].includes(phase)||phase==='pitch'&&pitch?.swung)return false;
 if(phase==='ready')windup();
 const aim=scene.aimAt(x,y);pointerPosition={x,y};
 scene.setAimPreview(reachableAim(scene.assistAim(aim))?aim:null);
 
 return true;
}
const releaseInput=bindReleaseInput(field,{getOrigin:()=>scene?.zoneCenterScreen(),onAim:aimHold,onRelease:(x,y,at)=>{swing(x,y,at);},onCancel:clearAim});
const lookInput=bindLookInput(field,{enabled:()=>phase==='result'&&Boolean(scene?.followRun)&&(!paused||tutorial?.stage==='look'),onLook:(dx,dy)=>{scene.lookAround(dx,dy);if(tutorial?.stage==='look'){tutorial.lookDistance=(tutorial.lookDistance||0)+Math.hypot(dx,dy);if(tutorial.lookDistance>=25)clubUI.looked();}}});
window.addEventListener('resize',()=>{lookInput.cancel();releaseInput.cancel();clearAim();pointerPosition=null;});
window.addEventListener('blur',()=>{lookInput.cancel();releaseInput.cancel();clearAim();keyHeld=false;});
window.addEventListener('game:pause',()=>setPause(true));
let keyHeld=false;
window.addEventListener('keydown',e=>{
 if(e.code==='Space'&&!e.repeat&&!document.querySelector('dialog[open]')&&!['BUTTON','INPUT'].includes(document.activeElement.tagName)){
  e.preventDefault();const rect=field.getBoundingClientRect(),p=pointerPosition||{x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  keyHeld=aimHold(p.x,p.y);
 }
});
window.addEventListener('keyup',e=>{if(e.code==='Space'&&keyHeld){e.preventDefault();keyHeld=false;const p=pointerPosition;clearAim();if(p)swing(p.x,p.y,inputTime(e.timeStamp));}});
field.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!e.buttons){pointerPosition={x:e.clientX,y:e.clientY};if(keyHeld)aimHold(e.clientX,e.clientY);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true);});
$('field').addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true);$('fatal').hidden=false;$('fatal').textContent='그래픽 연결이 중단되었습니다. 페이지를 다시 열어주세요. 저장한 기록은 유지됩니다.';});
async function beginTutorial(){
 if(tutorial)return;
 tutorial={stage:'aim',lookAt:Infinity,lookDistance:0,returnToResults:phase==='over',returnState:state,returnSaved:saved};phase='loading';await sound.unlock();
 if(paused){pausedTotal+=performance.now()-pauseStart;paused=false;sound.resume();}
 sound.stopCheer();$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','일시정지');
 state=R.initial();pendingResult=null;scene.resultPresentation=null;scene.clearDepartures();scene.setBases(state.bases);scene.beginStance(now()-2200);
 $('overlay').hidden=true;enterReady();clubUI.step('aim');
}
function completeTutorial(){
 const practice=tutorial;tutorial=null;club={...club,tutorialDone:true};persist();clubUI.step(null);
 if(practice?.returnToResults){state=practice.returnState;saved=practice.returnSaved;setPause(false);scene.setBases(state.bases);finish();return;}
 return start(storedProgress?'resume':'new');
}
function setupClub(){
 scene.setTeam(findTeam(club.teamId));
 clubUI=bindClubUI({read:()=>club,canSave:()=>storageOK,onSelect:id=>{club=selectTeam(club,id);persist();scene.setTeam(findTeam(id));update();},
  onOpen(){setPause(true);$('menu-dialog').close();},onPractice:beginTutorial,onSkip:completeTutorial,
  onLookDone(){if(tutorial?.stage!=='look'||tutorial.lookDistance<25)return;tutorial.stage='run';clubUI.step(null);setPause(false);},
  onComplete:completeTutorial});
 clubUI.init();
 window.addEventListener('storage',event=>{if(event.key!==KEY||!event.newValue)return;try{club=cleanClub(JSON.parse(event.newValue).club);scene.setTeam(findTeam(club.teamId));clubUI.refresh();}catch{}});
}
try{scene=new Stadium($('field'),{onFieldCatch:distance=>sound.playFieldCatch(distance)});$('start').disabled=false;showStartChoices();update();unlockMenuMusic();setupClub();
 const frame=()=>{let time=now();
  // Release before clamping so even a delayed windup frame stops before contact.
  if(tutorial?.stage==='aim'&&phase==='windup'&&!paused&&time>=pitch.start)release();
  if(tutorial?.stage==='aim'&&phase==='pitch'&&!paused){const stop=pitch.start+pitch.duration-120;if(time>=stop){pausedTotal+=time-stop;time=stop;tutorial.stage='release';setPause(true,true);clubUI.step('release');}}if(tutorial?.stage==='bat'&&phase==='result'&&time>=tutorial.lookAt){tutorial.stage='look';setPause(true);clubUI.step('look');}if(!paused){if(phase==='intro'&&time>=due){enterStance(time);}else if(phase==='stance'&&time>=due){enterReady();}else if(phase==='windup'&&time>=pitch.start)release();else if(phase==='pitch'&&canResolvePending(pitch,time)){const {result,error,at}=pitch.pending;delete pitch.pending;resolve(result,error,time);}else if(phase==='pitch'&&canTakePitch(pitch,time)){if(tutorial)enterReady();else resolve(takenPitch(pitch));}else if(phase==='result'&&!pendingResult&&time>=due){finishResult(time);}}$('skip-result').hidden=!canSkipResult(time);$('pitch-result').hidden=phase!=='result'||time>=pitchInfoUntil;$('feedback').hidden=!$('call').textContent||time>=callUntil;$('batted-stats').hidden=phase!=='result'||time>=battedInfoUntil;scene.draw({time,phase,pitch,swingAt,paused});if(!paused)announceResult(time);requestAnimationFrame(frame);};requestAnimationFrame(frame);
}catch(error){$('fatal').hidden=false;$('fatal').textContent='3D 야구장을 열지 못했습니다. 최신 Safari 또는 Chrome에서 다시 열어주세요.';console.error(error);}
