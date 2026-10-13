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
