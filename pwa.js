'use strict';
(() => {
  const status = document.getElementById('offline-status');
  // Local ports are shared by unrelated tools. Never persist a game shell there.
  const host = location.hostname.toLowerCase();
  const localHost = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    host === '[::1]' || host === '::1' || /^127\./.test(host) || /^10\./.test(host) ||
    /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (location.protocol === 'http:' || localHost) {
    status.textContent = '로컬 실행 · 오프라인 저장 안 함';
    return;
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol === 'file:') {
    status.textContent = '현재 주소에서는 온라인으로 플레이합니다.';return;
  }
  let refreshing=false;
  let gameStarted=false;
  const overlay=document.getElementById('overlay');
  // Lock updates before the async start/resume handler can begin loading a game.
  for(const id of ['start','resume-game','restart-game','confirm-team','tutorial-start','tutorial-skip']){
    document.getElementById(id)?.addEventListener?.('click',()=>{gameStarted=true;},{capture:true});
  }
  const canApplyUpdate=()=>!gameStarted&&!overlay.hidden;
  const hadController=Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(hadController&&!refreshing&&canApplyUpdate()){
      refreshing=true;location.reload();
    }
  });
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration => {
    const refresh=()=>{if(registration.active)status.textContent='오프라인 준비 완료';};
    const waiting=()=>{
      // Apply on opening the game. Once play starts, leave the update for next time.
      if(registration.waiting&&canApplyUpdate())registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
    };
    refresh();navigator.serviceWorker.ready.then(refresh);waiting();
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;if(!worker)return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='redundant')status.textContent='오프라인 저장 실패 · 연결 후 다시 열어주세요.';
        if(worker.state==='installed'){if(registration.active)waiting();else refresh();}
      });
    });
    registration.update().catch(()=>{}); // Offline play continues from the installed shell.
  }).catch(()=>{status.textContent='오프라인 저장 실패 · 연결 후 다시 열어주세요.';});
})();
