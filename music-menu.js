export function bindMusicMenu({sound,onChanged,onOpen}){
 const $=id=>document.getElementById(id),dialog=$('music-dialog'),status=$('music-status'),renameDialog=$('music-rename-dialog'),nameInput=$('music-name'),renameStatus=$('music-rename-status');let busy=false,editingId=null;
 function setBusy(value){busy=value;for(const panel of [dialog,renameDialog])for(const node of panel.querySelectorAll('button,input'))node.disabled=value;}
 function render(){
  for(const kind of ['cheer','anthem']){
   const list=$(kind+'-list');list.replaceChildren();
   for(const track of sound.library.filter(t=>t.kind===kind)){
    const row=document.createElement('div');row.className='music-row';
    const title=document.createElement('span');title.textContent=track.title;title.title=track.filename;
    const edit=document.createElement('button');edit.type='button';edit.textContent='✎';edit.className='music-edit';edit.setAttribute('aria-label',track.title+' 이름 변경');
    edit.onclick=()=>{if(busy)return;editingId=track.id;nameInput.value=track.title;renameStatus.textContent='';renameDialog.showModal();nameInput.focus();nameInput.select();};
    const remove=document.createElement('button');remove.type='button';remove.textContent='✕';remove.className='music-remove';remove.setAttribute('aria-label',track.title+' 삭제');
    remove.onclick=async()=>{if(busy)return;setBusy(true);try{await sound.removeMusic(track.id);status.textContent='곡을 삭제했습니다.';onChanged();}catch{status.textContent='삭제하지 못했어요. 다시 시도해 주세요.';}finally{render();setBusy(false);}};
    row.append(title,edit,remove);list.append(row);
   }
   if(!list.childElementCount){const empty=document.createElement('p');empty.className='small';empty.textContent=kind==='cheer'?'추가한 타석 응원가가 없습니다.':'테마 응원가가 없습니다.';list.append(empty);}
  }
 }
 const openMusic=async()=>{onOpen();dialog.showModal();status.textContent='저장된 곡을 불러오는 중…';setBusy(true);await sound.libraryReady;render();status.textContent=sound.libraryError||'';setBusy(false);};
 for(const id of ['music-library','title-music']){const button=$(id);if(button)button.onclick=openMusic;}
 const closeRename=()=>{if(busy)return;renameDialog.close();editingId=null;};
 $('cancel-music-rename').onclick=closeRename;
 renameDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else editingId=null;});
 $('music-rename-form').onsubmit=async event=>{
  event.preventDefault();if(busy||!editingId)return;
  setBusy(true);renameStatus.textContent='';
  try{await sound.renameMusic(editingId,nameInput.value);renameDialog.close();editingId=null;render();status.textContent='응원가 이름을 변경했습니다.';onChanged();}
  catch(error){renameStatus.textContent=error.message;}
  finally{setBusy(false);if(renameDialog.open)nameInput.focus();}
 };
 $('close-music').onclick=()=>dialog.close();
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 for(const kind of ['cheer','anthem']){
  const input=$(kind+'-files');$(kind+'-add').onclick=()=>input.click();
  input.onchange=async()=>{
   const files=[...input.files];if(!files.length||busy)return;
   setBusy(true);let count=0;const errors=[];
   for(const file of files){status.textContent='추가 중 · '+file.name;try{await sound.importMusic(file,kind);count++;}catch(error){errors.push(file.name+': '+error.message);}}
   input.value='';render();status.textContent=[count?count+'곡을 기기에 저장했습니다.':'',...errors].filter(Boolean).join('\n');setBusy(false);onChanged();
   if(count)navigator.storage?.persist?.().catch(()=>{});
  };
 }
}
