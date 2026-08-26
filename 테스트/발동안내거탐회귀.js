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
  notify(message, category, options = {}) { 알림.push({ message, category, options }); }
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
const 초기상태검사시각 = Date.now;
Date.now = () => 10000;
분석기.processPopupStructureFrame(노랑화면);
분석기.processPopupStructureFrame(연속이동화면);
assert.equal(알림.length, 0, '색상 무관 5줄 후보 두 장만으로 알리면 안 됩니다.');
for (const [x, y] of [[26, 15], [28, 16], [30, 17]]) {
  const 추가이동화면 = 새화면();
  발동안내(추가이동화면, x, y, [230, 125, 72]);
  분석기.processPopupStructureFrame(추가이동화면);
}
assert.equal(
  알림.length,
  0,
  '글자형 근거가 없는 색상 무관 5줄 후보는 오래 이동해도 알리면 안 됩니다.'
);
Date.now = 초기상태검사시각;

const 전투광원 = 새화면();

const 빈화면 = 새화면();
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

const 다섯줄전투윤곽 = 새화면();
가변선(다섯줄전투윤곽, 72, 22, 10, 2, [220, 220, 235]);
가변선(다섯줄전투윤곽, 48, 31, 46, 3, [120, 80, 230]);
가변선(다섯줄전투윤곽, 61, 42, 22, 5, [245, 180, 70]);
가변선(다섯줄전투윤곽, 45, 54, 51, 2, [235, 235, 235]);
가변선(다섯줄전투윤곽, 58, 67, 27, 6, [200, 75, 235]);
const 다섯줄전투증거 = 분석기.findPopupUniqueStructureEvidence(다섯줄전투윤곽);
assert.notEqual(
  다섯줄전투증거?.kind,
  'floating-activation-layout',
  '크기와 획 양이 불규칙한 몬스터·검광 5줄을 발동 안내로 잡으면 안 됩니다.'
);

const 불규칙줄간격 = 새화면();
가변선(불규칙줄간격, 83, 11, 6, 3, [222, 174, 58]);
가변선(불규칙줄간격, 73, 18, 26, 3, [222, 174, 58]);
가변선(불규칙줄간격, 72, 28, 28, 3, [222, 174, 58]);
가변선(불규칙줄간격, 74, 39, 24, 3, [222, 174, 58]);
가변선(불규칙줄간격, 71, 54, 30, 3, [222, 174, 58]);
const 불규칙줄간격증거 = 분석기.findPopupUniqueStructureEvidence(불규칙줄간격);
assert.notEqual(
  불규칙줄간격증거?.kind,
  'floating-activation-text',
  '버프 타이머·몬스터·데미지 숫자가 불규칙한 다섯 줄로 모여도 발동 안내로 잡으면 안 됩니다.'
);

const 상단가로배너 = 새화면();
for (let y = 4; y < 20; y++) {
  for (let x = 20; x < 132; x++) 픽셀(상단가로배너, x, y, [12, 10, 18]);
}
가변선(상단가로배너, 20, 4, 112, 2, [105, 55, 145]);
가변선(상단가로배너, 20, 18, 112, 2, [105, 55, 145]);
가변선(상단가로배너, 54, 10, 58, 3, [205, 155, 70]);
const 상단가로배너증거 = 분석기.findPopupUniqueStructureEvidence(상단가로배너);
assert.notEqual(
  상단가로배너증거?.kind,
  'activation-banner',
  '상단 타이머·금색 시스템 문구·보라 테두리를 거탐 가로 배너로 잡으면 안 됩니다.'
);

