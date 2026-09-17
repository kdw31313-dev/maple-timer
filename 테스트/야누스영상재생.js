'use strict';
const { spawnSync } = require('node:child_process');
global.window = global;
global.addEventListener = () => {};
global.document = { getElementById: () => ({ checked: true }), createElement: () => ({ getContext: () => ({}) }) };
let time = 0;
const alerts = [];
global.audioNotifier = { notify: (...args) => alerts.push({ time, args }) };
for (const name of ['버프인식기기준','야누스인식기준','익스트림골드인식기준','영상학습인식기준','거탐인식기기준','imageAnalyzer','검출정확도개선','룬검출정확도','거탐검출정확도','버프검출정확도','야누스소멸감지']) require('../js/' + name + '.js');
require('../js/야누스추가표본.js');
require('../js/야누스곡선표본.js');
require('../js/야누스아이콘판별.js');
const width = 864, height = 259, bytes = width * height * 4;
const result = spawnSync('ffmpeg', ['-v','error','-i',process.argv[2],'-vf',`fps=20/9,crop=${width}:${height}:1056:0:exact=1`,'-f','rawvideo','-pix_fmt','rgba','pipe:1'], { maxBuffer: 512 * 1024 * 1024 });
if (result.status !== 0) throw new Error(result.stderr.toString());
if(result.stdout.length % bytes !== 0) throw new Error('프레임 경계 불일치');
const frames = [], costs = [];
for (let offset = 0, index = 0; offset + bytes <= result.stdout.length; offset += bytes, index++) {
  time = index * .45;
  const started = performance.now();
  imageAnalyzer.processJanusPresenceFrame({ width, height, data: result.stdout.subarray(offset, offset + bytes) }, time * 1000);
  costs.push(performance.now() - started);
  const state = imageAnalyzer.janusPresenceTracker;
  frames.push({ time, active: state.active, pending: state.startCount, missing: state.missingCount, match: state.lastMatch });
}
costs.sort((a,b)=>a-b);
console.log(JSON.stringify({ file:process.argv[2], count:frames.length, alerts, timing:{p50:costs[Math.floor(costs.length*.5)],p95:costs[Math.floor(costs.length*.95)],max:costs.at(-1)},frames },null,2));
