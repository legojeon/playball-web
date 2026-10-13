(function (root) {
  'use strict';
  function initial() { return { inning: 1, runs: 0, outs: 0, strikes: 0, balls: 0, bases: [false, false, false], hits: 0, homers: 0, walks: 0, hitByPitches: 0 }; }
  function nextInning(state) { return state.outs < 3 ? state : state.inning >= 9 ? initial() : { ...state, inning: (state.inning || 1) + 1, outs: 0, strikes: 0, balls: 0, bases: [false, false, false] }; }
  function advance(state, bases) {
    if (state.outs >= 3) return state;
    const next = { ...state, bases: [false, false, false], strikes: 0, balls: 0, hits: state.hits + 1, homers: state.homers + (bases === 4 ? 1 : 0) };
    for (let i = 2; i >= 0; i--) if (state.bases[i]) {
      if (i + bases >= 3) next.runs++;
      else next.bases[i + bases] = true;
    }
    if (bases === 4) next.runs++; else next.bases[bases - 1] = true;
    return next;
  }
  function out(state) { return state.outs >= 3 ? state : { ...state, outs: state.outs + 1, strikes: 0, balls: 0 }; }
  function strike(state) { return state.outs >= 3 ? state : state.strikes === 2 ? out(state) : { ...state, strikes: state.strikes + 1 }; }
  function walk(state) {
    if (state.outs >= 3) return state;
    const [first, second, third] = state.bases;
    return { ...state, balls: 0, strikes: 0, walks: state.walks + 1,
      runs: state.runs + (first && second && third ? 1 : 0),
      bases: [true, first || second, third || (first && second)] };
  }
  function ball(state) { return state.outs >= 3 ? state : state.balls === 3 ? walk(state) : { ...state, balls: state.balls + 1 }; }
  function foul(state) { return state.outs >= 3 || state.strikes === 2 ? state : strike(state); }
  function hitByPitch(state) {
    if (state.outs >= 3) return state;
    return { ...walk(state), walks: state.walks, hitByPitches: state.hitByPitches + 1 };
  }
  function forcePlay(state, play) {
    if (state.outs >= 3) return state;
    const outs = Math.min(3, state.outs + play.outs);
    const next = { ...state, outs, balls: 0, strikes: 0, bases: [false, false, false] };
    // No run scores when the third out is a force or the batter before first.
    if (outs === 3) return next;
    for (const runner of play.runners) if (!runner.out) {
      if (runner.to === 4) next.runs++;
      else next.bases[runner.to - 1] = true;
    }
    return next;
  }
  // A new plate appearance follows a completed batter, not every pitch or foul.
  function nextPhaseAfterResult(before, after) {
    if (after.outs >= 3) return 'over';
    return ['hits', 'outs', 'walks', 'hitByPitches'].some(key => after[key] > before[key]) ? 'stance' : 'ready';
  }
  const api = { initial, nextInning, advance, out, strike, ball, walk, foul, hitByPitch, forcePlay, nextPhaseAfterResult };
  if (typeof module !== 'undefined') module.exports = api;
  root.BaseballRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
