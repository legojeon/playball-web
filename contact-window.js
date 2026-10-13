// Control assistance, in ms relative to the visible ball crossing the plate.
export const TIMING={good:35,normal:75,weak:110,physicalScale:9.5/110,powerLoss:.22};
export const ASSIST={early:180,late:TIMING.weak,expiryGrace:60};
export const inContactWindow=error=>error>=-ASSIST.early&&error<=ASSIST.late;
export function timingGrade(error){const a=Math.abs(error);return a<=TIMING.good+1e-7?'good':a<=TIMING.normal+1e-7?'normal':a<=TIMING.weak+1e-7?'weak':'miss';}
export function timingText(error){const grade=timingGrade(error),ms=Math.round(Math.abs(error));return grade==='good'?'타이밍 좋음':`${error<0?'조금 빠름':'조금 늦음'} ${ms}ms · ${grade==='normal'?'허용 범위':grade==='weak'?'약한 접촉 범위':'타이밍 범위 밖'}`;}

// Visible control envelope, not an oversized physical bat. Only inputs inside
// this ellipse receive aim assistance; mesh, collider and review use its target.
// Vertical assistance reduces angle sensitivity without narrowing the accepted area.
export const MEET={radiusX:.36,radiusY:.25,inner:.55,aimScaleX:.30,aimScaleY:.18};
export function meetTarget(rawAim,pitch){
 const dx=rawAim.x-pitch.x,dy=rawAim.y-pitch.y;
 const distance=Math.hypot(dx/MEET.radiusX,dy/MEET.radiusY),inside=distance<=1+1e-9;
 return {inside,distance,rawAim:{x:rawAim.x,y:rawAim.y,z:.35},
  aim:inside?{x:pitch.x+dx*MEET.aimScaleX,y:pitch.y+dy*MEET.aimScaleY,z:.35}:{x:rawAim.x,y:rawAim.y,z:.35}};
}

// Support both holding an aim at the plate and following the ball actually
// shown on screen. Preserve the offset from the chosen visible ball; never
// grant a hit for an arbitrary remote tap. References expire after 110ms.
export function followAim(rawAim,pitch,references=[]){
 if(!rawAim)return null;
 let best={x:rawAim.x,y:rawAim.y,z:.35},score=meetTarget(best,pitch).distance;
 for(const ref of references){
  const candidate={x:pitch.x+rawAim.x-ref.x,y:pitch.y+rawAim.y-ref.y,z:.35};
  const distance=meetTarget(candidate,pitch).distance;
  if(distance<score){best=candidate;score=distance;}
 }
 return best;
}
