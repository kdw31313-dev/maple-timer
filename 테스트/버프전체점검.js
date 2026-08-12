#!/usr/bin/env node
'use strict';

// 모든 과거 첨부 화면을 같은 운영 버프 ROI로 읽어 솔 야누스와
// 익스트림 골드가 서로의 화면 또는 일반 사냥 화면을 잡는지 점검한다.
// 회귀 명세에 넣을 표본을 고르는 진단 도구이며 파일을 복사하거나 수정하지 않는다.

const fs = require('node:fs');
const path = require('node:path');

const 프로젝트폴더 = path.resolve(__dirname, '..');
const 상위폴더 = path.resolve(프로젝트폴더, '..');
const sharp = require(path.join(상위폴더, '영상분석도구', 'node_modules', 'sharp'));

global.window = global;
global.addEventListener = () => {};
global.document = {
  getElementById() {
    return { checked: true };
  },
  createElement() {
    return { width: 0, height: 0, getContext: () => ({}) };
  }
};
global.audioNotifier = { notify() {} };
global['버프영상수집기'] = {};

[
  'js/버프인식기기준.js',
  'js/야누스인식기준.js',
  'js/익스트림골드인식기준.js',
  'js/영상학습인식기준.js',
  'js/거탐인식기기준.js',
  'js/imageAnalyzer.js',
  'js/검출정확도개선.js',
  'js/룬검출정확도.js',
  'js/거탐검출정확도.js',
  'js/버프검출정확도.js'
].forEach((상대경로) => require(path.join(프로젝트폴더, 상대경로)));

const ImageAnalyzer = window.imageAnalyzer.constructor;
const 버프ROI = { x: 55, y: 0, w: 44, h: 24 };

function 재귀사진목록(폴더) {
  if (!fs.existsSync(폴더)) return [];
  const 결과 = [];
  const 방문 = (현재) => {
    for (const 항목 of fs.readdirSync(현재, { withFileTypes: true })) {
      const 전체 = path.join(현재, 항목.name);
      if (항목.isDirectory()) 방문(전체);
      else if (/\.jpe?g$/i.test(항목.name)) 결과.push(전체);
    }
  };
  방문(폴더);
  return 결과.sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
}

function 비율ROI계산(메타) {
  const left = Math.max(0, Math.round((버프ROI.x / 100) * 메타.width));
  const top = Math.max(0, Math.round((버프ROI.y / 100) * 메타.height));
  return {
    left,
    top,
    width: Math.max(10, Math.min(
      메타.width - left,
      Math.round((버프ROI.w / 100) * 메타.width)
    )),
    height: Math.max(10, Math.min(
      메타.height - top,
      Math.round((버프ROI.h / 100) * 메타.height)
    ))
  };
}

async function 버프영상읽기(파일) {
  const 메타 = await sharp(파일).metadata();
  let 변환 = sharp(파일);
  if (메타.width / Math.max(1, 메타.height) < 2.8) {
    변환 = 변환.extract(비율ROI계산(메타));
  }
  const 결과 = await 변환.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: 결과.info.width,
    height: 결과.info.height,
    data: new Uint8ClampedArray(결과.data)
  };
}

function 요약(match) {
  const shape = match.shape || {};
  return {
    found: Boolean(match.found),
    score: Number.isFinite(match.score) ? Number(match.score.toFixed(2)) : null,
    x: match.x,
    y: match.y,
    size: match.size,
    yellow: shape.yellowDigitPixels || 0,
    violet: shape.violetPixels || 0,
    dark: shape.darkPixels || 0,
    gold: shape.goldPixels || 0,
    grayBlue: shape.grayBluePixels || 0
  };
}

function 아이콘단독영상(영상, match) {
  const width = 256;
  const height = 240;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 3; index < data.length; index += 4) data[index] = 255;
  const left = 80;
  const top = 2;
  for (let y = 0; y < match.size; y++) {
    for (let x = 0; x < match.size; x++) {
      const source = ((match.y + y) * 영상.width + match.x + x) * 4;
      const target = ((top + y) * width + left + x) * 4;
      data[target] = 영상.data[source];
      data[target + 1] = 영상.data[source + 1];
      data[target + 2] = 영상.data[source + 2];
      data[target + 3] = 255;
    }
  }
  return { width, height, data };
}

