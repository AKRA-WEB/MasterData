// Actual bridge verification; every transport and storage surface is fictional and in-process.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/akra-shell-bridge.js'),'utf8');
function fixture(response){
 const storage=new Map(),requests=[],window={location:{origin:'https://fixture.invalid',hostname:'fixture.invalid',search:''},addEventListener(){},localStorage:{getItem:k=>storage.get(k)||null}};
 window.parent=window;
 const c=vm.createContext({window,console,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async(_url,options)=>{requests.push(JSON.parse(options.body));return response;}});
 vm.runInContext(source,c);return{bridge:window.AkraModule,storage,requests};
}
test('startup bridge preserves reason/status and rejects server failures without valid JSON',async()=>{
 for(const [status,reason]of [[401,'invalid_or_expired_token'],[403,'permission_denied'],[500,'service_unavailable']]){
  const f=fixture({ok:false,status,json:async()=>({valid:false,reason})});await assert.rejects(f.bridge.verifySession('app-master-data','fictional-token'),error=>error.reason===reason&&error.code===reason&&error.status===status);
  assert.equal(f.requests.length,1);assert.deepEqual(f.requests[0],{action:'verifyToken',appId:'app-master-data',token:'fictional-token'});
 }
 for(const json of [async()=>{throw new SyntaxError('fictional non-JSON server body');},async()=>null]){
  const f=fixture({ok:false,status:500,json});await assert.rejects(f.bridge.verifySession('app-master-data','fictional-token'),error=>error.reason==='internal_error'&&error.status===500);
 }
});
test('reasonless verify failures preserve permission and rate-limit meaning without assuming an expired login',async()=>{
 for(const [status,reason]of [[403,'permission_denied'],[429,'rate_limited'],[401,'invalid_session'],[400,'invalid_session'],[200,'invalid_session']]){
  const f=fixture({ok:status<400,status,json:async()=>({valid:false})});
  await assert.rejects(f.bridge.verifySession('app-master-data','fictional-token'),error=>error.reason===reason&&error.code===reason&&error.status===status);
  assert.equal(f.requests.length,1);
 }
});
