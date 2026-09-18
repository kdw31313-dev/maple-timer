#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
assert.ok(args.length > 0 && args.length % 2 === 0, '수정전.json 수정후.json 쌍을 입력하세요.');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const results = [];
const names = new Set();
for (let i = 0; i < args.length; i += 2) {
  const before = read(args[i]), after = read(args[i + 1]);
  assert.equal(before.length, after.length, '영상 수 변경');
  for (const old of before) {
    assert.ok(!names.has(old.file), '중복 영상');
    names.add(old.file);
    const current = after.find(row => row.file === old.file);
    assert.ok(current, `결과 없음: ${old.file}`);
    assert.equal(current.frames, old.frames, `${old.file}: 검사 프레임 수 변경`);
    assert.ok(old.alerts.length > 0 && current.alerts.length > 0, `${old.file}: 알림 없음`);
    assert.deepEqual(current.alerts, old.alerts, `${old.file}: 알림 유형/시각/횟수 변경`);
    assert.deepEqual(current.candidateKinds, old.candidateKinds, `${old.file}: 발동 안내 후보 변경`);
    results.push({ file: old.file, seconds: current.duration, frames: current.frames,
      firstAlertAt: current.alerts[0].time, alerts: current.alerts.length,
      beforeKinds: old.allCandidateKinds, afterKinds: current.allCandidateKinds });
  }
}
console.log(JSON.stringify({ videos: results.length, framesPerVersion: results.reduce((s,r)=>s+r.frames,0),
  secondsPerVersion: results.reduce((s,r)=>s+r.seconds,0), results,
  limitation: '기존 알림 유지 비교다. 등장 시점별 정답 라벨, 원형형 양성, 실제 텔레그램 전달 검증은 별도다.' }, null, 2));
