import {traceBall,sampleTrajectory} from './trajectory.js?v=111';
import {throwPlan} from './fielding.js?v=111';
// Isolated practice contact: always a fair single, never used by regular batting.
export function tutorialHit(){
 const velocity=[-12,7,25],trace=traceBall({x:0,y:1.02,z:.35},velocity,0);
 const fielding={fielder:4,time:3.5,point:sampleTrajectory(trace.samples,3.5),caught:false};
 const plan=throwPlan(fielding,2);
 return {bases:1,label:'SINGLE',detail:'연습 안타 · 1루로 출루합니다',batted:{...trace,speed:Math.hypot(...velocity)*3.6,launch:Math.atan2(7,Math.hypot(-12,25))*180/Math.PI,type:'line',fielding,caught:false,throwBase:2,throwPlan:plan,returnAt:plan.arrival,animationTime:plan.arrival}};
}
export function tutorialPitch(clock){return {name:'FOUR-SEAM',ko:'연습 공',speed:90,x:0,y:1.02,isStrike:true,curve:0,arc:.16,windup:900,windupAt:clock,start:clock+900,duration:(17-.35)*3600/90,swung:false,lastRenderedError:-Infinity};}
