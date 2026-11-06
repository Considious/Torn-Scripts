import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {extractFunction,fragments} from './test-support/runtime.mjs';
const core='src/00-runtime-core.part';
test('PDA reserves active watch demand and gives alerts first priority',()=>{
 const now=Date.now(),c=vm.createContext({Date,API_LIMIT:60,CONTRIBUTION_CEILING:40,CONTRIBUTION_INTERACTIVE_RESERVE:10,validSession:()=>true,hasScope:()=>true,moduleIsActive:()=>true,marketWatchLimit:()=>5,marketSettings:()=>({enabled:true,listedItemsEnabled:true,watches:Array.from({length:5},()=>({enabled:true,maxPrice:100,marketEnabled:true}))})});
 for(const n of ['foregroundApiDemand','protectedApiCapacity','contributionCapacity'])vm.runInContext(extractFunction(n,core),c);
 const ledger={events:[]};assert.equal(c.protectedApiCapacity(ledger,'normal'),15);assert.equal(c.protectedApiCapacity(ledger,'market'),5);assert.equal(c.protectedApiCapacity(ledger,'alerts'),0);assert.equal(c.contributionCapacity(ledger).available,35);
 ledger.events=Array.from({length:35},()=>({at:now,priority:'contribution'}));assert.equal(c.contributionCapacity(ledger).available,0);
 c.moduleIsActive=()=>false;assert.equal(c.protectedApiCapacity(ledger,'normal'),5);
});
test('PDA uses the same cache cycle and ten-second Weaver screen, with no stale retry burst',()=>{
 const market=fragments.get('src/10-market-runtime.part'),s=fragments.get(core);
 assert.match(s,/WEAVER_SUMMARY_REFRESH_MS = 10_000/);assert.doesNotMatch(market,/stale \? now \+ Math.min/);assert.match(market,/Math.floor\(\(now - deadline\) \/ ITEM_MARKET_FALLBACK_MS\)/);assert.match(market,/needPrices:false/);
 const src=extractFunction('refreshMarket','src/10-market-runtime.part');assert.match(src,/cacheDelayMs !== null/);
});
test('browser storage quota failure does not reset the PDA request ledger',()=>{
 const c=vm.createContext({Date,API_WINDOW_MS:60000,SHARED_API_LEDGER_KEY:'test',volatileApiLedger:{events:[],cooldownUntil:0},global:{localStorage:{getItem:()=>null,setItem:()=>{throw Error('QuotaExceededError');}}}});
 for(const n of ['readApiLedger','writeApiLedger'])vm.runInContext(extractFunction(n,core),c);
 c.writeApiLedger({events:[{id:'request-one',at:Date.now(),priority:'market'}],cooldownUntil:0});assert.equal(c.readApiLedger().events.length,1);
});
test('PDA waiting reservations do not hold the queue against general alerts',async()=>{
 let wake,uid=0;const c=vm.createContext({Date,API_LIMIT:60,API_WINDOW_MS:60000,CONTRIBUTION_CEILING:40,CONTRIBUTION_INTERACTIVE_RESERVE:10,global:{setTimeout:fn=>{wake=fn;},crypto:{randomUUID:()=>String(++uid)}},serializeNetwork:fn=>fn(),withApiLock:fn=>fn(),protectedApiCapacity:(_l,p)=>p==='alerts'?0:15,contributionCapacity:()=>({available:0}),ledger:{events:Array.from({length:45},(_,i)=>({at:Date.now()-i})),cooldownUntil:0}});
 let queue=Promise.resolve();c.serializeNetwork=fn=>{const task=queue.then(fn,fn);queue=task.catch(()=>{});return task;};
 c.readApiLedger=()=>c.ledger;c.writeApiLedger=x=>{c.ledger=x;};
 vm.runInContext(extractFunction('reserveTornApi',core),c);
 const waiting=c.reserveTornApi('/normal');for(let i=0;i<20&&!wake;i++)await new Promise(setImmediate);assert.equal(typeof wake,'function');
 await c.reserveTornApi('/alert',{priority:'alerts',wait:false});assert.equal(c.ledger.events.length,46);c.ledger.events=[];wake();await waiting;
});

