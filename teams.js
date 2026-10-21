// Game palettes and redrawn emblems inspired by the current KBO clubs.
// Official reference pages and design notes: docs/TEAM-DESIGN.md.
export const TEAMS=[
 {id:'lg',name:'LG 트윈스',short:'TWINS',primary:'#c30452',secondary:'#17191d',mark:'T',motif:'twins'},
 {id:'hanwha',name:'한화 이글스',short:'EAGLES',primary:'#fc4e00',secondary:'#212121',mark:'E',motif:'wings'},
 {id:'ssg',name:'SSG 랜더스',short:'LANDERS',primary:'#ce0e2d',secondary:'#e6c99a',mark:'L',motif:'orbit'},
 {id:'samsung',name:'삼성 라이온즈',short:'LIONS',primary:'#074ca1',secondary:'#c5ced5',mark:'SL',motif:'mane'},
 {id:'nc',name:'NC 다이노스',short:'DINOS',primary:'#315288',secondary:'#c7a079',mark:'NC',motif:'claw'},
 {id:'kt',name:'KT 위즈',short:'WIZ',primary:'#202023',secondary:'#eb1c24',mark:'W',motif:'bolt'},
 {id:'lotte',name:'롯데 자이언츠',short:'GIANTS',primary:'#041e42',secondary:'#d00f31',mark:'G',motif:'ball'},
 {id:'kia',name:'KIA 타이거즈',short:'TIGERS',primary:'#ea0029',secondary:'#06141f',mark:'T',motif:'stripes'},
 {id:'doosan',name:'두산 베어스',short:'BEARS',primary:'#131230',secondary:'#ed1c24',mark:'B',motif:'bear'},
 {id:'kiwoom',name:'키움 히어로즈',short:'HEROES',primary:'#820024',secondary:'#d2ae7c',mark:'H',motif:'hero'}
];
export const findTeam=id=>TEAMS.find(team=>team.id===id)||null;
export function teamLogo(team){
 const motifs={twins:'<path d="M23 20h12v8h-3v15h-6V28h-3zm22 0h12v8h-3v15h-6V28h-3z"/>',wings:'<path d="m12 21 18 5-2 6-14-5zm56 0-18 5 2 6 14-5M17 33l12 3-1 5-9-3m44-5-12 3 1 5 9-3"/>',orbit:'<ellipse cx="40" cy="34" rx="31" ry="12" transform="rotate(-28 40 34)" fill="none" stroke="currentColor" stroke-width="4"/>',mane:'<path d="m40 9 8 7 11-1 1 11 8 8-8 8-1 11-11-1-8 7-8-7-11 1-1-11-8-8 8-8 1-11 11 1z"/>',claw:'<path d="m18 16 10 5-6 17-6 5 4-19m17-12 9 6-6 16-6 4 5-18m17-12 8 7-6 14-6 4 5-17"/>',bolt:'<path d="m45 9-25 27h17l-5 23 29-34H43z"/>',ball:'<circle cx="40" cy="33" r="23" fill="none" stroke="currentColor" stroke-width="4"/><path d="m17 27 11 6-10 9m45-15-11 6 10 9" fill="none" stroke="currentColor" stroke-width="3"/>',stripes:'<path d="m17 18 18 5-4 6-16-5m48-6-18 5 4 6 16-5M19 34l12 3-4 5-10-3m44-5-12 3 4 5 10-3"/>',bear:'<circle cx="23" cy="20" r="9"/><circle cx="57" cy="20" r="9"/><path d="M20 27Q40 13 60 27v18Q40 59 20 45z"/>',hero:'<path d="m40 10 7 15 17 2-13 12 4 17-15-8-15 8 4-17-13-12 17-2z"/>'};
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
