'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {inspectPublicFiles, PUBLIC_FILES} = require('../scripts/build-pages.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts/check.cjs'), 'utf8');

function check(files) {
  const messages = [];
  vm.runInNewContext(source, {
    __dirname: path.join(root, 'scripts'),
    require(name) {
      if (name === './build-pages.cjs') return {PUBLIC_FILES, inspectPublicFiles: () => ({files, version: '20261013.03'})};
      if (name === 'node:vm') return vm;
      if (name === 'node:path') return path;
      throw new Error('Unexpected checker dependency: ' + name);
    },
    console: {log: message => messages.push(message)}
  }, {filename: 'scripts/check.cjs'});
  return messages;
}
const fixture = html => [{file: 'index.html', bytes: Buffer.from(html)}, {file: 'js/app.js', bytes: Buffer.from('const fixture = true;')}];

test('current published assets compile and their cache-stamped references pass the checker', () => {
  const {files} = inspectPublicFiles(root);
  assert.match(check(files)[0], /Public JavaScript compilation, asset references and version parity passed/);
});

test('plain, query-stamped and fragment references retain the exact allowlisted pathname', () => {
  for (const reference of ['style.css', 'style.css?v=20261013.02', 'js/app.js?v=20261013.03', 'js/api.js?cache=fixture#module', 'js/import-parser.js#module']) {
    assert.equal(check(fixture(`<script src="${reference}"></script>`)).length, 1, reference);
    assert.equal(check(fixture(`<link href="${reference}" rel="preload">`)).length, 1, reference);
  }
});

test('query strings do not let external, traversal or unpublished paths pass', () => {
  for (const reference of [
    'https://example.invalid/style.css?v=20261013.02', '//example.invalid/js/app.js?v=20261013.03',
    '/style.css?v=20261013.02', '../style.css?v=20261013.02', './style.css?v=20261013.02',
    'js/../style.css?v=20261013.02', 'js/../../style.css?v=20261013.02',
    '%2e%2e/style.css?v=20261013.02', 'js%2fapp.js?v=20261013.03',
    'style.css%3fv=20261013.02', 'style.css\\other?v=20261013.02',
    'private.json?v=20261013.03', 'js/unknown.js?asset=style.css', '?asset=style.css', '#style.css'
  ]) {
    assert.throws(() => check(fixture(`<script src="${reference}"></script>`)), /outside the published allowlist/, reference);
    assert.throws(() => check(fixture(`<link href="${reference}" rel="stylesheet">`)), /outside the published allowlist/, reference);
  }
});

test('the checker still rejects invalid JavaScript before reporting success', () => {
  const files = fixture('<script src="js/app.js?v=20261013.03"></script>');
  files[1].bytes = Buffer.from('const = invalid');
  assert.throws(() => check(files), /Unexpected token/);
});
