import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const loader=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('./src/00-runtime-core.part',import.meta.url),'utf8');
const saved=new Map(),local=new Map(),listeners=new Map();let hang=false;
class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
const document={addEventListener(type,fn){(listeners.get(type)||listeners.set(type,[]).get(type)).push(fn);},dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);}};
const storage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
const native={
 get:async(k,fallback)=>saved.get(k)??fallback,
 getMany:async keys=>Object.fromEntries(keys.map(k=>[k,saved.get(k)??null])),
 set:async(k,value)=>{await new Promise(r=>setTimeout(r,70));saved.set(k,value);},
 setMany:async values=>{if(hang)await new Promise(()=>{});await new Promise(r=>setTimeout(r,70));for(const [k,v]of Object.entries(values))saved.set(k,v);}
};
const ctx=vm.createContext({
 n:'data',s:'mirror',i:'stats',l:'ui',c:'snoozes',u:'targets',m:'write',d:new Set(['data','stats','ui','snoozes','targets']),
 DATA_STORAGE_KEY:'data',OWN_BATTLE_STATS_STORAGE_KEY:'stats',STORAGE_KEY:'ui',ALERT_SNOOZE_STORAGE_KEY:'snoozes',TARGET_RECORDS_KEY:'targets',
 PDA_BOOTSTRAP:{},PDA_STORAGE_WRITE_EVENT:'write',GM_API:{},PDA_storage:native,localStorage:storage,CustomEvent,document,
 setTimeout:(fn,ms)=>setTimeout(fn,ms/100),clearTimeout,moduleRoot:()=>null,writeDataMirror(){},
 GM_getValue:(_k,fallback)=>fallback
});ctx.global=ctx;
vm.runInContext(loader.slice(loader.indexOf('function isRecord(value)'),loader.indexOf('function validBundle(value)')),ctx);
const start=loader.indexOf('!function(){let e=Promise.resolve();'),end=loader.indexOf(',await loadRuntime()',start);
vm.runInContext(loader.slice(start,end),ctx);
const bridge=core.indexOf('const pendingStorageWrites='),bridgeEnd=core.indexOf('try { delete global[PDA_BOOTSTRAP_KEY]',bridge);
const write=core.indexOf('function storageWrite('),writeEnd=core.indexOf('function storageDelete(',write);
vm.runInContext(core.slice(bridge,bridgeEnd)+core.slice(write,writeEnd),ctx);
// Scaled bridge deadline:150ms, but six ordered native writes require420ms.
// A queued write must not be mistaken for an unresponsive native operation.
await Promise.all(Array.from({length:6},(_,index)=>ctx.storageWrite(['ui','stats','snoozes'][index%3],{_savedAt:index+1,checkedAt:index+1,value:index})));
assert.equal(saved.get('ui').value,3);assert.equal(saved.get('stats').value,4);assert.equal(saved.get('snoozes').value,5);
console.log('Slow ordered native saves do not time out merely while queued; final values remain acknowledged and ordered.');
hang=true;
await assert.rejects(ctx.storageWrite('ui',{_savedAt:10,value:99}),/SLINK_STORAGE_NATIVE_TIMEOUT/);
assert.equal(saved.get('ui').value,3,'A working acknowledgement must never claim the hanging write succeeded');
listeners.delete('write');
await assert.rejects(ctx.storageWrite('ui',{_savedAt:11,value:100}),/SLINK_STORAGE_BRIDGE_TIMEOUT/);
console.log('Missing bridge and stalled native writes still fail with distinct operation-specific errors, never a false saved acknowledgement.');
