#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { Analyzer, decode, alerts } = require('./추가사진진단');
const a = new Analyzer();
for (const scale of [0.6, 1, 1.5, 2]) {
  assert.equal(a.isCircularBoundaryConsistent(2.02 * scale, .67, scale), false, '9월 오탐 경계 수치를 허용함');
  assert.equal(a.isCircularBoundaryConsistent(1.8 * scale, .67, scale), true, '일관된 정지 원판까지 차단함');
  assert.equal(a.isCircularBoundaryConsistent(2.4 * scale, .75, scale), true, '이동 원판 경로를 차단함');
  assert.equal(a.isCircularBoundaryConsistent(1.5 * scale, .60, scale), false);
}
assert.equal(a.isCircularBoundaryConsistent(NaN, .8), false);
// 실제 프레임 전체 판정과 별개로, 보고된 수치를 사용하는 경계 단위 검사다.
console.log('PASS 원형 경계 단위 검사 (실제 원형 영상 검증의 대체가 아님)');

// 화면을 옮겨 다니는 원판도 전체 구조 검출과 3프레임 알림 경로를 유지한다.
// 단색 합성판이므로 실제 원형 양성 원본을 대신하는 검사는 아니다.
const circleAnalyzer = new Analyzer();
alerts.length = 0;
for (const centerX of [65, 115, 175]) {
  const width = 240, height = 135;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const radius = Math.hypot(x - centerX, y - 66);
    const color = radius >= 40 && radius <= 43 ? [15, 15, 65] : [35, 65, 125];
    data.set([...color, 255], (y * width + x) * 4);
  }
  const frame = { data, width, height };
  assert.equal(circleAnalyzer.findPopupUniqueStructureEvidence(frame)?.kind, 'circular-click-game');
  circleAnalyzer.processPopupStructureFrame(frame);
}
assert.equal(alerts.filter(item => item.category === 'popup').length, 1);
console.log('PASS 합성 이동 원형판 전체 검출·3프레임 알림');

const folder = process.argv[2];
if (!folder) {
  console.log('SKIP 9월 실사진: node 테스트/구월오탐회귀.js <사진 폴더> 필요');
} else {
  const originalNow = Date.now;
  let now = 100000;
  Date.now = () => now;
  try {
    for (const n of [2, 4, 5, 3]) for (const scale of (n === 3 ? [1.5] : [1, 1.5, 2])) {
      const width = Math.round(178 * scale), height = Math.round(72 * scale);
      const file = path.join(folder, `${n}-Photo-${n}.jpg`);
      const roi = decode(file, `crop=178:72:0:65,scale=${width}:${height}:flags=bilinear`, width, height);
      for (const learned of (n === 3 ? [true] : [false, true])) {
        const analyzer = new Analyzer();
        if (learned) {
          // 이전 프레임은 제공되지 않았다. 빈 보라 배경 학습이 완료된 상태를
          // 명시적으로 구성해 신규 후보 수락 경로만 검사한다.
          Object.assign(analyzer.runeState, {
            backgroundLearningFrames: analyzer.runeState.BACKGROUND_LEARNING_REQUIRED,
            mapReferenceData: new Uint8ClampedArray(roi.data),
            runeHysteresisBackgroundMask: new Uint8Array(width * height),
            runeHysteresisWidth: width, runeHysteresisHeight: height
          });
        }
        alerts.length = 0;
        now += 10000;
        const startedAt = now;
        let firstAt = null;
        for (let i = 0; i < 30; i++, now += 150) {
          analyzer.processRuneFrame(roi, null);
          if (alerts.length && firstAt === null) firstAt = now - startedAt;
        }
        const count = alerts.filter(item => item.category === 'rune').length;
        assert.equal(count, n === 3 ? 1 : 0, `${n}번 scale=${scale} learned=${learned} 알림 수`);
        if (n === 3) assert.equal(firstAt, 600, '정상 룬의 합성 반복 입력 확인 시간 증가');
        console.log(`PASS 사진${n} scale=${scale} learned=${learned} 알림=${count} 최초=${firstAt}ms`);
      }
    }
  } finally { Date.now = originalNow; }
}
