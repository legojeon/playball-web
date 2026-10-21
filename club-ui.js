import {TEAMS,findTeam,teamLogo,battingAverage} from './teams.js?v=95';
export function bindClubUI({read,onSelect,onPractice,onSkip,onLookDone,onMusic,onComplete,onOpen,canSave=()=>true}){
 const $=id=>document.getElementById(id),dialog=$('team-dialog');let chosen=null,first=false;
 const choice=$('tutorial-choice'),card=$('tutorial-card');
 function refresh(club=read()){
  const team=findTeam(club.teamId),status=$('club-status');status.hidden=!team;
  if(!team)return;
  $('club-badge').innerHTML=teamLogo(team);$('club-name').textContent=team.name;
  $('club-average').textContent='팀 타율 '+battingAverage(club)+(canSave()?'':' · 저장 불가');
  $('team-summary').textContent=`${team.name} · 타율 ${battingAverage(club)} · ${club.atBats}타수 ${club.hits}안타`;
 }
 function grid(){
  const list=$('team-options');list.replaceChildren();
  for(const team of TEAMS){
   const button=document.createElement('button');button.type='button';button.className='team-option';button.setAttribute('aria-pressed',String(chosen===team.id));
   button.style.setProperty('--team-color',team.primary);button.innerHTML=teamLogo(team)+`<span>${team.name}</span>`;
   button.dataset.team=team.id;button.onclick=()=>{chosen=team.id;for(const option of list.children)option.setAttribute('aria-pressed',String(option.dataset.team===chosen));$('confirm-team').disabled=false;};list.append(button);
  }
  $('confirm-team').disabled=!chosen;
  $('confirm-team').textContent=first?'이 팀으로 시작':'팀 변경하기';
 }
 function openTeams(initial=false){
  onOpen();first=initial;chosen=read().teamId;
  $('team-dialog-title').textContent=first?'어느 팀으로 칠까요?':'치는 팀 변경';
  $('close-team').hidden=first;$('team-reset-note').hidden=first;grid();dialog.showModal();
 }
 function offerPractice(){choice.showModal();}
 $('confirm-team').onclick=()=>{if(!chosen)return;onSelect(chosen);dialog.close();refresh();if(first)offerPractice();};
 $('close-team').onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{if(first)event.preventDefault();});
 $('change-team').onclick=()=>openTeams(false);
 choice.addEventListener('cancel',event=>event.preventDefault());
 $('tutorial-start').onclick=()=>{choice.close();onPractice();};
 $('tutorial-skip').onclick=()=>{choice.close();onSkip();};
 $('tutorial-next').onclick=onLookDone;$('tutorial-music').onclick=onMusic;$('tutorial-finish').onclick=onComplete;
 $('finish-music-tutorial').onclick=()=>{$('music-dialog').close();onComplete();};
 function step(stage){
  card.hidden=!stage;card.dataset.step=stage||'';
  $('tutorial-next').hidden=stage!=='look';$('tutorial-next').disabled=true;
  $('tutorial-music').hidden=stage!=='music';$('tutorial-finish').hidden=stage!=='music';
  $('music-tutorial-note').hidden=stage!=='music';$('finish-music-tutorial').hidden=stage!=='music';
  const copy={bat:['01 · 타격','누르고, 조준하고, 놓기','화면을 누른 채 손가락이나 마우스를 움직여 조준하고, 손을 떼세요. 이번 연습은 반드시 안타가 됩니다.'],look:['02 · 둘러보기','달리면서 주변도 볼 수 있어요','잠깐 멈췄어요. 화면을 드래그하거나 스크롤해 주변을 둘러보세요.'],music:['03 · 응원가','나만의 응원가를 추가해요','응원가 설정에서 ‘타석 응원가 추가’를 누르고 기기의 음악 파일을 고르면 됩니다. 나중에 설정에서도 추가할 수 있어요.']};
  if(stage){const [count,title,text]=copy[stage];$('tutorial-count').textContent=count;$('tutorial-title').textContent=title;$('tutorial-text').textContent=text;}
 }
 return {refresh,openTeams,step,looked(){ $('tutorial-next').disabled=false;},init(){refresh();if(!read().teamId)openTeams(true);else if(!read().tutorialDone)offerPractice();}};
}