const 가상일치 = (
  confidence,
  x = 30,
  y = 20,
  bandCounts = [8, 28, 32, 30, 34],
  structureOverrides = {}
) => ({
  found: true,
  verified: true,
  type: '거짓말 탐지기 팝업',
  detectedType: '발동 안내형 거짓말 탐지기',
  confidence,
  structuralEvidence: 'floating-activation-text',
  x,
  y,
  width: 57,
  height: 57,
  structure: { bandCounts, ...structureOverrides }
});
const 강한가상일치 = (confidence, x = 30, y = 20) => 가상일치(
  confidence,
  x,
  y,
  [6, 30, 32, 31, 33],
  {
    lowerBandUniformity: 1.29,
    topToLowerCountRatio: 0.19,
    topSpan: 6,
    meanLowerSpan: 19,
    horizontalWarmRatio: 0.53
  }
);
const 경계가상일치 = (confidence, x = 30, y = 20) => 가상일치(
  confidence,
  x,
  y,
  [13, 30, 32, 31, 33],
  {
    lowerBandUniformity: 1.18,
    topToLowerCountRatio: 0.405,
    topSpan: 6,
    meanLowerSpan: 17.75,
    horizontalWarmRatio: 0.77
  }
);
const 가상불일치 = {
  found: false,
  verified: false,
  type: '거짓말 탐지기 팝업',
  detectedType: '',
  confidence: 0,
  structuralEvidence: ''
};
const 가상레이아웃 = (
  confidence,
  x = 30,
  y = 20,
  clusterCounts = [8, 28, 32, 30, 34]
) => ({
  ...가상일치(confidence, x, y, clusterCounts),
  structuralEvidence: 'floating-activation-layout',
  structure: { clusterCounts }
});

