/* Integration adapter: shares the original page's user-selected stream with the existing popup detector. */
(function(root){
 'use strict';
 class PopupBridge{
  constructor({video,canvas,analyzer,onStatus,isPaused=()=>false,now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout}){
   Object.assign(this,{video,canvas,analyzer,onStatus,isPaused,now,schedule,cancel});this.enabled=true;this.stream=null;this.timer=null;this.generation=0;this.lastErrorAt=0;this.wasPaused=false;
  }
  attach(stream){this.detach();this.stream=stream;this.video.srcObject=stream;this.analyzer.reset();const generation=this.generation;for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(generation===this.generation)this.detach();},{once:true});Promise.resolve(this.video.play()).then(()=>{if(generation===this.generation)this.tick(generation);}).catch(e=>this.onStatus('거탐 영상 준비 실패: '+e.message));}
  detach(){this.generation++;if(this.timer!==null)this.cancel(this.timer);this.timer=null;this.video.pause();this.video.srcObject=null;this.stream=null;this.analyzer.reset();this.onStatus('거탐: 화면 공유 대기');}
  setEnabled(enabled){this.enabled=enabled;this.analyzer.reset();this.onStatus(enabled?(this.stream?'거탐 감시 중':'거탐: 화면 공유 대기'):'거탐 감시 꺼짐');}
  tick(generation){if(generation!==this.generation||!this.stream)return;const paused=this.isPaused();if(paused&&!this.wasPaused){this.analyzer.reset();this.onStatus('거탐: 전체 비활성화');}this.wasPaused=paused;if(this.enabled&&!paused&&this.video.readyState>=2){try{const ctx=this.canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(this.video,0,0,240,135);this.analyzer.processPopupStructureFrame(ctx.getImageData(0,0,240,135));}catch(e){if(this.now()-this.lastErrorAt>5000){this.lastErrorAt=this.now();this.onStatus('거탐 분석 오류: '+e.message);}}}this.timer=this.schedule(()=>this.tick(generation),300);}
 }
 function wrapCapture(devices,attach){
  if(!devices||typeof devices.getDisplayMedia!=='function')return()=>{};
  const original=devices.getDisplayMedia;
  const wrapped=async function(...args){const stream=await original.apply(this,args);try{attach(stream);}catch(e){console.error('기존 거탐 연결 실패',e);}return stream;};
  devices.getDisplayMedia=wrapped;return()=>{if(devices.getDisplayMedia===wrapped)devices.getDisplayMedia=original;};
 }
 if(typeof module==='object'&&module.exports){module.exports={PopupBridge,wrapCapture};return;}
 const init=()=>{
  const analyzer=root.imageAnalyzer;if(!analyzer)return;
  const nav=document.querySelector('.local-mode-nav'),label=document.createElement('label'),toggle=document.createElement('input'),status=document.createElement('span');
  toggle.type='checkbox';toggle.checked=localStorage.getItem('local-popup-enabled')!=='false';label.append(toggle,' 기존 거탐 함께 감시');status.textContent='거탐: 화면 공유 대기';nav.append(label,status);
  const video=document.createElement('video'),canvas=document.createElement('canvas');video.muted=true;video.playsInline=true;canvas.width=240;canvas.height=135;
  const bridge=new PopupBridge({video,canvas,analyzer,onStatus:text=>{status.textContent=text;},isPaused:()=>[...document.querySelectorAll('label')].some(label=>label.textContent.includes('전체 비활성화')&&label.querySelector('input')?.checked)});
  root.screenCaptureManager={get isStreaming(){return!!bridge.stream;}};
  let audio=null;
  const unlock=()=>{if(!audio){const AudioCtx=root.AudioContext||root.webkitAudioContext;if(AudioCtx)audio=new AudioCtx();}if(audio?.state==='suspended')audio.resume().catch(()=>{});};
  document.addEventListener('pointerdown',unlock,{once:true});
  analyzer.onPopupStatusChange=(text,detected)=>{
   status.textContent=text;status.style.color=detected?'#ffb5ad':'';
   if(!detected)return;const master=document.querySelector('[aria-label^="마스터 볼륨"]')?.getAttribute('aria-label')?.match(/(\d+)%/);const volume=master?Math.min(1,Number(master[1])/100):1;if(volume<=0)return;
   try{if(audio){const osc=audio.createOscillator(),gain=audio.createGain();osc.type='square';osc.frequency.value=880;gain.gain.value=.12*volume;osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.6);}if('speechSynthesis'in root){const utterance=new SpeechSynthesisUtterance('거짓말 탐지기가 감지되었습니다. 화면을 확인하세요.');utterance.lang='ko-KR';utterance.volume=volume;speechSynthesis.speak(utterance);}}catch(e){status.textContent=text+' · 소리 확인 필요';}
  };
  bridge.setEnabled(toggle.checked);toggle.addEventListener('change',()=>{localStorage.setItem('local-popup-enabled',String(toggle.checked));bridge.setEnabled(toggle.checked);});
  const restore=wrapCapture(navigator.mediaDevices,stream=>bridge.attach(stream));
  root.addEventListener('pagehide',()=>{restore();bridge.detach();},{once:true});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window==='object'?window:globalThis);
