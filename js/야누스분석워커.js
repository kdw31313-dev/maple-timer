'use strict';
self.window = self;
let epoch = 0;
const pill = { set textContent(text) { self.postMessage({ epoch, status: text }); } };
self.document = { getElementById: id => id === 'janus-status-pill' ? pill : { checked: true }, createElement: () => ({ getContext: () => ({}) }) };
self.audioNotifier = { notify: (message, category, options) => self.postMessage({ epoch, alert: { message, category, options } }) };
importScripts('버프인식기기준.js','야누스인식기준.js','익스트림골드인식기준.js','영상학습인식기준.js','imageAnalyzer.js','야누스곡선표본.js?v=20260917-2','야누스아이콘판별.js?v=20260917-2','야누스소멸감지.js?v=20260917-2');
self.onmessage = ({ data }) => {
  epoch = data.epoch;
  if(data.reset) { self.imageAnalyzer.resetJanusPresence(); return; }
  if(data.pause) { self.imageAnalyzer.pauseJanusPresence(); return; }
  const started=performance.now();
  try { self.imageAnalyzer.processJanusPresenceFrame(data.frame,data.now); }
  catch(error) { self.imageAnalyzer.resetJanusPresence(); self.postMessage({epoch,error:String(error)}); }
  finally { self.postMessage({epoch,done:true,cost:performance.now()-started,active:Boolean(self.imageAnalyzer.janusPresenceTracker?.active)}); }
};
