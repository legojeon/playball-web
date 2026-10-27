export const SWING_FEEDBACK_MS=2000, PITCH_FEEDBACK_MS=2350;
// Fast reveal, brief hold, gentle fade; driven by the pausable game clock.
export function feedbackOpacity(elapsed){
 if(elapsed<0||elapsed>=2350)return 0;
 if(elapsed<90)return elapsed/90;
 if(elapsed<1650)return 1;
 const t=(elapsed-1650)/700;
 return 1-t*t*(3-2*t);
}

// The contact/closest-approach snapshot exists for exactly two game-clock seconds.
export function swingFeedbackOpacity(elapsed){
 if(elapsed<0||elapsed>=2000)return 0;
 return elapsed<1650?1:1-(elapsed-1650)/350;
}

// Seconds after contact. Home runs reveal at fence crossing; other safe advances
// wait for arrival. Outs/fouls retain
// their decisive catch/throw event instead of waiting for a dugout return.
export function battedResultDelay(result,runningTime=0){
 const b=result.batted;
 if(result.bases===4)return b?.animationTime??0;
 if(result.bases||result.hbp||result.label==='BASE ON BALLS')return Math.max(0,runningTime)/1000;
 if(!b)return 0;
 if(b.caught)return b.fielding?.time??b.animationTime??0;
 if(result.out)return b.returnAt??b.animationTime??0;
 if(result.foul)return Math.min(b.firstBounce?.t??Infinity,b.animationTime??0);
 if(b.groundRuleDouble)return b.animationTime??0;
 return b.firstBounce?.t??b.flight??b.fielding?.time??b.animationTime??0;
}
