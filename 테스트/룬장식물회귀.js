const assert = require('node:assert/strict');
const path = require('node:path');
const sharp = require(process.env.MAPLE_SHARP || 'sharp');
global.window = global;
global.addEventListener = () => {};
global.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
global.screenCaptureManager = { isStreaming: true };
let alerts = 0;
global.audioNotifier = { notify: () => alerts++ };
for (const name of ['imageAnalyzer', '검출정확도개선', '룬검출정확도']) require('../js/' + name + '.js');
async function read(name) {
  const file = path.join(__dirname, '자료/룬장식물_20260921', name);
  const m = await sharp(file).metadata();
  const {data, info} = await sharp(file).extract({ left: Math.round(m.width * .003), top: Math.round(m.height * .083), width: Math.round(m.width * .145), height: Math.round(m.height * .13) }).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  return {data: new Uint8ClampedArray(data), width: info.width, height: info.height};
}
(async () => {
  const frames = await Promise.all([1,2,3].map(i => read('오탐'+i+'.png')));
  const A = imageAnalyzer.constructor;
  const a = new A();
  for (const frame of frames) {
    assert.equal(a.findRuneDiamondCandidates(frame).some(c => c.centerX/frame.width > .65 && c.centerX/frame.width < .82), false, '오른쪽 장식물이 룬 후보로 남음');
  }
  const realNow = Date.now;
  let now = 10000;
  Date.now = () => now;
  try {
    for (let i=0;i<90;i++) { a.processRuneFrame(frames[i%3], null); now += 150; }
    assert.equal(alerts, 0, '배경 학습과 반복 프레임 중 오탐');
    const positive = await read('정상룬.jpg');
    const b = new A();
    const blank = {...positive, data: new Uint8ClampedArray(positive.data.length)};
    for(let i=0;i<30;i++){b.processRuneFrame(blank,null);now+=150;}
    b.runeState.mapReferenceData = new Uint8ClampedArray(positive.data);
    for(let i=0;i<10;i++){b.processRuneFrame(positive,null);now+=150;}
    assert.equal(alerts,1,'사용자가 확인한 실제 룬 알림 누락');
  } finally { Date.now=realNow; }
  console.log('통과: 장식물 3장 후보 제외, 90프레임 오탐 0회, 정상 룬 알림 1회');
})().catch(e=>{console.error(e);process.exitCode=1;});
