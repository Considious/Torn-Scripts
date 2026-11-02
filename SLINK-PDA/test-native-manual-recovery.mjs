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
 const records=new Map([['data',structuredClone(original)],['ui',{minimized:true}]]),calls=[];let dropNextPart=false,quotaNextPart=false,allowReset=false,dropDelete=false,failRebuild=false;
 const failure=()=>{throw Object.assign(Error(mode==='quota'?'QuotaExceeded':cast),{code:mode==='quota'?'QuotaExceeded':cast});};
 const get=async key=>{calls.push(['get',key]);if(key==='data'&&mode!=='healthy'||key.includes(':record:')&&(mode==='unreadable-fresh'||mode==='growing'&&JSON.stringify(records.get(key)||null).length>60000))failure();return structuredClone(records.get(key)??null);};
 const set=async(key,value)=>{calls.push(['set',key]);assert.notEqual(key,'data','Original must never be overwritten by recovery');if(failRebuild)throw Error('Synthetic replacement failure');if(key.includes(':part:')&&quotaNextPart){quotaNextPart=false;throw Object.assign(Error('QuotaExceeded'),{code:'QuotaExceeded'});}if(key.includes(':part:')&&dropNextPart){dropNextPart=false;return;}if(mode==='fresh-quota')throw Object.assign(Error('QuotaExceeded'),{code:'QuotaExceeded'});if(mode==='drop-fresh'&&key.includes(':record:'))return;if(mode==='drop-selector'&&(key.endsWith(':v1')||key.endsWith(':v2')))return;records.set(key,structuredClone(value));};
 const store={get,set,getMany:async keys=>Object.fromEntries(await Promise.all(keys.map(async key=>[key,await get(key)]))),setMany:async values=>{for(const [key,value]of Object.entries(values))await set(key,value);},list:async()=>[...records.keys()],loadAll:async()=>{calls.push(['loadAll']);return failure();},usage:async()=>({used:5291734,quota:10485760}),delete:async key=>{calls.push(['delete',key]);assert(allowReset,'Deletion requires reset test opt-in');if(!dropDelete)records.delete(key);}};
 const freshAdapter=()=>{const ctx=vm.createContext({PDA_storage:store,n:'data',i:'stats',l:'ui',c:'snoozes',isRecord:v=>!!v&&typeof v==='object'&&!Array.isArray(v),TextEncoder,globalThis:{crypto:webcrypto,navigator:{locks:{request:(_name,run)=>run()}},setTimeout:fn=>setTimeout(fn,0),clearTimeout}});vm.runInContext(source,ctx);return ctx.nativeStorage();};
 return {records,calls,freshAdapter,set dropNextPart(value){dropNextPart=value;},set quotaNextPart(value){quotaNextPart=value;},set allowReset(value){allowReset=value;},set dropDelete(value){dropDelete=value;},set failRebuild(value){failRebuild=value;}};
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
await assert.rejects(a.recoverSettings(current,true),/confirmed native Null\/String/);
for(const mode of ['healthy','quota','drop-fresh','drop-selector','fresh-quota','unreadable-fresh']){
 const test=fixture(mode),adapter=test.freshAdapter();
 await assert.rejects(adapter.recoverSettings(current,true));
 assert.deepEqual(test.records.get('data'),original,mode+': original preserved');
 assert(!test.records.has('data:manual-recovery:v2'),mode+': no unverified selection');
 if(['healthy','quota'].includes(mode))assert(!test.calls.some(([method])=>method==='set'),mode+': rejected before any mutation');
}
const stale=fixture();stale.records.set('data:manual-recovery:v1',{schema:1,record:'unrelated'});
await assert.rejects(stale.freshAdapter().get('data',null),/recovery selection is unreadable/);
assert(!stale.calls.some(([method])=>method==='set'),'Invalid selector is not silently reset');

