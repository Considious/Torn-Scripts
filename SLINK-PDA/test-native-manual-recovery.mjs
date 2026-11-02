import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const loader=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
const source=loader.slice(loader.indexOf('function nativeStorage(){'),loader.indexOf('async function targetJournal('));
const original={apiKey:'old-synthetic-key',settings:{theme:'old'},sessions:{permission:{token:'old-token'}}};
const current={apiKey:'current-synthetic-key',settings:{theme:'halloween-2026',chat:{ff:true}},accepted:{permission:'current'},sessions:{permission:{token:'current-token'}},caches:{ownBattleStats:{total:603000}}};
const cast="type 'Null' is not a subtype of type 'String' in type cast";
function fixture(mode='broken'){
 const records=new Map([['data',structuredClone(original)],['ui',{minimized:true}]]),calls=[];
 const failure=()=>{throw Object.assign(Error(mode==='quota'?'QuotaExceeded':cast),{code:mode==='quota'?'QuotaExceeded':cast});};
 const get=async key=>{calls.push(['get',key]);if(key==='data'&&mode!=='healthy'||key.includes(':record:')&&mode==='unreadable-fresh')failure();return structuredClone(records.get(key)??null);};
 const set=async(key,value)=>{calls.push(['set',key]);assert.notEqual(key,'data','Original must never be overwritten by recovery');if(mode==='fresh-quota')throw Object.assign(Error('QuotaExceeded'),{code:'QuotaExceeded'});if(mode==='drop-fresh'&&key.includes(':record:'))return;if(mode==='drop-selector'&&key.endsWith(':v1'))return;records.set(key,structuredClone(value));};
 const store={get,set,getMany:async keys=>Object.fromEntries(await Promise.all(keys.map(async key=>[key,await get(key)]))),setMany:async values=>{for(const [key,value]of Object.entries(values))await set(key,value);},list:async()=>[...records.keys()],loadAll:async()=>failure(),usage:async()=>({used:5291734,quota:10485760}),delete:async key=>{calls.push(['delete',key]);assert.notEqual(key,'data');records.delete(key);}};
 const freshAdapter=()=>{const ctx=vm.createContext({PDA_storage:store,n:'data',i:'stats',l:'ui',c:'snoozes',isRecord:v=>!!v&&typeof v==='object'&&!Array.isArray(v),globalThis:{crypto:webcrypto,setTimeout:fn=>setTimeout(fn,0),clearTimeout}});vm.runInContext(source,ctx);return ctx.nativeStorage();};
 return {records,calls,freshAdapter};
}
const f=fixture(),a=f.freshAdapter();
await assert.rejects(a.get('data',null),/Null/);
assert.equal(f.calls.filter(([method])=>method==='set').length,0,'Failed startup does not activate recovery');
await assert.rejects(a.recoverSettings(current,false),/confirmed manually/);
assert.equal((await a.diagnose()).canRecoverSettings,true);
assert.equal((await a.recoverSettings(current,true)).originalPreserved,true);
assert.deepEqual(JSON.parse(JSON.stringify(await a.get('data',null))),current);
assert.deepEqual(f.records.get('data'),original);
const reloaded=f.freshAdapter();
assert.deepEqual(JSON.parse(JSON.stringify(await reloaded.get('data',null))),current,'Fresh page must use verified native recovery selection');
const changed={...current,settings:{...current.settings,theme:'crimson'}};
await reloaded.set('data',changed);
assert.equal((await f.freshAdapter().get('data',null)).settings.theme,'crimson');
assert.deepEqual(f.records.get('data'),original,'Later saves also leave original untouched');
assert.equal((await a.diagnose()).canRecoverSettings,false,'Recovery is not offered again once selected');
await assert.rejects(a.recoverSettings(current,true),/already selected/);
for(const mode of ['healthy','quota','drop-fresh','drop-selector','fresh-quota','unreadable-fresh']){
 const test=fixture(mode),adapter=test.freshAdapter();
 await assert.rejects(adapter.recoverSettings(current,true));
 assert.deepEqual(test.records.get('data'),original,mode+': original preserved');
 assert(!test.records.has('data:manual-recovery:v1'),mode+': no unverified selection');
 if(['healthy','quota'].includes(mode))assert(!test.calls.some(([method])=>method==='set'),mode+': rejected before any mutation');
}
const stale=fixture();stale.records.set('data:manual-recovery:v1',{schema:1,record:'unrelated'});
await assert.rejects(stale.freshAdapter().get('data',null),/recovery selection is unreadable/);
assert(!stale.calls.some(([method])=>method==='set'),'Invalid selector is not silently reset');
console.log('Manual native recovery: consent, exact-failure gating, verified fresh record/selector, reload, subsequent saves, healthy/quota/no-ack safeguards and untouched originals passed.');
