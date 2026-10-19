const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

function fixture(dataset, rows, options = {}) {
  const nodes = new Map(), requests = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {innerHTML:'', addEventListener(){}, focus(){}});
    return nodes.get(id);
  };
  const context = vm.createContext({
    URLSearchParams, location:{search:'', hash:''}, localStorage:{getItem(){return null;}},
    window:{AkraModule:{markSaved(){}, markDirty(){}}, addEventListener(){}},
    document:{getElementById:node, addEventListener(){}, body:{classList:{toggle(){}}}},
    MasterDataAPI:{hasAdminRole:require('../js/api.js').hasAdminRole, create:() => ({request:async (action, data) => {
      requests.push({action, data});
      return {added:1, changed:1, unchanged:1, skipped:1};
    }})}
  });
  // Exercise the actual renderer/confirmation, replacing only startup and external boundaries.
  const instrumented = source.replace(/  verifyAccess\(\);\s*\}\(\)\);\s*$/,
    '  globalThis.app={state,renderImport,applyImport,setSession:value=>session=value};\n}());');
  vm.runInContext(instrumented, context);
  const app = context.app;
  app.setSession({roles:['ADMIN'], perms:{'app-master-data':['viewMasterData',
    ...Object.values({products:['manageProducts','importProducts'], vendors:['manageVendors','importVendors'], members:['manageMembers','importMembers']}).flat()]}});
  const summary = rows.reduce((counts, row) => { counts[row.type]++; return counts; }, {new:0, changed:0, unchanged:0, error:0});
  app.state.view = 'import';
  app.state.import = {dataset, step:3, notes:{}, bindings:{}, skipErrors:false,
    review:{reviewId:'fictional-review', expiresAt:new Date(Date.now()+60000).toISOString(), summary, rows}, ...options};
  return {app, requests, html:() => { app.renderImport(); return node('import-view').innerHTML; }};
}

function row(type, number, extra = {}) {
  return {row:number, type, code:'000'+number, name:'Fictional '+type, changes:[], ...extra};
}

test('all datasets omit unchanged details while retaining original rows, summary and old/new values', () => {
  for (const dataset of ['products','vendors','members']) {
    const rows = [row('new',2), row('changed',4,{changes:[{key:'name',oldValue:'Old <name>',newValue:'New & name'}]}), row('unchanged',7), row('error',9,{errors:['missing_code']})];
    const f = fixture(dataset, rows), before = JSON.stringify(f.app.state.import.review), html = f.html();
    assert.doesNotMatch(html, /data-import-type="unchanged"|Fictional unchanged/);
    for (const [type, number] of [['new',2],['changed',4],['error',9]]) assert.ok(html.includes(`data-import-row="${number}" data-import-type="${type}"`));
    assert.match(html, /Old &lt;name&gt;/); assert.match(html, /New &amp; name/);
    assert.match(html, /<strong>1<\/strong> ไม่เปลี่ยนแปลง/);
    assert.equal(JSON.stringify(f.app.state.import.review), before);
    assert.match(html, /data-action="apply-import" disabled/);
  }
});

test('all-unchanged review hides empty comparison table and cannot confirm', async () => {
  const f = fixture('products', [row('unchanged',2),row('unchanged',3)]), html = f.html();
  assert.doesNotMatch(html, /data-import-row=/);
  assert.match(html, /class="review-scroll" hidden/);
  assert.match(html, /ไม่มีรายการใหม่หรือการเปลี่ยนแปลงที่พร้อมบันทึก/);
  assert.match(html, /data-action="apply-import" disabled/);
  await f.app.applyImport(); assert.equal(f.requests.length,0);
});

test('Vendor binding errors stay visible even with no importable changes', () => {
  const f = fixture('vendors', [row('unchanged',2),row('error',5,{candidate:{id:'fictional-vendor',name:'Vendor เดิม'},errors:['vendor_code_unassigned']})]);
  const html = f.html();
  assert.match(html, /data-action="bind-vendor"/); assert.match(html, /data-action="bind-all"/);
  assert.doesNotMatch(html, /class="review-scroll" hidden/);
  assert.match(html, /id="skip-import-errors"/); assert.match(html, /data-action="apply-import" disabled/);
});

test('filtering preserves confirmation count, review ID, skip flag and full review rows', async () => {
  const rows = [row('new',2),row('changed',3),row('unchanged',4),row('error',5)];
  const f = fixture('members', rows, {skipErrors:true}), html = f.html();
  assert.match(html, /ยืนยันบันทึก 2 รายการ/);
  assert.doesNotMatch(html, /data-action="apply-import" disabled/);
  await f.app.applyImport();
  assert.deepEqual(JSON.parse(JSON.stringify(f.requests)), [{action:'commitImport',data:{dataset:'members',reviewId:'fictional-review',skipErrors:true}}]);
  assert.equal(f.app.state.import.review.rows.length,4);
});

test('expired review and missing import permission still disable confirmation', () => {
  const expired = fixture('products',[row('new',2)]);
  expired.app.state.import.review.expiresAt = new Date(Date.now()-1000).toISOString();
  assert.match(expired.html(), /data-action="apply-import" disabled/);
  const denied = fixture('products',[row('new',2)]);
  denied.app.setSession({roles:['ADMIN'],perms:{'app-master-data':['viewMasterData']}});
  assert.match(denied.html(), /data-action="apply-import" disabled/);
});
