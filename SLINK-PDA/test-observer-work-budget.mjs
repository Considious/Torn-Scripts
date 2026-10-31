import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const observers=[],timers=new Map(),listeners=new Map(),settings={highlights:[]};let queries=0,next=0,active=true;
const activity={eligible:()=>active,subscribe(fn){listeners.set('activity',fn);},cancel(id){timers.delete(id);},defer(fn){timers.set(++next,fn);return next;}};
const document={body:{},querySelectorAll(){queries++;return[];}};
const context={document,console,URL,CustomEvent:class{},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){this.connected=true;}disconnect(){this.connected=false;}},
 SLINK_PDA_PAGE_ACTIVITY:activity,SLINK_CHAT_FF:{mount:()=>({sync(){}})},dispatchEvent(){},addEventListener(name,fn){listeners.set(name,fn);},location:{pathname:'/page.php'},setInterval(){},
 SLINK_PDA_PLUGIN_API:{settings:()=>settings,register:plugin=>plugin.start(),hasScope:()=>false,root:()=>null,cache:()=>({}),chatFairFight:async()=>[]}};
context.globalThis=context;
const chat=fs.readFileSync(new URL('./src/addons/chat.addon.js',import.meta.url),'utf8');
vm.runInNewContext(chat.slice(chat.indexOf('(function registerSlinkPdaChat')),context);
const irrelevant={target:{nodeType:1,closest:()=>null},addedNodes:[]};
for(let i=0;i<10000;i++)observers[0].fn([irrelevant]);
assert.equal(queries,0);assert.equal(timers.size,0,'No highlight settings: no repeated scanning or timers');
settings.highlights=[{term:'hello'}];
for(let i=0;i<10000;i++)observers[0].fn([irrelevant]);
assert.equal(timers.size,0,'Unrelated page churn must not schedule chat highlighting');
observers[0].fn([{target:{nodeType:1,closest:()=>({})},addedNodes:[]}]);assert.equal(timers.size,1);
for(const [id,fn]of timers){timers.delete(id);fn();}assert.equal(queries,1,'Changed message still receives a highlight pass');
observers.length=0;listeners.clear();timers.clear();
vm.runInNewContext(fs.readFileSync(new URL('./src/addons/events.addon.js',import.meta.url),'utf8'),context);
assert.equal(observers[0].connected,false,'Basket observer must not watch attacks or other non-Items pages');
context.location.pathname='/item.php';listeners.get('popstate')();assert.equal(observers[0].connected,true);
active=false;listeners.get('activity')(false);assert.equal(observers[0].connected,false);
active=true;listeners.get('activity')(true);assert.equal(observers[0].connected,true);
context.location.pathname='/profiles.php';listeners.get('popstate')();assert.equal(observers[0].connected,false);
console.log('20,000 unrelated changes: no highlight scans/timers; basket observes only active Items pages, resumes correctly.');
