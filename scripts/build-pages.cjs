'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const PUBLIC_FILES = Object.freeze([
  'index.html', 'style.css', 'version.json', 'js/app.js', 'js/api.js',
  'js/import-parser.js', 'js/akra-shell-bridge.js',
  'assets/vendor/xlsx-0.20.3.full.min.js', 'assets/vendor/SHEETJS-LICENSE.txt'
]);
function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}
function inspectPublicFiles(directory) {
  const root = fs.realpathSync(directory);
  const files = PUBLIC_FILES.map(file => {
    const source = path.join(root, file);
    if (!fs.lstatSync(source).isFile() || !inside(root, fs.realpathSync(source))) throw new Error('Public asset must be a regular in-repository file: ' + file);
    const bytes = fs.readFileSync(source);
    return {file, bytes, sha256:createHash('sha256').update(bytes).digest('hex')};
  });
  const version = JSON.parse(files.find(item => item.file === 'version.json').bytes).version;
  const appVersion = files.find(item => item.file === 'js/app.js').bytes.toString().match(/const CURRENT_VERSION = '([^']+)'/);
  if (!/^\d{8}\.\d{2}$/.test(version) || appVersion?.[1] !== version) throw new Error('Application and version.json versions must match');
  return {root, files, version};
}
function buildPages(directory = path.resolve(__dirname, '..')) {
  const {root, files, version} = inspectPublicFiles(directory);
  const destination = path.join(root, '_site');
  // Only this exact generated subtree is removed. Refuse linked output paths.
  if (!inside(root, destination) || path.dirname(destination) !== root || path.basename(destination) !== '_site') throw new Error('Unsafe Pages output path');
  if (fs.existsSync(destination) && (!fs.lstatSync(destination).isDirectory() || fs.lstatSync(destination).isSymbolicLink() || fs.realpathSync(destination) !== destination)) throw new Error('Pages output must be an ordinary generated directory');
  fs.rmSync(destination, {recursive:true, force:true});
  for (const item of files) {
    const target = path.join(destination, item.file);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, item.bytes);
  }
  return {version, destination, files:files.map(({file, bytes, sha256}) => ({file, bytes:bytes.length, sha256}))};
}
if (require.main === module) console.log(JSON.stringify(buildPages(), null, 2));
module.exports = {PUBLIC_FILES, inspectPublicFiles, buildPages};
