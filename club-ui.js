import {TEAMS,findTeam,teamLogo,battingAverage,teamTheme} from './teams.js?v=103';
export function bindClubUI({read,onSelect,onPractice,onSkip,onLookDone,onComplete,onOpen,canSave=()=>true}){
 const $=id=>document.getElementById(id),dialog=$('team-dialog');let chosen=null,first=false;
 const choice=$('tutorial-choice'),card=$('tutorial-card');let themedId;
 function applyTheme(team){
  if(themedId===(team?.id??null))return;themedId=team?.id??null;
  const theme=teamTheme(team);for(const [name,color] of Object.entries(theme))document.documentElement.style.setProperty('--theme-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),color);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.primary);
 }
 function refresh(club=read()){
  const team=findTeam(club.teamId),status=$('club-status');status.hidden=!team;applyTheme(team);
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
 $('tutorial-next').onclick=onLookDone;
 $('finish-music-tutorial').onclick=()=>{onComplete();$('music-dialog').close();};
 function placeSpotlight(){
  const button=$('menu').getBoundingClientRect(),game=$('game').getBoundingClientRect(),spot=$('tutorial-spotlight');
  spot.style.left=(button.left-game.left-6)+'px';spot.style.top=(button.top-game.top-6)+'px';
  spot.style.width=(button.width+12)+'px';spot.style.height=(button.height+12)+'px';
 }
 window.addEventListener('resize',placeSpotlight);
 function step(stage){
  const music=stage==='music',files=stage==='music-files',menu=stage==='music-menu';
  card.hidden=!stage||menu||files;card.dataset.step=stage||'';
  $('tutorial-next').hidden=stage!=='look';$('tutorial-next').disabled=true;
  $('tutorial-shade').hidden=!music;$('tutorial-spotlight').hidden=!music;
  $('game').classList.toggle('tutorial-menu-guide',music);
  $('menu-tutorial-note').hidden=!menu;$('music-library').classList.toggle('tutorial-target',menu);
  for(const id of ['change-team','controls-help','privacy-help','restart-game','history'])$(id).disabled=menu;
  $('music-tutorial-note').hidden=!files;$('finish-music-tutorial').hidden=!files;
  const copy={aim:['01 · 조준','화면을 눌러 배트를 조준하세요.','화면을 누른 채 손가락이나 마우스를 움직여 조준하세요. 손을 떼지 말고 공을 기다리세요.'],release:['02 · 스윙','손을 떼 배트를 휘두르세요.','공을 잠시 멈췄습니다. 손을 떼면 공이 다시 움직이고 배트를 휘두릅니다. 이미 손을 뗐다면 다시 누른 뒤 떼세요.'],look:['03 · 둘러보기','화면을 움직여 주변을 둘러보세요','주루를 잠시 멈췄습니다. 화면을 드래그하거나 마우스 휠을 스크롤하세요. 둘러본 뒤 아래 버튼을 눌러 계속 달리세요.'],music:['04 · 응원가','위쪽 ☰ 메뉴를 누르세요','메뉴에서 응원가를 추가할 수 있습니다. 화살표가 가리키는 버튼을 누르세요.']};
  if(copy[stage]){const [count,title,text]=copy[stage];$('tutorial-count').textContent=count;$('tutorial-title').textContent=title;$('tutorial-text').textContent=text;}
  if(music)placeSpotlight();
 }

 return {refresh,openTeams,step,looked(){ $('tutorial-next').disabled=false;},init(){refresh();if(!read().teamId)openTeams(true);else if(!read().tutorialDone)offerPractice();}};
}
