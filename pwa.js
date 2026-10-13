'use strict';
(() => {
  const status = document.getElementById('offline-status');
  const updateButton = document.getElementById('update-game');
  if (!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol === 'file:') {
    status.textContent = '현재 주소에서는 온라인으로 플레이합니다.';return;
  }
  let refreshing=false;
  const hadController=Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(hadController&&!refreshing){
      if(document.getElementById('overlay').hidden){
        status.textContent='업데이트 준비 완료';updateButton.hidden=false;
        updateButton.onclick=()=>{refreshing=true;location.reload();};return;
      }
      refreshing=true;location.reload();
    }
  });
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration => {
    const refresh=()=>{if(registration.active)status.textContent='오프라인 준비 완료';};
    const waiting=()=>{
      if(!registration.waiting)return;
      const apply=()=>registration.waiting?.postMessage({type:'ACTIVATE_UPDATE'});
      // Only auto-reload on the title/results screen. An active game gets a button.
      if(!document.getElementById('overlay').hidden){apply();return;}
      status.textContent='새 버전 준비 완료';updateButton.hidden=false;
      updateButton.onclick=()=>{window.dispatchEvent(new Event('game:pause'));apply();};
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
