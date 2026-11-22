import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const pda=import.meta.url.endsWith('/test-mugging-assignment.mjs');
const read=path=>fs.readFileSync(new URL((pda?'./':'../')+path,import.meta.url),'utf8');
const ff=read(pda?'src/00-mugging-ff.part':'src/core/mugging-ff.js');
const source=read(pda?'src/30-dashboard-combat.part':'src/background/mugging-service.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
const own={total:1000000,score:1000,level:50,checkedAt:Date.now()};
const row=(id,extra={})=>({player_id:id,source:'bss',bs_estimate:20000,last_updated:Math.floor(Date.now()/1000),bss_public:100,fair_fight:1.27,...extra});
function extract(name){const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert(start>=0);let code='';for(const line of source.slice(start).split('\n')){code+=line+'\n';try{new vm.Script(code);return code;}catch{}}throw Error('Cannot extract '+name);}
function setup({key='key',provider,targets,limit=2}={}){
 const settings={enabled:true,minFairFight:1,maxFairFight:2,limit},storage=new Map([['mugging.settings.v1',settings],['access.settings.v1',{tornKey:'torn-key',ffKey:key}]]);
 const state={settings:{mugging:settings},caches:{mugging:{targets:[{id:99}],generated_at:1}}};
 const requests=[],ffCalls=[],timers=new Map();let timerId=0,paused=null,grant=true;
 const defaultTargets=[{id:1,fair_fight:1.1,estimate_kind:'rough'},{id:2,fair_fight:1.1},{id:3,fair_fight:2.8},{id:4,fair_fight:1.1}];
 const http=async(url,options)=>{
  if(url.includes('ffscouter')){ffCalls.push(options);return provider?provider(options):[row(1,{fair_fight:2.8}),row(2,{fair_fight:1.5}),row(3,{fair_fight:1.7}),row(4,{source:'premium'})];}
  if(url.includes('/assignments/')){const body=typeof options.body==='string'?JSON.parse(options.body):options.body;requests.push({body,signal:options.signal});if(paused)await paused.promise;return {generated_at:Date.now(),targets:(targets||defaultTargets).filter(t=>!body.exclude_target_ids?.includes(t.id))};}
  return {};
 };
 const api={core:{storage:{get:async(k,f)=>storage.get(k)??f,set:async(k,v)=>{storage.set(k,v);if(k==='mugging.settings.v1')state.settings.mugging=v;}},permissions:{hasScope:()=>grant},http:{requestJson:(_kind,url,opts)=>http(url,opts)},format:{errorMessage:e=>e.message},tornApiLimiter:{getContributionCapacity:async()=>({available:1})}},services:{permissionAccess:{ensureSession:async()=>({token:'session',scopes:['slink.mugging']})},sharedData:{peekPersonal:async()=>own,personal:async()=>own}},define(group,name,value){this[group][name]=value;}};
 const ctx=vm.createContext({SLINK_EXTENSION:api,AbortController,URL,Date,console,chrome:{alarms:{clear:async()=>{},get:async()=>true}},
  setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),
  dataState:state,moduleState:{mugging:{busy:false,error:'',notice:''}},hasScope:s=>s==='slink.mugging'&&grant,
  renderMugging(){},touchMuggingActivity(){},pdaOwnBattleStats:async()=>own.total,pdaStoredOwnBattleStats:()=>own,
  schedulePdaCacheSave(){},syncMuggingContributorReports:async()=>({accepted:0}),errorMessage:e=>e.message,
  muggingRequest:(path,options)=>http('https://backend.invalid'+path,options),validPlayerIntelligenceId:v=>Number(v)||null,finite:v=>v==null?null:Number(v)
 });
 ctx.global=ctx;
 vm.runInContext(ff,ctx);
 if(pda){
  ctx.muggingFairFightChecks=ctx.SLINK_MUGGING_FF.create({key:async()=>key,request:(_ids,_key,signal)=>http('https://ffscouter.com',{signal}),queue:async()=>{}});
  vm.runInContext(extract('muggingCache')+extract('muggingDeadline')+'let muggingAssignmentRefresh=null,muggingAssignmentController=null;'+extract('refreshMugging'),ctx);
 }else vm.runInContext(source,ctx);
 const refresh=(opts={})=>pda?ctx.refreshMugging(!opts.background,opts):api.services.mugging.refresh({userBattleStats:own.total,...opts});
 return {ctx,requests,ffCalls,timers,storage,state,settings,refresh,pause:()=>paused=deferred(),unpause:()=>{paused.resolve();paused=null;},cache:()=>pda?state.caches.mugging:storage.get('mugging.cache.v1'),disable:async()=>{
  if(pda){state.settings.mugging.enabled=false;vm.runInContext("muggingAssignmentController?.abort(new Error('Mugging disabled'))",ctx);}
  else await api.services.mugging.routes['mugging.settings.save']({enabled:false});
 },revoke:()=>grant=false};
}
const env=setup();await env.refresh({excludeTargetIds:[99,'99',-1,'bad']});
assert.deepEqual(JSON.parse(JSON.stringify(env.requests[0].body.exclude_target_ids)),[99]);
assert.equal(env.requests[0].body.verify_fair_fight,true);assert.equal(env.requests[0].body.limit,100);assert.equal(env.requests[0].body.assignment_mode,'manual');
assert.equal(env.ffCalls.length,1);assert.deepEqual(Array.from(env.cache().targets,t=>t.id),[2,3],'Verify before filtering and before the display limit');
assert.equal(env.cache().targets[0].fairFight,1.5);assert.equal(env.requests.length,1,'Do not reload the same pool after contribution uploads');
await env.refresh({excludeTargetIds:env.cache().targets.map(t=>t.id)});assert(env.cache().targets.length>0);assert(env.cache().targets.every(t=>![2,3].includes(t.id)),'Backend alternatives are retained on the next manual search');
const concurrent=setup();concurrent.pause();const bg=concurrent.refresh({background:true,touch:false});await tick();assert.equal(concurrent.requests.length,1);
const fresh=concurrent.refresh({excludeTargetIds:[99]});await tick();assert.equal(concurrent.requests.length,1);concurrent.unpause();await Promise.all([bg,fresh]);
assert.equal(concurrent.requests.length,2);assert.equal(concurrent.requests[0].body.assignment_mode,'background');assert.equal(concurrent.requests[0].body.exclude_target_ids,undefined);assert.equal(concurrent.requests[1].body.assignment_mode,'manual');assert.deepEqual(Array.from(concurrent.requests[1].body.exclude_target_ids),[99]);
const missing=setup({key:''});await missing.refresh();assert.equal(missing.ffCalls.length,0);assert(missing.cache().targets.every(t=>t.estimateKind==='unchecked'&&t.fairFight===null));assert.match(missing.cache().ffCheckNotice,/FFScouter key.*Access|FFScouter key.*access/);
const failed=setup({provider:async()=>{throw Error('rate limit');}});await failed.refresh();assert(failed.cache().targets.every(t=>t.estimateKind==='unchecked'));assert.match(failed.cache().ffCheckNotice,/unavailable|rate.limit/);
const pending=deferred(),disabled=setup({provider:()=>pending.promise});const disableWork=disabled.refresh();await tick();assert.equal(disabled.ffCalls.length,1);await disabled.disable();pending.resolve([row(1)]);await disableWork.catch(()=>{});assert(!disabled.cache()?.updatedAt,'Disabled request must not publish results');assert.equal(disabled.ffCalls[0].signal.aborted,true);
const timed=setup();timed.pause();const timeoutWork=timed.refresh();await tick();const timer=[...timed.timers.values()].find(t=>t.ms===25000);assert(timer);timer.fn();await timeoutWork.catch(()=>{});assert.equal(timed.requests[0].signal.aborted,true);timed.unpause();await tick();assert(!timed.cache()?.updatedAt,'Late responses must not overwrite the cache');
const blocked=setup();await blocked.disable();await blocked.refresh().catch(()=>{});assert.equal(blocked.requests.length,0);assert.equal(blocked.ffCalls.length,0);
const denied=setup();denied.revoke();await denied.refresh().catch(()=>{});assert.equal(denied.requests.length,0);
// The exact imported main-branch scoring formula, including capped FF ambiguity.
const C=env.ctx.SLINK_MUGGING_FF;
const scored=C.applyRange([{id:1},{id:2},{id:3},{id:4,fairFight:1.1,estimateKind:'bss'}],new Map([[1,{bss:300,ff:null}],[2,{bss:900,ff:3}],[3,{bss:null,ff:3}]]),1000,1,2,100);
assert.equal(scored[0].fairFight,1.8);assert.equal(scored[0].estimateKind,'bss');assert(!scored.some(t=>t.id===2));assert(scored.filter(t=>t.id>=3).every(t=>t.fairFight===null&&t.estimateKind==='unchecked'));
// Key changes invalidate personalised scores; stale/spy-only data cannot verify targets.
let apiKey='one',clock=Date.now(),calls=0;
const checker=C.create({now:()=>clock,key:async()=>apiKey,request:async()=>{calls++;return [row(1),row(2,{last_updated:Math.floor(clock/1000)-31*86400}),row(3,{source:'premium'})];},queue:async()=>{}});
let checked=await checker.check([{id:1},{id:2},{id:3}],true);assert(checked.scores.has(1));assert(!checked.scores.has(2));assert(!checked.scores.has(3));apiKey='two';await checker.check([{id:1}],true);assert.equal(calls,2);
// Check actual rendered target controls rather than merely inspecting source strings.
const uiTargets=[{id:1,estimateKind:'bss',fairFight:1.8},{id:2,estimateKind:'rough',fairFight:1.1},{id:3,estimateKind:'unchecked',fairFight:null}];
if(pda){
 let html='';const root={set innerHTML(v){html=v;}};
 Object.assign(env.ctx,{shouldRenderPdaModule:()=>true,moduleRoot:()=>root,muggingCache:()=>({targets:uiTargets,pool:{},userLevel:50}),muggingLevelBadge:()=>'',PLAYER_INTELLIGENCE_TIMED_STATES:new Set(),escapeHtml:v=>String(v),number:v=>String(v),duration:v=>String(v),actionLink:(label,url)=>`<a href="${url}">${label}</a>`,moduleMessage:v=>v,muggingContributionMode:()=> 'active'});
 vm.runInContext(extract('renderMugging'),env.ctx);env.ctx.renderMugging();assert.match(html,/Estimated FF 1.8/);assert.equal((html.match(/>Attack</g)||[]).length,1);assert.equal((html.match(/>Save Target</g)||[]).length,3);assert.equal((html.match(/FF check pending/g)||[]).length,2);
}
console.log((pda?'PDA':'Extension')+' Mugging assignments: rotation, queued manual/background refresh, verified range/limit, missing key/provider fallback, timeout/disable/permission guards and BSS scoring passed.');
