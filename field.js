// Shared dimensions for rendering, fielding and runners (metres, seconds).
export const BASE_PATH=27.43;
const D=BASE_PATH/Math.sqrt(2);
export const BASES=[[0,0,0],[-D,0,D],[0,0,2*D],[D,0,D],[0,0,0]];
export const FIELDERS=[[-23,27],[23,27],[-10,36],[10,36],[-38,75],[0,88],[38,75]];
export const FIELD={fence:110,fenceHeight:4,runnerSpeed:8,jogSpeed:6,throwSpeed:30,reaction:.32,fielderSpeed:6.8,fielderAcceleration:4.5};
export const runnerArrival=base=>.4+base*BASE_PATH/FIELD.runnerSpeed+Math.max(0,base-1)*.12;

export function fielderTravel(distance){
 const ramp=FIELD.fielderSpeed/FIELD.fielderAcceleration,rampDistance=.5*FIELD.fielderAcceleration*ramp*ramp;
 return distance<rampDistance?Math.sqrt(2*distance/FIELD.fielderAcceleration):ramp+(distance-rampDistance)/FIELD.fielderSpeed;
}
export function fielderDistance(time){
 const t=Math.max(0,time),ramp=FIELD.fielderSpeed/FIELD.fielderAcceleration;
 return t<ramp?.5*FIELD.fielderAcceleration*t*t:.5*FIELD.fielderAcceleration*ramp*ramp+(t-ramp)*FIELD.fielderSpeed;
}
