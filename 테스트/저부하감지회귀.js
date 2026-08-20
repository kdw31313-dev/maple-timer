#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const 프로젝트폴더 = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(프로젝트폴더, 'index.html'), 'utf8');
const 화면분석코드 = fs.readFileSync(path.join(프로젝트폴더, 'js', 'screenCapture.js'), 'utf8');

for (const 필수항목 of ['toggle-rune-detection', 'toggle-popup-detection']) {
  assert.ok(html.includes(`id="${필수항목}"`), `${필수항목}이 운영 화면에 없습니다.`);
}
for (const 제거항목 of [
  'toggle-janus-detection',
  'toggle-exp-detection',
  'js/버프검출정확도.js',
  'js/버프영상수집기.js',
  'js/야누스학습수집기.js'
]) {
  assert.equal(html.includes(제거항목), false, `${제거항목}이 운영 화면에 남아 있습니다.`);
}
assert.doesNotMatch(화면분석코드, /processJanusTemplateFrame|processExpTemplateFrame|janusCanvas/);

const 캔버스목록 = [];
const 새캔버스 = () => {
  const 횟수 = { drawImage: 0, getImageData: 0 };
  const 문맥 = {
    drawImage() { 횟수.drawImage++; },
    getImageData(x, y, width, height) {
      횟수.getImageData++;
      return { data: new Uint8ClampedArray(4), width, height };
    },
    clearRect() {},
    strokeRect() {},
    fillRect() {},
    fillText() {},
    setLineDash() {},
    measureText() { return { width: 10 }; }
  };
  const 캔버스 = {
    width: 0,
    height: 0,
    style: {},
    getContext() { return 문맥; },
    addEventListener() {},
    getBoundingClientRect() { return { width: 1600, height: 900 }; },
    횟수
  };
  캔버스목록.push(캔버스);
  return 캔버스;
};

const 게임영상 = {
  readyState: 4,
  HAVE_ENOUGH_DATA: 4,
  videoWidth: 1600,
  videoHeight: 900,
  getBoundingClientRect() { return { width: 1600, height: 900 }; }
};
const 요소 = new Map([
  ['game-video', 게임영상],
  ['analysis-canvas', 새캔버스()],
  ['roi-overlay-canvas', 새캔버스()],
  ['toggle-rune-detection', { checked: true }],
  ['toggle-popup-detection', { checked: true }]
]);

global.window = global;
global.addEventListener = () => {};
global.document = {
  getElementById(id) { return 요소.get(id) || null; },
  createElement(tag) { return tag === 'canvas' ? 새캔버스() : {}; }
};

let 예약함수 = null;
global.setInterval = (callback) => {
  예약함수 = callback;
  return 1;
};
global.clearInterval = () => {};

const 분석횟수 = { rune: 0, popup: 0 };
global.imageAnalyzer = {
  processRuneFrame() { 분석횟수.rune++; },
  processPopupStructureFrame() { 분석횟수.popup++; }
};

require(path.join(프로젝트폴더, 'js', 'screenCapture.js'));
const 관리자 = global.screenCaptureManager;
관리자.isStreaming = true;
관리자.startLoop();
assert.equal(typeof 예약함수, 'function', '분석 루프가 예약되지 않았습니다.');

for (let 틱 = 0; 틱 < 4; 틱++) 예약함수();

assert.equal(분석횟수.rune, 4, '룬 150ms 검사 주기가 유지되지 않았습니다.');
assert.equal(분석횟수.popup, 2, '거탐 300ms 검사 주기가 유지되지 않았습니다.');
assert.equal(관리자.runeCanvas.횟수.getImageData, 4, '룬 화면 복사 횟수가 다릅니다.');
assert.equal(관리자.popupCanvas.횟수.getImageData, 2, '거탐 화면이 검사하지 않는 틱에도 복사됩니다.');

console.log('✅ 저부하 감지 회귀 통과: 룬 4회, 거탐 2회, 버프 분석 0회');
