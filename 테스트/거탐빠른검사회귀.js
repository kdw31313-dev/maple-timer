#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const 프로젝트폴더 = path.resolve(__dirname, '..');
const 새캔버스 = () => ({
  width: 0,
  height: 0,
  style: {},
  classList: { add() {}, remove() {} },
  getContext() { return {}; },
  addEventListener() {},
  getBoundingClientRect() { return { width: 1600, height: 900 }; }
});
global.window = global;
global.addEventListener = () => {};
global.document = {
  hidden: false,
  getElementById(id) {
    if (id === 'game-video') {
      return {
        classList: { add() {}, remove() {} },
        getBoundingClientRect() { return { width: 1600, height: 900 }; }
      };
    }
    if (id === 'analysis-canvas' || id === 'roi-overlay-canvas') return 새캔버스();
    return null;
  },
  createElement() { return 새캔버스(); }
};

let previewResult = false;
class 가짜분석기 {
  findPopupTemplateMatch() { return { found: previewResult }; }
  reset() {}
}
global.imageAnalyzer = new 가짜분석기();
require(path.join(프로젝트폴더, 'js', 'screenCapture.js'));
const 관리자 = global.screenCaptureManager;
const 작은화면 = { width: 120, height: 68, data: new Uint8ClampedArray(120 * 68 * 4) };

previewResult = false;
assert.equal(관리자.hasPopupFastTemplateSignal(작은화면), false, '음성 후보가 정밀 검사로 올라갔습니다.');

previewResult = true;
assert.equal(관리자.hasPopupFastTemplateSignal(작은화면), true, '거탐 패널 후보를 놓쳤습니다.');

관리자.isStreaming = false;
관리자.stopCapture();

console.log('✅ 거탐 빠른 검사 회귀 통과: 120x68 패널 후보 양성·음성 분리');
