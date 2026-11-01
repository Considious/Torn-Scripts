import assert from 'node:assert/strict';
import vm from 'node:vm';
import {extractFunction,fragments} from './test-support/runtime.mjs';
const core='src/00-runtime-core.part',shell='src/90-shell-bootstrap.part';
const load=(ctx,name,file=core)=>vm.runInContext(extractFunction(name,file),ctx);
// The actual Alert renderer must keep the launcher current without assigning
// hidden HTML, then paint current data as soon as its panel is selected.
let paints=0,count=0,rows=[{id:'medicalCooldown',title:'Medical ready',detail:'Ready',links:[]}];
const ctx=vm.createContext({dashboardOpen:false,pdaDomActive:()=>true,state:{page:'combat',combatTab:'leveling'},Set,moduleRoot:()=>({set innerHTML(html){paints++;assert.match(html,/Medical ready|Nothing needs/);}}),hasScope:()=>true,stakeoutAlertRows:()=>[],PDA_ABROAD:{alerts:()=>[]},warRetalAlertRows:()=>[],syncPdaRetalSound(){},companyAlertRows:()=>[],pdaPluginAlerts:()=>[],moduleState:{alerts:{data:{cityBought:100,at:1}}},dataState:{settings:{alerts:{}}},alertRows:()=>rows,updateAlertIndicator:n=>{count=n;},finite:Number,utcDay:()=>1,number:String,relativeTime:()=>'',escapeHtml:String,timer24Label:()=>'',alertSettingsHtml:()=>'',moduleMessage:String,actionLink:()=>''});
for(const name of ['shouldRenderPdaModule','activeModuleName'])load(ctx,name,shell);load(ctx,'renderAlerts','src/40-war.part');
ctx.renderAlerts();assert.equal(count,1);assert.equal(paints,0);
ctx.dashboardOpen=true;ctx.renderAlerts();assert.equal(paints,0,'Another selected module must not paint Alerts');
ctx.state.page='efficiency';ctx.state.efficiencyTab='alerts';ctx.renderAlerts();assert.equal(paints,1);
ctx.dashboardOpen=false;rows=[];ctx.renderAlerts();assert.equal(count,0);assert.equal(paints,1);
ctx.dashboardOpen=true;ctx.renderAlerts();assert.equal(paints,2,'Reopening paints current, not stale hidden HTML');

// Real target functions: empty and future passes do not schedule cache saves;
// removing obsolete schedules and expiring alerts are meaningful exceptions.
let scheduled=0,rendered=0,lookups=0,notified=0;
let targets=[],cache={};const runtime={schedule:{},observed:{}};
const target=vm.createContext({console,Date,JSON,hasScope:()=>true,TARGET_LIST_SCOPE:'targets',TARGET_STAKEOUT_MAX_DUE_PER_TICK:20,targetStakeoutBusy:false,targetPollingBusy:false,beginPdaCacheBatch(){},endPdaCacheBatch(){},targetStakeoutRuntime:()=>runtime,targetStakeoutTargets:()=>targets,targetStakeoutAlertCache:()=>cache,dataState:{caches:{alertNotificationIds:[]}},moduleState:{alerts:{data:null}},schedulePdaCacheSave:()=>{scheduled++;},renderTargetList:()=>{rendered++;},renderAlerts:()=>{rendered++;},reconcileAlertNotifications(){notified++;target.dataState.caches.alertNotificationIds=Object.keys(cache);},targetPollingSettings:()=>({enabled:false,intervalMinutes:10}),targetPollingRuntime:()=>({schedule:{},revision:0}),targetPollingEligible:()=>[],seedTargetPolling(){},refreshPlayerIntelligence:async()=>{lookups++;return {fetched:true,record:{},reason:'api'};},playerIntelligenceRecord:()=>null,collectTargetStakeoutChanges:()=>[],errorMessage:e=>e.message});
load(target,'runTargetStakeouts');load(target,'runTargetPolling');
for(let i=0;i<5;i++)await target.runTargetStakeouts(1000+i*5000);assert.equal(scheduled,0);assert.equal(rendered,0);
targets=[{playerId:1,stakeoutIntervalSeconds:10}];runtime.schedule['1']=999999;
await target.runTargetStakeouts(1000);assert.equal(scheduled,0);assert.equal(lookups,0);
await target.runTargetPolling(1000);assert.equal(scheduled,0,'Disabled polling is not a periodic save');
cache={expired:{expiresAt:500}};await target.runTargetStakeouts(1000);assert.equal(Object.keys(cache).length,0);assert.equal(scheduled,1);assert.equal(notified,1);
targets=[];await target.runTargetStakeouts(2000);assert.equal(scheduled,2,'Removing an obsolete schedule is persisted once');
await target.runTargetStakeouts(3000);assert.equal(scheduled,2);
targets=[{playerId:2,stakeoutIntervalSeconds:10}];await target.runTargetStakeouts(4000);assert.equal(lookups,1);assert.equal(runtime.schedule['2'],14000);assert.equal(scheduled,3);

