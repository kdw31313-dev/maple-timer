#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const 프로젝트폴더 = path.resolve(__dirname, '..');
const 알림 = [];

global.window = global;
global.addEventListener = () => {};
global.document = {
  getElementById() { return null; },
  createElement() { return { getContext() { return {}; } }; }
};
global.screenCaptureManager = { isStreaming: true };
global.audioNotifier = {
  notify(message, category) { 알림.push({ message, category }); }
};

[
  'js/버프인식기기준.js',
  'js/야누스인식기준.js',
  'js/익스트림골드인식기준.js',
  'js/영상학습인식기준.js',
  'js/거탐인식기기준.js',
  'js/imageAnalyzer.js',
  'js/검출정확도개선.js',
  'js/룬검출정확도.js'
].forEach((상대경로) => require(path.join(프로젝트폴더, 상대경로)));

const ImageAnalyzer = global.imageAnalyzer.constructor;
const 영상 = {
  width: 278,
  height: 140,
  data: new Uint8ClampedArray(278 * 140 * 4)
};
const 기본후보 = {
  x: 120,
  y: 62,
  width: 14,
  height: 14,
  centerX: 126.5,
  centerY: 68.5,
  pixelCount: 80,
  strictSeedCount: 45,
  repeatedStructureCount: 1,
  averageRedGreenContrast: 80,
  pinkCoreRatio: 0.8,
  shapeConfidence: 0.8,
  isHysteresisRune: true
};

const 경계분석기 = new ImageAnalyzer();
경계분석기.isRuneBackgroundCandidate = () => false;
경계분석기.isRuneNovelCandidate = () => true;
assert.equal(
  경계분석기.isRuneCandidateAccepted(기본후보, 영상, false),
  true,
  '미니맵 내부의 검증된 룬 후보가 거부됐습니다.'
);
assert.equal(
  경계분석기.isRuneCandidateAccepted({ ...기본후보, centerY: 132 }, 영상, false),
  false,
  '미니맵 아래 전투 UI 후보가 허용됐습니다.'
);

const 전투이펙트분석기 = new ImageAnalyzer();
전투이펙트분석기.runeState.backgroundLearningFrames =
  전투이펙트분석기.runeState.BACKGROUND_LEARNING_REQUIRED;
전투이펙트분석기.findRuneDiamondCandidates = () => [{ ...기본후보 }];
전투이펙트분석기.isRuneBackgroundCandidate = () => false;
전투이펙트분석기.isRuneNovelCandidate = () => true;
전투이펙트분석기.hasRuneMapChanged = () => true;
전투이펙트분석기.onRuneStatusChange = () => {};

const 원래시각 = Date.now;
let 가상시각 = 1000;
try {
  Date.now = () => 가상시각;
  for (let 프레임 = 0; 프레임 < 6; 프레임++) {
    전투이펙트분석기.processRuneFrame(영상, null);
    가상시각 += 150;
  }
} finally {
  Date.now = 원래시각;
}

assert.equal(알림.filter((항목) => 항목.category === 'rune').length, 1,
  '전투 이펙트로 미니맵 변화가 커진 동안 실제 룬 알림이 누락됐습니다.');

console.log('✅ 룬 영상 보완 회귀 통과: 미니맵 밖 후보 차단, 전투 이펙트 중 실제 룬 1회 감지');
