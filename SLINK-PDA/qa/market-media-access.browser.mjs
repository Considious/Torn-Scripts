import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<main></main>');
 for(const path of ['src/addons/chat-giphy.addon.js','src/addons/chat-giphy-ui.addon.js'])await page.addScriptTag({path:fileURLToPath(new URL('../'+path,import.meta.url))});
 for(const scenario of ['fresh','disabled','read-failure']){
  await page.evaluate(async scenario=>{
   window.stored=scenario==='disabled'?{enabled:false}:{};window.failRead=scenario==='read-failure';window.requests=[];window.requestPaths=[];window.writes=0;
   const client=SLINK_GIPHY.createClient({read:async()=>{if(failRead)throw Error('Synthetic settings read failure');return stored;},write:async value=>{writes++;stored=value;},authorize:async()=>{},request:async url=>{requests.push(new URL(url).searchParams.get('q')||'');requestPaths.push(new URL(url).pathname);return {status:200,body:{data:[],pagination:{total_count:0}}};}});
   window.picker=SLINK_GIPHY_PANEL(client,{chatWindow:true,isActive:()=>true});document.querySelector('main').replaceChildren(picker.host);await picker.ready;
  },scenario);
  const query=page.locator('[data-query]');
  if(scenario==='read-failure'){
   assert.equal(await query.isEnabled(),false);
   assert.match(await page.locator('[data-status]').textContent(),/Synthetic settings read failure/);
   await page.evaluate(()=>{failRead=false;});await page.locator('[data-load-retry]').click();
  }
  if(scenario==='disabled'){
   assert.equal(await query.isEnabled(),true,'Explicitly disabled feature must not present an unexplained inert text box');
   assert.equal(await page.evaluate(()=>stored.enabled),false,'Do not silently override a saved opt-out');
   await page.locator('[data-enable-picker]').click();await page.waitForFunction(()=>stored.enabled===true);
   assert.equal(await page.evaluate(()=>writes),1);
  }
  assert.equal(await query.isEnabled(),true);await query.fill('working search');await query.press('Enter');await page.waitForFunction(()=>requests.includes('working search'));
  await page.waitForFunction(()=>!document.querySelector('[data-slink-giphy]').shadowRoot.querySelector('[data-search]').disabled);
  assert.equal(await page.locator('[data-search]').isEnabled(),true);
  await page.evaluate(()=>picker.open('sticker'));await page.waitForFunction(()=>requestPaths.includes('/v1/stickers/search'));
  await page.evaluate(()=>picker.stop());
 }
 const dom=read('src/50-market-dom.part'),shell=read('src/90-shell-bootstrap.part');
 await page.evaluate(({dom,shell})=>{
  document.body.innerHTML='<section id="market"></section>';window.shadow=document;window.moduleState={market:{busy:false,editingUid:''}};window.dataState={settings:{market:{watches:[{uid:'saved-without-tier',label:'Saved item',maxPrice:100}]}},caches:{market:{results:{'saved-without-tier':{}}}}};
  window.marketSettings=()=>dataState.settings.market;window.marketRuntime=()=>dataState.caches.market;window.marketWatchLimit=()=>0;window.shouldRenderPdaModule=()=>true;window.moduleRoot=()=>document.getElementById('market');window.captureMarketDraft=()=>{};window.lockedModule=()=>'<p>Market is locked</p>';window.escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>'&#'+char.charCodeAt(0)+';');window.moduleMessage=()=>'';window.savedWrites=0;window.savePdaChanges=async()=>{savedWrites++;};window.schedulePurchaseOpportunityFormatting=()=>{};
  const render=dom.slice(dom.indexOf('function savedMarketWatchRemovalHtml()'),dom.indexOf('function readMarketForm()'));
  new Function(render+';window.renderMarket=renderMarket;')();renderMarket();
  const begin=shell.indexOf("if (action === 'remove-market-watch')"),end=shell.indexOf('const marketOption',begin);
  const remove=new Function('event','return (async()=>{const action="remove-market-watch";'+shell.slice(begin,end)+'})();');
  document.getElementById('market').onclick=event=>{window.removing=remove(event);};
 },{dom,shell});
 assert.equal(await page.locator('[data-action="remove-market-watch"]').count(),1);assert.equal(await page.locator('[data-action="save-market-watch"]').count(),0);
 await page.locator('[data-action="remove-market-watch"]').click();await page.evaluate(()=>removing);assert.equal(await page.evaluate(()=>dataState.settings.market.watches.length),0);assert.equal(await page.evaluate(()=>savedWrites),1);
 const nav=read('src/30-dashboard-combat.part');assert(nav.includes('data-action="open-market-watches"'));
 const loader=shell.slice(shell.indexOf('async function loadActiveModule('),shell.indexOf('function renderAllModules()'));
 await page.evaluate(async loader=>{
  window.dashboardOpen=true;window.pdaDomActive=()=>true;window.activeModuleName=()=> 'market';window.pdaPlugins=new Map();window.canAccessModule=()=>true;window.touchModuleActivity=()=>{};window.authRefreshes=0;window.moduleState.market.refreshPermissions=true;
  window.refreshMarketPermissions=async()=>{authRefreshes++;moduleState.market.refreshPermissions=false;};
  await new Function(loader+';return loadActiveModule(false);')();if(authRefreshes!==1)throw Error('Opening Market must reach permission refresh even without a cached grant');
 },loader);
 assert.deepEqual(errors,[]);
 console.log('PDA real media client/picker: fresh defaults, preserved opt-out with enable action, visible read failure/retry, editable query and actual search dispatch. Real locked Market renderer/removal handler: saved watch removable without tier and no add controls.');
}finally{await browser.close();}
