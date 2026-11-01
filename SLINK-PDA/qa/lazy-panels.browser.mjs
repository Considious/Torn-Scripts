import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.SLINK_BROWSER_PACKAGE||'playwright');
const base=new URL('../',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('source-manifest.json',base),'utf8'));
const runtime=manifest.fragments.map(p=>fs.readFileSync(new URL(p,base),'utf8')).join('');
const browser=await chromium.launch({executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const page=await browser.newPage({viewport:{width:420,height:820},isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.fulfill({contentType:'application/json',body:'{}'}));await page.goto('https://www.torn.com/');
await page.evaluate(()=>{
document.body.innerHTML='<main>Fixture Torn page</main><div id="chatRoot"><button id="people_panel_button">People</button><button id="notes_settings_button">Settings</button></div>';
const targets={},ops=[{schema:1,id:'migration',kind:'migration',clock:0}];
for(let i=1;i<=500;i++){const value={playerId:10000+i,name:'Fixture '+i,tags:['Target'],description:'Saved note',updatedAt:1,stakeout:false,stakeoutIntervalSeconds:10};targets[value.playerId]=value;ops.push({schema:1,id:'seed:'+i,kind:'seed',clock:0,playerId:value.playerId,base:{},value});}
const data={_savedAt:1,apiKey:'',sessions:{permission:{token:'fixture',userId:9002,expiresAt:Date.now()+3600000,scopes:['slink.combat.target-list','slink.adhd.alerts']}},settings:{mugging:{enabled:false}},caches:{targetList:targets,dataBackup:{lastUploadedAt:Date.now()}}};
window.__SLINK_PDA_BOOTSTRAP__={sourceRevision:'fixture','slink-pda-dashboard:data:v1':data,'slink-pda-dashboard:ui:v1':{page:'access'},'slink-pda-dashboard:targets:v1':{ops}};
window.fixtureStore=new Map(Object.entries(__SLINK_PDA_BOOTSTRAP__));window.GM_getValue=(k,d)=>fixtureStore.get(k)??d;window.GM_setValue=(k,v)=>fixtureStore.set(k,structuredClone(v));window.GM_registerMenuCommand=()=>{};
window.__SLINK_PDA_STORAGE_BRIDGE__={protocol:1,document,channel:'fixture-save'};
let writes=Promise.resolve();document.addEventListener('fixture-save',event=>{const payload=JSON.parse(event.detail);writes=writes.then(()=>{let value;if(payload.key==='slink-pda-dashboard:targets:v1'){const current=fixtureStore.get(payload.key)||{ops:[]};value={ops:[...current.ops,...(payload.value.ops||[]).filter(op=>!current.ops.some(old=>old.id===op.id))]};fixtureStore.set(payload.key,value);}else fixtureStore.set(payload.key,structuredClone(payload.value));document.dispatchEvent(new CustomEvent('fixture-save:ack',{detail:JSON.stringify({id:payload.id,ok:true,backend:'pda',value})}));});});
});
await page.addScriptTag({content:runtime});
for(const addon of manifest.startupAddons)await page.addScriptTag({content:fs.readFileSync(new URL(addon.source,base),'utf8')});
const host=page.locator('#slink-pda-dashboard-host'),targets=host.locator('[data-module-root="targetList"]'),alerts=host.locator('[data-module-root="alerts"]');
assert.equal(await targets.locator('*').count(),0);assert.equal(await alerts.locator('*').count(),0,'Minimized Alerts must not construct its GUI');
assert.equal(await host.locator('[data-module-root="access"] *').count(),0);
await page.evaluate(()=>SLINK_PDA_DASHBOARD.open());assert(await host.locator('[data-field="api-key"]').count());assert.equal(await targets.locator('*').count(),0,'Opening Access must not construct Targets');
await page.evaluate(()=>SLINK_PDA_DASHBOARD.close());
await page.evaluate(()=>{window.fixtureAlerts=[{id:'fixture:one',title:'Fixture first alert',detail:'Ready',links:[]}];SLINK_PDA_PLUGIN_API.register({id:'fixture',title:'Fixture',alerts:()=>fixtureAlerts,render(){}});SLINK_PDA_PLUGIN_API.alertsChanged();});
assert.equal(await alerts.locator('*').count(),0);assert.equal(await host.locator('.launcher-alert-count').textContent(),'1');
await page.evaluate(()=>SLINK_PDA_DASHBOARD.open());await host.locator('[data-page="efficiency"]').click();await page.waitForTimeout(100);assert.match(await alerts.textContent(),/Fixture first alert/);
await page.evaluate(()=>SLINK_PDA_DASHBOARD.close());const oldHtml=await alerts.innerHTML();
await page.evaluate(()=>{fixtureAlerts.push({id:'fixture:two',title:'Fixture second alert',detail:'Ready',links:[]});SLINK_PDA_PLUGIN_API.alertsChanged();});
assert.equal(await alerts.innerHTML(),oldHtml,'Closed panel HTML stays untouched when new alerts arrive');assert.equal(await host.locator('.launcher-alert-count').textContent(),'2');
await page.evaluate(()=>SLINK_PDA_DASHBOARD.open());await page.waitForTimeout(100);assert.match(await alerts.textContent(),/Fixture second alert/);
await host.locator('[data-page="combat"]').click();await host.locator('[data-combat-tab="targetList"]').click();await page.waitForTimeout(80);
assert.equal(await targets.locator('.target-list-card').count(),50);const first=await targets.locator('.target-list-card').first().getAttribute('data-target-list-id');
await targets.locator('[data-target-page="1"]').click();assert.equal(await targets.locator('.target-list-card').count(),50);assert.notEqual(await targets.locator('.target-list-card').first().getAttribute('data-target-list-id'),first);
await targets.locator('[data-action="edit-target-list"]').first().click();await targets.locator('[data-field="target-list-description"]').fill('Unsaved draft must remain');
await host.locator('[data-action="close"]').click();await page.evaluate(()=>SLINK_PDA_DASHBOARD.open());await page.waitForTimeout(150);
assert.equal(await targets.locator('[data-field="target-list-description"]').inputValue(),'Unsaved draft must remain');
await page.evaluate(async()=>{for(let i=1;i<=40;i++)SLINK_PDA_DASHBOARD.playerIntelligence.observe({playerId:20000+i,name:'Observed '+i,state:'Okay',source:'torn-api'});await SLINK_PDA_DASHBOARD.storage.flush();});
const saved=await page.evaluate(()=>{const data=fixtureStore.get('slink-pda-dashboard:data:v1');return {intelligence:Object.keys(data.caches.playerIntelligence||{}).length,duplicate:!!data.caches.bounties?.statuses,targets:SLINK_PDA_DASHBOARD.targetList.list().length,status:SLINK_PDA_DASHBOARD.storage.status()};});
assert.equal(saved.intelligence,40);assert.equal(saved.duplicate,false);assert.equal(saved.targets,500);assert.equal(saved.status.pending,0);assert.equal(saved.status.failed,0);assert.deepEqual(errors,[]);
console.log('Actual runtime: minimized/current badges without panel paints, reopen freshness, Access-only rendering, 50-row pagination, draft retention and acknowledged cache flush passed.');
}finally{await browser.close();}

