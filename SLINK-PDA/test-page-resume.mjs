import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractFunction} from './test-support/runtime.mjs';
const core=fs.readFileSync(new URL('./src/00-runtime-core.part',import.meta.url),'utf8');
const activitySource=core.slice(core.indexOf('let pdaPagePresent'),core.indexOf("const STORAGE_KEY ="));
const events=new Map(),intervals=new Map(),timeouts=new Map();let nextId=0,domReads=0,polls=0,stakeouts=0,locks=0,unlocks=0,clears=0;
const on=(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);};
const emit=type=>{for(const fn of events.get(type)||[])fn({persisted:true});};
class Observer{connected=false;connections=0;observe(){this.connected=true;this.connections++;}disconnect(){this.connected=false;}}
const market=new Observer(),guardian=new Observer(),racing=new Observer();
const ctx=vm.createContext({console,document:{visibilityState:'visible',body:{},documentElement:{appendChild(){}},addEventListener:on,getElementById:()=>null,querySelectorAll:()=>{domReads++;return[];}},
 addEventListener:on,setTimeout:(fn,delay)=>{timeouts.set(++nextId,{fn,delay});return nextId;},clearTimeout:id=>timeouts.delete(id),setInterval:(fn,delay)=>{intervals.set(++nextId,{fn,delay});return nextId;},clearInterval:id=>intervals.delete(id),
 targetPollingTimer:null,targetStakeoutTimer:null,targetPollingKickoff:null,targetStakeoutKickoff:null,pdaForegroundActive:null,
 marketObserver:market,guardian,racingStateObserver:racing,attackMugScanTimer:null,racingScanTimer:null,keyboardFocusTimer:null,RACING_HIGHLIGHT_STYLE_ID:'owned-style',
 host:{isConnected:true},state:{page:'efficiency',efficiencyTab:'alerts',theme:'keep',minimizedMode:'chat'},dashboardOpen:true,pdaChatButton:{isConnected:true},
 dataState:{settings:{alerts:{enabledTypes:{medicalCooldown:false}}},caches:{targetList:{'42':{description:'keep'}}}},
 TARGET_POLL_TICK_MS:1000,TARGET_STAKEOUT_TICK_MS:2000,
 runTargetPolling:()=>{polls++;},runTargetStakeouts:()=>{stakeouts++;},ensurePdaChatButton:()=>{domReads++;},syncThemeHealthAssets:()=>{domReads++;},schedulePurchaseOpportunityFormatting:()=>{domReads++;},scheduleRacingScan:()=>{domReads++;},scanAttackMugResults:()=>{domReads++;},scanIntendedProfileDom:()=>{domReads++;},clearRacingHighlight(){},clearMarketPurchaseFormatting:()=>{clears++;},clampLauncher(){},lockTornScroll:()=>{locks++;},unlockTornScroll:()=>{unlocks++;},schedulerTimer:null});ctx.global=ctx;
