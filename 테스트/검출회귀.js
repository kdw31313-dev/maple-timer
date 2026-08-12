#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const 프로젝트폴더 = path.resolve(__dirname, '..');
const 상위폴더 = path.resolve(프로젝트폴더, '..');
const 분석결과폴더 = path.join(상위폴더, '영상분석결과', '5초간격_버프영역');
const 이전양성기준폴더 = path.resolve(
  프로젝트폴더,
  '..', '..', '..',
  '2026-07-27',
  'pc-3-1-github-https-github-2',
  '.codex-remote-attachments',
  '019fa1dc-0a7c-76b3-a8a2-5c01059873bd'
);
const 스크린샷코퍼스폴더 = path.join(
  상위폴더,
  '.codex-remote-attachments',
  '019facf2-c68e-74f3-838c-05d531b6a960'
);

// 과거 대화의 원본 첨부 UUID와 사진 번호다. 원본을 복사하지 않고 직접 읽는다.
const 실제거탐양성명세 = [
  ['272fb1f2', 2], ['a482c19f', 1], ['52d4c11f', 4], ['77cb6d4e', 5],
  ['508dc128', 1], ['52d4c11f', 2], ['508dc128', 5], ['508dc128', 3],
  ['056f22fa', 2], ['77cb6d4e', 1], ['77cb6d4e', 3], ['a482c19f', 3],
  ['056f22fa', 3], ['056f22fa', 4], ['272fb1f2', 3], ['272fb1f2', 4],
  ['272fb1f2', 5]
];
const 야누스양성홀드아웃명세 = [
  ['662d925c', 2], ['1382e968', 3], ['aae7822e', 2],
  ['25831e43', 4], ['368814ad', 1], ['242fb747', 4]
];
// 숫자가 사라진 회색 원형은 새 활성 시작 근거가 아니라, 이미 추적 중인
// 야누스의 종료 위상이다. 활성 양성에 섞으면 다른 회색 스킬 오탐이 늘어난다.
const 야누스종료위상명세 = [['1382e968', 1]];
const 야누스음성명세 = [
  ['aae7822e', 5], ['1382e968', 4], ['ec17b6d6', 5], ['9e788b94', 4],
  ['a4ab6e49', 4]
];
const 골드양성명세 = [
  ...[1, 2, 3, 4, 5].map((번호) => ['f3f543d6', 번호])
];
const 골드종료하드음성명세 = [
  ...[1, 2, 3, 4, 5].map((번호) => ['90b58c3a', 번호]),
  ['06b1598c', 1], ['477d1c7c', 1], ['7c53ca52', 1]
];

function 샤프불러오기() {
  const 후보 = [
    'sharp',
    path.join(상위폴더, '영상분석도구', 'node_modules', 'sharp')
  ];
  const 오류 = [];

  for (const 모듈 of 후보) {
    try {
      return { sharp: require(모듈), 위치: 모듈 };
    } catch (error) {
      오류.push(`${모듈}: ${error.message}`);
    }
  }

  throw new Error(
    'sharp를 찾지 못했습니다. 프로젝트에 sharp를 설치하거나 형제 영상분석도구의 의존성을 복구해 주세요.\n'
      + 오류.join('\n')
  );
}

const { sharp, 위치: 샤프위치 } = 샤프불러오기();
const 원시후보진단 = /^(1|true|yes|on)$/i.test(process.env.MAPLE_TEST_DIAGNOSTIC || '');
const 검사필터 = (process.env.MAPLE_TEST_SECTION || '').trim();

let 현재알림 = [];
const 토글 = new Map([
  ['toggle-rune-detection', { checked: true }],
  ['toggle-popup-detection', { checked: true }],
  ['toggle-janus-detection', { checked: true }],
  ['toggle-exp-detection', { checked: true }]
]);

global.window = global;
global.addEventListener = () => {};
global.document = {
  getElementById(id) {
    return 토글.get(id) || null;
  },
  createElement(tagName) {
    if (tagName !== 'canvas') return {};
    return {
      width: 0,
      height: 0,
      getContext() {
        return {};
      }
    };
  }
};
global.audioNotifier = {
  notify(message, category) {
    현재알림.push({ message, category });
  }
};
global.버프영상수집기 = {
  startJanusCycle() {},
  captureJanusMove() {},
  captureExtremeGoldMove() {},
  captureExtremeGoldStart() {},
  captureEnding() {}
};

// index.html의 검출 기준 로드 순서를 그대로 유지한다.
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
  'js/버프검출정확도.js',
  'js/screenCapture.js'
].forEach((상대경로) => require(path.join(프로젝트폴더, 상대경로)));

window.screenCaptureManager.isStreaming = true;

const ImageAnalyzer = window.imageAnalyzer.constructor;
const 룬ROI = { ...window.screenCaptureManager.runeRoi };
const 버프ROI = { ...window.screenCaptureManager.janusRoi };
const 팝업크기 = {
  width: window.screenCaptureManager.popupCanvas.width,
  height: window.screenCaptureManager.popupCanvas.height
};

const 첨부기준폴더 = path.join(
  프로젝트폴더,
  '.codex-remote-attachments',
  '019fd099-8233-78a2-a340-f6fce93a8ab5'
);
const 오탐그룹 = {
  룬: path.join(첨부기준폴더, '37ed626e-d315-4fb0-bc0a-4f9bd0de2363'),
  거짓말탐지기: path.join(첨부기준폴더, '13a52311-b6a9-4f69-b355-d29c2ef7977a'),
  야누스: path.join(첨부기준폴더, 'f1a9ddba-40dc-433e-bb99-4947595bc0b4')
};
const 룬양성폴더 = path.join(이전양성기준폴더, '2d8badfd-8104-4f88-9f09-56da17e2d003');

function 사진목록(폴더, 기대개수) {
  if (!fs.existsSync(폴더)) {
    throw new Error(`회귀 원본 폴더가 없습니다: ${폴더}`);
  }
  const 목록 = fs.readdirSync(폴더)
    .filter((이름) => /\.jpe?g$/i.test(이름))
    .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }))
    .map((이름) => path.join(폴더, 이름));
  assert.equal(목록.length, 기대개수, `${폴더}의 JPG 개수가 달라졌습니다.`);
  return 목록;
}

function 코퍼스폴더찾기(기준폴더, 접두사, 자료명) {
  if (!fs.existsSync(기준폴더)) {
    throw new Error(`${자료명} 기준 폴더가 없습니다: ${기준폴더}`);
  }
  const 일치폴더 = fs.readdirSync(기준폴더, { withFileTypes: true })
    .filter((항목) => 항목.isDirectory() && 항목.name.startsWith(접두사))
    .map((항목) => path.join(기준폴더, 항목.name));
  assert.equal(
    일치폴더.length,
    1,
    `${자료명} 폴더 접두사 ${접두사}는 정확히 1개여야 하지만 ${일치폴더.length}개입니다: ${기준폴더}`
  );
  return 일치폴더[0];
}

function 코퍼스사진찾기(기준폴더, [접두사, 사진번호], 자료명) {
  const 폴더 = 코퍼스폴더찾기(기준폴더, 접두사, 자료명);
  const 사진 = fs.readdirSync(폴더, { withFileTypes: true })
    .filter((항목) => 항목.isFile() && /^\d+-.*\.jpe?g$/i.test(항목.name))
    .find((항목) => Number(항목.name.match(/^(\d+)-/)[1]) === 사진번호);
  assert.ok(
    사진,
    `${자료명} 사진 ${접두사}/${사진번호}를 찾지 못했습니다: ${폴더}`
  );
  return path.join(폴더, 사진.name);
}

function 코퍼스목록(기준폴더, 명세, 기대개수, 자료명) {
  assert.equal(명세.length, 기대개수, `${자료명} 명세 개수가 ${기대개수}개가 아닙니다.`);
  const 목록 = 명세.map((항목) => 코퍼스사진찾기(기준폴더, 항목, 자료명));
  assert.equal(new Set(목록).size, 기대개수, `${자료명} 명세에 중복 사진이 있습니다.`);
  return 목록;
}

