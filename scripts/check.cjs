'use strict';
const vm = require('node:vm');
const {inspectPublicFiles, PUBLIC_FILES} = require('./build-pages.cjs');
const {files, version} = inspectPublicFiles(require('node:path').resolve(__dirname, '..'));
for (const item of files.filter(item => item.file.endsWith('.js'))) new vm.Script(item.bytes.toString(), {filename:item.file});
const html = files.find(item => item.file === 'index.html').bytes.toString();
for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
  // Keep the path literal: only cache queries/fragments are excluded from the file allowlist.
  const assetPath = match[1].split(/[?#]/, 1)[0];
  if (!PUBLIC_FILES.includes(assetPath)) throw new Error('HTML references an asset outside the published allowlist: ' + match[1]);
}
console.log('Public JavaScript compilation, asset references and version parity passed: ' + version);