// Real cache queue: collection-level batching, single-flight saves, no failed
// save retry storm, and explicit flush support. No settings writer is replaced.
const timers=new Map();let id=0,writes=0,fail=false,release=null;
const queue=vm.createContext({Promise,Error,Math,global:{setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)},writeDataState(){writes++;if(fail)return Promise.reject(Error('native failure'));if(release)return new Promise(resolve=>{release=resolve;});return Promise.resolve();}});
for(const name of ['schedulePdaCacheSave','beginPdaCacheBatch','endPdaCacheBatch','flushPdaCacheSave'])load(queue,name);
queue.beginPdaCacheBatch();for(let i=0;i<40;i++)queue.schedulePdaCacheSave();assert.equal(timers.size,0);queue.endPdaCacheBatch();assert.equal(timers.size,1);await queue.flushPdaCacheSave();assert.equal(writes,1);assert.equal(timers.size,0);
release=true;queue.schedulePdaCacheSave();const saving=queue.flushPdaCacheSave();queue.schedulePdaCacheSave();queue.schedulePdaCacheSave();assert.equal(writes,2);release();release=null;await saving;await queue.flushPdaCacheSave();assert.equal(writes,3,'Updates during a save produce one later save, not overlapping writers');
fail=true;queue.schedulePdaCacheSave();await assert.rejects(queue.flushPdaCacheSave(),/native failure/);queue.schedulePdaCacheSave();assert.equal(timers.size,0,'A failed cache save must not start an automatic retry loop');

// Legacy Bounties data is merged with field timestamps before the duplicate
// serialization path is removed. Never discard a primary fresh estimate.
const source=fragments.get(core),intel=vm.createContext({Date,Number,String,Set,Map,Math,Object,dataState:{caches:{playerIntelligence:{'10':{playerId:10,battleStatsEstimate:900,observedAt:2000,checkedAt:2000,source:'torn-api'}},bounties:{statuses:{'10':{playerId:10,battleStatsEstimate:100,observedAt:1000,checkedAt:1000},'20':{playerId:20,battleStatsEstimate:300,observedAt:1000,checkedAt:1000}}}}}});
vm.runInContext(source.slice(source.indexOf('function validPlayerIntelligenceId('),source.indexOf('function normalizeTargetListTag(')),intel);load(intel,'adoptPdaLegacyIntelligence');intel.adoptPdaLegacyIntelligence();
assert.equal(intel.dataState.caches.playerIntelligence['10'].battleStatsEstimate,900);assert.equal(intel.dataState.caches.playerIntelligence['20'].battleStatsEstimate,300);assert.equal(intel.dataState.caches.bounties.statuses,intel.dataState.caches.playerIntelligence);
const stored=JSON.parse(JSON.stringify(intel.dataState));assert.equal(stored.caches.bounties.statuses,undefined);assert.equal(stored.caches.playerIntelligence['20'].battleStatsEstimate,300);
intel.dataState=stored;intel.adoptPdaLegacyIntelligence();assert.equal(intel.dataState.caches.bounties.statuses,intel.dataState.caches.playerIntelligence,'Restart restores the live alias without a second saved copy');
console.log('Lazy alert panels/current badge, idle/due/expired target checks, batched single-flight cache saves, failure pause and lossless legacy intelligence adoption passed.');
