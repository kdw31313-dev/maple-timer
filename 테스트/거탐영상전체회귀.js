#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const 입력목록 = process.argv.slice(2).map((입력) => path.resolve(입력));
if (!입력목록.length) {
  console.error('사용법: node 테스트/거탐영상전체회귀.js <영상 또는 사진> [...]');
  process.exit(2);
}

for (const 입력 of 입력목록) {
  if (!fs.existsSync(입력)) {
    console.error(`자료를 찾지 못했습니다: ${입력}`);
    process.exit(2);
  }
}

global.window = global;
global.addEventListener = () => {};
global.document = {
  getElementById() { return { checked: true }; },
  createElement() { return { getContext() { return {}; } }; }
};

let 현재알림 = [];
global.audioNotifier = {
  notify(message, category) {
    현재알림.push({ message, category, time: 현재영상시각 });
  }
};

const 프로젝트폴더 = path.resolve(__dirname, '..');
[
  'js/거탐인식기기준.js',
  'js/imageAnalyzer.js',
  'js/검출정확도개선.js',
  'js/거탐검출정확도.js'
].forEach((파일) => require(path.join(프로젝트폴더, 파일)));

const ImageAnalyzer = global.imageAnalyzer.constructor;
const 분석너비 = 240;
const 분석높이 = 135;
const 빠른너비 = 144;
const 빠른높이 = 81;
const 초당프레임 = 20 / 3;
const 프레임크기 = 분석너비 * 분석높이 * 4;
let 현재영상시각 = 0;

const 축소 = (화면) => {
  const data = new Uint8ClampedArray(빠른너비 * 빠른높이 * 4);
  for (let y = 0; y < 빠른높이; y++) {
    const sourceY = Math.min(분석높이 - 1, Math.floor(y * 분석높이 / 빠른높이));
    for (let x = 0; x < 빠른너비; x++) {
      const sourceX = Math.min(분석너비 - 1, Math.floor(x * 분석너비 / 빠른너비));
      const source = (sourceY * 분석너비 + sourceX) * 4;
      const target = (y * 빠른너비 + x) * 4;
      data[target] = 화면.data[source];
      data[target + 1] = 화면.data[source + 1];
      data[target + 2] = 화면.data[source + 2];
      data[target + 3] = 255;
    }
  }
  return { data, width: 빠른너비, height: 빠른높이 };
};

const 프레임처리 = (상태, raw) => {
  const data = new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength);
  const 화면 = { data, width: 분석너비, height: 분석높이 };
  현재영상시각 = 상태.frame / 초당프레임;

  let 빠른후보 = null;
  let 정밀실행 = 상태.frame % 2 === 0;
  if (!정밀실행) {
    const preview = 축소(화면);
    빠른후보 = 상태.analyzer.findFloatingActivationFastEvidence(preview);
    const template = 상태.analyzer.findPopupTemplateMatch(preview);
    정밀실행 = Boolean(빠른후보?.found || template?.found);
  }

  let 증거 = null;
  if (정밀실행) {
    증거 = 상태.analyzer.findPopupUniqueStructureEvidence(화면);
    상태.analyzer.processPopupStructureFrame(화면);
  }

  const 발동안내 = 증거?.found && 증거.type === '발동 안내형 거짓말 탐지기';
  if (발동안내) {
    상태.후보수++;
    if (상태.첫후보시각 === null) 상태.첫후보시각 = 현재영상시각;
    상태.후보종류[증거.kind] = (상태.후보종류[증거.kind] || 0) + 1;
    if (상태.후보표본.length < 8) {
      상태.후보표본.push({
        time: Number(현재영상시각.toFixed(2)),
        kind: 증거.kind,
        confidence: Number((증거.confidence || 0).toFixed(3)),
        x: 증거.x,
        y: 증거.y,
        width: 증거.width,
        height: 증거.height,
        topSpan: 증거.topSpan,
        meanLowerSpan: 증거.meanLowerSpan,
        lowerBandUniformity: 증거.lowerBandUniformity,
        topToLowerCountRatio: 증거.topToLowerCountRatio,
        horizontalRatio: 증거.horizontalWarmRatio || 증거.horizontalSalientRatio
      });
    }
  }
  if (빠른후보?.found) 상태.빠른후보수++;
  상태.frame++;
};

const 자료검사 = (입력) => new Promise((resolve, reject) => {
  const analyzer = new ImageAnalyzer();
  현재알림 = [];
  const 상태 = {
    analyzer,
    frame: 0,
    후보수: 0,
    빠른후보수: 0,
    첫후보시각: null,
    후보종류: {},
    후보표본: []
  };
  const 원래시각 = Date.now;
  const 기준시각 = 100000;
  Date.now = () => 기준시각 + Math.round(현재영상시각 * 1000);

  const ffmpeg = process.env.MAPLE_FFMPEG || 'ffmpeg';
  const 사진 = /\.(?:png|jpe?g|webp|bmp)$/i.test(입력);
  const 입력인수 = 사진 ? ['-loop', '1', '-t', '0.45', '-i', 입력] : ['-i', 입력];
  const child = spawn(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', ...입력인수,
    '-vf', `fps=${초당프레임},scale=${분석너비}:${분석높이}:flags=area`,
    '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'
  ], { windowsHide: true });
  let 남은바이트 = Buffer.alloc(0);
  let 오류 = '';

  child.stderr.on('data', (chunk) => { 오류 += chunk.toString('utf8'); });
  child.stdout.on('data', (chunk) => {
    남은바이트 = Buffer.concat([남은바이트, chunk]);
    while (남은바이트.length >= 프레임크기) {
      프레임처리(상태, 남은바이트.subarray(0, 프레임크기));
      남은바이트 = 남은바이트.subarray(프레임크기);
    }
  });
  child.on('error', (error) => {
    Date.now = 원래시각;
    reject(error);
  });
  child.on('close', (code) => {
    Date.now = 원래시각;
    if (code !== 0) {
      reject(new Error(`ffmpeg 종료 코드 ${code}: ${오류.trim()}`));
      return;
    }
    resolve({
      file: path.basename(입력),
      path: 입력,
      duration: Number((상태.frame / 초당프레임).toFixed(2)),
      frames: 상태.frame,
      activationCandidateFrames: 상태.후보수,
      fastCandidateFrames: 상태.빠른후보수,
      firstActivationCandidateAt: 상태.첫후보시각 === null
        ? null : Number(상태.첫후보시각.toFixed(2)),
      candidateKinds: 상태.후보종류,
      alerts: 현재알림.map((알림) => ({
        ...알림,
        time: Number(알림.time.toFixed(2))
      })),
      samples: 상태.후보표본
    });
  });
});

(async () => {
  const 결과 = [];
  for (const 입력 of 입력목록) {
    const 항목 = await 자료검사(입력);
    결과.push(항목);
    console.error(`검사 완료: ${항목.file} (${항목.duration}초, 알림 ${항목.alerts.length}회)`);
  }
  console.log(JSON.stringify(결과, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
