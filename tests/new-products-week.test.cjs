const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const window={startAt:'2026-11-15T17:00:00Z',endAt:'2026-11-22T17:00:00Z',asOf:'2026-11-22T10:00:00Z',timezone:'Asia/Bangkok'};
const row={id:'new',code:'N001',name:'สินค้าใหม่ <b>',subname:'แพ็ค',active:true,createdAt:'2026-11-20T17:01:00Z'};
function fixture(){
 const nodes=new Map(),requests=[],events={};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false,dataset:{},classList:{toggle(){}},setAttribute(){},replaceChildren(){this.innerHTML='';},addEventListener(){},focus(){},querySelectorAll:()=>[]});return nodes.get(id);};
 const c=vm.createContext({console,URLSearchParams,location:{hash:'',search:'',pathname:'/'},history:{replaceState(){}},setTimeout:()=>0,clearTimeout(){},window:{AkraModule:{markSaved(){},markDirty(){},stopWatchingSession(){}},addEventListener(){}},
  document:{getElementById:node,activeElement:{tagName:'BODY',closest:()=>null},querySelector:node,querySelectorAll:()=>[],body:{classList:{toggle(){}}},addEventListener:(name,fn)=>events[name]=fn},
  MasterDataAPI:{hasAdminRole:user=>user?.roles?.includes('ADMIN'),create:()=>({request:(action,data)=> action==='history'?Promise.resolve({history:[]}):new Promise((resolve,reject)=>requests.push({action,data,resolve,reject}))})}});
 vm.runInContext(source.replace(/  verifyAccess\(\);\s*\}\(\)\);\s*$/, "  globalThis.app={state,loadList,render,renderDetail,runNavigation,invalidate,setSession:value=>session=value};\n}());"),c);
 c.app.setSession({roles:['ADMIN'],perms:{'app-master-data':['viewMasterData','manageProducts']}});
 const reply=(index,records=[],scoped=false)=>requests[index].resolve({records,total:records.length,counts:{all:999,active:900,inactive:99},...(scoped?{creationWindow:window}:{})});
 const toggle=checked=>events.change({target:{id:'created-this-week',checked,dataset:{}}});
 return{app:c.app,node,requests,reply,toggle,events};
}
const settle=()=>new Promise(setImmediate);

test('filter is opt-in, resets page/selection and renders server dates in Bangkok under escaped names',async()=>{
 const f=fixture();let pending=f.app.loadList();assert(!('createdThisWeek' in f.requests[0].data));f.reply(0,[row]);await pending;
 f.app.state.offset=300;f.app.state.selected='old';await f.toggle(true);
 assert.equal(f.requests[1].data.createdThisWeek,true);assert.equal(f.requests[1].data.offset,0);assert.equal(f.app.state.records.length,0);
 f.reply(1,[row],true);await settle();
 assert.equal(f.app.state.selected,'new');assert.match(f.node('record-list').innerHTML,/เพิ่มเข้าระบบ 21 พ.ย. 2569/);
 assert.match(f.node('record-list').innerHTML,/สินค้าใหม่ &lt;b&gt;/);assert.doesNotMatch(f.node('record-list').innerHTML,/สินค้าใหม่ <b>/);
 assert.match(f.node('creation-window').textContent,/16 พ.ย. 2569 – 22 พ.ย. 2569/);
 assert.match(f.node('source-caption').textContent,/ไม่นับการแก้ไข/);assert(!('createdAt' in (f.app.state.draft||{})));
 f.app.state.mode='edit';f.app.state.draft={};f.app.renderDetail();assert.equal(f.node('created-this-week').disabled,true);
});

test('legacy or malformed server result fails closed after scope switch, then scoped retry succeeds empty',async()=>{
 const f=fixture();let pending=f.app.loadList();f.reply(0,[{id:'old',name:'สินค้าที่แก้ไข',active:true}]);await pending;
 await f.toggle(true);f.reply(1,[row]);await settle();
 assert.match(f.node('record-list').innerHTML,/ยังโหลดสินค้าเพิ่มใหม่ไม่ได้/);assert.doesNotMatch(f.node('record-list').innerHTML,/สินค้าที่แก้ไข|<table/);
 pending=f.app.loadList();f.reply(2,[],true);await pending;
 assert.match(f.node('record-list').innerHTML,/ไม่มีสินค้าเพิ่มใหม่สัปดาห์นี้ที่ตรงกับตัวกรอง/);
 const reset={dataset:{action:'reset-search'},closest(){return this;}};
 f.events.click({target:reset});assert.equal(f.app.state.createdThisWeek,false);assert(!('createdThisWeek' in f.requests[3].data));
 f.reply(3,[row]);await settle();assert.doesNotMatch(f.node('record-list').innerHTML,/record-added-date/);
});

test('rapid toggle fences late normal/scoped responses; dataset/import/invalidation reset filter',async()=>{
 const f=fixture();const older=f.app.loadList();await f.toggle(true);await f.toggle(false);
 f.reply(2,[{id:'normal',name:'Default list',active:true}]);await settle();f.reply(1,[row],true);f.reply(0,[{id:'late',name:'Late',active:true}]);await older;await settle();
 assert.equal(f.app.state.records[0].id,'normal');assert.equal(f.app.state.creationWindow,null);
 f.app.state.createdThisWeek=true;f.app.state.creationWindow=window;f.app.runNavigation({kind:'dataset',dataset:'vendors'});
 assert.equal(f.app.state.createdThisWeek,false);assert.equal(f.node('product-week-filter').hidden,true);f.reply(3,[]);await settle();
 f.app.state.createdThisWeek=true;f.app.state.creationWindow=window;f.app.state.import={dataset:'products'};
 f.events.click({target:{dataset:{action:'finish-import'},closest(){return this;}}});
 assert.equal(f.app.state.createdThisWeek,false);f.reply(4,[]);await settle();
 f.app.state.createdThisWeek=true;f.app.invalidate('หมดอายุ');assert.equal(f.app.state.createdThisWeek,false);assert.equal(f.app.state.creationWindow,null);
});

test('missing, null, future and out-of-week creation timestamps are rejected for scoped responses',async()=>{
 for(const createdAt of [undefined,null,'bad','2026-11-15T16:59:59Z','2026-11-22T10:00:01Z','2026-11-22T17:00:00Z']){
  const f=fixture();await f.toggle(true);f.reply(0,[{...row,createdAt}],true);await settle();
  assert.match(f.node('record-list').innerHTML,/ยังโหลดสินค้าเพิ่มใหม่ไม่ได้/);assert.equal(f.app.state.records.length,0);
 }
});

test('switching week scope clears a status confirmation belonging to the previous SKU',async()=>{
 const f=fixture(),pending=f.app.loadList();f.reply(0,[{id:'old',code:'OLD',name:'Old SKU',active:true}]);await pending;
 f.events.click({target:{dataset:{action:'toggle-status'},closest(){return this;}}});
 assert.equal(f.app.state.confirm,true);assert.match(f.node('detail-panel').innerHTML,/confirm-status/);
 await f.toggle(true);f.reply(1,[row],true);await settle();
 assert.equal(f.app.state.selected,'new');assert.equal(f.app.state.confirm,false);assert.doesNotMatch(f.node('detail-panel').innerHTML,/confirm-status/);
 assert(f.requests.every(request=>request.action==='list'));
});
