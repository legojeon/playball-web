// User-selected audio stays in this origin's IndexedDB; no network upload.
export const MUSIC_LIMITS={fileBytes:20*1024*1024,totalBytes:60*1024*1024,seconds:180,totalSeconds:600,tracks:24};
export function musicName(filename){return String(filename).normalize('NFC').replace(/\.[^.]+$/,'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80)||'이름 없는 응원가';}
export function validateMusicFile(file){
 if(!file||!file.size)throw new Error('비어 있는 파일입니다.');
 if(file.size>MUSIC_LIMITS.fileBytes)throw new Error('파일 하나는 20MB까지 추가할 수 있어요.');
 if(!/\.(mp3|m4a|wav|ogg|aac|flac|webm)$/i.test(file.name))throw new Error('MP3, M4A, WAV 등 오디오 파일을 선택해 주세요.');
}
export function validateMusicBudget(records,track){
 const kept=records.filter(r=>track.kind!=='anthem'||r.kind!=='anthem');
 if(!Number.isFinite(track.duration)||track.duration<=0||track.duration>MUSIC_LIMITS.seconds)throw new Error('곡 하나는 3분까지 추가할 수 있어요.');
 if(kept.length>=MUSIC_LIMITS.tracks)throw new Error('최대 24곡까지 저장할 수 있어요.');
 if(kept.reduce((n,r)=>n+r.size,0)+track.size>MUSIC_LIMITS.totalBytes||kept.reduce((n,r)=>n+r.duration,0)+track.duration>MUSIC_LIMITS.totalSeconds)throw new Error('저장 한도는 전체 60MB · 10분입니다. 곡을 삭제한 뒤 다시 추가해 주세요.');
}
function openDatabase(){return new Promise((resolve,reject)=>{
 if(!globalThis.indexedDB){reject(new Error('이 환경에서는 응원가를 저장할 수 없어요.'));return;}
 const request=indexedDB.open('play-ball-music-v1',1);let expired=false;
 const timer=setTimeout(()=>{expired=true;reject(new Error('저장 공간 연결 시간이 초과됐어요. 다시 시도해 주세요.'));},8000);
 request.onupgradeneeded=()=>request.result.createObjectStore('tracks',{keyPath:'id'});
 request.onsuccess=()=>{clearTimeout(timer);const db=request.result;if(expired){db.close();return;}db.onversionchange=()=>db.close();resolve(db);};
 request.onerror=()=>{clearTimeout(timer);reject(request.error);};request.onblocked=()=>{clearTimeout(timer);expired=true;reject(new Error('다른 게임 창을 닫고 다시 시도해 주세요.'));};
});}
async function transaction(mode,action){
 const db=await openDatabase();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('tracks',mode);let request;
  try{request=action(tx.objectStore('tracks'));}catch(error){tx.abort();reject(error);return;}
  tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('저장하지 못했습니다.'));
 });}finally{db.close();}
}
export const musicStore={
 list:()=>transaction('readonly',store=>store.getAll()),
 put:async(track,replaceIds=[])=>{const record=await musicRecordForStorage(track);return transaction('readwrite',store=>{for(const id of replaceIds)store.delete(id);return store.put(record);});},
 remove:id=>transaction('readwrite',store=>store.delete(id))
};

// Materialize picker-backed files BEFORE opening an IndexedDB transaction.
// Store plain bytes: WebKit's File/Blob backing-store path can fail independently of quota.
export async function musicRecordForStorage(track){
 const {blob,bytes,...metadata}=track;
 const data=bytes instanceof ArrayBuffer?bytes:await blob?.arrayBuffer();
 if(!(data instanceof ArrayBuffer)||!data.byteLength)throw new Error('응원가 파일을 읽지 못했어요. 파일 앱에서 다운로드한 뒤 다시 선택해 주세요.');
 return {...metadata,bytes:data.slice(0),storageVersion:2};
}
export function musicStorageError(error){
 const code=error?.name||'Error';
 if(code==='QuotaExceededError')return '응원가 저장 공간이 부족해요. 저장된 곡을 삭제한 뒤 다시 추가해 주세요. (QuotaExceededError)';
 if(code==='SecurityError'||code==='NotAllowedError')return '브라우저가 기기 저장을 차단했어요. Safari 일반 탭에서 다시 시도해 주세요. ('+code+')';
 return '응원가를 저장하지 못했어요. 파일 앱에서 파일을 다운로드한 뒤 다시 선택해 주세요. 계속되면 이 오류 코드를 알려주세요: '+code;
}