vm.runInContext(activitySource,ctx);
for(const name of ['repairPdaHost','startPdaTargetTimers','stopPdaTargetTimers','syncPdaForeground'])vm.runInContext(extractFunction(name,'src/90-shell-bootstrap.part'),ctx);
ctx.SLINK_PDA_PAGE_ACTIVITY.subscribe(ctx.syncPdaForeground);on('pagehide',ctx.stopPdaTargetTimers);on('pageshow',ctx.startPdaTargetTimers);
const saved=JSON.stringify({state:ctx.state,data:ctx.dataState});
ctx.startPdaTargetTimers();ctx.syncPdaForeground();assert.equal(intervals.size,2);assert.equal(market.connected,true);
const oldIntervals=[...intervals.values()].map(value=>value.fn),oldKickoffs=[...timeouts.values()].map(value=>value.fn),connections=market.connections;
ctx.syncPdaForeground();emit('pageshow');emit('visibilitychange');assert.equal(intervals.size,2);assert.equal(market.connections,connections);
ctx.document.visibilityState='hidden';emit('visibilitychange');assert.equal(market.connected,false);assert.equal(guardian.connected,false);assert.equal(racing.connected,false);
assert.equal(intervals.size,2,'Authorized API polling policy is not changed by visibility alone');
emit('pagehide');assert.equal(intervals.size,0);assert.equal(timeouts.size,0);
const before=domReads;ctx.syncPdaForeground(false);assert.equal(domReads,before);
emit('pageshow');assert.equal(intervals.size,2);assert.equal(market.connected,false,'Hidden pageshow must not reconnect DOM observers');
ctx.document.visibilityState='visible';emit('visibilitychange');assert.equal(market.connected,true);assert.equal(guardian.connected,true);
for(const fn of oldIntervals)fn();for(const fn of oldKickoffs)fn();assert.equal(polls,0);assert.equal(stakeouts,0,'Old interval callbacks cannot duplicate restarted jobs');
for(const {fn}of intervals.values())fn();assert.equal(polls,1);assert.equal(stakeouts,1);
for(let i=0;i<5;i++){emit('pagehide');assert.equal(intervals.size,0);emit('pageshow');assert.equal(intervals.size,2);}
assert.equal(JSON.stringify({state:ctx.state,data:ctx.dataState}),saved,'Resume must not reset settings, selected tab, theme, targets or notes');assert(locks>1&&unlocks>0&&clears>0);
vm.runInContext(extractFunction('visibleLifeSnapshot','src/90-shell-bootstrap.part'),ctx);ctx.document.visibilityState='hidden';emit('visibilitychange');const reads=domReads;assert.equal(ctx.visibleLifeSnapshot(),null);assert.equal(domReads,reads,'Theme fallback must not scrape life while hidden');
vm.runInContext(extractFunction('startScheduler','src/90-shell-bootstrap.part'),ctx);ctx.startScheduler();emit('pagehide');[...intervals.values()][0].fn();assert.equal(domReads,reads,'A pagehide-suspended scheduler must return before any page work');
ctx.document.visibilityState='visible';emit('pageshow');
let factionReads=0,launches=0,sends=0;
ctx.normalizeChatHtml=value=>value;ctx.factionContainer=()=>{factionReads++;return null;};ctx.factionComposer=()=>null;ctx.factionLauncher=()=>({click:()=>{launches++;}});
vm.runInContext(extractFunction('waitFor','src/40-war.part')+extractFunction('sendToFaction','src/40-war.part'),ctx);
const pendingSend=ctx.sendToFaction('Synthetic draft');const readBeforeHide=factionReads;
ctx.document.visibilityState='hidden';emit('visibilitychange');ctx.document.visibilityState='visible';emit('visibilitychange');
const waitTimer=[...timeouts.values()].find(value=>value.delay===75);assert(waitTimer);waitTimer.fn();assert.equal(await pendingSend,false);assert.equal(factionReads,readBeforeHide,'A pre-hide pending action must not query or send after resume');assert.equal(launches,1);
const composer={matches:()=>false,focus(){},dispatchEvent(){}};
ctx.document.hasFocus=()=>false;ctx.factionComposer=()=>composer;ctx.factionSendButton=()=>({disabled:false,getAttribute:()=>null,click:()=>{sends++;}});ctx.Event=class{};
assert.equal(await ctx.sendToFaction('Explicit second-click test'),true,'Visible PDA actions must not depend on unreliable desktop hasFocus');assert.equal(sends,1);
const shell=fs.readFileSync(new URL('./src/90-shell-bootstrap.part',import.meta.url),'utf8');
const viewportHandlers=shell.split(/\r?\n/).filter(line=>line.startsWith("global.addEventListener('resize', () => { if")||line.startsWith("global.addEventListener('orientationchange', () => global.SLINK_PDA_PAGE_ACTIVITY.defer"));
assert.equal(viewportHandlers.length,2);let viewportWrites=0;ctx.clampLauncher=()=>{viewportWrites++;};vm.runInContext(viewportHandlers.join('\n'),ctx);
ctx.document.visibilityState='hidden';emit('visibilitychange');emit('resize');emit('orientationchange');assert.equal(viewportWrites,0,'Hidden/zero-size viewport events must not save a clamped default launcher position');
ctx.document.visibilityState='visible';emit('visibilitychange');ctx.state.minimizedMode='bubble';ctx.state.bubblePosition={left:200,top:300};ctx.innerWidth=0;ctx.innerHeight=0;ctx.writeState=()=>{viewportWrites++;};ctx.launcher={dataset:{}};
vm.runInContext(extractFunction('clampLauncher','src/90-shell-bootstrap.part'),ctx);const beforeClamp=viewportWrites;ctx.clampLauncher(true);assert.equal(viewportWrites,beforeClamp);assert.deepEqual(ctx.state.bubblePosition,{left:200,top:300},'Transient zero-size viewport must not erase the saved position');
console.log('PDA repeated pagehide/pageshow, hidden startup/resume, singleton timers/observers, stale callback exclusion, scroll restoration and saved state retention passed.');
const build='direct-source';let reopened=0;
const existingActivity={marker:'keep'};
const reuse=vm.createContext({document:{getElementById:()=>({dataset:{slinkReady:'true'}})},SLINK_PDA_DASHBOARD:{build,open:()=>{reopened++;}},SLINK_PDA_PAGE_ACTIVITY:existingActivity,__SLINK_PDA_BOOTSTRAP__:{synthetic:'not-retained'}});reuse.global=reuse;
const early=core.slice(core.indexOf('(function installSlinkPdaDashboard'),core.indexOf('// PDA visibility is authoritative;'));
for(let i=0;i<4;i++)vm.runInContext(early+"throw Error('Duplicate runtime did not return before installing activity hooks');})(globalThis);",reuse);
assert.equal(reopened,4);assert.equal(reuse.SLINK_PDA_PAGE_ACTIVITY,existingActivity);assert.equal(reuse.__SLINK_PDA_BOOTSTRAP__,undefined);
// The embedded custom-message sender has a separate asynchronous wait owner.
let macroGeneration=0,macroTimer,macroClicks=0;
const macroButton={isConnected:true,disabled:true,getAttribute:()=>null,click(){macroClicks++;}};
const macro=vm.createContext({Date,Promise,activity:{eligible:()=>true,token:()=>macroGeneration,current:token=>token===macroGeneration},
 window:{setTimeout:fn=>{macroTimer=fn;}},sending:false,armed:{macroId:'one',contextId:'faction',message:'draft',expiresAt:Date.now()+10000},
 contextComposer:()=>({}),contextId:()=> 'faction',contextContent:()=> 'draft',contextSendButton:()=>macroButton,
 renderMenu(){},clearArmed(){macro.armed=null;},isNewsletterRoot:()=>false,menu:null,menuStatus:''});
const macroSource=fs.readFileSync(new URL('./src/addons/chat.addon.js',import.meta.url),'utf8');
vm.runInContext(macroSource.slice(macroSource.indexOf('  async function waitForEnabledSend('),macroSource.indexOf('  function openEditor(')),macro);
const pendingMacro=macro.handleMacroClick({id:'one'},{isConnected:true});
assert(macroTimer);macroGeneration++;macroButton.disabled=false;macroTimer();await pendingMacro;
assert.equal(macroClicks,0,'A pre-hide custom-message action must not send after resume');assert.equal(macro.armed,null);assert.equal(macro.sending,false);
macro.armed={macroId:'one',contextId:'faction',message:'draft',expiresAt:Date.now()+10000};
await macro.handleMacroClick({id:'one'},{isConnected:true});assert.equal(macroClicks,1,'A new explicit confirmation may send while active');

