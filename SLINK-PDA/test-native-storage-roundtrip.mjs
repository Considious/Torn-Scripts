import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const loader=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
const source=loader.slice(loader.indexOf('  function isRecord(value)'),loader.indexOf('  function validBundle(value)'));
const dataKey='data',statsKey='own-stats';
const local=new Map(),native=new Map([[dataKey,{_savedAt:100,caches:{ownBattleStats:{total:571764,checkedAt:100}}}]]);
const callbacks=new Map();
let inFlight=0,maxInFlight=0;
let finishDataWrite;
const dataWritten=new Promise(resolve=>{finishDataWrite=resolve;});
const ctx={DATA_STORAGE_KEY:dataKey,DATA_MIRROR_KEY:'mirror',OWN_BATTLE_STATS_STORAGE_KEY:statsKey,
  BRIDGED_STORAGE_KEYS:new Set([dataKey,statsKey]),STORAGE_WRITE_EVENT:'write',
  document:{addEventListener(type,callback){callbacks.set(type,callback);}},
  globalThis:{localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},
    GM_getValue:async(k,fallback)=>{await new Promise(resolve=>setTimeout(resolve,1));return native.get(k)||fallback;},
    GM_setValue:async(k,value)=>{inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);await new Promise(resolve=>setTimeout(resolve,value?.total===571764?20:1));native.set(k,value);inFlight--;if(k===dataKey&&value?._savedAt===200)finishDataWrite();}}
};
vm.createContext(ctx);vm.runInContext(source,ctx);
ctx.installStorageBridge();
assert.equal((await ctx.collectBootstrap())[dataKey].caches.ownBattleStats.total,571764,'PDA async primary reads must be awaited.');
const send=(key,value)=>callbacks.get('write')({detail:JSON.stringify({key,value})});
send(statsKey,{total:571764,checkedAt:100});
send(statsKey,{total:603502,checkedAt:200});
send(dataKey,{_savedAt:200,caches:{ownBattleStats:{total:603502,checkedAt:200}}});
await dataWritten;
assert.equal(maxInFlight,1,'Native saves must remain ordered even when the old save takes longer.');
local.clear();
const reloaded=await ctx.collectBootstrap();
assert.equal(reloaded[statsKey].total,603502,'603K must survive a fresh WebView without a local mirror.');
assert.equal(reloaded[dataKey].caches.ownBattleStats.total,603502);
send(statsKey,{total:571764,checkedAt:100});
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(native.get(statsKey).total,603502,'A stale page must not overwrite a newer dedicated record in native storage.');
send('unrelated',{total:1});
await new Promise(resolve=>setTimeout(resolve,5));
assert.equal(native.has('unrelated'),false,'Only registered SLINK storage keys can use this bridge.');
console.log('PDA native storage roundtrip and async write-order tests passed.');
