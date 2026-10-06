'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html','style.css','version.json','js/app.js','js/api.js','js/import-parser.js','js/akra-shell-bridge.js','assets/vendor/xlsx-0.20.3.full.min.js','assets/vendor/SHEETJS-LICENSE.txt']);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'};
const server = http.createServer((request, response) => {
  let route;
  try { route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html'; }
  catch (_) { response.writeHead(400); response.end(); return; }
  if (!files.has(route)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, {'Content-Type':types[path.extname(route)] || 'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(path.join(__dirname, route)).pipe(response);
});
server.listen(4331, '127.0.0.1', () => console.log('Master Data candidate: http://127.0.0.1:4331 (requires verified Main session and available API)'));
