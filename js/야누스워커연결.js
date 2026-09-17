/* 무거운 최초 탐색이 룬/거탐·소리 UI를 막지 않도록 전용 Worker에 격리한다. */
(() => {
  if(typeof Worker === 'undefined') return;
  const analyzer = window.imageAnalyzer;
  let worker = null, busy = false, epoch = 0, failed = false;
  let nextCheck = -Infinity, tracking = false;
  const reset = analyzer.resetJanusPresence.bind(analyzer);
  analyzer.canCheckJanus = now => !failed && !busy && now>=nextCheck;
  analyzer.pauseJanusPresence = () => {
    epoch++;nextCheck=-Infinity;
    if(worker)worker.postMessage({pause:true,epoch});
  };
  analyzer.resetJanusPresence = () => {
    reset();
    epoch++;
    nextCheck=-Infinity;tracking=false;
    // 작업 중인 이전 결과는 epoch로 폐기. 완료 응답은 busy를 해제한다.
    if(worker) worker.postMessage({reset:true,epoch});
  };
  analyzer.processJanusPresenceFrame = (frame,now) => {
    if(failed || busy || now<nextCheck) return;
    if(!worker) {
      try {
        worker = new Worker('js/야누스분석워커.js?v=20260917-2');
        worker.onmessage = ({data}) => {
          if(data.done) {busy=false;analyzer.janusLastAnalysisMs=data.cost;}
          if(data.epoch!==epoch || !document.getElementById('toggle-janus-detection')?.checked || !window.screenCaptureManager?.isStreaming) return;
          const pill=document.getElementById('janus-status-pill');
          if(data.status && pill) pill.textContent=data.status;
          if(data.status) tracking=/확인 중|유지 확인|소멸 확인/.test(data.status);
          if(data.alert) window.audioNotifier?.notify(data.alert.message,data.alert.category,data.alert.options);
          if(data.error && pill) pill.textContent='⚠️ 야누스 분석 오류 · 다시 켜 주세요';
        };
        worker.onerror = () => {
          busy=false; failed=true; worker.terminate(); worker=null;
          const pill=document.getElementById('janus-status-pill');
          if(pill) pill.textContent='⚠️ 야누스 분석 시작 실패 · 새로고침 필요';
        };
      } catch(error) { failed=true; console.error('야누스 Worker 시작 실패',error); return; }
    }
    busy=true;
    nextCheck=now+(tracking?150:600);
    worker.postMessage({epoch,frame,now},[frame.data.buffer]);
  };
})();
