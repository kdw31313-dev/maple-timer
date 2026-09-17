'use strict';
self.window = self;
let epoch = 0;
const pill = { set textContent(text) { self.postMessage({ epoch, status: text }); } };
self.document = { getElementById: id => id === 'janus-status-pill' ? pill : { checked: true }, createElement: () => ({ getContext: () => ({}) }) };
self.audioNotifier = { notify: (message, category, options) => self.postMessage({ epoch, alert: { message, category, options } }) };
importScripts('버프인식기기준.js','야누스인식기준.js','익스트림골드인식기준.js','영상학습인식기준.js','imageAnalyzer.js','야누스추가표본.js','야누스아이콘판별.js','야누스소멸감지.js');
self.onmessage = ({ data }) => {
  epoch = data.epoch;
  if(data.reset) { self.imageAnalyzer.resetJanusPresence(); return; }
  try { self.imageAnalyzer.processJanusPresenceFrame(data.frame,data.now); }
  catch(error) { self.imageAnalyzer.resetJanusPresence(); self.postMessage({epoch,error:String(error)}); }
  finally { self.postMessage({epoch,done:true}); }
};
