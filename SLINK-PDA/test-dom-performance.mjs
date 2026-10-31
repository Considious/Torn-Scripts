import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const path='src/60-xanax-safety.part';
const source=fs.readFileSync(new URL('./'+path,import.meta.url),'utf8');
const isPda=path.endsWith('.part');
const events=new Map(),timers=new Map(),observers=[];let id=0,queries=0,energyReads=0,hasAction=false,focused=true,confirmed=0;
const on=(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);};
const emit=name=>{for(const fn of events.get(name)||[])fn({});};
const action={toggleAttribute(){},setAttribute(){},removeAttribute(){}};
const energy={getAttribute:()=>null,textContent:'900 / 1000',closest:()=>null};
const document={visibilityState:'visible',hasFocus:()=>focused,documentElement:{appendChild(){}},addEventListener:on,
 createElement:()=>({}),querySelectorAll(selector){queries++;if(selector.includes('Take Xanax'))return hasAction?[action]:[];energyReads++;return [energy];}};
class Observer{constructor(fn){this.fn=fn;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}
const ctx={document,MutationObserver:Observer,Object,Number,String,Math,Set,console,addEventListener:on,
 setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key),confirm:()=>{confirmed++;return false;}};ctx.global=ctx;ctx.pdaDomActive=()=>document.visibilityState!=='hidden';ctx.SLINK_PDA_PAGE_ACTIVITY={subscribe(){}};ctx.SLINK_EXTENSION={core:{pageActivity:{eligible:()=>document.visibilityState==='visible'&&focused,subscribe(){}}}};
vm.runInNewContext(source,ctx);const flush=()=>{for(const [key,fn]of[...timers]){timers.delete(key);fn();}};flush();
assert.equal(energyReads,0,'Without Xanax actions there must be no full-page energy search');queries=0;
const unrelated={type:'characterData',target:{nodeType:3,parentElement:{closest:()=>null}}};
for(let n=0;n<10000;n++)observers[0].fn([unrelated]);flush();assert.equal(queries,0,'Attack/log text storms must not schedule whole-page queries');
hasAction=true;observers[0].fn([{type:'childList',target:{nodeType:1,closest:()=>null},addedNodes:[{nodeType:1,matches:()=>true}]}]);flush();assert(energyReads>0,'New native Xanax controls must still decorate');
let prevented=0;const node={nodeType:1,closest:selector=>selector==='.tt-close-icon'?null:node,matches:()=>false};
for(const fn of events.get('click'))fn({target:node,preventDefault(){prevented++;},stopPropagation(){},stopImmediatePropagation(){}});
assert.equal(confirmed,1);assert.equal(prevented,1,'Real click must still confirm current energy, not a stale decoration');
document.visibilityState='hidden';emit('visibilitychange');assert.equal(observers[0].active,false);assert.equal(timers.size,0);
document.visibilityState='visible';emit('visibilitychange');assert.equal(observers[0].active,true);flush();
if(!isPda){focused=false;emit('blur');assert.equal(observers[0].active,false);focused=true;emit('focus');assert.equal(observers[0].active,true);}
emit('pagehide');assert.equal(observers[0].active,false);emit('pageshow');assert.equal(observers[0].active,true);
console.log('10,000 unrelated attack mutations: zero rescans; live Xanax confirmation and repeated activity resume passed.');


