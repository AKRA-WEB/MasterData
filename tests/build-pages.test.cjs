'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {PUBLIC_FILES, buildPages} = require('../scripts/build-pages.cjs');
const root = path.resolve(__dirname, '..'), workspace = path.join(root, 'output');
function withFixture(body) {
  fs.mkdirSync(workspace, {recursive:true});
  const directory = fs.mkdtempSync(path.join(workspace, 'pages-fixture-'));
  try {
    for (const file of PUBLIC_FILES) { const target = path.join(directory, file); fs.mkdirSync(path.dirname(target), {recursive:true}); fs.copyFileSync(path.join(root, file), target); }
    body(directory);
  } finally {
    const resolved = fs.realpathSync(directory);
    if (path.dirname(resolved) !== fs.realpathSync(workspace) || !path.basename(resolved).startsWith('pages-fixture-')) throw new Error('Unsafe fixture cleanup');
    fs.rmSync(resolved, {recursive:true, force:true});
  }
}
function list(directory, prefix='') {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? list(path.join(directory, entry.name), prefix + entry.name + '/') : [prefix + entry.name]);
}
test('Pages build publishes exactly the nine app/library/license assets and removes stale output',()=>withFixture(directory=>{
  for (const file of ['preview/index.html','tests/private-fixture.json','README.md','raw.xlsx','output/evidence.json','server.cjs']) { const target=path.join(directory,file); fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'excluded'); }
  fs.mkdirSync(path.join(directory,'_site'),{recursive:true});fs.writeFileSync(path.join(directory,'_site','stale.xlsx'),'stale');
  const result=buildPages(directory);
  assert.deepEqual(list(result.destination).sort(),PUBLIC_FILES.slice().sort());assert.equal(result.files.length,9);
  for (const file of PUBLIC_FILES) assert.deepEqual(fs.readFileSync(path.join(result.destination,file)),fs.readFileSync(path.join(directory,file)));
  assert.equal(result.version,JSON.parse(fs.readFileSync(path.join(directory,'version.json'))).version);
}));
test('missing public asset fails before touching an existing artifact',()=>withFixture(directory=>{
  fs.mkdirSync(path.join(directory,'_site'));fs.writeFileSync(path.join(directory,'_site','sentinel'),'retain');fs.unlinkSync(path.join(directory,'assets/vendor/SHEETJS-LICENSE.txt'));
  assert.throws(()=>buildPages(directory));assert.equal(fs.readFileSync(path.join(directory,'_site','sentinel'),'utf8'),'retain');
}));
test('version mismatch fails before touching an existing artifact',()=>withFixture(directory=>{
  fs.mkdirSync(path.join(directory,'_site'));fs.writeFileSync(path.join(directory,'_site','sentinel'),'retain');fs.writeFileSync(path.join(directory,'version.json'),'{"version":"20000101.01"}');
  assert.throws(()=>buildPages(directory),/versions must match/);assert.equal(fs.readFileSync(path.join(directory,'_site','sentinel'),'utf8'),'retain');
}));
test('output file is rejected without deletion',()=>withFixture(directory=>{
  fs.writeFileSync(path.join(directory,'_site'),'retain');assert.throws(()=>buildPages(directory),/ordinary generated directory/);assert.equal(fs.readFileSync(path.join(directory,'_site'),'utf8'),'retain');
}));
