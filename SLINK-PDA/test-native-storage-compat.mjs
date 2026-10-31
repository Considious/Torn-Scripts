import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const loader=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
const source=loader.slice(loader.indexOf('function nativeStorage(){'),loader.indexOf('async function targetJournal('));
const cast="type 'Null' is not a subtype of type 'String' in type cast";
const native=new Map([['data',{apiKey:'retained-synthetic-key',settings:{alerts:{city:false}},sessions:{permission:null}}]]);
const calls=[];let readCast=false,writeCast=false,drop=false,quota=false,allFail=false,browserWrites=0;
// Public PDA_storage API contract: every operation remains in this same store.
const store={
 get:async()=>{throw Error('Single-key reads should not be needed');},
 getMany:async keys=>{calls.push('getMany');if(readCast||allFail)throw Error(cast);return Object.fromEntries(keys.map(k=>[k,native.get(k)??null]));},
 loadAll:async()=>{calls.push('loadAll');if(allFail)throw Error(cast);return Object.fromEntries(native);},
 setMany:async values=>{calls.push('setMany');if(quota)throw Object.assign(Error('QuotaExceeded'),{code:'QuotaExceeded'});if(writeCast||allFail)throw Error(cast);if(!drop)for(const [k,v]of Object.entries(values))native.set(k,structuredClone(v));},
 set:async(k,value)=>{calls.push('set');if(allFail)throw Error(cast);native.set(k,structuredClone(value));}
};
const ctx=vm.createContext({PDA_storage:store,n:'data',i:'stats',l:'ui',c:'snoozes',isRecord:v=>!!v&&typeof v==='object'&&!Array.isArray(v),globalThis:{GM_setValue(){browserWrites++;}}});
vm.runInContext(source,ctx);const adapter=ctx.nativeStorage();
const data=structuredClone(native.get('data'));data.settings.theme='halloween-2026';data.settings.chat={ffBubbles:true};data.sessions.permission={token:'synthetic-session',roles:['member'],scopes:['slink.level']};
readCast=true;assert.equal((await adapter.get('data',null)).apiKey,data.apiKey,'Native read compatibility must preserve existing identity');
writeCast=true;await adapter.set('data',data);
assert.equal(native.get('data').settings.theme,'halloween-2026');
assert.equal(native.get('data').settings.alerts.city,false);
assert.equal(native.get('data').settings.chat.ffBubbles,true);
assert.equal(native.get('data').sessions.permission.roles[0],'member');
assert.equal(browserWrites,0);
assert.deepEqual(calls.slice(-3),['set','getMany','loadAll'],'Single-key compatibility write must be read back in native storage');
readCast=false;writeCast=false;
const prior=structuredClone(native.get('data'));drop=true;
await assert.rejects(adapter.set('data',{changed:true}),/did not retain.*settings.*write/);
assert.deepEqual(native.get('data'),prior);drop=false;
calls.length=0;quota=true;
await assert.rejects(adapter.set('data',{changed:true}),/QuotaExceeded/);
assert.deepEqual(calls,['setMany'],'Quota rejection must not retry a different method');
assert.deepEqual(native.get('data'),prior);quota=false;
allFail=true;
await assert.rejects(adapter.set('data',data),/single-key write failed: type 'Null'/);
assert.deepEqual(native.get('data'),prior);
assert.equal(browserWrites,0,'No native failure may silently switch persistence backends');
console.log('Native storage exact-cast compatibility, same-namespace retention, save readback, no-op detection, quota handling and explicit unrecovered failure passed.');
allFail=false;readCast=true;
store.get=async(k,fallback)=>native.get(k)??fallback;
let broadReads=0;
store.loadAll=async()=>{broadReads++;throw Error(cast);};
assert.equal((await adapter.get('data',null)).apiKey,prior.apiKey,'Readable requested records must not depend on loadAll succeeding for unrelated records');
assert.equal(broadReads,0);
assert.equal(await adapter.get('missing',null),null,'A genuine absent record remains a valid null, not a fabricated empty settings object');
store.get=async()=>{throw Error(cast);};
const readFailure=await adapter.get('data',null).then(()=>null,error=>error);
assert.match(readFailure.message,/SLINK_NATIVE_READ: record=settings; batch=Null\/String; single=Null\/String; all=Null\/String/);
assert(!readFailure.message.includes(prior.apiKey),'Failure context must not expose a saved key');
assert.deepEqual(native.get('data'),prior,'Read-only compatibility and diagnostics must not change stored data');
let individualReads=0;
store.get=async()=>{individualReads++;throw Error('No bulk fanout');};
store.loadAll=async()=>Object.fromEntries(native);
const bulk=await adapter.getMany(['data','missing']);
assert.equal(bulk.data.apiKey,prior.apiKey);assert.equal(bulk.missing,null);
assert.equal(individualReads,0,'A bulk journal read failure must not fan out into many native calls');
console.log('Targeted single-key read compatibility avoids unrelated whole-store failures; all-method failure identifies record kind and method results without stored values.');