function 비율ROI계산(메타, roi) {
  const left = Math.max(0, Math.round((roi.x / 100) * 메타.width));
  const top = Math.max(0, Math.round((roi.y / 100) * 메타.height));
  const width = Math.max(10, Math.min(
    메타.width - left,
    Math.round((roi.w / 100) * 메타.width)
  ));
  const height = Math.max(10, Math.min(
    메타.height - top,
    Math.round((roi.h / 100) * 메타.height)
  ));
  return { left, top, width, height };
}

async function 이미지데이터읽기(파일, 옵션 = {}) {
  if (!fs.existsSync(파일)) throw new Error(`이미지 파일이 없습니다: ${파일}`);

  let 변환 = sharp(파일);
  if (옵션.roi) {
    const 메타 = await sharp(파일).metadata();
    변환 = 변환.extract(비율ROI계산(메타, 옵션.roi));
  } else if (옵션.extract) {
    변환 = 변환.extract(옵션.extract);
  }
  if (옵션.resize) {
    변환 = 변환.resize({
      width: 옵션.resize.width,
      height: 옵션.resize.height,
      fit: 'fill',
      kernel: sharp.kernel.linear
    });
  }

  const 결과 = await 변환.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: 결과.info.width,
    height: 결과.info.height,
    data: new Uint8ClampedArray(결과.data)
  };
}

async function 버프영상읽기(파일) {
  const 메타 = await sharp(파일).metadata();
  // 1280x391~392 자료는 과거 진단 과정에서 이미 잘라 둔 버프 ROI다.
  // 전체 화면 자료에만 운영 ROI를 적용해야 이중 절단으로 아이콘이 사라지지 않는다.
  return 메타.width / Math.max(1, 메타.height) >= 2.8
    ? 이미지데이터읽기(파일)
    : 이미지데이터읽기(파일, { roi: 버프ROI });
}

// 한 화면에 야누스와 골드가 함께 있는 경우가 많다. 화면 전체를 반대 버프의
// 음성으로 쓰지 않고, 실제로 찾은 아이콘 슬롯만 중립 캔버스로 옮겨 템플릿
// 자체가 서로 혼동되는지를 확인한다.
function 아이콘단독영상(영상, 일치) {
  const width = 256;
  const height = 240;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 3; index < data.length; index += 4) data[index] = 255;
  const left = 80;
  const top = 2;
  for (let y = 0; y < 일치.size; y++) {
    for (let x = 0; x < 일치.size; x++) {
      const source = ((일치.y + y) * 영상.width + 일치.x + x) * 4;
      const target = ((top + y) * width + left + x) * 4;
      data[target] = 영상.data[source];
      data[target + 1] = 영상.data[source + 1];
      data[target + 2] = 영상.data[source + 2];
      data[target + 3] = 255;
    }
  }
  return { width, height, data };
}

function 아이콘이동영상(영상, 일치, 목표Y) {
  const 목표X = 일치.x;
  const size = 일치.size;
  assert.equal(목표X >= 0 && 목표X + size <= 영상.width, true, '이동할 아이콘의 X 범위가 영상 밖입니다.');
  assert.equal(목표Y >= 0 && 목표Y + size <= 영상.height, true, '이동할 아이콘의 Y 범위가 영상 밖입니다.');
  const 겹침 = 목표Y < 일치.y + size && 목표Y + size > 일치.y;
  assert.equal(겹침, false, '원본 슬롯과 이동 슬롯이 겹칩니다.');

  // 원본을 지우기 전에 아이콘을 별도로 복사해야 겹치지 않은 둘째 줄 합성이 된다.
  const 아이콘 = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const source = ((일치.y + y) * 영상.width + 일치.x + x) * 4;
      const target = (y * size + x) * 4;
      아이콘.set(영상.data.subarray(source, source + 4), target);
      아이콘[target + 3] = 255;
    }
  }

  const 결과 = { width: 영상.width, height: 영상.height, data: new Uint8ClampedArray(영상.data) };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const source = ((일치.y + y) * 영상.width + 일치.x + x) * 4;
      const target = ((목표Y + y) * 영상.width + 목표X + x) * 4;
      결과.data[source] = 110;
      결과.data[source + 1] = 110;
      결과.data[source + 2] = 110;
      결과.data[source + 3] = 255;
      const icon = (y * size + x) * 4;
      결과.data.set(아이콘.subarray(icon, icon + 4), target);
    }
  }
  return 결과;
}

async function JPEG재압축영상(영상, 품질) {
  const 원시버퍼 = Buffer.from(영상.data.buffer, 영상.data.byteOffset, 영상.data.byteLength);
  const JPEG버퍼 = await sharp(원시버퍼, {
    raw: { width: 영상.width, height: 영상.height, channels: 4 }
  }).jpeg({ quality: 품질, chromaSubsampling: '4:2:0' }).toBuffer();
  const 결과 = await sharp(JPEG버퍼).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: 결과.info.width, height: 결과.info.height, data: new Uint8ClampedArray(결과.data) };
}

function 빈영상(기준영상) {
  const data = new Uint8ClampedArray(기준영상.width * 기준영상.height * 4);
  for (let index = 3; index < data.length; index += 4) data[index] = 255;
  return { width: 기준영상.width, height: 기준영상.height, data };
}

function 새분석기() {
  현재알림 = [];
  const 분석기 = new ImageAnalyzer();
  // 운영 UI에서는 골드를 비활성화하지만, 회귀 테스트는 검출 알고리즘 자체를
  // 계속 검증해야 하므로 테스트 인스턴스에서만 명시적으로 켠다.
  분석기.expBuffState.disabled = false;
  분석기.onRuneStatusChange = () => {};
  분석기.onPopupStatusChange = () => {};
  분석기.onJanusStatusChange = () => {};
  분석기.onExpBuffStatusChange = () => {};
  return 분석기;
}

function 범주알림(범주) {
  return 현재알림.filter((항목) => 항목.category === 범주);
}

function 점수표시(값) {
  return Number.isFinite(값) ? Number(값.toFixed(2)) : String(값);
}

function 룬원시후보출력(라벨, 파일, 분석기, 영상) {
  if (!원시후보진단) return;
  const 후보 = 분석기.findRuneDiamondCandidates(영상);
  console.log(JSON.stringify({
    진단: '룬 원시 후보',
    라벨,
    파일: path.relative(프로젝트폴더, 파일),
    크기: { width: 영상.width, height: 영상.height },
    후보개수: 후보.length,
    후보
  }));
}

function 룬후보영역지우기(영상, 후보) {
  const 결과 = {
    width: 영상.width,
    height: 영상.height,
    data: new Uint8ClampedArray(영상.data)
  };
  const 시작X = Math.max(0, Math.floor(후보.x - 3));
  const 시작Y = Math.max(0, Math.floor(후보.y - 3));
  const 끝X = Math.min(영상.width, Math.ceil(후보.x + 후보.width + 3));
  const 끝Y = Math.min(영상.height, Math.ceil(후보.y + 후보.height + 3));

  // 미니맵 전체는 보존하고 작은 룬 영역만 무채색으로 만들어, 맵 이동이 아닌
  // '룬 해제' 상태 전이를 재현한다.
  for (let y = 시작Y; y < 끝Y; y++) {
    for (let x = 시작X; x < 끝X; x++) {
      const 인덱스 = (y * 영상.width + x) * 4;
      const 밝기 = Math.min(
        55,
        Math.round((영상.data[인덱스] + 영상.data[인덱스 + 1] + 영상.data[인덱스 + 2]) / 3)
      );
      결과.data[인덱스] = 밝기;
      결과.data[인덱스 + 1] = 밝기;
      결과.data[인덱스 + 2] = 밝기;
      결과.data[인덱스 + 3] = 255;
    }
  }
  return 결과;
}

