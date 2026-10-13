// Modern browsers use performance.timeOrigin. Normalize older epoch timestamps
// as well, but never let dispatch/handler delay replace a valid event timestamp.
export function inputTime(stamp,handledAt=performance.now(),origin=performance.timeOrigin){
 const time=stamp>1e12?stamp-origin:stamp;
 return Number.isFinite(time)&&time>0&&time<=handledAt+2?Math.min(time,handledAt):handledAt;
}
// One physical press starts one swing. Movement and release never start swings.
export function bindTapInput(field,{onPress,onHover,onLeave}){
 field.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.isPrimary===false)return;
  const at=inputTime(e.timeStamp);
  e.preventDefault();
  onPress(e.clientX,e.clientY,at);
  field.focus({preventScroll:true});
 });
 field.addEventListener('pointermove',e=>{
  if(e.pointerType==='mouse'&&!e.buttons)onHover(e.clientX,e.clientY);
 });
 field.addEventListener('pointerleave',onLeave);
 field.addEventListener('pointercancel',onLeave);
}

// Capture one pointer through drag/release. Cancel is never a swing.
export function bindReleaseInput(field,{onAim,onRelease,onCancel,getOrigin}){
 let pointer=null,anchor=null;
 const mapped=e=>anchor?{x:anchor.x+(e.clientX-anchor.pressX),y:anchor.y+(e.clientY-anchor.pressY)}:{x:e.clientX,y:e.clientY};
 function cancel(){const id=pointer;pointer=null;anchor=null;if(id!==null){if(field.hasPointerCapture?.(id))field.releasePointerCapture(id);onCancel();}}
 field.addEventListener('pointerdown',e=>{
  if(pointer!==null||e.button!==0||e.isPrimary===false)return;
  e.preventDefault();
  const origin=getOrigin?.();
  if(getOrigin&&(!origin||!Number.isFinite(origin.x)||!Number.isFinite(origin.y)))return;
  anchor=origin?{...origin,pressX:e.clientX,pressY:e.clientY}:null;
  const aim=mapped(e);if(onAim(aim.x,aim.y)===false){anchor=null;return;}
  pointer=e.pointerId;field.setPointerCapture?.(pointer);field.focus({preventScroll:true});
 });
 field.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();const aim=mapped(e);onAim(aim.x,aim.y);}});
 field.addEventListener('pointerup',e=>{
  if(e.pointerId!==pointer)return;e.preventDefault();const id=pointer,aim=mapped(e);pointer=null;anchor=null;
  if(field.hasPointerCapture?.(id))field.releasePointerCapture(id);
  const r=field.getBoundingClientRect();
  if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)onRelease(aim.x,aim.y,inputTime(e.timeStamp));
  onCancel();
 });
 for(const type of ['pointercancel','lostpointercapture'])field.addEventListener(type,e=>{if(e.pointerId===pointer)cancel();});
 return {cancel};
}
