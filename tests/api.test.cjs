const test=require('node:test');
const assert=require('node:assert/strict');
const {create,hasAdminRole}=require('../js/api.js');

test('signed API uses only action/data/token and returns authoritative result',async()=>{
  const original=global.fetch, calls=[];let owner={token:'fictional-token',roles:['ADMIN']};
  try{global.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return{ok:true,json:async()=>({success:true,data:{records:[],total:0}})}};
    const api=create(()=>owner,()=>{});assert.deepEqual(await api.request('list',{dataset:'members'}),{records:[],total:0});
    assert.deepEqual(calls,[{action:'list',data:{dataset:'members'},token:'fictional-token'}]);
  }finally{global.fetch=original;}
});
test('response from prior session is rejected without publishing data',async()=>{
  const original=global.fetch;let owner={token:'old',roles:['ADMIN']};
  try{global.fetch=async()=>{owner={token:'new',roles:['ADMIN']};return{ok:true,json:async()=>({success:true,data:{name:'private fixture'}})}};
    await assert.rejects(create(()=>owner,()=>{}).request('list',{}),error=>error.code==='session_changed');
  }finally{global.fetch=original;}
});
test('401 invalidates session while dataset403 stays a permission error',async()=>{
  const original=global.fetch, invalidated=[];const owner={token:'fixture',roles:['ADMIN']};
  try{const api=create(()=>owner,message=>invalidated.push(message));
    global.fetch=async()=>({ok:false,status:401,json:async()=>({success:false,error:'invalid_session'})});
    await assert.rejects(api.request('list',{}),error=>error.status===401);assert.equal(invalidated.length,1);
    global.fetch=async()=>({ok:false,status:403,json:async()=>({success:false,error:'permission_denied'})});
    await assert.rejects(api.request('save',{}),error=>error.code==='permission_denied');assert.equal(invalidated.length,1);
  }finally{global.fetch=original;}
});
test('uncertain commit never retries automatically and preserves retryable review id',async()=>{
  const original=global.fetch;let calls=0;const owner={token:'fixture',roles:['ADMIN']};
  try{global.fetch=async()=>{calls++;throw new TypeError('offline');};
    await assert.rejects(create(()=>owner,()=>{}).request('commitImport',{dataset:'members',reviewId:'review-1',skipErrors:true}),error=>error.code==='network_error');assert.equal(calls,1);
  }finally{global.fetch=original;}
});

test('ADMIN role is independent of granular grants and requires verified canonical role array',()=>{
  assert.equal(hasAdminRole({roles:['ADMIN']}),true);assert.equal(hasAdminRole({roles:['SUPERVISOR','ADMIN']}),true);
  for(const roles of [['SUPERVISOR'],['STAFF'],['ADMINISTRATION'],['admin'],'ADMIN',null])assert.equal(hasAdminRole({roles,perms:{'app-master-data':['viewMasterData','manageProducts','importProducts']}}),false);
});
test('non-ADMIN with all app grants cannot send any domain action',async()=>{
  const original=global.fetch;let calls=0;
  try{global.fetch=async()=>{calls++;throw new Error('should not fetch');};
    for(const roles of [['SUPERVISOR'],['STAFF'],[]]){
      const api=create(()=>({token:'fixture',roles,perms:{'app-master-data':['viewMasterData','manageProducts','manageVendors','manageMembers','importProducts','importVendors','importMembers']}}),()=>{});
      for(const action of ['list','history','save','reviewImport','commitImport'])await assert.rejects(api.request(action,{dataset:'products'}),error=>error.code==='permission_denied'&&error.status===403);
    }
    assert.equal(calls,0);
  }finally{global.fetch=original;}
});
