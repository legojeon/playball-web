// Keep catches within 3m at catcher volume, then soften with world-space distance.
export const fieldCatchGain=distance=>1/(1+Math.max(0,distance-3)/14);
import {musicStore,musicName,validateMusicFile,validateMusicBudget,musicStorageError} from './music-library.js?v=95';
export const CHEER_TRACKS=[];
export const ANTHEM_TRACKS=[];
export const CROWD_ASSETS=[['crowd-ambience','./audio/crowd-ambience.wav'],['crowd-reaction','./audio/crowd-reaction.mp3']];
export const CROWD_REACTIONS={anticipation:{gain:.16,duration:1.6},onbase:{gain:.22,duration:2.4},hit:{gain:.4,duration:3.8},score:{gain:.58,duration:5.4},homerun:{gain:.76,duration:7.5}};
export function crowdReactionFor(before,after,result){
 if(result.bases===4)return 'homerun';
 if(after.runs>before.runs)return 'score';
 if(after.hits>before.hits)return 'hit';
 if(after.walks>before.walks||after.hitByPitches>before.hitByPitches)return 'onbase';
 return null;
}
// Crowd reads the play early: a brief contact cheer, then a result response.
// Fast completed plays can react sooner; long flights never postpone the sound.
// Web Audio scheduling follows AudioContext suspension, including on iOS.
export function crowdSequenceFor(before,after,result){
 const outcome=crowdReactionFor(before,after,result),b=result.batted;
 if(!b)return outcome?[{kind:outcome,delay:.16}]:[];
 const resolvedAt=b.caught?b.fielding?.time:b.animationTime;
 const expected={homerun:.65,hit:.75,score:.75,onbase:.75}[outcome]??.75;
 const delay=Number.isFinite(resolvedAt)?Math.max(.35,Math.min(expected,resolvedAt+.12)):expected;
 // Outs fade the initial expectation; no disappointment voice or extra response.
 const duration=outcome?delay+.10:after.outs>before.outs?.9:CROWD_REACTIONS.anticipation.duration;
 const sequence=[{kind:'anticipation',delay:.04,duration}];
 if(outcome)sequence.push({kind:outcome,delay});
 return sequence;
}
export function shuffleCheers(tracks,random=Math.random){
 const order=[...tracks];
 for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 return order;
}
export function chooseCheer(tracks,lastId){
 if(!tracks.length)return null;
 return tracks[(tracks.findIndex(track=>track.id===lastId)+1)%tracks.length];
}
export class GameAudio {
 constructor({random=Math.random,cheers=CHEER_TRACKS,anthems=ANTHEM_TRACKS,store=musicStore}={}){this.ambience=null;this.crowdReaction=null;this.crowdSources=new Set();this.random=random;this.musicEnabled=true;this.musicVolume=1;this.crowdEnabled=true;this.crowdVolume=1;this.crowdGain=null;this.musicGain=null;this.anthem=null;this.cheerOrder=shuffleCheers(cheers,random);this.anthemTracks=[...anthems];this.store=store;this.library=[];this.libraryError='';this.libraryReady=store.list().then(records=>{this.library=records;return records;}).catch(()=>{this.libraryError='저장된 응원가를 읽지 못했어요. 기기의 저장 공간 설정을 확인해 주세요.';return [];});this.enabled=true;this.context=null;this.buffers={};this.sources=new Set();this.cheer=null;this.lastCheer=null;
  const assets=[...['bat-hit','glove'].map(name=>[name,'./audio/'+name+'.mp3'+(name==='bat-hit'?'?v=95':'')]),...cheers.filter(t=>t.src).map(t=>['cheer:'+t.id,t.src]),...anthems.filter(t=>t.src).map(t=>['anthem:'+t.id,t.src]),...CROWD_ASSETS];
  this.data=Promise.all(assets.map(async ([name,url])=>{try{const r=await fetch(url);if(!r.ok)throw new Error('audio');return[name,await r.arrayBuffer()];}catch{return[name,null];}}));
 }
 async unlock({resume=true}={}){
  try{
   if(!this.context){this.context=new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});this.gain=this.context.createGain();this.gain.gain.value=this.enabled?.82:0;this.gain.connect(this.context.destination);this.musicGain=this.context.createGain();this.musicGain.gain.value=this.musicEnabled?this.musicVolume:0;this.musicGain.connect(this.gain);this.crowdGain=this.context.createGain();this.crowdGain.gain.value=this.crowdEnabled?this.crowdVolume:0;this.crowdGain.connect(this.gain);}
   if(!this.decoding)this.decoding=this.data.then(async data=>{for(const [name,bytes]of data)if(bytes){try{this.buffers[name]=await this.context.decodeAudioData(bytes);}catch{}}await this.restoreLibrary();return Boolean(this.buffers['bat-hit']&&this.buffers.glove);});
   if(resume)await this.context.resume();
   return await this.decoding;
  }catch{return false;}
 }
 async decodeMusic(data){
  // decodeAudioData may detach its input. Always pass a copy, preserving stored bytes.
  const bytes=data instanceof ArrayBuffer?data:await data.arrayBuffer();
  const decoded=await this.context.decodeAudioData(bytes.slice(0));
  if(decoded.duration>180)throw new Error('곡 하나는 3분까지 추가할 수 있어요.');
  // Resample user music to mono 24 kHz to bound mobile memory usage.
  const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!Offline)return decoded;
  const offline=new Offline(1,Math.ceil(decoded.duration*24000),24000),source=offline.createBufferSource();
  source.buffer=decoded;source.connect(offline.destination);source.start();return offline.startRendering();
 }
 async restoreLibrary(){
  const tracks=await this.libraryReady,loaded=[];
  for(const track of tracks){try{const buffer=await this.decodeMusic(track.bytes??track.blob);if(this.library.some(t=>t.id===track.id)){this.buffers[track.kind+':'+track.id]=buffer;loaded.push(track);}}catch{this.libraryError='일부 저장된 응원가를 재생할 수 없어요. 삭제한 뒤 다시 추가해 주세요.';}}
  this.cheerOrder.push(...shuffleCheers(loaded.filter(t=>t.kind==='cheer'&&this.library.some(r=>r.id===t.id)),this.random));
  this.anthemTracks.push(...loaded.filter(t=>t.kind==='anthem'&&this.library.some(r=>r.id===t.id)));
 }
 async importMusic(file,kind){
  if(!['cheer','anthem'].includes(kind))throw new Error('응원가 종류를 확인해 주세요.');
  validateMusicFile(file);await this.unlock({resume:false});
  if(!this.context)throw new Error('오디오를 시작할 수 없어요. 화면을 누르고 다시 시도해 주세요.');
  let buffer,bytes;try{bytes=await file.arrayBuffer();buffer=await this.decodeMusic(bytes);}catch(e){throw new Error(e.message.includes('3분')?e.message:'재생할 수 없는 파일입니다. MP3 또는 WAV 파일을 사용해 주세요.');}
  const title=musicName(file.name),track={id:crypto.randomUUID?.()||Date.now()+'-'+Math.random(),kind,title,player:title,filename:file.name,size:file.size,duration:buffer.duration,bytes,storageVersion:2};
  validateMusicBudget(this.library,track);
  const replaced=kind==='anthem'?this.library.filter(t=>t.kind==='anthem').map(t=>t.id):[];
  try{await this.store.put(track,replaced);}catch(error){throw new Error(musicStorageError(error));}
  if(kind==='anthem'){this.stopAnthem();this.anthemTracks=[track];for(const id of replaced)delete this.buffers['anthem:'+id];}
  else this.cheerOrder.push(track); // Preserve this session's existing batting order.
  this.library=this.library.filter(t=>!replaced.includes(t.id));this.library.push(track);this.buffers[kind+':'+track.id]=buffer;
  return track;
 }
 async renameMusic(id,value){
  await this.libraryReady;
  const track=this.library.find(t=>t.id===id);
  if(!track)throw new Error('응원가를 찾지 못했어요. 목록을 다시 열어 주세요.');
  const title=String(value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,'').trim();
  if(!title)throw new Error('응원가 이름을 입력해 주세요.');
  if(title.length>80)throw new Error('이름은 80자까지 입력할 수 있어요.');
  if(title===track.title)return track;
  try{await this.store.put({...track,title,player:title});}catch{throw new Error('이름을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');}
  // Keep IDs, decoded buffers, order and active sources. Commit metadata only
  // after storage succeeds, including references held during library decoding.
  for(const item of new Set([track,...this.cheerOrder,...this.anthemTracks,this.cheer?.track,this.anthem?.track])){
   if(item?.id===id){item.title=title;item.player=title;}
  }
  return track;
 }
 async removeMusic(id){
  await this.store.remove(id);
  const index=this.cheerOrder.findIndex(t=>t.id===id);
  if(this.lastCheer===id)this.lastCheer=index>0?this.cheerOrder[index-1].id:null;
  if(this.cheer?.track.id===id)this.stopCheer();if(this.anthem?.track.id===id)this.stopAnthem();
  this.cheerOrder=this.cheerOrder.filter(t=>t.id!==id);this.anthemTracks=this.anthemTracks.filter(t=>t.id!==id);this.library=this.library.filter(t=>t.id!==id);
  delete this.buffers['cheer:'+id];delete this.buffers['anthem:'+id];
 }
 upcomingCheers(count=3){
  const available=this.cheerOrder.filter(t=>this.buffers['cheer:'+t.id]),next=[];
  let cursor=this.lastCheer;
  for(let i=0;i<Math.min(count,available.length);i++){const track=chooseCheer(available,cursor);if(!track)break;next.push(track);cursor=track.id;}
  return next;
 }
 get loadedCheerCount(){return this.cheerOrder.filter(t=>this.buffers['cheer:'+t.id]).length;}
 startCheer(){
  this.startAmbience();
  this.stopAnthem();this.stopCheer();
  if(!this.context)return null;
  const track=this.upcomingCheers(1)[0];
  if(!track)return null;
  const source=this.context.createBufferSource(),gain=this.context.createGain();
  source.buffer=this.buffers['cheer:'+track.id];source.loop=true;
  source.connect(gain).connect(this.musicGain||this.gain);gain.gain.setValueAtTime(0,this.context.currentTime);
  gain.gain.linearRampToValueAtTime(.32,this.context.currentTime+.25);
  this.cheer={source,gain,track};this.lastCheer=track.id;this.sources.add(source);
  source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();if(this.cheer?.source===source)this.cheer=null;};
  source.start();return track.player;
 }
 startAnthem(){
  this.startAmbience();
  this.stopCheer();
  if(this.anthem)return this.anthem.track.title;
  if(!this.context)return null;
  const available=this.anthemTracks.filter(t=>this.buffers['anthem:'+t.id]);
  if(!available.length)return null;
  const track=available[0];
  const source=this.context.createBufferSource(),gain=this.context.createGain();
  source.buffer=this.buffers['anthem:'+track.id];source.loop=true;
  source.connect(gain).connect(this.musicGain||this.gain);gain.gain.setValueAtTime(.32,this.context.currentTime);
  this.anthem={source,gain,track};this.sources.add(source);
  source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();if(this.anthem?.source===source)this.anthem=null;};
  source.start();return track.title;
 }
 startAmbience(){
  if(this.ambience||!this.context||!this.buffers['crowd-ambience'])return;
  const source=this.context.createBufferSource(),gain=this.context.createGain(),at=this.context.currentTime;
  source.buffer=this.buffers['crowd-ambience'];source.loop=true;source.connect(gain).connect(this.crowdGain||this.gain);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.16,at+1.2);
  this.ambience={source,gain};this.sources.add(source);
  source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();if(this.ambience?.source===source)this.ambience=null;};
  source.start(at,this.random()*source.buffer.duration);
 }
 stopCrowdReactions(){
  for(const source of this.crowdSources){try{source.stop();}catch{}}
  this.crowdSources.clear();this.crowdReaction=null;
 }
 reactToPlay(before,after,result){
  this.stopCrowdReactions();
  for(const {kind,delay,duration} of crowdSequenceFor(before,after,result))this.reactCrowd(kind,delay,{duration,replace:false});
 }
 reactCrowd(kind,delay=.16,{duration:requestedDuration,replace=true}={}){
  const reaction=CROWD_REACTIONS[kind],buffer=this.buffers[reaction?.asset||'crowd-reaction'];
  if(!reaction||!buffer||!this.context||!this.enabled)return;
  if(replace)this.stopCrowdReactions();
  const source=this.context.createBufferSource(),gain=this.context.createGain(),at=this.context.currentTime+delay;
  const duration=Math.min(requestedDuration??reaction.duration,buffer.duration),offset=reaction.offset??this.random()*Math.max(0,buffer.duration-duration);
  const attack=Math.min(reaction.attack??.22,duration*.25),fade=Math.min(1.2,duration*.45);
  source.buffer=buffer;source.connect(gain).connect(this.crowdGain||this.gain);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(reaction.gain,at+attack);
  gain.gain.setValueAtTime(reaction.gain,at+duration-fade);gain.gain.linearRampToValueAtTime(0,at+duration);
  this.crowdReaction={source,gain,kind};this.sources.add(source);this.crowdSources.add(source);
  source.onended=()=>{this.sources.delete(source);this.crowdSources.delete(source);source.disconnect();gain.disconnect();if(this.crowdReaction?.source===source)this.crowdReaction=null;};
  source.start(at,offset,duration);
 }
 stopAnthem(){
  if(!this.anthem)return;
  const {source}=this.anthem;this.anthem=null;
  try{source.stop();}catch{}
 }
 cheerVolume(value){
  if(!this.cheer||!this.context)return;
  const param=this.cheer.gain.gain,time=this.context.currentTime;
  if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);
  else{param.cancelScheduledValues(time);param.setValueAtTime(param.value,time);}
  param.linearRampToValueAtTime(value,time+.2);
 }
 stopCheer(){
  if(!this.cheer)return;
  const {source}=this.cheer;this.cheerVolume(0);this.cheer=null;
  try{source.stop(this.context.currentTime+.22);}catch{}
 }
 playFieldCatch(distance){this.play('glove',0,fieldCatchGain(distance));}
 play(name,delay=0,volume=1){
  if(['ball','strike','out'].includes(name)){this.signal(name,delay);return;}
  if(!this.enabled||!this.context||!this.buffers[name])return;
  const s=this.context.createBufferSource();s.buffer=this.buffers[name];
  const level=volume<1?this.context.createGain():null;
  if(level){level.gain.value=Math.max(0,volume);s.connect(level);level.connect(this.gain);}else s.connect(this.gain);
  s.onended=()=>{this.sources.delete(s);s.disconnect?.();level?.disconnect();};this.sources.add(s);s.start(this.context.currentTime+delay);
 }
 signal(name,delay=0){
  if(!this.enabled||!this.context)return;
  // Original synthesized ABS-style signals: no human voice or speech service.
  const notes={strike:[[0,880,.085],[.115,1320,.14]],ball:[[0,440,.20]],out:[[0,880,.075],[.11,660,.075],[.22,330,.22]]}[name];
  const start=this.context.currentTime+delay;
  for(const [offset,hz,duration] of notes){
   const osc=this.context.createOscillator(),envelope=this.context.createGain();osc.type='sine';osc.frequency.setValueAtTime(hz,start+offset);
   envelope.gain.setValueAtTime(0,start+offset);envelope.gain.linearRampToValueAtTime(.20,start+offset+.008);envelope.gain.setValueAtTime(.16,start+offset+duration-.025);envelope.gain.exponentialRampToValueAtTime(.001,start+offset+duration);
   osc.connect(envelope).connect(this.gain);this.sources.add(osc);osc.onended=()=>{this.sources.delete(osc);osc.disconnect();envelope.disconnect();};osc.start(start+offset);osc.stop(start+offset+duration+.015);
  }
 }
 setMusicEnabled(enabled){this.musicEnabled=Boolean(enabled);if(this.musicGain)this.musicGain.gain.value=this.musicEnabled?this.musicVolume:0;return this.musicEnabled;}
 setMusicVolume(value){if(typeof value==='number'&&Number.isFinite(value))this.musicVolume=Math.max(0,Math.min(1,value));this.setMusicEnabled(this.musicEnabled);return this.musicVolume;}
 setCrowdEnabled(enabled){this.crowdEnabled=Boolean(enabled);if(this.crowdGain)this.crowdGain.gain.value=this.crowdEnabled?this.crowdVolume:0;return this.crowdEnabled;}
 setCrowdVolume(value){if(typeof value==='number'&&Number.isFinite(value))this.crowdVolume=Math.max(0,Math.min(1,value));this.setCrowdEnabled(this.crowdEnabled);return this.crowdVolume;}
 applyPreferences(prefs){
  if(!prefs||typeof prefs!=='object')return;
  if(typeof prefs.musicEnabled==='boolean')this.setMusicEnabled(prefs.musicEnabled);
  if(typeof prefs.crowdEnabled==='boolean')this.setCrowdEnabled(prefs.crowdEnabled);
  this.setMusicVolume(prefs.musicVolume);this.setCrowdVolume(prefs.crowdVolume);
 }
 get preferences(){return {musicEnabled:this.musicEnabled,musicVolume:this.musicVolume,crowdEnabled:this.crowdEnabled,crowdVolume:this.crowdVolume};}
 toggleMusic(){return this.setMusicEnabled(!this.musicEnabled);}
 stop({preserveAnthem=false}={}){
  const anthem=preserveAnthem?this.anthem:null;
  this.stopCrowdReactions();this.cheer=null;this.anthem=anthem;this.ambience=null;this.crowdReaction=null;
  for(const source of [...this.sources]){if(source===anthem?.source)continue;try{source.stop();}catch{}this.sources.delete(source);}
 }
 suspend(){if(this.context)this.context.suspend().catch(()=>{});}
 resume(){if(this.context)this.context.resume().catch(()=>{});}
}
