'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { assetPath } = require('./mirror-cache.cjs');
const project = path.resolve(__dirname, '..');
const source = path.join(project, 'local-cache'), dest = path.join(project, 'precise', 'runtime');
const roots = 'assets|models|vendor|sounds|fonts|skill-icons|buff-icons|images|videos|guide-videos|icons';
const rootFiles = 'favicon[^/]*\\.png|favicon\\.ico|apple-touch-icon\\.png|build-info\\.json|release-notes\\.json';
const literal = new RegExp('(["\\x27\\x60(])/(?=(?:' + roots + ')/|(?:' + rootFiles + ')(?:[?"\\x27\\x60)]))','g');
async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
  let count = 0;
  for (const [name, record] of Object.entries(manifest.assets)) {
    if (assetPath(encodeURI(name)) !== name) throw Error('Invalid asset path');
    const original = await fs.readFile(path.join(source, name.slice(1)));
    if (original.length !== record.bytes || crypto.createHash('sha256').update(original).digest('hex') !== record.sha256) throw Error('Cache hash mismatch: ' + name);
    const file = path.join(dest, name.slice(1));
    const body = /\.(js|css)$/.test(name) ? original.toString('utf8').replace(literal, '$1/maple-timer/precise/runtime/') : original;
    await fs.mkdir(path.dirname(file), {recursive:true});
    await fs.writeFile(file, body);
    count++;
  }
  console.log('Pages runtime: ' + count + ' verified assets');
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