const 검사결과 = [];

async function 검사(이름, 실행) {
  if (검사필터 && !이름.includes(검사필터)) return;
  const 시작 = process.hrtime.bigint();
  try {
    const 상세 = await 실행();
    const 걸린초 = Number(process.hrtime.bigint() - 시작) / 1e9;
    검사결과.push({ 이름, 통과: true, 상세, 걸린초 });
    console.log(`✅ ${이름} (${걸린초.toFixed(2)}초)${상세 ? ` | ${상세}` : ''}`);
  } catch (error) {
    const 걸린초 = Number(process.hrtime.bigint() - 시작) / 1e9;
    검사결과.push({ 이름, 통과: false, 오류: error.message, 걸린초 });
    // 통과/실패를 같은 출력 스트림에 써서 CI와 PowerShell에서도 실행 순서를 보존한다.
    console.log(`❌ ${이름} (${걸린초.toFixed(2)}초)\n   ${error.message}`);
  }
}

async function 룬오탐검사(파일) {
  const 영상 = await 이미지데이터읽기(파일, { roi: 룬ROI });
  const 분석기 = 새분석기();
  룬원시후보출력('오탐 음성', 파일, 분석기, 영상);
  const 시작후보 = 분석기.findRuneDiamondCandidates(영상).filter((후보) => (
    분석기.isConservativeStartupRuneCandidate(후보, 영상)
  ));
  assert.equal(
    시작후보.length,
    0,
    `시작 음성에서 엄격 룬 후보가 ${시작후보.length}개 생겼습니다.`
  );
  const 원래시각 = Date.now;
  let 가상시각 = 100000;

  try {
    Date.now = () => 가상시각;
    // 공유 시작부터 있던 맵 구조물은 같은 화면으로 배경 학습되어야 한다.
    for (let 프레임 = 0; 프레임 < 30; 프레임++) {
      분석기.processRuneFrame(영상, null);
      가상시각 += 150;
    }
  } finally {
    Date.now = 원래시각;
  }

  const 알림수 = 범주알림('rune').length;
  assert.equal(알림수, 0, `룬 알림 ${알림수}회, 마지막 후보 ${분석기.runeState.lastCandidateCount}개`);
  assert.equal(분석기.runeState.isDetected, false, '룬 감지 상태가 켜졌습니다.');
  assert.equal(
    Boolean(분석기.runeState.startupRuneAlerted),
    false,
    '시작 음성에서 시작시점 룬 경로가 켜졌습니다.'
  );
  return `엄격후보 0개, 배경학습 ${분석기.runeState.backgroundLearningFrames}프레임`;
}

async function 룬시작양성검사(파일) {
  const 영상 = await 이미지데이터읽기(파일, { roi: 룬ROI });
  const 분석기 = 새분석기();
  룬원시후보출력('시작 양성', 파일, 분석기, 영상);
  const 시작후보 = 분석기.findRuneDiamondCandidates(영상).filter((후보) => (
    분석기.isConservativeStartupRuneCandidate(후보, 영상)
  ));
  assert.ok(
    시작후보.length >= 1,
    '실제 룬이 엄격 시작시점 공간 특징을 통과하지 못했습니다.'
  );
  const 대표 = 시작후보[0];
  const 원래시각 = Date.now;
  let 가상시각 = 150000;

  try {
    Date.now = () => 가상시각;
    // 공유 첫 프레임부터 룬이 있는 경우다. 배경 학습이 끝나기 전 600ms
    // 연속 공간 근거만으로 한 번 알린다. 학습 완료 뒤에도 같은 후보가 배경에
    // 흡수되지 않아야 나중에 같은 좌표로 재출현한 룬을 다시 볼 수 있다.
    for (let 프레임 = 0; 프레임 < 25; 프레임++) {
      분석기.processRuneFrame(영상, null);
      가상시각 += 150;
    }
  } finally {
    Date.now = 원래시각;
  }

  assert.equal(Boolean(분석기.runeState.startupRuneAlerted), true, '시작시점 룬 경로가 켜지지 않았습니다.');
  assert.equal(분석기.runeState.isDetected, true, '시작시점 실제 룬 감지 상태가 켜지지 않았습니다.');
  assert.equal(범주알림('rune').length, 1, `시작시점 실제 룬 알림이 ${범주알림('rune').length}회입니다.`);
  assert.ok(
    분석기.runeState.startupRuneAlertLearningFrame < 분석기.runeState.BACKGROUND_LEARNING_REQUIRED,
    '시작시점 감지가 배경 학습 완료 뒤에야 발생했습니다.'
  );
  const 학습후후보 = 분석기.findRuneDiamondCandidates(영상).find((후보) => (
    분석기.isConservativeStartupRuneCandidate(후보, 영상)
  ));
  assert.ok(학습후후보, '학습 완료 뒤 엄격 룬 후보가 사라졌습니다.');
  assert.equal(
    분석기.isRuneCandidateAccepted(학습후후보, 영상, false),
    true,
    `시작시점 실제 룬이 배경 구조물로 흡수되었습니다. ${JSON.stringify({
      배경후보: 분석기.isRuneBackgroundCandidate(학습후후보),
      신규후보: 분석기.isRuneNovelCandidate(학습후후보, 영상),
      반복: 학습후후보.repeatedStructureCount,
      신규seed: 학습후후보.newStrictSeedCount,
      신규비율: 학습후후보.newStrictSeedRatio
    })}`
  );

  const 룬없는영상 = 룬후보영역지우기(영상, 학습후후보);
  assert.equal(
    분석기.findRuneDiamondCandidates(룬없는영상).some((후보) => (
      분석기.isConservativeStartupRuneCandidate(후보, 룬없는영상)
    )),
    false,
    '룬 해제 합성 화면에 엄격 룬 후보가 남았습니다.'
  );
  try {
    Date.now = () => 가상시각;
    for (let 프레임 = 0; 프레임 < 16; 프레임++) {
      분석기.processRuneFrame(룬없는영상, null);
      가상시각 += 150;
    }
    assert.equal(분석기.runeState.cooldownActive, false, '룬 해제 뒤 쿨다운이 풀리지 않았습니다.');
    assert.equal(분석기.runeState.isDetected, false, '룬 해제 뒤 감지 상태가 풀리지 않았습니다.');
    for (let 프레임 = 0; 프레임 < 10; 프레임++) {
      분석기.processRuneFrame(영상, null);
      가상시각 += 150;
    }
  } finally {
    Date.now = 원래시각;
  }
  assert.equal(
    범주알림('rune').length,
    2,
    `같은 좌표 룬 재출현 뒤 누적 알림이 ${범주알림('rune').length}회입니다.`
  );
  return `적합도 ${대표.diamondFit.toFixed(3)}, 시작 600ms 1회 + 동일좌표 재출현 1회`;
}

async function 거탐오탐검사(파일) {
  const 영상 = await 이미지데이터읽기(파일, { resize: 팝업크기 });
  const 분석기 = 새분석기();
  const 단일 = 분석기.verifyPopupTemplateMatch(영상, 분석기.findPopupTemplateMatch(영상));

  for (let 프레임 = 0; 프레임 < 3; 프레임++) {
    분석기.processPopupStructureFrame(영상);
  }

  const 알림수 = 범주알림('popup').length;
  assert.equal(알림수, 0, `거탐 알림 ${알림수}회, 판정 ${단일.type}, 점수 ${점수표시(단일.score)}`);
  assert.equal(분석기.popupState.isDetected, false, '거탐 감지 상태가 켜졌습니다.');
  return `최저점수 ${점수표시(단일.score)}, 템플릿 ${단일.type || '없음'}, 제목근거 ${Boolean(단일.titleEvidence)}`;
}

