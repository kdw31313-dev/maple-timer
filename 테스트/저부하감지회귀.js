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
  'toggle-exp-detection',
  'js/버프영상수집기.js',
  'js/야누스학습수집기.js'
]) {
  assert.equal(html.includes(제거항목), false, `${제거항목}이 운영 화면에 남아 있습니다.`);
}
assert.doesNotMatch(화면분석코드, /processJanusTemplateFrame|processExpTemplateFrame/);
assert.ok(html.includes('js/야누스소멸감지.js'));

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
  // Chrome이 바쁠 때 충분한 버퍼(4)는 아니어도 현재 프레임(2)은 그릴 수 있다.
  // 이 상태에서도 감지 루프가 멈추지 않아야 한다.
  readyState: 2,
  HAVE_CURRENT_DATA: 2,
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
  hidden: false,
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
class 가짜분석기 {
  processRuneFrame() { 분석횟수.rune++; }
  processPopupStructureFrame() { 분석횟수.popup++; }
  findPopupTemplateMatch() { return { found: false }; }
  verifyPopupTemplateMatch() { return { verified: false }; }
  reset() {}
}
global.imageAnalyzer = new 가짜분석기();

require(path.join(프로젝트폴더, 'js', 'screenCapture.js'));
const 관리자 = global.screenCaptureManager;
관리자.isStreaming = true;
관리자.startLoop();
assert.equal(typeof 예약함수, 'function', '분석 루프가 예약되지 않았습니다.');

for (let 틱 = 0; 틱 < 4; 틱++) 예약함수();

assert.equal(분석횟수.rune, 4, '룬 150ms 검사 주기가 유지되지 않았습니다.');
assert.equal(분석횟수.popup, 2, '거탐 300ms 검사 주기가 유지되지 않았습니다.');
assert.equal(관리자.runeCanvas.횟수.getImageData, 4, '룬 화면 복사 횟수가 다릅니다.');
assert.equal(관리자.popupCanvas.횟수.getImageData, 2, '거탐 정밀 화면 복사 횟수가 다릅니다.');
assert.equal(관리자.popupPreviewCanvas.횟수.getImageData, 2, '거탐 초경량 후보 화면 복사 횟수가 다릅니다.');

document.hidden = true;
for (let 틱 = 0; 틱 < 4; 틱++) 예약함수();
assert.equal(분석횟수.rune, 8, '백그라운드에서 룬 검사가 유지되지 않았습니다.');
assert.equal(분석횟수.popup, 6, '백그라운드 타이머 기회마다 거탐을 검사하지 않았습니다.');

// 야누스를 켜도 거탐/룬 검사 횟수는 유지되고, 같은 영상 프레임은 중복 세지 않는다.
요소.set('toggle-janus-detection', { checked: true });
let 야누스횟수 = 0, 초기화횟수 = 0, 시각 = 0;
global.performance = { now: () => 시각 };
global.imageAnalyzer.processJanusPresenceFrame = () => 야누스횟수++;
global.imageAnalyzer.resetJanusPresence = () => 초기화횟수++;
document.hidden = false;
for (let 틱 = 0; 틱 < 12; 틱++) {
  시각 = 틱 * 150;
  게임영상.currentTime = 틱 * .15;
  예약함수();
}
assert.equal(야누스횟수, 4, '야누스 450ms 검사');
assert.equal(분석횟수.rune, 20, '야누스 활성 시 룬 검사 유지');
assert.equal(분석횟수.popup, 12, '야누스 활성 시 거탐 검사 유지');
게임영상.currentTime = .15 * 9;
시각 = 3000;
예약함수();
assert.equal(야누스횟수, 4, '같은 프레임 재분석 금지');
관리자.mediaStream = { getVideoTracks: () => [{ muted: true }] };
게임영상.currentTime = 4;
시각 = 4000;
예약함수();
assert.equal(야누스횟수, 4, '캡처 중단은 부재 증거 아님');
assert.ok(초기화횟수 > 0);
console.log('✅ 저부하·야누스 선택 검사 회귀 통과: 룬/거탐 주기 유지, 중복 프레임/공유 중단 방지');
