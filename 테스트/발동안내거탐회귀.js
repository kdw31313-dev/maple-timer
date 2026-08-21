#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

global.window = global;
global.addEventListener = () => {};
global.document = {
  getElementById() { return { checked: true }; },
  createElement() { return { getContext() { return {}; } }; }
};
const 알림 = [];
global.audioNotifier = {
  notify(message, category) { 알림.push({ message, category }); }
};

const 프로젝트 = path.resolve(__dirname, '..');
[
  'js/거탐인식기기준.js',
  'js/imageAnalyzer.js',
  'js/검출정확도개선.js',
  'js/거탐검출정확도.js'
].forEach((파일) => require(path.join(프로젝트, 파일)));

const 새화면 = () => {
  const width = 240;
  const height = 135;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 35;
    data[index + 1] = 64;
    data[index + 2] = 88;
    data[index + 3] = 255;
  }
  return { data, width, height };
};

const 픽셀 = (화면, x, y, color) => {
  const index = (y * 화면.width + x) * 4;
  화면.data[index] = color[0];
  화면.data[index + 1] = color[1];
  화면.data[index + 2] = color[2];
};

const 선 = (화면, x, y, width, color) => {
  for (let py = y; py < y + 3; py++) {
    for (let px = x; px < x + width; px++) 픽셀(화면, px, py, color);
  }
};

const 발동안내 = (화면, x, y, color) => {
  선(화면, x + 13, y + 1, 6, color);
  선(화면, x + 4, y + 8, 24, color);
  선(화면, x + 3, y + 15, 26, color);
  선(화면, x + 5, y + 22, 22, color);
  선(화면, x + 2, y + 29, 28, color);
};

const 분석기 = new global.imageAnalyzer.constructor();
const 노랑화면 = 새화면();
발동안내(노랑화면, 18, 10, [222, 174, 58]);
const 노랑증거 = 분석기.findPopupUniqueStructureEvidence(노랑화면);
assert.equal(노랑증거?.kind, 'floating-activation-text', '노란 발동 안내 5줄을 찾아야 합니다.');

const 주황화면 = 새화면();
발동안내(주황화면, 186, 78, [230, 125, 72]);
const 주황증거 = 분석기.findPopupUniqueStructureEvidence(주황화면);
assert.equal(주황증거?.kind, 'floating-activation-text', '이동한 주황색 발동 안내도 찾아야 합니다.');

const 연속이동화면 = 새화면();
발동안내(연속이동화면, 56, 36, [230, 125, 72]);
분석기.processPopupStructureFrame(노랑화면);
분석기.processPopupStructureFrame(연속이동화면);
assert.equal(알림.length, 1, '색과 위치가 바뀌어도 두 프레임 확인 후 한 번 알려야 합니다.');
assert.match(알림[0].message, /발동 안내형 거짓말 탐지기/);

const 전투광원 = 새화면();

const 빈화면 = 새화면();
for (let frame = 0; frame < 20; frame++) 분석기.processPopupStructureFrame(빈화면);
분석기.processPopupStructureFrame(노랑화면);
분석기.processPopupStructureFrame(연속이동화면);
assert.equal(알림.length, 1, '잠깐 가려진 같은 발동 안내를 다시 알리면 안 됩니다.');

for (let frame = 0; frame < 100; frame++) 분석기.processPopupStructureFrame(빈화면);
분석기.processPopupStructureFrame(노랑화면);
분석기.processPopupStructureFrame(연속이동화면);
assert.equal(알림.length, 2, '30초 연속 해제 뒤 새 발동 안내는 다시 알려야 합니다.');
for (let y = 32; y < 65; y++) {
  for (let x = 88; x < 142; x++) {
    if ((x + y) % 3 !== 0) 픽셀(전투광원, x, y, [235, 145, 55]);
  }
}
const 전투증거 = 분석기.findPopupUniqueStructureEvidence(전투광원);
assert.notEqual(
  전투증거?.kind,
  'floating-activation-text',
  '연속된 공격 광원을 발동 안내 5줄로 잡으면 안 됩니다.'
);

const 가상일치 = (confidence) => ({
  found: true,
  verified: true,
  type: '거짓말 탐지기 팝업',
  detectedType: '발동 안내형 거짓말 탐지기',
  confidence,
  structuralEvidence: 'floating-activation-text',
  x: 30,
  y: 20,
  width: 57,
  height: 57
});
const 가상불일치 = {
  found: false,
  verified: false,
  type: '거짓말 탐지기 팝업',
  detectedType: '',
  confidence: 0,
  structuralEvidence: ''
};

const 원래시각 = Date.now;
let 가상시각 = 1000;
Date.now = () => 가상시각;
try {
  const 누락복구분석기 = new global.imageAnalyzer.constructor();
  const 누락복구응답 = [가상일치(0.90), 가상불일치, 가상일치(0.91)];
  누락복구분석기.findPopupTemplateMatch = () => ({});
  누락복구분석기.verifyPopupTemplateMatch = () => 누락복구응답.shift();
  const 누락복구전 = 알림.length;

  누락복구분석기.processPopupStructureFrame(노랑화면);
  assert.equal(알림.length, 누락복구전, '약한 단일 후보만으로 알리면 안 됩니다.');
  가상시각 += 1000;
  누락복구분석기.processPopupStructureFrame(빈화면);
  assert.equal(알림.length, 누락복구전, '중간 누락 프레임에서 알리면 안 됩니다.');
  가상시각 += 1000;
  누락복구분석기.processPopupStructureFrame(주황화면);
  assert.equal(
    알림.length,
    누락복구전 + 1,
    '2.5초 안의 두 발동 안내 증거는 중간 누락이 있어도 합쳐서 알려야 합니다.'
  );

  const 즉시분석기 = new global.imageAnalyzer.constructor();
  즉시분석기.findPopupTemplateMatch = () => ({});
  즉시분석기.verifyPopupTemplateMatch = () => 가상일치(0.99);
  const 즉시전 = 알림.length;
  즉시분석기.processPopupStructureFrame(노랑화면);
  assert.equal(
    알림.length,
    즉시전 + 1,
    '매우 강한 5줄 발동 안내는 첫 확인에서 즉시 알려야 합니다.'
  );
} finally {
  Date.now = 원래시각;
}

console.log('✅ 발동 안내 거탐 회귀 통과: 이동·노랑/주황 양성, 연속 전투광원 음성');