async function 영상골드종료점검() {
  const 프레임폴더 = path.join(상위폴더, '영상분석결과', '5초간격_버프영역');
  const 파일목록 = fs.readdirSync(프레임폴더)
    .filter((이름) => /^프레임_\d+\.jpg$/i.test(이름))
    .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
  const 분석기 = new ImageAnalyzer();
  let 추적 = null;
  let 이전발견 = null;
  let 종료연속 = 0;
  let 최장종료연속 = 0;
  const 종료후보 = [];

  for (let index = 0; index < 파일목록.length; index++) {
    const 결과 = await sharp(path.join(프레임폴더, 파일목록[index]))
      .extract({ left: 250, top: 0, width: 670, height: 360 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const 영상 = {
      width: 결과.info.width,
      height: 결과.info.height,
      data: new Uint8ClampedArray(결과.data)
    };
    const 현재 = 분석기.findBuffTemplateMatch(영상, 'extremeGold', 3, 추적);
    const 추적모양 = 추적
      ? 분석기.measureBuffIconShape(영상, 추적.x, 추적.y, 추적.size)
      : null;
    const scale = Math.pow((추적?.size || 33) / 33, 2);
    const 종료모양 = Boolean(
      추적모양
      && 추적모양.lowerLeftYellowPixels <= Math.max(2, Math.round(2 * scale))
      && 추적모양.grayBluePixels >= 70 * scale
      && 추적모양.goldPixels <= 20 * scale
    );
    종료연속 = !현재.found && 종료모양 ? 종료연속 + 1 : 0;
    최장종료연속 = Math.max(최장종료연속, 종료연속);
    if (!현재.found && 종료모양) {
      종료후보.push({
        프레임: index + 1,
        초: index * 5,
        추적: 추적 ? [추적.x, 추적.y, 추적.size] : null,
        모양: {
          timer: 추적모양.lowerLeftYellowPixels,
          grayBlue: 추적모양.grayBluePixels,
          gold: 추적모양.goldPixels
        }
      });
    }
    if (현재.found) 추적 = 현재;
    if (이전발견 !== 현재.found) {
      console.log(JSON.stringify({
        전환프레임: index + 1,
        초: index * 5,
        현재: 요약(현재),
        추적종료모양: 종료모양
      }));
      이전발견 = 현재.found;
    }
  }

  console.log(JSON.stringify({
    영상프레임: 파일목록.length,
    종료후보수: 종료후보.length,
    최장종료연속,
    종료후보
  }));
}

(async () => {
  if (process.argv.includes('--영상')) {
    await 영상골드종료점검();
    return;
  }
  const 폴더목록 = [
    path.resolve(
      프로젝트폴더,
      '..', '..', '..',
      '2026-07-27',
      'pc-3-1-github-https-github-2',
      '.codex-remote-attachments',
      '019fa1dc-0a7c-76b3-a8a2-5c01059873bd'
    ),
    path.join(상위폴더, '.codex-remote-attachments', '019facf2-c68e-74f3-838c-05d531b6a960'),
    path.join(프로젝트폴더, '.codex-remote-attachments', '019fd099-8233-78a2-a340-f6fce93a8ab5')
  ];
  const 사진목록 = [...new Set(폴더목록.flatMap(재귀사진목록))];
  let 야누스발견 = 0;
  let 골드발견 = 0;
  const 교차오탐 = [];
  const 상세 = process.argv.includes('--상세');

  for (const 파일 of 사진목록) {
    const 영상 = await 버프영상읽기(파일);
    const 분석기 = new ImageAnalyzer();
    const 야누스 = 분석기.findBuffTemplateMatch(영상, 'janus', 1, null);
    const 골드 = 분석기.findBuffTemplateMatch(영상, 'extremeGold', 3, null);
    if (야누스.found) 야누스발견++;
    if (골드.found) 골드발견++;
    const 야누스가골드 = 야누스.found
      ? 분석기.findBuffTemplateMatch(
        아이콘단독영상(영상, 야누스),
        'extremeGold',
        3,
        null
      )
      : { found: false };
    const 골드가야누스 = 골드.found
      ? 분석기.findBuffTemplateMatch(
        아이콘단독영상(영상, 골드),
        'janus',
        1,
        null
      )
      : { found: false };
    if (야누스가골드.found || 골드가야누스.found) {
      교차오탐.push({
        파일: path.relative(프로젝트폴더, 파일),
        야누스가골드: 요약(야누스가골드),
        골드가야누스: 요약(골드가야누스)
      });
    }
    if (상세 && (야누스.found || 골드.found)) {
      console.log(JSON.stringify({
        파일: path.relative(프로젝트폴더, 파일),
        크기: [영상.width, 영상.height],
        야누스: 요약(야누스),
        골드: 요약(골드)
      }));
    }
  }

  console.log(JSON.stringify({
    전체: 사진목록.length,
    야누스발견,
    골드발견,
    교차오탐수: 교차오탐.length,
    교차오탐
  }));
  if (교차오탐.length) process.exitCode = 1;
})().catch((오류) => {
  console.error(오류.stack || 오류.message);
  process.exitCode = 1;
});