// Synthetic thresholds deliberately model the reported recurrence; these are
// not assertions about an undocumented PDA/Android size limit.
const growth=fixture('growing'),oldRecord='data:manual-recovery:v1:record:previous';
const large={...current,caches:{...current.caches,largeRuntime:'🎃'.repeat(50000)}};
growth.records.set(oldRecord,structuredClone(large));growth.records.set('data:manual-recovery:v1',{schema:1,record:oldRecord});
const resumed=growth.freshAdapter();await assert.rejects(resumed.get('data',null),/record=recovered settings/);
assert(!growth.calls.some(([method])=>method==='loadAll'),'Recovered reads must never walk the retained unreadable original');
assert.equal((await resumed.diagnose()).canRecoverSettings,true,'Recurrence in the old recovery format remains manually recoverable');
await resumed.recoverSettings(large,true);const selected=growth.records.get('data:manual-recovery:v2').record;assert.equal(growth.records.get('data:manual-recovery:v1').record,oldRecord,'Old launchers retain the old pointer and cannot overwrite segmented storage');
assert.deepEqual(growth.records.get(oldRecord),large,'Earlier unreadable recovery record is also preserved');
for(let index=0;index<12;index++){
 const next={...large,settings:{...large.settings,theme:'theme-'+index},_savedAt:index+1};
 await resumed.set('data',next);
 const loaded=await growth.freshAdapter().get('data',null);assert.deepEqual(JSON.parse(JSON.stringify(loaded)),next,'Growing caches survive fresh reads after every save');
}
const previous=JSON.parse(JSON.stringify(await growth.freshAdapter().get('data',null))),header=structuredClone(growth.records.get(selected));
assert(growth.records.size<=2*header.count+6,'Repeated saves reuse two fixed banks rather than leak a generation per save');
growth.dropNextPart=true;await assert.rejects(resumed.set('data',{...previous,settings:{theme:'unacknowledged'}}),/did not retain/);
assert.deepEqual(growth.records.get(selected),header,'Interrupted segment write must not switch the active header');
assert.deepEqual(JSON.parse(JSON.stringify(await growth.freshAdapter().get('data',null))),previous,'Interrupted save retains last confirmed settings');
growth.quotaNextPart=true;await assert.rejects(resumed.set('data',{...previous,settings:{theme:'quota-failure'}}),/SLINK_STORAGE_FULL/);
assert.deepEqual(growth.records.get(selected),header);assert.deepEqual(growth.records.get('data'),original);
console.log('Manual native recovery: consent, exact-failure gating, verified fresh record/selector, reload, subsequent saves, healthy/quota/no-ack safeguards and untouched originals passed.');

for(const mode of ['healthy','quota']){
 const test=fixture(mode);test.allowReset=true;
 await assert.rejects(test.freshAdapter().resetSettings(current,true),/Nothing was deleted/);
 assert(!test.calls.some(([method])=>['delete','set'].includes(method)),mode+': reset rejected without mutation');
}
const reset=fixture('growing');reset.allowReset=true;
reset.records.set(oldRecord,structuredClone(large));reset.records.set(oldRecord+':part:a:0','old unreadable-root part');
reset.records.set('data:manual-recovery:v1',{schema:1,record:oldRecord});
const readableRoot='data:manual-recovery:v2:record:readable';reset.records.set(readableRoot,{settings:{theme:'readable'}});
reset.records.set('saved-targets',{ids:[123]});reset.records.set('unrelated','keep');
const resetAdapter=reset.freshAdapter();
await assert.rejects(resetAdapter.resetSettings(current,false),/explicit confirmation/);
assert(!reset.calls.some(([method])=>['delete','set'].includes(method)));
assert.equal((await resetAdapter.diagnose()).canResetSettings,true);
const receipt=await resetAdapter.resetSettings(current,true);
assert.equal(receipt.deleted,4);assert.equal(receipt.originalPreserved,false);
for(const key of ['data',oldRecord,oldRecord+':part:a:0','data:manual-recovery:v1'])assert(!reset.records.has(key),key+': unreadable root/part/pointer removed');
assert.equal(reset.records.get(readableRoot).settings.theme,'readable');assert.deepEqual(reset.records.get('saved-targets'),{ids:[123]});assert.equal(reset.records.get('unrelated'),'keep');assert.deepEqual(reset.records.get('ui'),{minimized:true});
assert(reset.calls.findIndex(([method])=>method==='set')>reset.calls.map(([method])=>method).lastIndexOf('delete'),'All deletions precede replacement writes');
assert.deepEqual(JSON.parse(JSON.stringify(await reset.freshAdapter().get('data',null))),current,'Clean selected settings survive a new document');
for(const failure of ['dropDelete','failRebuild']){
 const test=fixture();test.allowReset=true;test[failure]=true;
 await assert.rejects(test.freshAdapter().resetSettings(current,true),failure==='dropDelete'?/SLINK_STORAGE_RESET_DELETE_FAILED/:/current settings remain on this page.*SLINK_STORAGE_RESET_REBUILD_FAILED/);
 if(failure==='dropDelete')assert(!test.calls.some(([method])=>method==='set'),'Unconfirmed deletion stops replacement writes');
 else assert(!test.records.has('data'),'Rebuild failure is explicit after irreversible deletion');
 assert.deepEqual(test.records.get('ui'),{minimized:true});
}
console.log('Manual reset: explicit consent, exact-read-failure gating, narrow deletion, readable/unrelated preservation, delete-before-write, no-ack stop, rebuild-failure warning and fresh-document reload passed.');