async function 거탐양성검사(파일) {
  const 영상 = await 이미지데이터읽기(파일, { resize: 팝업크기 });
  const 분석기 = 새분석기();
  const 단일 = 분석기.verifyPopupTemplateMatch(영상, 분석기.findPopupTemplateMatch(영상));
  assert.equal(
    단일.verified,
    true,
    `실제 거탐 단일 프레임을 검증하지 못했습니다. 후보 ${단일.type || '없음'}, 점수 ${점수표시(단일.score)}, 제목근거 ${Boolean(단일.titleEvidence)}`
  );

  for (let 프레임 = 0; 프레임 < 2; 프레임++) {
    분석기.processPopupStructureFrame(영상);
  }
  assert.equal(분석기.popupState.isDetected, true, '실제 거탐 2프레임 뒤에도 감지 상태가 켜지지 않았습니다.');
  assert.equal(범주알림('popup').length, 1, `실제 거탐 알림이 ${범주알림('popup').length}회입니다.`);
  return `판정 ${단일.type}, 점수 ${점수표시(단일.score)}, 제목근거 ${Boolean(단일.titleEvidence)}`;
}

async function 야누스오탐검사(파일) {
  const 영상 = await 버프영상읽기(파일);
  const 분석기 = 새분석기();
  const 단일 = 분석기.findBuffTemplateMatch(영상, 'janus', 1, null);

  for (let 프레임 = 0; 프레임 < 10; 프레임++) {
    분석기.processJanusTemplateFrame(영상);
  }

  const 알림수 = 범주알림('janus').length;
  assert.equal(알림수, 0, `야누스 알림 ${알림수}회, 점수 ${점수표시(단일.score)}`);
  assert.equal(분석기.janusState.isBuffActive, false, '다른 스킬을 야누스 활성으로 판정했습니다.');
  return `발견 ${Boolean(단일.found)}, 점수 ${점수표시(단일.score)}, 노란픽셀 ${단일.shape?.yellowDigitPixels || 0}`;
}

async function 야누스홀드아웃양성검사(파일) {
  const 영상 = await 버프영상읽기(파일);
  const 분석기 = 새분석기();
  const 단일 = 분석기.findBuffTemplateMatch(영상, 'janus', 1, null);
  assert.equal(
    단일.found,
    true,
    `홀드아웃 야누스를 찾지 못했습니다. 점수 ${점수표시(단일.score)}, 임계값 ${단일.threshold}, 노란픽셀 ${단일.shape?.yellowDigitPixels || 0}`
  );

  for (let 프레임 = 0; 프레임 < 3; 프레임++) {
    분석기.processJanusTemplateFrame(영상);
  }
  assert.equal(분석기.janusState.isBuffActive, true, '홀드아웃 양성 3프레임 뒤에도 야누스가 활성화되지 않았습니다.');
  assert.equal(범주알림('janus').length, 0, '야누스 활성화 과정에서 종료 알림이 발생했습니다.');
  return `점수 ${점수표시(단일.score)}/${단일.threshold}, 노란픽셀 ${단일.shape?.yellowDigitPixels || 0}, 위치 ${단일.x},${단일.y}`;
}

async function 야누스종료위상단독검사(파일) {
  const 영상 = await 버프영상읽기(파일);
  const 분석기 = 새분석기();
  const 단일 = 분석기.findBuffTemplateMatch(영상, 'janus', 1, null);

  // 공유를 이 장면에서 시작했을 때 회색 원형만으로 활성 상태를 만들거나
  // 종료 알림을 울리면 안 된다. 종료 알림은 활성 슬롯을 먼저 추적한 뒤에만 허용한다.
  for (let 프레임 = 0; 프레임 < 5; 프레임++) {
    분석기.processJanusTemplateFrame(영상);
  }
  assert.equal(분석기.janusState.isBuffActive, false, '타이머 없는 종료 위상을 야누스 활성 시작으로 판정했습니다.');
  assert.equal(범주알림('janus').length, 0, '추적 슬롯이 없는 종료 위상에서 야누스 알림이 발생했습니다.');
  return `일반점수 ${점수표시(단일.score)}, 노란픽셀 ${단일.shape?.yellowDigitPixels || 0}`;
}

async function 야누스음성검사(파일) {
  const 영상 = await 버프영상읽기(파일);
  const 분석기 = 새분석기();
  const 단일 = 분석기.findBuffTemplateMatch(영상, 'janus', 1, null);
  assert.equal(
    단일.found,
    false,
    `야누스 음성 단일 프레임이 템플릿을 통과했습니다. 점수 ${점수표시(단일.score)}, 임계값 ${단일.threshold}`
  );

  for (let 프레임 = 0; 프레임 < 10; 프레임++) {
    분석기.processJanusTemplateFrame(영상);
  }
  assert.equal(분석기.janusState.isBuffActive, false, '야누스 음성을 연속 입력한 뒤 활성 상태가 켜졌습니다.');
  assert.equal(범주알림('janus').length, 0, `야누스 음성에서 알림이 ${범주알림('janus').length}회 발생했습니다.`);
  return `점수 ${점수표시(단일.score)}/${단일.threshold}, 노란픽셀 ${단일.shape?.yellowDigitPixels || 0}`;
}

async function 골드양성검사(파일) {
  const 영상 = await 버프영상읽기(파일);
  const 분석기 = 새분석기();
  const 단일 = 분석기.findBuffTemplateMatch(영상, 'extremeGold', 3, null);
  assert.equal(
    단일.found,
    true,
    `익스트림 골드 홀드아웃을 찾지 못했습니다. 점수 ${점수표시(단일.score)}, 임계값 ${단일.threshold}`
  );

  분석기.expBuffState.disabled = false;
  for (let 프레임 = 0; 프레임 < 2; 프레임++) {
    분석기.processExpTemplateFrame(영상);
  }
  assert.equal(분석기.expBuffState.isBuffActive, true, '골드 양성 2프레임 뒤에도 활성 상태가 켜지지 않았습니다.');
  assert.equal(범주알림('exp').length, 0, '골드 활성화 과정에서 종료 알림이 발생했습니다.');
  return `점수 ${점수표시(단일.score)}/${단일.threshold}, 위치 ${단일.x},${단일.y}, 크기 ${단일.size}`;
}

async function 골드오탐음성검사(하드음성파일) {
  const 하드음성영상 = await 버프영상읽기(하드음성파일);
  const 분석기 = 새분석기();
  분석기.expBuffState.disabled = false;

  // 사용자가 직접 "오탐"으로 분류한 자료다. 일부는 파란 원으로 당시 골드
  // 위치를 설명한 화면이지만, 주어진 한 장만으로 시작/이동의 시간 순서를
  // 재구성할 수 없으므로 정상 활성 양성으로 중복 사용하지 않는다.
  const 현재골드 = 분석기.findBuffTemplateMatch(하드음성영상, 'extremeGold', 3, null);
  for (let 프레임 = 0; 프레임 < 8; 프레임++) {
    분석기.processExpTemplateFrame(하드음성영상);
  }
  assert.equal(분석기.expBuffState.isBuffActive, false, '골드 오탐 자료를 활성 골드로 판정했습니다.');
  assert.equal(분석기.expBuffState.alert10Triggered, false, '골드 종료 하드 음성을 종료 임박으로 판정했습니다.');
  assert.equal(범주알림('exp').length, 0, `골드 종료 하드 음성에서 알림이 ${범주알림('exp').length}회 발생했습니다.`);
  return `발견 ${Boolean(현재골드.found)}, 최저점수 ${점수표시(현재골드.score)}`;
}

