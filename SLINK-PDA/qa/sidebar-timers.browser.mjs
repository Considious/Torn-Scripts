import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const paths=['./inline-status.js','../src/content/inline-status.js','../src/addons/inline-status.addon.js'];
const source=fs.readFileSync(new URL(paths.find(p=>fs.existsSync(new URL(p,import.meta.url))),import.meta.url),'utf8');
const helpers={};vm.runInNewContext(source,helpers);const model=helpers.SLINK_INLINE_STATUS,now=Date.parse('2026-11-21T18:14:50Z');
assert.equal(model.elapsed(117660000),'1d 8h 41m');assert.equal(model.elapsed(59000),'0m');assert.equal(model.elapsed(-1),'0m');
assert.equal(model.dailyWindow(now),false);assert.equal(model.dailyWindow(now+10000),true);assert.equal(model.dailyWindow(now+70000),false);
const defaultTimers={alerts:{at:now,body:{cooldowns:{medical:999999,drug:999999,booster:999999},education:{current:{until:(now+100000)/1000}}}}};
assert.deepEqual(Object.keys(model.timers(defaultTimers,now)),[]);
assert.equal(model.timers({virus:{at:now,until:(now+7200000)/1000}},now).virus.end,now+7200000);
assert.equal(model.timers({alerts:{at:now,body:{organizedCrime:{ready_at:now/1000-1,executed_at:now/1000}}}},now).oc,undefined);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{for(const pda of [false,true]){
 const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:now});
 await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<aside id="sidebar"><div class="userInformation___Kae57"><div class="bars">Energy: 150/250</div></div></aside><main id="mainContainer"></main>'}));await page.goto('https://www.torn.com/index.php');
 await page.evaluate(({pda,now})=>{
  window.calls=[];window.owner=7;window.caches={};const alerts={at:now,fetchedAt:now,body:{profile:{id:7},organizedCrime:{ready_at:(now+117660000)/1000},cooldowns:{medical:999999,booster:999999}}};alerts.data=alerts.body;
  const company={userId:7,self:{addictionPenalty:12}},war={startedAt:(now+90000000)/1000,detectedAt:now,ownFactionId:3};
  window.statusFixture={owner:7,expiresAt:now+86400000,canVirus:true,canCompany:true,canWar:true,alerts,company,war};
  const request=async name=>{calls.push(name);if(name.includes('virus'))return {virus:{until:(now+172800000)/1000}};if(name.includes('employees'))return {employees:[{id:7,effectiveness:{addiction:-15}}]};return {owner:'7',date:'2026-11-21',at:Date.now(),penalty:-15};};
  if(pda)window.SLINK_PDA_PLUGIN_API={inlineStatus:()=>({...statusFixture,owner}),moduleMonitoringEnabled:()=>true,cache:(k)=>caches[k]??(caches[k]={}),persist:()=>{},tornJson:request};
  else {window.store={'access.session.v1':{userId:7,token:'fixture',expiresAt:now+86400000,factionId:3},'adhd.runtime.v1':{snapshot:alerts},'company.runtime.v1':{snapshot:company},'war.activeWar.v1':war};window.SLINK_EXTENSION={core:{storage:{get:async k=>store[k],set:async(k,v)=>{store[k]=v;},fullKey:k=>k},permissions:{hasScope:()=>true},messaging:{send:request}}};}
 },{pda,now});
 await page.clock.pauseAt(now+1000);await page.addScriptTag({content:source});await page.waitForFunction(()=>document.querySelector('[data-slink-sidebar-timers]')?.textContent.includes('Virus'));
 let text=await page.locator('[data-slink-sidebar-timers]').textContent();assert.equal(text,'OC: 1d 8h 40mRW: 1d 0h 59mCompany Addiction: -12Virus: 1d 23h 59m');
 assert.equal(await page.locator('details').count(),0);assert.equal(await page.locator('#mainContainer').textContent(),'');assert.equal(await page.locator('.bars').textContent(),'Energy: 150/250');assert.equal(await page.evaluate(()=>calls.length),1);
 await page.clock.runFor(15000);await page.waitForFunction(()=>document.querySelector('[data-slink-sidebar-timers]').textContent.includes('Company Addiction: -15'));
 await page.clock.runFor(30000);assert.equal(await page.evaluate(()=>calls.length),2,'One virus check, one daily company check');
 await page.evaluate(()=>{const info=document.querySelector('[class^="userInformation___"]');info.replaceWith(Object.assign(document.createElement('div'),{className:'userInformation___new',innerHTML:'<div class="bars">Energy: 150/250</div>'}));});await page.clock.runFor(20);assert.equal(await page.locator('[data-slink-sidebar-timers]').count(),1);
 assert.deepEqual(errors,[]);await page.close();
}console.log('Sidebar timers: four compact rows, timestamps, no default cooldowns, 18:15 check, throttling and remount passed.');}finally{await browser.close();}
