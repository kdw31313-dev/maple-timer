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

const 가변선 = (화면, x, y, width, height, color) => {
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) 픽셀(화면, px, py, color);
  }
};

const 색상무관발동안내 = (화면, x, y, width, lineHeight, gap, color) => {
  const lineWidths = [
    Math.max(4, Math.round(width * 0.25)),
    Math.round(width * 0.72),
    Math.round(width * 0.92),
    Math.round(width * 0.84),
    width
  ];
  lineWidths.forEach((lineWidth, index) => {
    가변선(
      화면,
      x + Math.round((width - lineWidth) / 2),
      y + index * (lineHeight + gap),
      lineWidth,
      lineHeight,
      color
    );
  });
};

const 분석기 = new global.imageAnalyzer.constructor();
const 노랑화면 = 새화면();
발동안내(노랑화면, 18, 10, [222, 174, 58]);
const 노랑증거 = 분석기.findPopupUniqueStructureEvidence(노랑화면);
assert.ok(
  ['floating-activation-text', 'floating-activation-layout'].includes(노랑증거?.kind),
  '노란 발동 안내 5줄을 찾아야 합니다.'
);

const 주황화면 = 새화면();
발동안내(주황화면, 186, 78, [230, 125, 72]);
const 주황증거 = 분석기.findPopupUniqueStructureEvidence(주황화면);
assert.ok(
  ['floating-activation-text', 'floating-activation-layout'].includes(주황증거?.kind),
  '이동한 주황색 발동 안내도 찾아야 합니다.'
);

const 청록소형화면 = 새화면();
색상무관발동안내(청록소형화면, 88, 35, 32, 2, 4, [45, 205, 235]);
const 청록소형증거 = 분석기.findPopupUniqueStructureEvidence(청록소형화면);
assert.equal(
  청록소형증거?.kind,
  'floating-activation-layout',
  '따뜻한 색이 아닌 작은 청록색 5줄 발동 안내도 구조로 찾아야 합니다.'
);

const 보라대형화면 = 새화면();
색상무관발동안내(보라대형화면, 124, 54, 72, 3, 8, [190, 85, 235]);
const 보라대형증거 = 분석기.findPopupUniqueStructureEvidence(보라대형화면);
assert.equal(
  보라대형증거?.kind,
  'floating-activation-layout',
  '크기가 큰 보라색 5줄 발동 안내도 구조로 찾아야 합니다.'
);

const 흰색중형화면 = 새화면();
색상무관발동안내(흰색중형화면, 22, 72, 48, 3, 5, [230, 230, 230]);
const 흰색중형증거 = 분석기.findPopupUniqueStructureEvidence(흰색중형화면);
assert.equal(
  흰색중형증거?.kind,
  'floating-activation-layout',
  '채도가 없는 흰색 5줄 발동 안내도 구조로 찾아야 합니다.'
);

const 연속이동화면 = 새화면();
발동안내(연속이동화면, 24, 14, [230, 125, 72]);
분석기.processPopupStructureFrame(노랑화면);
분석기.processPopupStructureFrame(연속이동화면);
assert.equal(알림.length, 1, '색과 위치가 바뀌어도 두 프레임 확인 후 한 번 알려야 합니다.');
assert.match(알림[0].message, /발동 안내형 거짓말 탐지기/);

const 전투광원 = 새화면();

const 빈화면 = 새화면();
for (let frame = 0; frame < 4; frame++) 분석기.processPopupStructureFrame(빈화면);
분석기.processPopupStructureFrame(노랑화면);
분석기.processPopupStructureFrame(연속이동화면);
assert.equal(알림.length, 1, '잠깐 가려진 같은 발동 안내를 다시 알리면 안 됩니다.');

분석기.popupState.lastAlertAt -= 31000;
분석기.processPopupStructureFrame(노랑화면);
분석기.processPopupStructureFrame(연속이동화면);
assert.equal(알림.length, 2, '30초 상한 뒤 새 발동 안내는 다시 알려야 합니다.');
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
assert.notEqual(
  전투증거?.kind,
  'floating-activation-layout',
  '연속된 공격 광원을 색상 무관 5줄 구조로 잡으면 안 됩니다.'
);

const 불규칙광원 = 새화면();
가변선(불규칙광원, 30, 18, 28, 4, [60, 225, 220]);
가변선(불규칙광원, 146, 35, 10, 8, [215, 80, 240]);
가변선(불규칙광원, 76, 64, 46, 6, [235, 235, 235]);
가변선(불규칙광원, 182, 94, 32, 3, [90, 210, 125]);
const 불규칙증거 = 분석기.findPopupUniqueStructureEvidence(불규칙광원);
assert.notEqual(
  불규칙증거?.kind,
  'floating-activation-layout',
  '색색의 불규칙 공격 광원을 5줄 발동 안내로 잡으면 안 됩니다.'
);

