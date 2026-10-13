// Only completed pitch outcomes are persisted; animation and pointer state are transient.
const stats=['runs','hits','homers','walks','hitByPitches'];
export function cleanState(value){
 if(!value||typeof value!=='object')return null;
 const bounds={inning:[1,9],outs:[0,3],balls:[0,3],strikes:[0,2],...Object.fromEntries(stats.map(k=>[k,[0,1000000]]))};
 const state={};
 for(const [key,[min,max]]of Object.entries(bounds)){
  if(!Number.isSafeInteger(value[key])||value[key]<min||value[key]>max)return null;
  state[key]=value[key];
 }
 if(!Array.isArray(value.bases)||value.bases.length!==3||value.bases.some(v=>typeof v!=='boolean'))return null;
 state.bases=[...value.bases];return state;
}
export function readProgress(value){
 if(!value||value.version!==1||typeof value.matchId!=='string'||!value.matchId||value.matchId.length>100||!Number.isFinite(value.at))return null;
 const state=cleanState(value.state),inningStart=cleanState(value.inningStart);
 if(!state||!inningStart||state.inning!==inningStart.inning||inningStart.outs||inningStart.balls||inningStart.strikes||inningStart.bases.some(Boolean)||stats.some(k=>inningStart[k]>state[k]))return null;
 return {version:1,matchId:value.matchId,at:value.at,state,inningStart};
}
export function makeProgress(matchId,state,inningStart,at=Date.now()){
 return readProgress({version:1,matchId,state,inningStart,at});
}
