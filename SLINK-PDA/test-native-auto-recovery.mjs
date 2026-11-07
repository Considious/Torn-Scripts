import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const loader=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8'),source=loader.slice(loader.indexOf('function nativeStorage(){'),loader.indexOf('async function targetJournal('));
const copy=value=>JSON.parse(JSON.stringify(value)),data={apiKey:'synthetic-key',settings:{theme:'halloween-2026',market:{watches:[{id:123,price:456}]}},accepted:{permission:'current'},sessions:{permission:{token:'synthetic-token'}},caches:{sample:'🎃'.repeat(65000)}};
function fixture({coordination=true,nKey='data'}={}){
 const records=new Map([[nKey,{settings:{theme:'legacy'}}],['ui',{minimized:true}],['targets',{ids:[123]}]]),faults=new Map(),calls=[];let queue=Promise.resolve(),dropDelete=false,dropRestore=false,quota=false;
 const get=async key=>{calls.push(['get',key]);const kind=faults.get(key);if(kind){const message=kind==='row'?'Row too big to fit into CursorWindow':kind==='cast'?"type 'Null' is not a subtype of type 'String' in type cast":kind;throw Object.assign(Error(message),{code:kind==='cast'?message:kind});}return copy(records.get(key)??null);};
 const set=async(key,value)=>{calls.push(['set',key]);if(quota&&key.includes(':part:')){quota=false;throw Object.assign(Error('QuotaExceeded'),{code:'QuotaExceeded'});}if(dropRestore&&/:record:[^:]+$/.test(key)){dropRestore=false;return;}records.set(key,copy(value));};
 const store={get,set,getMany:async keys=>Object.fromEntries(await Promise.all(keys.map(async key=>[key,await get(key)]))),setMany:async values=>{for(const [key,value]of Object.entries(values))await set(key,value);},list:async()=>[...records.keys()],usage:async()=>({used:1,quota:10485760}),delete:async key=>{calls.push(['delete',key]);if(!dropDelete){records.delete(key);faults.delete(key);}}};
 const locks={request:(_name,run)=>{const result=queue.catch(()=>{}).then(run);queue=result.catch(()=>{});return result;}};
 const fresh=()=>{const global={crypto:webcrypto,navigator:coordination?{locks}:{},setTimeout,clearTimeout,localStorage:{getItem:()=>JSON.stringify(data)}};const c=vm.createContext({PDA_storage:store,n:nKey,i:'stats',l:'ui',c:'snoozes',isRecord:v=>!!v&&typeof v==='object'&&!Array.isArray(v),TextEncoder,globalThis:global});vm.runInContext(source,c);return c.nativeStorage();};
 const root=()=>records.get(nKey+':manual-recovery:v2').record;
 return {records,faults,calls,fresh,root,store,locks,set dropDelete(v){dropDelete=v;},set dropRestore(v){dropRestore=v;},set quota(v){quota=v;}};
}
for(const kind of ['row','cast']){
 const f=fixture();await f.fresh().set('data',data);const root=f.root();assert.ok(f.records.has(root+':checkpoint:a'));
 f.faults.set(root,kind);const repaired=f.fresh();assert.deepEqual(copy(await repaired.get('data',null)),data);
 assert.equal(f.calls.filter(([method,key])=>method==='delete'&&key===root).length,1);
 assert.equal((await repaired.diagnose()).automaticRecovery.status,'recovered');
 assert.deepEqual(copy(await f.fresh().get('data',null)),data,'Repair survives a new document');
 assert.deepEqual(f.records.get('ui'),{minimized:true});assert.deepEqual(f.records.get('targets'),{ids:[123]});
 assert.deepEqual(f.records.get('data'),{settings:{theme:'legacy'}},'Unselected original is not touched');
 await f.fresh().set('data',{...data,settings:{...data.settings,theme:'candy'}});assert.equal((await f.fresh().get('data',null)).settings.theme,'candy');
}
// A damaged latest bank must recover only a previously committed, intact bank.
const rollback=fixture();await rollback.fresh().set('data',data);await rollback.fresh().set('data',{...data,settings:{...data.settings,theme:'newer'}});const root=rollback.root(),header=rollback.records.get(root);rollback.records.set(root+':part:'+header.bank+':0','corrupt');
const older=rollback.fresh();assert.deepEqual(copy(await older.get('data',null)),data);assert.equal((await older.diagnose()).automaticRecovery.usedPrevious,true);
assert.equal(rollback.records.get(root+':part:'+header.bank+':0'),'corrupt','Repair does not delete unverified bank data');
// No-op saves retain the prior distinct version and do not write any records.
const stable=fixture();await stable.fresh().set('data',data);const count=stable.records.size;for(let i=0;i<6;i++)await stable.fresh().set('data',data);assert.equal(stable.records.size,count);assert.equal(stable.records.get(stable.root()).generation,1);
// Legacy data and browser mirrors are never treated as verified native backups.
const legacy=fixture();legacy.faults.set('data','row');await assert.rejects(legacy.fresh().get('data',null),/SLINK_STORAGE_ROW_TOO_LARGE/);assert(!legacy.calls.some(([m])=>m==='delete'||m==='set'));
for(const mode of ['wrong-record','bad-digest','both-banks','malformed']){
 const f=fixture();await f.fresh().set('data',data);const r=f.root(),cp=f.records.get(r+':checkpoint:a');
 if(mode==='wrong-record')cp.record='another-script';if(mode==='bad-digest')cp.header.sha256='0'.repeat(64);if(mode==='malformed')cp.header.count=-1;if(mode==='both-banks')f.records.set(r+':part:a:0','damaged');
 f.records.set(r+':checkpoint:a',cp);f.faults.set(r,'row');f.calls.length=0;
 await assert.rejects(f.fresh().get('data',null),/SLINK_STORAGE_ROW_TOO_LARGE/);assert(!f.calls.some(([m])=>m==='delete'),'Invalid checkpoint cannot authorize deletion: '+mode);
}
for(const fault of ['QuotaExceeded','Network timeout','other']){const f=fixture();await f.fresh().set('data',data);f.faults.set(f.root(),fault);f.calls.length=0;await assert.rejects(f.fresh().get('data',null));assert(!f.calls.some(([m])=>m==='delete'||m==='set'),'Unrelated errors do not trigger mutation');}
const deletion=fixture();await deletion.fresh().set('data',data);deletion.faults.set(deletion.root(),'row');deletion.dropDelete=true;await assert.rejects(deletion.fresh().get('data',null),/SLINK_STORAGE_AUTORECOVERY_FAILED/);deletion.dropDelete=false;assert.deepEqual(copy(await deletion.fresh().get('data',null)),data);
const interrupted=fixture();await interrupted.fresh().set('data',data);interrupted.faults.set(interrupted.root(),'row');interrupted.dropRestore=true;await assert.rejects(interrupted.fresh().get('data',null),/SLINK_STORAGE_AUTORECOVERY_FAILED/);assert(!interrupted.records.has(interrupted.root()));assert.deepEqual(copy(await interrupted.fresh().get('data',null)),data,'Missing header after interruption is repaired from retained checkpoints');
const concurrent=fixture();await concurrent.fresh().set('data',data);concurrent.faults.set(concurrent.root(),'row');const results=await Promise.all([concurrent.fresh().get('data',null),concurrent.fresh().get('data',null)]);for(const result of results)assert.deepEqual(copy(result),data);assert.equal(concurrent.calls.filter(([m])=>m==='delete').length,1,'Concurrent repair deletes only once');
const partial=fixture();await partial.fresh().set('data',data);partial.quota=true;await assert.rejects(partial.fresh().set('data',{...data,settings:{theme:'not-saved'}}),/SLINK_STORAGE_FULL/);assert.deepEqual(copy(await partial.fresh().get('data',null)),data);
const unsupported=fixture({coordination:false});unsupported.faults.set('data','row');await assert.rejects(unsupported.fresh().get('data',null),/SLINK_STORAGE_ROW_TOO_LARGE/);assert(!unsupported.calls.some(([m])=>m==='delete'||m==='set'));
// Exercise the complete installed launcher, bootstrap, save queue, acknowledgements
// and a fresh-document reload, not just extracted adapter methods.
const nativeKey='slink-pda-dashboard:data:v1',live=fixture({nKey:nativeKey});await live.fresh().set(nativeKey,data);live.faults.set(live.root(),'row');
async function boot(){
 const events=new EventTarget(),local=new Map(),gm=new Map();let host=null,bootstrap=null;
 const document={addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),getElementById:id=>id==='slink-pda-dashboard-host'?host:null,createElement:()=>({style:{},addEventListener(){},remove(){}}),body:{appendChild(){throw Error('Unexpected startup failure banner');}}};
 const memory={getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,String(value)),removeItem:key=>local.delete(key)};
 const context=vm.createContext({console,URL,Date,Promise,JSON,TextEncoder,setTimeout,clearTimeout,CustomEvent,crypto:webcrypto,navigator:{locks:live.locks},document,PDA_storage:live.store,localStorage:memory,sessionStorage:memory,
  GM_getValue:async(key,fallback)=>gm.get(key)??fallback,GM_setValue:async(key,value)=>gm.set(key,value),
  PDA_httpGet:async url=>({status:200,data:url.includes('source-manifest.json')?JSON.stringify({schema:3,mode:'direct-source',revision:'synthetic-auto-recovery',storageProtocol:3,fragments:['src/one.part'],startupAddons:[]}):'/*'+'.'.repeat(1200)+'*/'}),
  PDA_evaluateJavascript:async code=>{const match=code.match(/globalThis\.__SLINK_PDA_BOOTSTRAP__=(.+);\n/);if(match)bootstrap=JSON.parse(match[1]);host={dataset:{slinkReady:'true',slinkAddonsReady:'true'}};}
 });
 await vm.runInContext(loader,context);assert.ok(bootstrap,'Launcher must supply its real bootstrap');return {context,bootstrap,document};
}
const launched=await boot();assert.deepEqual(launched.bootstrap[nativeKey],data);assert.equal(launched.bootstrap.storageAutoRecovery.status,'recovered');
const channel=launched.context.__SLINK_PDA_STORAGE_BRIDGE__.channel,updated={...data,_savedAt:Date.now(),settings:{...data.settings,theme:'updated-after-repair'}};
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Save acknowledgement missing')),2000);launched.document.addEventListener(channel+':ack',event=>{const ack=JSON.parse(event.detail);if(ack.id!=='integration-save'||ack.phase)return;clearTimeout(timer);ack.ok?resolve():reject(Error(ack.error));});launched.document.dispatchEvent(new CustomEvent(channel,{detail:JSON.stringify({protocol:2,id:'integration-save',key:nativeKey,value:updated,base:{settings:data.settings,targetList:{}}})}));});
const reload=await boot();assert.equal(reload.bootstrap[nativeKey].settings.theme,'updated-after-repair');assert.equal(reload.bootstrap[nativeKey].apiKey,data.apiKey);assert.deepEqual(reload.bootstrap[nativeKey].accepted,data.accepted);
console.log('Automatic native recovery: verified checkpoints, row/cast failures, prior-bank rollback, full launcher/bootstrap/save acknowledgement/reload, interrupted repair, concurrency, bounded metadata, no-op saves, quota/timeouts, invalid/missing backups and unrelated-record preservation passed.');
