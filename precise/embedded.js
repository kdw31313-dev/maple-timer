const embedded = window.parent !== window;
if (!embedded) location.replace('../#precision-panel');
else {
  const status = document.querySelector('#precision-status');
  const host = window.parent;
  const devices = navigator.mediaDevices;
  const original = devices?.getDisplayMedia;
  if (original) {
    devices.getDisplayMedia = async function (...args) {
      const legacy = host.screenCaptureManager;
      const existing = legacy?.mediaStream;
      const reuse = existing?.getVideoTracks().some(t => t.readyState === 'live');
      const stream = reuse ? existing.clone() : await original.apply(this, args);
      if (!reuse) {
        const stop = () => {
          for (const track of stream.getTracks()) {
            if (track.readyState === 'live') {
              track.stop();
              track.dispatchEvent(new Event('ended'));
            }
          }
        };
        legacy?.attachSharedCapture(stream, stop);
      } else {
        const cancel = () => {
          for (const track of stream.getTracks()) if (track.readyState === 'live') {
            track.stop();
            track.dispatchEvent(new Event('ended'));
          }
        };
        for (const track of existing.getVideoTracks()) track.addEventListener('ended', cancel, {once:true});
        legacy?.addSharedCaptureCleanup(cancel);
      }
      return stream;
    };
  }
  try {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
    }
    await import('./runtime/assets/main-CFOc9O-R.js');
    status.hidden = true;
    const notifySize = () => {
      const root = document.querySelector('#root');
      const height = Math.ceil(root.getBoundingClientRect().height);
      if (height > 0) host.document.getElementById('maple-precision-frame')?.style.setProperty('height', Math.max(420,height+16)+'px');
    };
    new ResizeObserver(notifySize).observe(document.querySelector('#root'));
    host.maplePrecisionStart = () => {
      const button = document.querySelector('button[aria-label="화면 공유 시작"]');
      if (!button || button.disabled) return false;
      host.document.getElementById('precision-panel')?.scrollIntoView({behavior:'smooth'});
      button.click();
      return true;
    };
    host.document.getElementById('precision-load-status')?.replaceChildren('룬 · 스킬 · 버프 · 경험치 감시 준비됨');
  } catch (error) {
    status.textContent = '정밀 감지 준비 실패. 페이지를 새로고침해 주세요.';
    console.warn('Precision engine could not start:', error.message);
  }
}
