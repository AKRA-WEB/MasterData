// Actual app render/load/navigation functions; API and DOM are isolated fixtures.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
function fixture(options={}){
 const nodes=new Map(),requests=[],events={},storage=new Map(),location={search:'?sso=fixture-token',hash:'',pathname:'/'};const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false,dataset:{},classList:{toggle(){}},setAttribute(){},replaceChildren(){this.innerHTML='';},addEventListener(){},focus(){},querySelectorAll:()=>[]});return nodes.get(id);};
 const c=vm.createContext({console,URLSearchParams,location,history:{replaceState(_state,_title,url){location.search=url.includes('?')?'?'+url.split('?')[1].split('#')[0]:'';}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},fetch:async()=>({ok:true,json:async()=>({version:source.match(/CURRENT_VERSION = '([^']+)'/)[1]})}),setTimeout:()=>0,clearTimeout(){},window:{AkraModule:{markSaved(){},markDirty(){},verifySession:options.verifySession,authRequired:options.authRequired,sessionStamp:()=>storage.get('main-stamp')||'',watchSession(){},stopWatchingSession(){}},addEventListener(){}},
  document:{getElementById:node,activeElement:{tagName:'BODY',closest:()=>null},querySelector:node,querySelectorAll:()=>[],body:{classList:{toggle(){}}},addEventListener:(name,fn)=>events[name]=fn},
  MasterDataAPI:{hasAdminRole:user=>user?.roles?.includes('ADMIN'),create:()=>({request:(action,data)=>new Promise((resolve,reject)=>requests.push({action,data,resolve,reject}))})}});
 // Suppress only startup authorization; expose lexical app functions in this isolated VM.
 const instrumented=source.replace(/  verifyAccess\(\);\s*\}\(\)\);\s*$/,"  globalThis.fixtureApp={state,verifyAccess,loadList,renderList,runNavigation,setSession:value=>session=value};\n}());");
 vm.runInContext(instrumented,c);c.fixtureApp.setSession({roles:['ADMIN'],perms:{'app-master-data':['viewMasterData']}});
 const reply=(index,records=[])=>requests[index].resolve({records,total:records.length,counts:{all:records.length,active:records.length,inactive:0}});
 return{app:c.fixtureApp,requests,reply,node,events,storage,location};
}
test('load failure renders only inline retry; retry success empty has the actual empty state',async()=>{
 const f=fixture();const pending=f.app.loadList();assert.match(f.node('record-list').innerHTML,/กำลังโหลดข้อมูล/);assert.doesNotMatch(f.node('record-list').innerHTML,/ยังไม่มีรายการ/);
 f.requests[0].reject(Object.assign(new Error('raw internal detail'),{status:500,code:'internal_error'}));await pending;
 assert.match(f.node('record-list').innerHTML,/ระบบขัดข้องชั่วคราว/);assert.match(f.node('record-list').innerHTML,/ลองอีกครั้ง/);assert.doesNotMatch(f.node('record-list').innerHTML,/ยังไม่มีรายการ|raw internal detail/);
 const retry=f.app.loadList();f.reply(1);await retry;assert.match(f.node('record-list').innerHTML,/ยังไม่มีรายการในสถานะนี้/);assert.doesNotMatch(f.node('record-list').innerHTML,/ระบบขัดข้อง/);
});
test('current session_changed read retires private state and clears the loading skeleton',async()=>{
 const f=fixture();const first=f.app.loadList();f.reply(0,[{id:'private',name:'ข้อมูลเดิม',active:true}]);await first;
 const read=f.app.loadList();f.requests[2].reject(Object.assign(new Error('session_changed'),{code:'session_changed'}));await read;
 assert.equal(f.app.state.loading,false);assert.equal(f.node('app-content').hidden,true);assert.equal(f.app.state.records.length,0);
 assert.doesNotMatch(f.node('record-list').innerHTML,/กำลังโหลดข้อมูล|ข้อมูลเดิม/);
});
test('startup failures use standard Thai copy, preserve explicit reason precedence, and never read domain data',async()=>{
 for(const [error,copy,retry] of [
  [Object.assign(new Error('invalid_or_expired_token'),{reason:'invalid_or_expired_token',status:403}),'เซสชันหมดอายุหรือเปลี่ยนแล้ว',false],
  [new Error('session_changed'),'เซสชันหมดอายุหรือเปลี่ยนแล้ว',false],
  [new TypeError('raw network exception'),'เชื่อมต่อไม่ได้',true],
  [Object.assign(new Error('raw internal detail'),{status:500}),'ระบบขัดข้องชั่วคราว',true],
  [Object.assign(new Error('raw permission detail'),{reason:'permission_denied',status:403}),'ไม่มีสิทธิ์ใช้ส่วนนี้',false],
  [Object.assign(new Error('raw permission detail'),{reason:'permission_denied',status:401}),'ไม่มีสิทธิ์ใช้ส่วนนี้',false],
  [Object.assign(new Error('raw unavailable detail'),{reason:'service_unavailable',status:403}),'ระบบขัดข้องชั่วคราว',true],
  [Object.assign(new Error('deadline'),{code:'session_verify_timeout'}),'เชื่อมต่อไม่ได้',true]
 ]){
  const f=fixture({verifySession:async()=>{throw error;}});await f.app.verifyAccess();
  assert.match(f.node('session-message').textContent,new RegExp(copy));assert.doesNotMatch(f.node('session-message').textContent,/raw |invalid_or_expired_token|session_changed/);
  assert.equal(f.node('auth-retry').hidden,!retry);assert.equal(f.requests.length,0);
 }
});
test('startup retry repeats verification and version/list reads without any write',async()=>{
 let attempts=0;const f=fixture({verifySession:async()=>{if(++attempts===1)throw new TypeError('offline');return{roles:['ADMIN'],perms:{'app-master-data':['viewMasterData']}};}});
 await f.app.verifyAccess();assert.equal(f.location.search,'');assert.equal(f.storage.has('akra_master_data_token'),false,'unverified SSO is never persisted');const retry=f.app.verifyAccess();await new Promise(setImmediate);assert.equal(attempts,2);assert.equal(f.requests.length,1);assert.equal(f.requests[0].action,'list');f.reply(0);await retry;assert.equal(f.node('app-content').hidden,false);
});
test('startup retry never reuses a transient SSO token after Main or stored-login replacement',async()=>{
 for(const change of ['main','stored']){
  const tokens=[];const f=fixture({verifySession:async(_app,token)=>{tokens.push(token);throw new TypeError('offline');}});await f.app.verifyAccess();
  if(change==='main')f.storage.set('main-stamp','replacement-login');else f.storage.set('akra_master_data_token','replacement-token');
  await f.app.verifyAccess();assert.deepEqual(tokens,change==='main'?['fixture-token']:['fixture-token','replacement-token']);assert.equal(f.requests.length,0);
 }
});
test('returning user retry keeps the incoming SSO ahead of the unchanged saved module token until verification',async()=>{
 const tokens=[];let verified;
 const f=fixture({verifySession:async(_app,token)=>{tokens.push(token);if(tokens.length===1)throw new TypeError('offline');return new Promise(resolve=>verified=resolve);}});
 f.storage.set('akra_master_data_token','saved-token-A');f.storage.set('main-stamp','unchanged-main-session');f.location.search='?sso=incoming-token-B';
 await f.app.verifyAccess();assert.equal(f.location.search,'');assert.equal(f.storage.get('akra_master_data_token'),'saved-token-A');assert.equal(f.requests.length,0);
 const retry=f.app.verifyAccess();assert.deepEqual(tokens,['incoming-token-B','incoming-token-B']);assert.equal(f.requests.length,0,'no domain read before authoritative verification');assert.equal(f.storage.get('akra_master_data_token'),'saved-token-A','unverified incoming SSO is never persisted');
 verified({roles:['ADMIN'],perms:{'app-master-data':['viewMasterData']}});await new Promise(setImmediate);assert.equal(f.requests.length,1);assert.equal(f.requests[0].action,'list');f.reply(0);await retry;assert.equal(f.storage.get('akra_master_data_token'),'incoming-token-B');
});
test('failed reload retains last records without claiming empty; newer read fences late success/failure',async()=>{
 const f=fixture();const first=f.app.loadList();f.reply(0,[{id:'one',code:'001',name:'สินค้าเดิม',active:true}]);await first;
 const reload=f.app.loadList();f.requests[2].reject(Object.assign(new Error('offline'),{code:'network_error'}));await reload;
 assert.equal(f.app.state.records[0].id,'one');assert.match(f.node('record-list').innerHTML,/เชื่อมต่อไม่ได้/);assert.doesNotMatch(f.node('record-list').innerHTML,/ยังไม่มีรายการ/);
 assert.match(f.node('record-list').innerHTML,/<table/,'a failed reload keeps the actual prior table visible');
 assert.match(f.node('record-list').innerHTML,/สินค้าเดิม/,'retained records are rendered beneath the retry notice');
 const older=f.app.loadList(),newer=f.app.loadList();f.reply(4,[{id:'new',code:'002',name:'ใหม่',active:true}]);await newer;f.reply(3,[{id:'old',name:'เก่า'}]);await older;
 assert.equal(f.app.state.records[0].id,'new');assert.doesNotMatch(f.node('record-list').innerHTML,/เชื่อมต่อไม่ได้/);
});
test('search has no-match only after success; permission failure offers home instead of read retry',async()=>{
 const f=fixture();f.app.state.search='ไม่มี';const read=f.app.loadList();f.reply(0);await read;assert.match(f.node('record-list').innerHTML,/ไม่พบรายการที่ตรงกัน/);
 const denied=f.app.loadList();f.requests[1].reject(Object.assign(new Error('permission_denied'),{code:'permission_denied',status:403}));await denied;
 assert.match(f.node('record-list').innerHTML,/ไม่มีสิทธิ์ใช้ส่วนนี้/);assert.match(f.node('record-list').innerHTML,/data-action="home"/);assert.doesNotMatch(f.node('record-list').innerHTML,/ไม่พบรายการที่ตรงกัน/);
});
test('permission denial does not expose retained table rows through the recovery notice',async()=>{
 const f=fixture();const first=f.app.loadList();f.reply(0,[{id:'private',name:'ข้อมูลเดิม',active:true}]);await first;
 const denied=f.app.loadList();f.requests[2].reject(Object.assign(new Error('permission_denied'),{code:'permission_denied',status:403}));await denied;
 assert.match(f.node('record-list').innerHTML,/data-action="home"/);assert.doesNotMatch(f.node('record-list').innerHTML,/<table|ข้อมูลเดิม/);
});
test('new success also fences a late failure and retains readable conflict/rate-limit wording',async()=>{
 const f=fixture();const older=f.app.loadList(),newer=f.app.loadList();f.reply(1,[{id:'new',name:'รายการใหม่',active:true}]);await newer;f.requests[0].reject(Object.assign(new Error('offline'),{code:'network_error'}));await older;
 assert.equal(f.app.state.records[0].id,'new');assert.doesNotMatch(f.node('record-list').innerHTML,/เชื่อมต่อไม่ได้/);
 const conflict=f.app.loadList();f.requests[3].reject(Object.assign(new Error('รายการนี้มีการแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก'),{code:'stale_record',status:409}));await conflict;assert.match(f.node('record-list').innerHTML,/รายการนี้มีการแก้ไขแล้ว/);assert.doesNotMatch(f.node('record-list').innerHTML,/ระบบขัดข้องชั่วคราว/);
 const limit=f.app.loadList();f.requests[4].reject(Object.assign(new Error('raw rate detail'),{code:'rate_limited',status:429}));await limit;assert.match(f.node('record-list').innerHTML,/มีคำขอจำนวนมาก/);assert.doesNotMatch(f.node('record-list').innerHTML,/raw rate detail|ระบบขัดข้องชั่วคราว/);
});
