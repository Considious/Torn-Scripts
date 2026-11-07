import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const core=fs.readFileSync(new URL('./src/00-runtime-core.part',import.meta.url),'utf8');
const runtime=core.slice(core.indexOf('async function recoverPdaSettings('),core.indexOf('async function retryPdaStorage('));
assert.ok(runtime.startsWith('async function recoverPdaSettings('));
// Exercise the real runtime gate, rather than only the native adapter in isolation.
for(const version of [1,2,3,undefined,0,NaN,'2'])for(const oversized of [false,true]){
 const reached=Error('gate passed'),context=vm.createContext({Number,PDA_STORAGE_WRITE_EVENT:'test',pendingStorageWrites:new Map(),failedStorageWrites:new Map([['data',{error:oversized?'SLINK_NATIVE_READ: record=settings; batch=RowTooBig':'SLINK_NATIVE_READ: record=settings; batch=Null/String'}]]),diagnosePdaStorage:async()=>({manualResetVersion:version,manualRecoveryVersion:3,coordinationAvailable:true,canResetSettings:true}),schedulePdaCacheSave:{state:null},global:{clearTimeout(){throw reached;}},pdaPreferenceTimer:null});
 vm.runInContext(runtime,context);
 const valid=Number.isSafeInteger(version)&&version>=(oversized?2:1);
 await assert.rejects(context.recoverPdaSettings(true,true),error=>valid?error===reached:error!==reached,'Capability '+String(version)+' with oversized='+oversized);
}
const installer=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
const adapterSource=installer.slice(installer.indexOf('function nativeStorage(){'),installer.indexOf('async function targetJournal('));
const saved={settings:{theme:'halloween-2026',chat:{ff:true}},apiKey:'synthetic',accepted:{permission:'current'},sessions:{permission:{token:'synthetic'}}};
const records=new Map([['data',{old:'oversized'}],['targets',{ids:[123]}]]),calls=[];
const get=async key=>{if(key==='data'&&records.has(key))throw Object.assign(Error('Row too big to fit into CursorWindow'),{code:'DatabaseException'});return structuredClone(records.get(key)??null);};
const set=async(key,value)=>{calls.push(['set',key]);records.set(key,structuredClone(value));};
const store={get,set,getMany:async keys=>Object.fromEntries(await Promise.all(keys.map(async k=>[k,await get(k)]))),setMany:async values=>{for(const [k,v]of Object.entries(values))await set(k,v);},list:async()=>[...records.keys()],usage:async()=>({used:1,quota:10485760}),delete:async key=>{calls.push(['delete',key]);records.delete(key);}};
const native=vm.createContext({PDA_storage:store,n:'data',i:'stats',l:'ui',c:'snoozes',isRecord:v=>!!v&&typeof v==='object'&&!Array.isArray(v),TextEncoder,globalThis:{crypto:webcrypto,navigator:{locks:{request:(_key,run)=>run()}},setTimeout,clearTimeout}});vm.runInContext(adapterSource,native);const adapter=native.nativeStorage();
const document=new EventTarget(),channel='test-bridge',failed=new Map([['data',{error:'SLINK_NATIVE_READ: record=settings; batch=RowTooBig'}]]);
document.addEventListener(channel,event=>{const request=JSON.parse(event.detail);Promise.resolve().then(async()=>{
 try{assert.equal(request.action,'reset-settings');const result=await adapter.resetSettings(request.value,request.confirmed);document.dispatchEvent(new CustomEvent(channel+':recovered',{detail:JSON.stringify({id:request.id,ok:true,result})}));}
 catch(error){document.dispatchEvent(new CustomEvent(channel+':recovered',{detail:JSON.stringify({id:request.id,ok:false,error:error.message})}));}
});});
let subsequentSave=false;
const context=vm.createContext({Number,PDA_STORAGE_WRITE_EVENT:channel,pendingStorageWrites:new Map(),failedStorageWrites:failed,diagnosePdaStorage:()=>adapter.diagnose(),schedulePdaCacheSave:{state:null},global:{clearTimeout},pdaPreferenceTimer:null,dataState:structuredClone(saved),CustomEvent,document,setTimeout,clearTimeout,DATA_STORAGE_KEY:'data',storageWrite:{},writeDataMirror(){},lastPersistedProtected:{apiKey:null,accepted:null,sessions:null},writeDataState:async()=>{subsequentSave=true;await adapter.set('data',context.dataState);},updateStorageNotice(){}});
vm.runInContext(runtime,context);
const result=await context.recoverPdaSettings(true,true);
assert.equal(result.deleted,1);assert.equal(result.originalPreserved,false);assert.equal(records.has('data'),false);assert.equal(subsequentSave,true);assert.equal(failed.size,0);
assert.equal((await native.nativeStorage().get('data',null)).settings.theme,'halloween-2026');assert.deepEqual(records.get('targets'),{ids:[123]});
assert(calls.findIndex(([method])=>method==='set')>calls.findIndex(([method])=>method==='delete'));
assert(!core.includes('report.manualResetVersion!==1'));
console.log('Reset capability: v1 legacy, v2 oversized and newer versions accepted appropriately; malformed/unsupported capabilities rejected; actual runtime → diagnostic → confirmed native deletion → segmented rebuild → follow-up save completed.');
