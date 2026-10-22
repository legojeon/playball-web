// Game palettes and redrawn emblems inspired by the current KBO clubs.
// Official reference pages and design notes: docs/TEAM-DESIGN.md.
// Keep stable IDs so the renamed clubs retain existing selections and averages.
export const TEAMS=[
 {id:'lg',name:'잠실 비버즈',short:'BEAVERS',primary:'#c30452',secondary:'#17191d',mark:'B',motif:'beaver'},
 {id:'hanwha',name:'대전 호크스',short:'HAWKS',primary:'#fc4e00',secondary:'#212121',mark:'H',motif:'wings'},
 {id:'ssg',name:'인천 하운즈',short:'HOUNDS',primary:'#ce0e2d',secondary:'#e6c99a',mark:'H',motif:'hound'},
 {id:'samsung',name:'대구 퓨마스',short:'PUMAS',primary:'#074ca1',secondary:'#c5ced5',mark:'P',motif:'cat'},
 {id:'nc',name:'창원 브라키오즈',short:'BRACHIOS',primary:'#315288',secondary:'#c7a079',mark:'B',motif:'dino'},
 {id:'kt',name:'수원 아울즈',short:'OWLS',primary:'#202023',secondary:'#eb1c24',mark:'O',motif:'owl'},
 {id:'lotte',name:'부산 시걸즈',short:'SEAGULLS',primary:'#041e42',secondary:'#d00f31',mark:'S',motif:'gull'},
 {id:'kia',name:'광주 재규어즈',short:'JAGUARS',primary:'#ea0029',secondary:'#06141f',mark:'J',motif:'spots'},
 {id:'doosan',name:'서울 판다스',short:'PANDAS',primary:'#131230',secondary:'#ed1c24',mark:'P',motif:'panda'},
 {id:'kiwoom',name:'고척 샤크스',short:'SHARKS',primary:'#820024',secondary:'#d2ae7c',mark:'S',motif:'shark'}
];
export const findTeam=id=>TEAMS.find(team=>team.id===id)||null;
export function teamLogo(team){
 const motifs={beaver:'<ellipse cx="40" cy="33" rx="23" ry="21"/><circle cx="22" cy="18" r="6"/><circle cx="58" cy="18" r="6"/><path d="M32 49h16v11H32z" fill="white"/><path d="M40 49v11" stroke="currentColor" stroke-width="2"/>',wings:'<path d="m10 19 22 8-5 8-15-7m58-9-22 8 5 8 15-7M17 35l13 4-3 7-9-4m45-7-13 4 3 7 9-4"/>',hound:'<path d="M21 14 10 30l12 8 4-13m33-11 11 16-12 8-4-13M25 19q15-9 30 0v25L40 56 25 44z"/>',cat:'<path d="m18 12 19 10h6l19-10-4 31-18 14-18-14z"/><path d="m15 40 17 3m33-3-17 3" stroke="currentColor" stroke-width="3"/>',dino:'<path d="M14 47q-4-16 16-21l11 1 3-14q2-8 14-5l9 5-3 8-10-1-1 21-5 9-4 12h-8l1-12-11 1-2 11h-8l2-14z"/>',owl:'<path d="m17 11 13 9q10-5 20 0l13-9-3 33-20 16-20-16z"/><circle cx="29" cy="31" r="10" fill="none" stroke="white" stroke-width="2"/><circle cx="51" cy="31" r="10" fill="none" stroke="white" stroke-width="2"/>',gull:'<path d="M9 24q15-11 31 7 16-18 31-7L49 41l-9 15-9-15z"/>',spots:'<path d="m18 13 17 8h10l17-8-5 31-17 13-17-13z"/><g fill="white"><circle cx="24" cy="27" r="3"/><circle cx="56" cy="27" r="3"/><circle cx="25" cy="43" r="3"/><circle cx="55" cy="43" r="3"/></g>',panda:'<circle cx="23" cy="19" r="10"/><circle cx="57" cy="19" r="10"/><ellipse cx="40" cy="36" rx="23" ry="22"/><ellipse cx="28" cy="30" rx="7" ry="9" fill="white"/><ellipse cx="52" cy="30" rx="7" ry="9" fill="white"/>',shark:'<path d="M14 48q6-16 18-18L47 8l1 20 19 7-17 7-8 15-4-12-14 8z"/>'};
 return `<svg viewBox="0 0 80 84" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M6 7h68v42L40 78 6 49z" fill="${team.primary}" stroke="${team.secondary}" stroke-width="4"/><g fill="${team.secondary}" color="${team.secondary}">${motifs[team.motif]}</g><text x="40" y="46" fill="white" stroke="${team.primary}" stroke-width="1.3" paint-order="stroke" text-anchor="middle" font-family="Arial,sans-serif" font-style="italic" font-weight="900" font-size="${team.mark.length>1?25:34}">${team.mark}</text><path d="M26 60h28" stroke="white" stroke-width="3"/></svg>`;
}
export function cleanClub(value){
 const team=findTeam(value?.teamId);
 const valid=Number.isSafeInteger(value?.atBats)&&value.atBats>=0&&Number.isSafeInteger(value?.hits)&&value.hits>=0&&value.hits<=value.atBats;
 return {teamId:team?.id??null,tutorialDone:Boolean(team&&value?.tutorialDone===true),atBats:team&&valid?value.atBats:0,hits:team&&valid?value.hits:0,lastEvent:team&&typeof value?.lastEvent==='string'?value.lastEvent.slice(0,240):''};
}
export function selectTeam(club,id){
 if(!findTeam(id))return club;
 if(club.teamId===id)return club;
 return {...cleanClub({teamId:id}),tutorialDone:club.tutorialDone};
}
export function battingAverage(club){return club.atBats?(club.hits/club.atBats).toFixed(3).replace(/^0/,''):'—';}
export function recordAppearance(club,before,after,eventId){
 if(!club.teamId||club.lastEvent===eventId||before.outs>=3)return club;
 // One completed batter = one AB, even if the defense makes two outs.
 if(after.walks>before.walks||after.hitByPitches>before.hitByPitches)return {...club,lastEvent:eventId};
 if(after.hits===before.hits&&after.outs===before.outs)return club;
 return {...club,atBats:club.atBats+1,hits:club.hits+(after.hits>before.hits?1:0),lastEvent:eventId};
}

// Shared CSS/canvas palette; keep the club color and derive readable surfaces.
export function mixColor(color,target,amount){
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const a=rgb(color),b=rgb(target);
 return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*amount).toString(16).padStart(2,'0')).join('');
}
export function colorContrast(a,b){
 const luminance=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function teamTheme(team){
 const primary=team?.primary||'#c8102e',secondary=team?.secondary||'#17191d',soft=mixColor(primary,'#ffffff',.95);
 let action=primary;for(let i=0;i<20&&colorContrast(action,soft)<4.5;i++)action=mixColor(action,'#000000',.08);
 return {primary,secondary,action,onPrimary:colorContrast(primary,'#ffffff')>=4.5?'#ffffff':'#15171b',
  deep:mixColor(primary,'#000000',.67),dark:mixColor(primary,'#000000',.42),soft,border:mixColor(primary,'#ffffff',.76),
  ink:mixColor(primary,'#17191d',.82),muted:mixColor(primary,'#60636a',.75),light:mixColor(primary,'#ffffff',.78)};
}