const 원래시각 = Date.now;
let 가상시각 = 1000;
Date.now = () => 가상시각;
try {
  const 색순환분석기 = new global.imageAnalyzer.constructor();
  색순환분석기.findPopupTemplateMatch = () => ({});
  const 색순환응답 = [
    가상레이아웃(0.94),
    가상일치(0.96, 34, 22),
    가상레이아웃(0.95, 38, 24)
  ];
  색순환분석기.verifyPopupTemplateMatch = () => 색순환응답.shift();
  const 색순환전 = 알림.length;
  색순환분석기.processPopupStructureFrame(청록소형화면);
  assert.equal(알림.length, 색순환전, '색상 무관 첫 후보만으로 알리면 안 됩니다.');
  가상시각 += 300;
  색순환분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(
    알림.length,
    색순환전,
    '전투 윤곽처럼 두 프레임만 이어진 후보는 글자형 근거가 섞여도 알리면 안 됩니다.'
  );
  가상시각 += 300;
  색순환분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(알림.length, 색순환전 + 1, '색이 바뀌는 발동 안내가 세 프레임 이어지면 알려야 합니다.');

  const 누락복구분석기 = new global.imageAnalyzer.constructor();
  const 누락복구응답 = [
    가상일치(0.90),
    가상불일치,
    가상일치(0.91, 34, 22),
    가상일치(0.92, 38, 24)
  ];
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
    누락복구전,
    '2.5초 안이라도 두 발동 안내 증거만으로는 알리면 안 됩니다.'
  );
  가상시각 += 300;
  누락복구분석기.processPopupStructureFrame(주황화면);
  assert.equal(알림.length, 누락복구전 + 1, '중간 누락이 있어도 2.5초 안의 세 증거는 합쳐서 알려야 합니다.');

  const 즉시분석기 = new global.imageAnalyzer.constructor();
  즉시분석기.findPopupTemplateMatch = () => ({});
  const 고신뢰응답 = [
    가상일치(0.99),
    가상일치(0.99, 34, 22),
    가상일치(0.99, 38, 24)
  ];
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
  assert.equal(알림.length, 즉시전, '매우 강해도 두 프레임뿐인 전투형 후보는 알리면 안 됩니다.');
  가상시각 += 300;
  즉시분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(알림.length, 즉시전 + 1, '이동이 세 프레임 이어지면 약 0.6초 안에 알려야 합니다.');

  const 강한두장분석기 = new global.imageAnalyzer.constructor();
  강한두장분석기.findPopupTemplateMatch = () => ({});
  const 강한두장응답 = [경계가상일치(0.90), 강한가상일치(0.91, 34, 22)];
  강한두장분석기.verifyPopupTemplateMatch = () => 강한두장응답.shift();
  const 강한두장전 = 알림.length;
  강한두장분석기.processPopupStructureFrame(노랑화면);
  assert.equal(알림.length, 강한두장전, '강한 발동 안내도 한 장만으로 알리면 안 됩니다.');
  가상시각 += 300;
  강한두장분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(
    알림.length,
    강한두장전 + 1,
    '카운트 1줄과 균일한 문장 4줄이 분명한 실제 안내는 두 장으로 빠르게 알려야 합니다.'
  );

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
    색상무관이동전,
    '색상 무관 발동 안내는 두 장만으로 알려선 안 됩니다.'
  );
  for (const [x, y, color] of [
    [100, 43, [75, 220, 130]],
    [104, 45, [85, 205, 150]],
    [108, 47, [100, 190, 170]],
    [112, 49, [115, 180, 190]],
    [116, 51, [125, 170, 205]]
  ]) {
    가상시각 += 300;
    const 추가색상무관화면 = 새화면();
    색상무관발동안내(추가색상무관화면, x, y, 32, 2, 4, color);
    색상무관이동분석기.processPopupStructureFrame(추가색상무관화면);
  }
  assert.equal(
    알림.length,
    색상무관이동전,
    '글자형 근거가 없는 색상 무관 후보는 오래 이동해도 알리면 안 됩니다.'
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
    가상일치(0.92, 38, 24),
    가상일치(0.93, 42, 26)
  ];
  사건분리분석기.verifyPopupTemplateMatch = () => 사건분리응답.shift();
  const 사건분리전 = 알림.length;
  사건분리분석기.processPopupStructureFrame(노랑화면);
  가상시각 += 300;
  사건분리분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(알림.length, 사건분리전, '첫 발동 사건도 두 프레임만으로 알리면 안 됩니다.');
  가상시각 += 300;
  사건분리분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(알림.length, 사건분리전 + 1, '첫 발동 사건을 알려야 합니다.');
  가상시각 += 3000;
  사건분리분석기.processPopupStructureFrame(노랑화면);
  assert.equal(
    알림.length,
    사건분리전 + 2,
    '같은 거탐 과정이 남아 있으면 3초 뒤 다시 알려야 합니다.'
  );

  const 전투변형분석기 = new global.imageAnalyzer.constructor();
  전투변형분석기.findPopupTemplateMatch = () => ({});
  const 전투변형응답 = [
    가상일치(0.96, 30, 20, [8, 28, 32, 30, 34]),
    가상일치(0.96, 34, 22, [18, 12, 44, 15, 39]),
    가상일치(0.96, 38, 24, [5, 46, 13, 41, 18])
  ];
  전투변형분석기.verifyPopupTemplateMatch = () => 전투변형응답.shift();
  const 전투변형전 = 알림.length;
  for (let index = 0; index < 3; index++) {
    가상시각 += 300;
    전투변형분석기.processPopupStructureFrame(노랑화면);
  }
  assert.equal(
    알림.length,
    전투변형전,
    'MISS·콤보 숫자처럼 5줄 픽셀 비율이 바뀌는 전투 장면은 이동해도 알리면 안 됩니다.'
  );

  const 반복알림분석기 = new global.imageAnalyzer.constructor();
  반복알림분석기.findPopupTemplateMatch = () => ({});
  const 반복알림응답 = [
    가상일치(0.98, 30, 20),
    가상일치(0.98, 34, 22),
    가상일치(0.98, 38, 24),
    가상일치(0.98, 42, 26),
    가상일치(0.98, 46, 28),
    가상일치(0.98, 50, 30),
    가상일치(0.98, 54, 32),
    가상불일치,
    가상불일치,
    가상불일치,
    가상불일치,
    가상불일치,
    가상일치(0.98, 150, 78),
    가상일치(0.98, 154, 80),
    가상일치(0.98, 158, 82)
  ];
  반복알림분석기.verifyPopupTemplateMatch = () => 반복알림응답.shift() || 가상불일치;
  const 반복알림전 = 알림.length;
  반복알림분석기.processPopupStructureFrame(노랑화면);
  가상시각 += 300;
  반복알림분석기.processPopupStructureFrame(연속이동화면);
  가상시각 += 300;
  반복알림분석기.processPopupStructureFrame(연속이동화면);
  가상시각 += 3000;
  반복알림분석기.processPopupStructureFrame(노랑화면);
  assert.equal(
    알림.length,
    반복알림전 + 2,
    '실제 거탐을 한 번 확정하면 화면이 가려져도 3초 간격으로 총 2회 알려야 합니다.'
  );
  const 반복알림목록 = 알림.slice(반복알림전);
  assert.notEqual(
    반복알림목록[0].options.telegram,
    false,
    '최초 확정 알림은 텔레그램 사진을 보내야 합니다.'
  );
  assert.equal(
    반복알림목록[1].options.telegram,
    false,
    '같은 사건의 두 번째 소리는 텔레그램 사진을 다시 보내면 안 됩니다.'
  );
  for (let count = 0; count < 3; count++) {
    가상시각 += 3000;
    반복알림분석기.processPopupStructureFrame(노랑화면);
  }
  assert.equal(
    알림.length,
    반복알림전 + 2,
    '같은 거탐 후보가 계속 보여도 두 번을 넘겨 알리면 안 됩니다.'
  );
  for (let count = 0; count < 5; count++) {
    가상시각 += 3000;
    반복알림분석기.processPopupStructureFrame(빈화면);
  }
  가상시각 += 300;
  반복알림분석기.processPopupStructureFrame(노랑화면);
  가상시각 += 300;
  반복알림분석기.processPopupStructureFrame(연속이동화면);
  가상시각 += 300;
  반복알림분석기.processPopupStructureFrame(연속이동화면);
  assert.equal(
    알림.length,
    반복알림전 + 3,
    '거탐 근거가 15초 동안 사라진 뒤 새 거탐이 확정되면 다시 알려야 합니다.'
  );
  assert.notEqual(
    알림[반복알림전 + 2].options.telegram,
    false,
    '새 거탐의 최초 확정에서는 텔레그램 사진을 다시 보내야 합니다.'
  );

  const 시간상한분석기 = new global.imageAnalyzer.constructor();
  시간상한분석기.popupState.cooldownActive = true;
  시간상한분석기.popupState.isDetected = true;
  시간상한분석기.popupState.lastAlertAt = 가상시각;
  시간상한분석기.popupState.cooldownTrackMatch = 가상일치(0.92, 30, 20);
  가상시각 += 3001;
  시간상한분석기.processPopupStructureFrame(빈화면);
  assert.equal(
    시간상한분석기.popupState.cooldownActive,
    false,
    '다른 후보가 이어져도 재알림 제한은 3초를 넘기면 안 됩니다.'
  );
} finally {
  Date.now = 원래시각;
}

const 분석알림모형 = global.audioNotifier;
const 텔레그램전송 = [];
global.telegramNotifier = {
  sendAlert(message, category) { 텔레그램전송.push({ message, category }); }
};
delete require.cache[require.resolve(path.join(프로젝트, 'js/audioNotifier.js'))];
require(path.join(프로젝트, 'js/audioNotifier.js'));
const 실제알림기 = global.audioNotifier;
실제알림기.initAudioContext = () => {};
실제알림기.playSoundPreset = () => {};
실제알림기.useFlash = false;
실제알림기.notify('최초 거탐', 'popup');
실제알림기.notify('같은 사건 재알림', 'popup', { telegram: false });
assert.equal(텔레그램전송.length, 1, '알람은 두 번 울려도 텔레그램은 최초 한 번만 보내야 합니다.');
global.audioNotifier = 분석알림모형;

console.log('✅ 발동 안내 거탐 회귀 통과: 강한 글자형 2프레임·일반형 3프레임 양성, 순간 전투변형 음성, 2회 알림·텔레그램 1회');
