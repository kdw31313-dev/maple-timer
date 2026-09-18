#!/usr/bin/env node
'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
global.window = global;
global.addEventListener = () => {};
global.document = { getElementById: () => ({ checked: true }), createElement: () => ({ getContext: () => ({}) }) };
global.screenCaptureManager = { isStreaming: true };
const alerts = [];
global.audioNotifier = { notify: (message, category) => alerts.push({ message, category }) };
const root = process.env.MAPLE_ANALYZER_ROOT || path.resolve(__dirname, '..');
for (const name of ['거탐인식기기준', 'imageAnalyzer', '검출정확도개선', '룬검출정확도', '거탐검출정확도']) require(path.join(root, 'js', name + '.js'));
const Analyzer = imageAnalyzer.constructor;
function decode(file, filter, width, height) {
  const result = spawnSync(process.env.MAPLE_FFMPEG || 'ffmpeg', ['-v', 'error', '-i', file, '-vf', filter, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0 || result.stdout.length !== width * height * 4) throw new Error(result.stderr?.toString() || 'decode failed');
  return { width, height, data: new Uint8ClampedArray(result.stdout) };
}
module.exports = { Analyzer, decode, alerts };
if (require.main === module) for (const file of process.argv.slice(2)) {
  const popup = decode(file, 'scale=240:135:flags=area', 240, 135);
  console.log(JSON.stringify({ file: path.basename(file), popup: new Analyzer().findPopupUniqueStructureEvidence(popup) }));
  for (const scale of [1, 1.5, 2]) {
    const width = Math.round(178 * scale), height = Math.round(72 * scale);
    const roi = decode(file, `crop=178:72:0:65,scale=${width}:${height}:flags=bilinear`, width, height);
    const analyzer = new Analyzer();
    const candidates = analyzer.findRuneDiamondCandidates(roi);
    console.log(JSON.stringify({ file: path.basename(file), scale, candidates: candidates.filter(c => c.centerY > height * .1 && c.centerY < height * .84).map(c => {
      const bands = [[], [], []];
      for (let y = Math.max(0, c.y); y < Math.min(height, c.y + c.height); y++) for (let x = Math.max(0, c.x); x < Math.min(width, c.x + c.width); x++) {
        const d = Math.abs(x - c.centerX) / (c.width / 2) + Math.abs(y - c.centerY) / (c.height / 2);
        if (d > 1) continue;
        const p = (y * width + x) * 4;
        bands[d < .35 ? 0 : d < .7 ? 1 : 2].push((roi.data[p] + roi.data[p+2]) / 2);
      }
      return { ...c, bands: bands.map(a=>a.reduce((s,v)=>s+v,0)/a.length), startup: analyzer.isConservativeStartupRuneCandidate(c, roi) };
    }) }));
  }
}