async function 버프공통하드음성검사(파일) {
  const 영상 = await 버프영상읽기(파일);
  const 분석기 = 새분석기();
  const 야누스 = 분석기.findBuffTemplateMatch(영상, 'janus', 1, null);
  const 골드 = 분석기.findBuffTemplateMatch(영상, 'extremeGold', 3, null);
  assert.equal(야누스.found, false, `일반 사냥 화면을 야누스로 판정했습니다: ${파일}`);
  assert.equal(골드.found, false, `일반 사냥 화면을 골드로 판정했습니다: ${파일}`);

  // 단일 프레임뿐 아니라 시작 확정에 필요한 2프레임을 반복해도
  // 어느 버프 상태도 켜지지 않아야 한다.
  for (let 프레임 = 0; 프레임 < 2; 프레임++) {
    분석기.processJanusTemplateFrame(영상);
    분석기.processExpTemplateFrame(영상);
  }
  assert.equal(분석기.janusState.isBuffActive, false, '하드 음성 2프레임 뒤 야누스가 활성화됐습니다.');
  assert.equal(분석기.expBuffState.isBuffActive, false, '하드 음성 2프레임 뒤 골드가 활성화됐습니다.');
  assert.equal(범주알림('janus').length, 0, '하드 음성에서 야누스 알림이 발생했습니다.');
  assert.equal(범주알림('exp').length, 0, '하드 음성에서 골드 알림이 발생했습니다.');
  return `야누스 ${점수표시(야누스.score)}, 골드 ${점수표시(골드.score)}`;
}

// 영상 표본은 원래 920px 우측 영역이며, 운영 ROI의 실제 콘텐츠는 left=250부터다.
// 템플릿 생성 좌표는 원본 기준 x=528, 테스트 분석 좌표는 x=278이 된다.
const 양성절단 = { left: 250, top: 0, width: 670, height: 360 };

function 양성프레임경로(번호) {
  return path.join(분석결과폴더, `프레임_${String(번호).padStart(4, '0')}.jpg`);
}

async function 양성프레임읽기(번호, 옵션 = {}) {
  return 이미지데이터읽기(양성프레임경로(번호), { extract: 양성절단, ...옵션 });
}

