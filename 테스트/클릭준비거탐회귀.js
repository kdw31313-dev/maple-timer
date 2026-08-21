const assert = require('node:assert/strict');
const path = require('node:path');

global.window = global;
global.addEventListener = () => {};
global.document = {
  getElementById() { return { checked: true }; },
  createElement() { return { width: 0, height: 0, getContext() { return {}; } }; }
};
global.audioNotifier = { notify() {} };

const 프로젝트 = path.resolve(__dirname, '..');
[
  'js/거탐인식기기준.js',
  'js/imageAnalyzer.js',
  'js/검출정확도개선.js',
  'js/거탐검출정확도.js'
].forEach((파일) => require(path.join(프로젝트, 파일)));

const 색프로필 = [[[95,120,153],[95,111,142],[79,76,114],[111,97,111],[101,83,122],[73,76,119],[76,95,138],[94,102,130]],[[71,100,134],[74,80,108],[92,80,113],[119,93,106],[121,84,119],[115,81,126],[90,74,120],[74,74,108]],[[87,102,124],[81,76,101],[111,91,100],[122,95,103],[129,93,107],[134,88,119],[112,75,127],[50,44,84]],[[97,103,122],[81,77,95],[102,85,95],[107,89,99],[109,82,105],[118,80,118],[112,72,122],[72,61,83]],[[104,97,136],[87,86,94],[121,104,81],[120,101,90],[132,113,109],[122,89,109],[111,73,121],[97,87,107]],[[107,88,151],[93,90,97],[114,100,82],[117,95,91],[127,101,96],[128,94,105],[113,84,124],[82,89,104]],[[132,94,153],[116,94,124],[106,95,94],[106,88,93],[112,92,103],[123,95,116],[130,118,154],[118,123,152]],[[145,113,111],[172,151,121],[181,157,114],[163,123,106],[160,129,103],[162,141,115],[178,150,132],[172,146,111]]];

const 새화면 = () => {
  const width = 240;
  const height = 135;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < data.length; pixel += 4) {
    data[pixel] = 38;
    data[pixel + 1] = 68;
    data[pixel + 2] = 92;
    data[pixel + 3] = 255;
  }
  return { data, width, height };
};

const 픽셀 = (화면, x, y, color) => {
  const position = (y * 화면.width + x) * 4;
  화면.data[position] = color[0];
  화면.data[position + 1] = color[1];
  화면.data[position + 2] = color[2];
};

const 패널그리기 = (화면, 시작X, 시작Y, width = 26, height = 30) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gridX = Math.min(7, Math.floor(x * 8 / width));
      const gridY = Math.min(7, Math.floor(y * 8 / height));
      픽셀(화면, 시작X + x, 시작Y + y, 색프로필[gridY][gridX]);
    }
  }
  const 노랑 = [218, 174, 70];
  [3, 9, 15, 21, 27].forEach((y, index) => {
    const inset = index === 0 ? 8 : (index === 4 ? 2 : 4);
    for (let x = inset; x < width - inset; x++) {
      픽셀(화면, 시작X + x, 시작Y + y, 노랑);
      if (y + 1 < height) 픽셀(화면, 시작X + x, 시작Y + y + 1, 노랑);
    }
  });
};

const 몬스터윤곽그리기 = (화면, 시작X, 시작Y, width = 26, height = 30) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gridX = Math.min(7, Math.floor(x * 8 / width));
      const gridY = Math.min(7, Math.floor(y * 8 / height));
      픽셀(화면, 시작X + x, 시작Y + y, 색프로필[gridY][gridX]);
    }
  }
  const 노랑 = [218, 174, 70];
  [3, 9, 15, 21, 27].forEach((y, index) => {
    const start = 4 + index;
    for (let x = start; x < start + 7; x++) 픽셀(화면, 시작X + x, 시작Y + y, 노랑);
  });
};

const 분석기 = new global.imageAnalyzer.constructor();
const 일반화면 = 새화면();
const 일반판정 = 분석기.verifyPopupTemplateMatch(
  일반화면,
  분석기.findPopupTemplateMatch(일반화면)
);
assert.equal(Boolean(일반판정.verified), false, '일반 배경을 클릭 준비 거탐으로 잡으면 안 됩니다.');

const 거탐화면 = 새화면();
패널그리기(거탐화면, 171, 48);
const 거탐판정 = 분석기.verifyPopupTemplateMatch(
  거탐화면,
  분석기.findPopupTemplateMatch(거탐화면)
);
if (/^(1|true|yes|on)$/i.test(process.env.MAPLE_TEST_DIAGNOSTIC || '')) {
  console.log(JSON.stringify(거탐판정.structure || null, null, 2));
}
assert.equal(Boolean(거탐판정.verified), true, '임의 위치의 클릭 준비 패널을 감지해야 합니다.');
assert.equal(거탐판정.detectedType, '클릭 준비형 거짓말 탐지기');
assert.equal(거탐판정.structuralEvidence, 'click-instruction-panel');

const 몬스터화면 = 새화면();
몬스터윤곽그리기(몬스터화면, 96, 54);
const 몬스터판정 = 분석기.verifyPopupTemplateMatch(
  몬스터화면,
  분석기.findPopupTemplateMatch(몬스터화면)
);
assert.equal(
  Boolean(몬스터판정.verified),
  false,
  '성긴 노란 몬스터 윤곽을 클릭 준비 거탐으로 잡으면 안 됩니다.'
);

console.log('✅ 클릭 준비 거탐 회귀 통과: 임의 위치 양성, 일반 배경·몬스터 윤곽 음성');
