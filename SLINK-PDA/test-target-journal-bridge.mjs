import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const loader=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
const factorySource=fs.readFileSync(new URL('./src/00-target-records.part',import.meta.url),'utf8');
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const native=new Map(),browser=new Map();let quota=false,partial=false,sets=0;
const store={get:async(key,fallback)=>clone(native.get(key)??fallback),list:async()=>[...native.keys()],getMany:async keys=>Object.fromEntries(keys.map(key=>[key,clone(native.get(key)??null)])),set:async(key,value)=>{if(quota)throw Error('QuotaExceeded');native.set(key,clone(value));sets++;if(partial){partial=false;throw Error('Interrupted');}},setMany:async values=>{if(quota)throw Error('QuotaExceeded');for(const [key,value]of Object.entries(values))native.set(key,clone(value));sets++;}};
const localStorage={get length(){return browser.size;},key:index=>[...browser.keys()][index]??null,getItem:key=>browser.get(key)??null,setItem:(key,value)=>{if(quota)throw Error('QuotaExceeded');browser.set(key,value);}};
let id=0;
function page(useNative=true){
 const ctx=vm.createContext({u:'targets',globalThis:{PDA_storage:useNative?store:null,localStorage},isRecord:value=>!!value&&typeof value==='object'&&!Array.isArray(value)});
 vm.runInContext(loader.slice(loader.indexOf('function nativeStorage()'),loader.indexOf('function mergeChanges(')),ctx);
 const factory=vm.createContext({});vm.runInContext(factorySource,factory);
 return {read:ctx.targetJournal,create:(snapshot,legacy={})=>factory.SLINK_PDA_TARGET_RECORDS.create({snapshot,legacy,write:ctx.targetJournal,id:()=>`bridge:${++id}`})};
}
const a=page(),b=page();
const left=a.create(await a.read(),{'1':{name:'A',description:'before'}});await left.ready;
const right=b.create(await b.read());await right.ready;
await Promise.all([left.change('patch',1,left.snapshot()['1'],{name:'A',description:'after'}),right.change('patch',1,right.snapshot()['1'],{name:'B',description:'before'})]);
const cold=a.create(await a.read());assert.equal(cold.snapshot()['1'].description,'after');assert.equal(cold.snapshot()['1'].name,'B');
browser.clear();assert.equal(a.create(await a.read()).snapshot()['1'].description,'after','Clearing all page mirrors may not remove native target notes');
await left.change('remove',1);await assert.rejects(right.change('patch',1,right.snapshot()['1'],{name:'Stale'}),/deleted/);
assert.equal(a.create(await a.read(),{'1':{name:'legacy'}}).snapshot()['1'],undefined);
quota=true;await assert.rejects(left.change('add',2,{}, {name:'Retried'}),/Quota/);quota=false;await left.retry();
assert.equal(a.create(await a.read()).snapshot()['2'].name,'Retried');
const before=sets;await left.refresh();assert.equal(sets,before,'Foreground refresh is read-only');
const row=(await a.read()).ops[0];await assert.rejects(a.read({ops:[{...row,value:{tampered:true}}]}),/collision/);
const brokenKey='targets:op:unknown';native.set(brokenKey,{schema:99,id:'unknown'});await assert.rejects(a.read(),/damaged/);native.delete(brokenKey);
const batch=store.setMany;delete store.setMany;partial=true;
const interrupted=a.create(await a.read());await assert.rejects(interrupted.change('add',3,{}, {name:'Interrupt safe'}),/Interrupted/);await interrupted.retry();assert.equal(a.create(await a.read()).snapshot()['3'].name,'Interrupt safe');store.setMany=batch;
const browserPage=page(false),fallback=browserPage.create(await browserPage.read(),{'9':{name:'Browser fallback'}});await fallback.ready;assert.equal(browserPage.create(await browserPage.read()).snapshot()['9'].name,'Browser fallback');
quota=true;await assert.rejects(fallback.change('patch',9,fallback.snapshot()['9'],{name:'Unsaved'}),/Quota/);quota=false;await fallback.retry();
const list=store.list,getMany=store.getMany;delete store.list;delete store.getMany;
await assert.rejects(a.read(),/enumeration unavailable/);store.loadAll=async()=>Object.fromEntries(native);assert.ok((await a.read()).ops.length);delete store.loadAll;store.list=list;store.getMany=getMany;
console.log('Actual PDA loader target bridge: independent WebViews, native/browser backends, read-only refresh, quota, partial acknowledgement, malformed records and cache-clear recovery passed.');