const 가상일치 = (confidence, x = 30, y = 20) => ({
  found: true,
  verified: true,
  type: '거짓말 탐지기 팝업',
  detectedType: '발동 안내형 거짓말 탐지기',
  confidence,
  structuralEvidence: 'floating-activation-text',
  x,
  y,
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
  const 누락복구응답 = [가상일치(0.90), 가상불일치, 가상일치(0.91, 34, 22)];
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
  const 고신뢰응답 = [가상일치(0.99), 가상일치(0.99, 34, 22)];
  즉시분석기.verifyPopupTemplateMatch = () => 고신뢰응답.shift();
  const 즉시전 = 알림.length;
  즉시분석기.processPopupStructureFrame(노랑화면);
  assert.equal(
    알림.length,
    즉시전,
    '매우 강해도 한 장뿐인 5줄 후보는 즉시 알리면 안 됩니다.'
  );
  가상시각 += 300;
  즉시분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(알림.length, 즉시전 + 1, '이동이 이어진 두 번째 확인에서는 바로 알려야 합니다.');

  const 색상무관이동분석기 = new global.imageAnalyzer.constructor();
  const 색상무관이동전 = 알림.length;
  색상무관이동분석기.processPopupStructureFrame(청록소형화면);
  assert.equal(알림.length, 색상무관이동전, '색상 무관 후보 한 장만으로 즉시 알리면 안 됩니다.');
  가상시각 += 300;
  const 이동한초록화면 = 새화면();
  색상무관발동안내(이동한초록화면, 96, 41, 32, 2, 4, [70, 225, 115]);
  색상무관이동분석기.processPopupStructureFrame(이동한초록화면);
  assert.equal(
    알림.length,
    색상무관이동전 + 1,
    '색이 바뀌며 이동한 색상 무관 발동 안내는 두 번째 확인에서 알려야 합니다.'
  );

  const 색상무관정지분석기 = new global.imageAnalyzer.constructor();
  const 색상무관정지전 = 알림.length;
  색상무관정지분석기.processPopupStructureFrame(흰색중형화면);
  가상시각 += 300;
  색상무관정지분석기.processPopupStructureFrame(흰색중형화면);
  assert.equal(
    알림.length,
    색상무관정지전,
    '움직이지 않는 색상 무관 후보는 두 장만으로 알리면 안 됩니다.'
  );
  가상시각 += 300;
  색상무관정지분석기.processPopupStructureFrame(흰색중형화면);
  assert.equal(
    알림.length,
    색상무관정지전,
    '정지한 후보는 세 장 이어져도 떠다니는 발동 안내로 알리면 안 됩니다.'
  );

  const 사건분리분석기 = new global.imageAnalyzer.constructor();
  사건분리분석기.findPopupTemplateMatch = () => ({});
  const 사건분리응답 = [
    가상일치(0.92, 30, 20),
    가상일치(0.92, 34, 22),
    가상일치(0.93, 150, 78),
    가상일치(0.93, 154, 80)
  ];
  사건분리분석기.verifyPopupTemplateMatch = () => 사건분리응답.shift();
  const 사건분리전 = 알림.length;
  사건분리분석기.processPopupStructureFrame(노랑화면);
  가상시각 += 300;
  사건분리분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(알림.length, 사건분리전 + 1, '첫 발동 사건을 알려야 합니다.');
  가상시각 += 3000;
  사건분리분석기.processPopupStructureFrame(노랑화면);
  가상시각 += 300;
  사건분리분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(
    알림.length,
    사건분리전 + 1,
    '같은 거탐 과정의 화면 형태가 바뀌어도 30초 안에는 중복 알림을 내면 안 됩니다.'
  );

  const 시간상한분석기 = new global.imageAnalyzer.constructor();
  시간상한분석기.popupState.cooldownActive = true;
  시간상한분석기.popupState.isDetected = true;
  시간상한분석기.popupState.lastAlertAt = 가상시각;
  시간상한분석기.popupState.cooldownTrackMatch = 가상일치(0.92, 30, 20);
  가상시각 += 30001;
  시간상한분석기.processPopupStructureFrame(빈화면);
  assert.equal(
    시간상한분석기.popupState.cooldownActive,
    false,
    '다른 후보가 이어져도 재알림 제한은 30초를 넘기면 안 됩니다.'
  );
} finally {
  Date.now = 원래시각;
}

console.log('✅ 발동 안내 거탐 회귀 통과: 다색·다크기·이동 양성, 전투광원 음성');