async function 실행() {
  console.log('메이플 검출 회귀 테스트');
  console.log(`sharp: ${샤프위치}`);
  console.log(`운영 ROI: 룬 ${JSON.stringify(룬ROI)}, 버프 ${JSON.stringify(버프ROI)}, 팝업 ${팝업크기.width}x${팝업크기.height}`);
  console.log('');

  await 검사('운영 로드 순서와 골드 비활성화 설정', async () => {
    const html = fs.readFileSync(path.join(프로젝트폴더, 'index.html'), 'utf8');
    const 로드순서 = [
      'js/imageAnalyzer.js',
      'js/검출정확도개선.js',
      'js/룬검출정확도.js',
      'js/거탐검출정확도.js',
      'js/버프검출정확도.js',
      'js/screenCapture.js'
    ];
    let 이전위치 = -1;
    for (const 파일 of 로드순서) {
      const 위치 = html.indexOf(`src="${파일}`);
      assert.ok(위치 > 이전위치, `${파일}의 운영 로드 순서가 잘못됐거나 누락됐습니다.`);
      이전위치 = 위치;
    }
    assert.match(
      html,
      /<input\s+type="checkbox"\s+id="toggle-exp-detection"\s+disabled>/,
      '익스트림 골드 운영 토글이 비활성화 상태가 아닙니다.'
    );
    assert.equal(window.imageAnalyzer.expBuffState.disabled, true, '운영 골드 분석 상태가 비활성화가 아닙니다.');
    return '정확도 모듈 3개 순서 정상, 익스트림 골드 운영 비활성화';
  });

  await 검사('룬 배경 기억 초기화', async () => {
    const 파일 = 사진목록(오탐그룹.룬, 4)[0];
    const 영상 = await 이미지데이터읽기(파일, { roi: 룬ROI });
    const 분석기 = 새분석기();
    for (let 프레임 = 0; 프레임 < 20; 프레임++) 분석기.processRuneFrame(영상, null);
    assert.ok(분석기.runeState.runeHysteresisBackgroundMask, '룬 배경 마스크가 생성되지 않았습니다.');
    분석기.reset();
    assert.equal(분석기.runeState.backgroundLearningFrames, 0, '룬 배경 학습 프레임이 초기화되지 않았습니다.');
    assert.equal(분석기.runeState.runeHysteresisBackgroundMask, null, '룬 배경 마스크가 초기화되지 않았습니다.');
    return '화면 공유 재시작 시 맵 배경 재학습 준비 완료';
  });

  await 검사('검출 세션 이력 완전 초기화', async () => {
    const 분석기 = 새분석기();
    분석기.popupState.lastMatch = { type: '이전 거탐', x: 1, y: 1, width: 10, height: 10 };
    분석기.janusState.moveEvidenceHistory = [{ x: 1, y: 1, size: 33 }];
    분석기.janusState.lastConfirmedAt = 12345;
    분석기.expBuffState.startEvidenceHistory = [{ x: 2, y: 2, size: 33 }];
    분석기.expBuffState.moveEvidenceHistory = [{ x: 3, y: 3, size: 33 }];
    분석기.expBuffState.lastConfirmedAt = 12345;
    분석기.expBuffState.detectedBuffNames = ['익스트림 골드'];
    분석기.reset();

    assert.equal(분석기.popupState.lastMatch, null, '거탐 이전 세션 위치가 남았습니다.');
    assert.deepEqual(분석기.janusState.moveEvidenceHistory, [], '야누스 이전 이동 후보가 남았습니다.');
    assert.equal(분석기.janusState.lastConfirmedAt, 0, '야누스 이전 확인 시각이 남았습니다.');
    assert.deepEqual(분석기.expBuffState.startEvidenceHistory, [], '골드 이전 시작 후보가 남았습니다.');
    assert.deepEqual(분석기.expBuffState.moveEvidenceHistory, [], '골드 이전 이동 후보가 남았습니다.');
    assert.equal(분석기.expBuffState.lastConfirmedAt, 0, '골드 이전 확인 시각이 남았습니다.');
    assert.deepEqual(분석기.expBuffState.detectedBuffNames, [], '골드 이전 감지 이름이 남았습니다.');
    return '거탐·야누스·골드의 이전 화면 공유 이력 제거 완료';
  });

  const 룬사진 = 사진목록(오탐그룹.룬, 4);
  const 거탐사진 = 사진목록(오탐그룹.거짓말탐지기, 4);
  const 야누스사진 = 사진목록(오탐그룹.야누스, 3);
  const 룬양성사진 = 사진목록(룬양성폴더, 5);
  const 실제거탐양성사진 = 코퍼스목록(
    이전양성기준폴더,
    실제거탐양성명세,
    17,
    '실제 거짓말탐지기 양성'
  );
  const 야누스양성홀드아웃사진 = 코퍼스목록(
    스크린샷코퍼스폴더,
    야누스양성홀드아웃명세,
    6,
    '야누스 양성 홀드아웃'
  );
  const 야누스종료위상사진 = 코퍼스목록(
    스크린샷코퍼스폴더,
    야누스종료위상명세,
    1,
    '야누스 종료 위상'
  );
  const 야누스음성사진 = 코퍼스목록(
    스크린샷코퍼스폴더,
    야누스음성명세,
    5,
    '야누스 음성'
  );
  const 골드양성사진 = 코퍼스목록(
    스크린샷코퍼스폴더,
    골드양성명세,
    5,
    '익스트림 골드 양성'
  );
  const 골드종료하드음성사진 = 코퍼스목록(
    스크린샷코퍼스폴더,
    골드종료하드음성명세,
    8,
    '익스트림 골드 종료 하드 음성'
  );
  const 버프공통하드음성사진 = [...new Set([
    ...룬사진,
    ...거탐사진,
    ...야누스사진,
    ...야누스음성사진,
    ...골드종료하드음성사진
  ])];
  assert.equal(버프공통하드음성사진.length, 24, '버프 공통 하드 음성 코퍼스 개수가 달라졌습니다.');
  // 룬 자료가 아닌 다른 기능의 전체 화면에서도 미니맵은 항상
  // 같은 운영 ROI로 스캔된다. 미니맵에 분홍 마름모 룬이 없는 것을
  // 육안으로 확인한 이벤트창·야누스 오탐·골드 화면만 교차 음성으로 쓴다.
  const 룬교차하드음성그룹 = [
    { 이름: '거탐 이벤트창 일반 화면', 사진: 거탐사진 },
    { 이름: '야누스 기타 스킬 일반 화면', 사진: 야누스사진 },
    { 이름: '익스트림 골드 일반 화면', 사진: 골드종료하드음성사진 }
  ];
  assert.equal(
    룬교차하드음성그룹.reduce((합계, 그룹) => 합계 + 그룹.사진.length, 0),
    15,
    '룬 교차 하드 음성 수가 달라졌습니다.'
  );
  const 양성프레임 = new Map();
  for (const 번호 of [1, 2, 3, 4, 5]) {
    양성프레임.set(번호, await 양성프레임읽기(번호));
  }

  const 거탐교차음성사진 = [...new Set([
    ...룬사진,
    ...룬양성사진,
    ...야누스사진,
    ...야누스양성홀드아웃사진,
    ...야누스종료위상사진,
    ...야누스음성사진,
    ...골드양성사진,
    ...골드종료하드음성사진
  ])];

  for (const [순번, 파일] of 룬사진.entries()) {
    await 검사(`룬 시작 음성 - 기존 오탐 ${순번 + 1}/4`, () => 룬오탐검사(파일));
  }
  for (const 그룹 of 룬교차하드음성그룹) {
    for (const [순번, 파일] of 그룹.사진.entries()) {
      await 검사(
        `룬 시작 음성 - ${그룹.이름} ${순번 + 1}/${그룹.사진.length}`,
        () => 룬오탐검사(파일)
      );
    }
  }
  for (const [순번, 파일] of 룬양성사진.entries()) {
    await 검사(`룬 시작 양성 ${순번 + 1}/5`, () => 룬시작양성검사(파일));
  }
  for (const [순번, 파일] of 거탐사진.entries()) {
    await 검사(`이벤트창 거탐 오탐 방지 ${순번 + 1}/4`, () => 거탐오탐검사(파일));
  }
  for (const [순번, 파일] of 실제거탐양성사진.entries()) {
    await 검사(`실제 거탐 양성 ${순번 + 1}/17`, () => 거탐양성검사(파일));
  }
  for (const [순번, 파일] of 거탐교차음성사진.entries()) {
    await 검사(
      `일반 사냥 화면 거탐 교차 오탐 방지 ${순번 + 1}/${거탐교차음성사진.length}`,
      () => 거탐오탐검사(파일)
    );
  }
  for (const [순번, 파일] of 야누스사진.entries()) {
    await 검사(`다른 스킬 야누스 오탐 방지 ${순번 + 1}/3`, () => 야누스오탐검사(파일));
  }
  for (const [순번, 파일] of 야누스양성홀드아웃사진.entries()) {
    await 검사(`야누스 양성 홀드아웃 ${순번 + 1}/6`, () => 야누스홀드아웃양성검사(파일));
  }
  for (const 파일 of 야누스종료위상사진) {
    await 검사('야누스 종료 위상 단독 오탐 방지', () => 야누스종료위상단독검사(파일));
  }
  for (const [순번, 파일] of 야누스음성사진.entries()) {
    await 검사(`야누스 음성 ${순번 + 1}/5`, () => 야누스음성검사(파일));
  }
  for (const [순번, 파일] of 골드양성사진.entries()) {
    await 검사(`익스트림 골드 양성 ${순번 + 1}/5`, () => 골드양성검사(파일));
  }
  for (const [순번, 파일] of 골드종료하드음성사진.entries()) {
    await 검사(
      `익스트림 골드 오탐 음성 ${순번 + 1}/8`,
      () => 골드오탐음성검사(파일)
    );
  }
  for (const [순번, 파일] of 버프공통하드음성사진.entries()) {
    await 검사(
      `일반 사냥 버프 공통 하드 음성 ${순번 + 1}/${버프공통하드음성사진.length}`,
      () => 버프공통하드음성검사(파일)
    );
  }

  await 검사('야누스 슬롯의 골드 교차 오탐 방지', async () => {
    let 확인 = 0;
    for (const 파일 of 야누스양성홀드아웃사진) {
      const 영상 = await 버프영상읽기(파일);
      const 분석기 = 새분석기();
      const 야누스 = 분석기.findBuffTemplateMatch(영상, 'janus', 1, null);
      assert.equal(야누스.found, true, `교차 검사용 야누스 슬롯을 찾지 못했습니다: ${파일}`);
      const 단독 = 아이콘단독영상(영상, 야누스);
      const 골드 = 분석기.findBuffTemplateMatch(단독, 'extremeGold', 3, null);
      assert.equal(
        골드.found,
        false,
        `야누스 아이콘 슬롯을 골드로도 판정했습니다: ${파일}, 점수 ${점수표시(골드.score)}`
      );
      for (let 프레임 = 0; 프레임 < 2; 프레임++) 분석기.processExpTemplateFrame(단독);
      assert.equal(분석기.expBuffState.isBuffActive, false, '야누스 슬롯 2프레임으로 골드 상태가 켜졌습니다.');
      확인++;
    }
    return `야누스 실제 슬롯 ${확인}개를 골드 템플릿·상태가 모두 거부`;
  });

  await 검사('골드 슬롯의 야누스 교차 오탐 방지', async () => {
    let 확인 = 0;
    for (const 파일 of 골드양성사진) {
      const 영상 = await 버프영상읽기(파일);
      const 분석기 = 새분석기();
      const 골드 = 분석기.findBuffTemplateMatch(영상, 'extremeGold', 3, null);
      assert.equal(골드.found, true, `교차 검사용 골드 슬롯을 찾지 못했습니다: ${파일}`);
      const 단독 = 아이콘단독영상(영상, 골드);
      const 야누스 = 분석기.findBuffTemplateMatch(단독, 'janus', 1, null);
      assert.equal(
        야누스.found,
        false,
        `골드 아이콘 슬롯을 야누스로도 판정했습니다: ${파일}, 점수 ${점수표시(야누스.score)}`
      );
      for (let 프레임 = 0; 프레임 < 2; 프레임++) 분석기.processJanusTemplateFrame(단독);
      assert.equal(분석기.janusState.isBuffActive, false, '골드 슬롯 2프레임으로 야누스 상태가 켜졌습니다.');
      확인++;
    }
    return `골드 실제 슬롯 ${확인}개를 야누스 템플릿·상태가 모두 거부`;
  });

  for (const [순번, 파일] of 룬양성사진.entries()) {
    await 검사(`실제 룬 양성 ${순번 + 1}/5`, async () => {
      const 영상 = await 이미지데이터읽기(파일, { roi: 룬ROI });
      const 분석기 = 새분석기();
      룬원시후보출력('실제 양성', 파일, 분석기, 영상);
      const 원래시각 = Date.now;
      let 가상시각 = 200000;
      try {
        Date.now = () => 가상시각;
        const 빈영상 = {
          width: 영상.width,
          height: 영상.height,
          data: new Uint8ClampedArray(영상.data.length)
        };
        // 실제 운용에서는 공유 후 룬이 새로 출현한다. 맵 구조 학습 프레임 뒤에
        // 양성 표본을 투입해 출현 이벤트와 중복 알림 억제를 함께 검증한다.
        for (let 프레임 = 0; 프레임 < 20; 프레임++) {
          분석기.processRuneFrame(빈영상, null);
          가상시각 += 150;
        }
        // 검은 준비 프레임과 실제 미니맵의 차이를 맵 이동으로 재학습하지 않도록,
        // 이 테스트에서는 현재 맵 기준만 양성 화면으로 맞춘다.
        분석기.runeState.mapReferenceData = new Uint8ClampedArray(영상.data);
        for (let 프레임 = 0; 프레임 < 10; 프레임++) {
          분석기.processRuneFrame(영상, null);
          가상시각 += 150;
        }
      } finally {
        Date.now = 원래시각;
      }
      assert.equal(범주알림('rune').length, 1, `실제 룬 알림이 ${범주알림('rune').length}회입니다.`);
      return `후보 ${분석기.runeState.lastCandidateCount}개, 알림 1회`;
    });
  }

  await 검사('야누스 실제 아이콘 둘째 줄 최초 탐색과 이동 복구', async () => {
    const 원본분석기 = 새분석기();
    const 원본영상 = 양성프레임.get(1);
    const 원본일치 = 원본분석기.findBuffTemplateMatch(원본영상, 'janus', 1, null);
    assert.equal(원본일치.found, true, '둘째 줄 합성 전 원본 야누스를 찾지 못했습니다.');
    const 목표Y = 원본일치.y + 원본일치.size + Math.ceil(원본일치.size * 0.2);
    assert.equal(목표Y > Math.max(14, Math.round(원본일치.size * 0.23)), true, '합성 위치가 둘째 줄 아래까지 이동하지 않았습니다.');
    const 이동영상 = 아이콘이동영상(원본영상, 원본일치, 목표Y);

    const 최초분석기 = 새분석기();
    const 시작 = process.hrtime.bigint();
    const 이동일치 = 최초분석기.findBuffTemplateMatch(이동영상, 'janus', 1, null);
    const 걸린밀리초 = Number(process.hrtime.bigint() - 시작) / 1e6;
    assert.equal(이동일치.found, true, '둘째 줄로 옮긴 실제 야누스를 최초 탐색하지 못했습니다.');
    assert.equal(Math.abs(이동일치.x - 원본일치.x) <= 4, true, '둘째 줄 야누스 X 위치가 목표에서 벗어났습니다.');
    assert.equal(Math.abs(이동일치.y - 목표Y) <= 4, true, '둘째 줄 야누스 Y 위치가 목표에서 벗어났습니다.');
    assert.equal(걸린밀리초 < 300, true, `둘째 줄 최초 탐색 ${걸린밀리초.toFixed(1)}ms가 300ms 예산을 넘었습니다.`);
    최초분석기.processJanusTemplateFrame(이동영상);
    최초분석기.processJanusTemplateFrame(이동영상);
    assert.equal(최초분석기.janusState.isBuffActive, true, '둘째 줄 양성 2프레임으로 야누스를 확정하지 못했습니다.');

    const 이동분석기 = 새분석기();
    이동분석기.processJanusTemplateFrame(원본영상);
    이동분석기.processJanusTemplateFrame(원본영상);
    assert.equal(이동분석기.janusState.isBuffActive, true, '이동 복구 검증 전 원래 슬롯을 확정하지 못했습니다.');
    이동분석기.processJanusTemplateFrame(이동영상);
    이동분석기.processJanusTemplateFrame(이동영상);
    const 복구 = 이동분석기.janusState.confirmedTemplateMatch;
    assert.equal(Math.abs(복구.y - 목표Y) <= 4, true, '활성 야누스의 둘째 줄 이동을 2프레임 안에 복구하지 못했습니다.');
    assert.equal(범주알림('janus').length, 0, '정상적인 둘째 줄 이동 중 종료 알림이 발생했습니다.');
    return `원본 y=${원본일치.y}, 둘째 줄 y=${이동일치.y}, 최초 ${걸린밀리초.toFixed(1)}ms`;
  });

  await 검사('야누스 56px 중간 배율과 JPEG 압축 여유', async () => {
    const 배율 = 56 / 44;
    const 영상56 = await 양성프레임읽기(1, {
      resize: {
        width: Math.round(양성절단.width * 배율),
        height: Math.round(양성절단.height * 배율)
      }
    });
    const 압축영상 = await JPEG재압축영상(영상56, 85);
    const 분석기 = 새분석기();
    const 일치 = 분석기.findBuffTemplateMatch(압축영상, 'janus', 1, null);
    assert.equal(일치.found, true, `56px JPEG 양성을 찾지 못했습니다. 점수 ${점수표시(일치.score)}`);
    assert.equal(일치.size, 56, `56px 양성을 ${일치.size}px 후보로 판정했습니다.`);
    const 예상X = Math.round(278 * 배율);
    const 예상Y = Math.round(3 * 배율);
    assert.equal(Math.abs(일치.x - 예상X) <= 일치.size * 0.15, true, '56px 야누스 X 위치가 예상 중심에서 벗어났습니다.');
    assert.equal(Math.abs(일치.y - 예상Y) <= 일치.size * 0.15, true, '56px 야누스 Y 위치가 예상 중심에서 벗어났습니다.');
    분석기.processJanusTemplateFrame(압축영상);
    분석기.processJanusTemplateFrame(압축영상);
    assert.equal(분석기.janusState.isBuffActive, true, '56px JPEG 양성 2프레임으로 야누스를 확정하지 못했습니다.');

    const 경계원본 = await 버프영상읽기(야누스양성홀드아웃사진[0]);
    const 경계압축 = await JPEG재압축영상(경계원본, 85);
    const 경계일치 = 새분석기().findBuffTemplateMatch(경계압축, 'janus', 1, null);
    assert.equal(경계일치.found, true, `20.43 경계 양성의 JPEG 재압축을 놓쳤습니다. 점수 ${점수표시(경계일치.score)}`);
    assert.equal(경계일치.score <= 21, true, `JPEG 경계 양성 점수 ${점수표시(경계일치.score)}가 제한을 넘었습니다.`);
    return `56px ${점수표시(일치.score)}/${일치.threshold}, 경계 JPEG ${점수표시(경계일치.score)}/${경계일치.threshold}`;
  });

  for (const 번호 of [1, 2, 3, 4]) {
    await 검사(`야누스 양성 단일 프레임 ${번호}/4`, async () => {
      const 분석기 = 새분석기();
      const 일치 = 분석기.findBuffTemplateMatch(양성프레임.get(번호), 'janus', 1, null);
      assert.equal(일치.found, true, `야누스를 찾지 못했습니다. 점수 ${점수표시(일치.score)}, 임계값 ${일치.threshold}`);
      return `점수 ${점수표시(일치.score)}/${일치.threshold}, 위치 ${일치.x},${일치.y}, 크기 ${일치.size}`;
    });

    await 검사(`익스트림 골드 양성 단일 프레임 ${번호}/4`, async () => {
      const 분석기 = 새분석기();
      const 일치 = 분석기.findBuffTemplateMatch(양성프레임.get(번호), 'extremeGold', 3, null);
      assert.equal(일치.found, true, `익스트림 골드를 찾지 못했습니다. 점수 ${점수표시(일치.score)}, 임계값 ${일치.threshold}`);
      return `점수 ${점수표시(일치.score)}/${일치.threshold}, 위치 ${일치.x},${일치.y}, 크기 ${일치.size}`;
    });
  }

  await 검사('야누스 양성 연속 상태 전이', async () => {
    const 분석기 = 새분석기();
    for (const 번호 of [1, 2, 3]) {
      분석기.processJanusTemplateFrame(양성프레임.get(번호));
    }
    assert.equal(분석기.janusState.isBuffActive, true, '3개 양성 프레임 뒤에도 야누스가 활성화되지 않았습니다.');
    assert.equal(분석기.janusState.consecutiveActiveCount >= 2, true, '야누스 연속 근거가 2회 미만입니다.');
    return `활성근거 ${분석기.janusState.consecutiveActiveCount}, 추적위치 ${분석기.janusState.confirmedTemplateMatch?.x},${분석기.janusState.confirmedTemplateMatch?.y}`;
  });

  await 검사('야누스 종료 위상 연속 상태 전이', async () => {
    const 분석기 = 새분석기();
    for (const 번호 of [1, 2, 3]) {
      분석기.processJanusTemplateFrame(양성프레임.get(번호));
    }
    for (let 프레임 = 0; 프레임 < 3; 프레임++) {
      분석기.processJanusTemplateFrame(양성프레임.get(5));
    }
    assert.equal(분석기.janusState.alert10Triggered, true, '알려진 종료 위상 3프레임 뒤에도 임박 상태가 확정되지 않았습니다.');
    assert.equal(범주알림('janus').length, 1, `야누스 종료 알림이 ${범주알림('janus').length}회입니다.`);
    return `종료근거 ${분석기.janusState.endingFrames}, 알림 ${범주알림('janus').length}회`;
  });

  await 검사('야누스 종료 위상 가림 뒤 완전 소멸 알림', async () => {
    const 분석기 = 새분석기();
    for (const 번호 of [1, 2, 3]) 분석기.processJanusTemplateFrame(양성프레임.get(번호));
    assert.equal(분석기.janusState.isBuffActive, true, '완전 소멸 검증 전 야누스가 활성화되지 않았습니다.');
    const 소멸영상 = 빈영상(양성프레임.get(3));
    for (let 프레임 = 0; 프레임 < 14; 프레임++) 분석기.processJanusTemplateFrame(소멸영상);
    assert.equal(분석기.janusState.isBuffActive, false, '완전 소멸 14프레임 뒤에도 야누스가 활성 상태입니다.');
    assert.equal(범주알림('janus').length, 1, `야누스 완전 소멸 알림이 ${범주알림('janus').length}회입니다.`);
    assert.equal(분석기.janusState.alertExpiredTriggered, true, '야누스 종료 알림 상태가 기록되지 않았습니다.');
    return '회색 종료 위상이 가려져도 완전 소멸 14회 확인 뒤 종료 알림 1회';
  });

  await 검사('익스트림 골드 양성 연속 상태 전이', async () => {
    const 분석기 = 새분석기();
    // 운영 기능은 현재 비활성화 상태이므로, 검출 알고리즘만 검증하도록 이 인스턴스에서 해제한다.
    분석기.expBuffState.disabled = false;
    for (const 번호 of [1, 2]) {
      분석기.processExpTemplateFrame(양성프레임.get(번호));
    }
    assert.equal(분석기.expBuffState.isBuffActive, true, '2개 양성 프레임 뒤에도 익스트림 골드가 활성화되지 않았습니다.');
    assert.equal(분석기.expBuffState.consecutiveActiveCount >= 2, true, '익스트림 골드 연속 근거가 2회 미만입니다.');
    return `활성근거 ${분석기.expBuffState.consecutiveActiveCount}, 추적위치 ${분석기.expBuffState.confirmedTemplateMatch?.x},${분석기.expBuffState.confirmedTemplateMatch?.y}`;
  });

  await 검사('익스트림 골드 실제 회색 종료 위상 상태 전이', async () => {
    const 활성영상 = 양성프레임.get(3);
    const 회색영상 = await 양성프레임읽기(238);
    const 소멸영상 = await 양성프레임읽기(240);
    const 분석기 = 새분석기();
    분석기.expBuffState.disabled = false;

    // 프레임 3의 숫자가 남은 금색 병은 종료 영상의 슬롯과 같은 3열에 있다.
    for (let 프레임 = 0; 프레임 < 2; 프레임++) 분석기.processExpTemplateFrame(활성영상);
    assert.equal(분석기.expBuffState.isBuffActive, true, '회색 종료 검증 전 골드 활성 슬롯을 확정하지 못했습니다.');
    const 추적 = 분석기.expBuffState.confirmedTemplateMatch;
    assert.ok(추적, '골드 확정 슬롯이 없습니다.');

    // 5초 간격 원본 영상의 프레임 238은 같은 슬롯에서 숫자와 금색이 사라진
    // 실제 회색 병 위상이다. 골드 운영 캡처는 약 600ms이므로 한 장을 3프레임
    // (첫 확인부터 셋째 확인까지 약 1.2초) 연속 상태로 재생해 조건을 검증한다.
    const 회색모양 = 분석기.measureBuffIconShape(회색영상, 추적.x, 추적.y, 추적.size);
    const scale = Math.pow(추적.size / 33, 2);
    assert.equal(
      회색모양.lowerLeftYellowPixels <= Math.max(2, Math.round(2 * scale)),
      true,
      '실제 회색 위상에 노란 타이머가 남아 있습니다.'
    );
    assert.equal(회색모양.grayBluePixels >= 70 * scale, true, '실제 회색 위상의 회청색 픽셀이 부족합니다.');
    assert.equal(회색모양.goldPixels <= 20 * scale, true, '실제 회색 위상에 금색 픽셀이 너무 많습니다.');
    for (let 프레임 = 0; 프레임 < 3; 프레임++) 분석기.processExpTemplateFrame(회색영상);
    assert.equal(분석기.expBuffState.alert10Triggered, true, '실제 회색 위상 3프레임 뒤 종료 임박이 확정되지 않았습니다.');
    assert.equal(범주알림('exp').length, 1, `골드 종료 임박 알림이 ${범주알림('exp').length}회입니다.`);

    // 완전 소멸 뒤에도 임박 알림은 한 번뿐이어야 한다.
    for (let 프레임 = 0; 프레임 < 14; 프레임++) 분석기.processExpTemplateFrame(소멸영상);
    assert.equal(분석기.expBuffState.isBuffActive, false, '완전 소멸 14프레임 뒤에도 골드가 활성 상태입니다.');
    assert.equal(범주알림('exp').length, 1, '완전 소멸 뒤 골드 알림이 중복 발생했습니다.');
    return `회색 timer ${회색모양.lowerLeftYellowPixels}, gray ${회색모양.grayBluePixels}, gold ${회색모양.goldPixels}, 알림 1회`;
  });

  await 검사('익스트림 골드 종료 위상 가림 뒤 완전 소멸 알림', async () => {
    const 분석기 = 새분석기();
    분석기.expBuffState.disabled = false;
    for (const 번호 of [1, 2]) 분석기.processExpTemplateFrame(양성프레임.get(번호));
    assert.equal(분석기.expBuffState.isBuffActive, true, '완전 소멸 검증 전 골드가 활성화되지 않았습니다.');
    const 소멸영상 = 빈영상(양성프레임.get(2));
    for (let 프레임 = 0; 프레임 < 14; 프레임++) 분석기.processExpTemplateFrame(소멸영상);
    assert.equal(분석기.expBuffState.isBuffActive, false, '완전 소멸 14프레임 뒤에도 골드가 활성 상태입니다.');
    assert.equal(범주알림('exp').length, 1, `골드 완전 소멸 알림이 ${범주알림('exp').length}회입니다.`);
    assert.equal(분석기.expBuffState.alertExpiredTriggered, true, '골드 종료 알림 상태가 기록되지 않았습니다.');
    return '회색 종료 위상이 가려져도 완전 소멸 14회 확인 뒤 종료 알림 1회';
  });

  const 통과 = 검사결과.filter((항목) => 항목.통과).length;
  const 실패 = 검사결과.length - 통과;
  const 총초 = 검사결과.reduce((합계, 항목) => 합계 + 항목.걸린초, 0);
  console.log('');
  console.log(`결과: ${통과}/${검사결과.length} 통과, ${실패} 실패, ${총초.toFixed(2)}초`);
  if (실패 > 0) {
    console.log('실패 목록:');
    검사결과.filter((항목) => !항목.통과).forEach((항목) => {
      console.log(`- ${항목.이름}: ${항목.오류}`);
    });
    process.exitCode = 1;
  }
}

실행().catch((error) => {
  console.error(`테스트 준비 실패: ${error.stack || error.message}`);
  process.exitCode = 1;
});
