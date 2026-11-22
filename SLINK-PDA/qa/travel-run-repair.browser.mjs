import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import vm from 'node:vm';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const ext=new URL('../',import.meta.url),localPda=fs.existsSync(new URL('src/addons/travel-run.js',ext)),pda=process.env.SLINK_PDA_ROOT||(localPda?fileURLToPath(ext):null);
const read=path=>{
 if(!localPda)return fs.readFileSync(new URL(path,ext),'utf8');
 if(path==='src/core/torn-components.js')return fs.readFileSync(new URL('src/00-torn-components.part',ext),'utf8');
 if(path==='src/core/abroad-stocks.js'){
  const source=fs.readFileSync(new URL('src/00-runtime-core.part',ext),'utf8');let snippet='';for(const line of source.slice(source.indexOf('const ABROAD_STOCKS = (() => {')).split('\n')){snippet+=line+'\n';try{new vm.Script(snippet);break;}catch{}}
  return '(function(){'+snippet+'globalThis.SLINK_EXTENSION.core.abroadStocks=ABROAD_STOCKS;})();';
 }
 return fs.readFileSync(new URL(path==='src/modules/travel-run.js'?'src/addons/travel-run.js':path,ext),'utf8');
};
const classic=(id,name,stock=6,cost=500)=>`<div class="row___fixture" data-stock="${stock}" data-price="${cost}"><button aria-controls="item-${id}-itemInfoWrapper">${name}</button><form id="item-${id}-form"><input type="button" aria-label="Click here to add the maximum amount" data-action="max"><input data-input-money-visible="true" placeholder="Qty" max="12"></form><button type="button" form="item-${id}-form" aria-controls="item-${id}-buyPanel" aria-expanded="false" data-action="open-buy" data-id="${id}">Buy</button></div>`;
const variant=(id,name,stock=6,cost=500)=>`<article data-item-id="${id}" data-item-name="${name}" data-stock="${stock}" data-price="${cost}"><h3>${name}</h3><form id="item-${id}-form"><button type="button" data-action="max">Max</button><input type="number" name="quantity" min="1" max="12"></form><button type="button" aria-controls="purchase-${id}" aria-expanded="false" data-action="open-buy" data-id="${id}">Purchase</button></article>`;
const inventory=`<ul class="inventoryPanel___fixture" aria-label="Inventory 2 items"><li class="inventorySlot___fixture"><button type="button" class="itemButton___fixture" aria-label="Opium slot 1" aria-expanded="false" data-action="select"><img class="torn-item" alt="Opium"></button></li></ul>`;
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 for(const platform of localPda?['pda']:['extension','pda'])for(const width of [390,960]){
  assert(platform!=='pda'||pda,'Set SLINK_PDA_ROOT to verify PDA independently');
  const page=await browser.newPage({viewport:{width,height:1000},isMobile:width<500,hasTouch:width<500}),errors=[],requests=[];
  page.setDefaultTimeout(5000);page.on('pageerror',e=>{errors.push(e.message);console.error(platform+' Travel Run browser error: '+e.message);});
  const shop=width<500?classic:variant;
  const markup=`<style>body{margin:8px;font:14px sans-serif}button{padding:8px}article,.row___fixture{margin:8px 0;padding:8px;border:1px solid #888}input{max-width:100%}</style><main><div id="travel-root"><div data-carry-capacity="20" data-carry-used="15"></div><span data-cash="3000"></span>${inventory}${shop(1,'Xanax')}${shop(2,'Shark Fin',0,100)}${shop(3,'Plushie',9,100)}<a href="#" class="travel-home-header-button" aria-controls="travel-home-panel" aria-expanded="false" data-action="home">Travel home</a><div role="status" id="native-result"></div></div></main><div id="portal-result" role="alert"></div>`;
  await page.route('**/*',route=>{if(route.request().url().startsWith('https://www.torn.com/travelagency.php'))return route.fulfill({contentType:'text/html',body:markup});requests.push(route.request().url());return route.fulfill({status:404,body:''});});
  await page.goto('https://www.torn.com/travelagency.php');
  const setup=async()=>page.evaluate(platform=>{
   window.nativeClicks=[];window.mode='success';window.monitoring=true;window.cacheReads=[];window.storageListeners=[];window.apiCalls=0;
   const NativeObserver=MutationObserver;window.activeObservers=new Set();window.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);this.travelOwned=new Error().stack.includes('setEnabled');}observe(...args){if(this.travelOwned)activeObservers.add(this);return super.observe(...args);}disconnect(){activeObservers.delete(this);return super.disconnect();}};
   window.cache={};const now=Date.now();cache['abroadStocks.runtime.v1']={fetchedAt:now,rows:[{countryCode:'can',itemName:'Xanax',itemId:1,sources:{yata:{quantity:20,cost:500,updatedAt:now}}},{countryCode:'mex',itemName:'Plushie',itemId:3,sources:{prometheus:{quantity:50,cost:100,updatedAt:now}}}]};cache['abroadStocks.settings.v1']={travelMethod:'airstrip'};cache['shared.providers.v1']={catalog:{pricesAt:now,items:[{id:1,marketPrice:1000},{id:3,marketPrice:700}]}};
   const storage={get:async(key,fallback)=>{cacheReads.push(key);if(key==='ui.monitoring.travel-run.enabled')return monitoring;if(window.failPlanning)throw Error('Cached planning unavailable');return cache[key]??fallback;},fullKey:key=>'slink.'+key};
   window.chrome={storage:{onChanged:{addListener:fn=>storageListeners.push(fn)}}};
   window.SLINK_EXTENSION={core:platform==='extension'?{storage,messaging:{send:async(type,payload)=>{if(type!=='abroadStocks.status'||payload.refreshIfDue!==false)throw Error('Only cached Abroad Stocks status may be read');cacheReads.push(type);if(window.failPlanning)throw Error('Cached planning unavailable');return {...cache['abroadStocks.runtime.v1'],settings:cache['abroadStocks.settings.v1']};}}}:{},define(group,name,value){this[group][name]=value;}};
   if(platform==='pda')window.SLINK_PDA_PLUGIN_API={moduleMonitoringEnabled:()=>monitoring,travelRunPlanning:async()=>{cacheReads.push('pda-cached-planning');if(window.failPlanning)throw Error('Cached planning unavailable');return {countries:SLINK_EXTENSION.core.abroadStocks.COUNTRIES,rows:cache['abroadStocks.runtime.v1'].rows,settings:cache['abroadStocks.settings.v1'],catalog:cache['shared.providers.v1'].catalog};}};
   window.setMonitoring=value=>{monitoring=value;if(platform==='pda')dispatchEvent(new Event('slink:travel-run-monitoring'));else for(const listener of storageListeners)listener({'slink.ui.monitoring.travel-run.enabled':{newValue:value}},'local');};
   window.nativeResult=text=>{document.querySelector(mode==='portal'?'#portal-result':'#native-result').textContent=text;};
   document.addEventListener('click',event=>{
    const control=event.target.closest('[data-action]');if(!control)return;event.preventDefault();const action=control.dataset.action;nativeClicks.push(action);
    if(action==='select'){control.setAttribute('aria-expanded','true');control.parentElement.insertAdjacentHTML('beforeend','<div class="panel___fixture"><div role="group"><button type="button" data-action="sell-open">Sell</button></div></div>');}
    if(action==='sell-open'){control.setAttribute('aria-current','true');control.parentElement.parentElement.insertAdjacentHTML('beforeend','<form><button type="button" data-action="max">Maximum</button><input type="number" name="quantity" aria-label="Amount to sell" max="2"><button type="submit" data-action="sell-confirm">Sell</button></form>');}
    if(action==='max'){const input=control.form.querySelector('input:not([type=button])');input.value=control.closest('li')?'2':'18';input.dispatchEvent(new Event('input',{bubbles:true}));}
    if(action==='sell-confirm')nativeResult('You sold 2 Opium for $100.');
    if(action==='open-buy'){
     control.setAttribute('aria-expanded','true');const row=control.closest('article,.row___fixture'),id=control.dataset.id;
     if(!row.querySelector('[data-action="buy-confirm"]'))row.insertAdjacentHTML('beforeend','<button type="submit" form="item-'+id+'-form" data-action="buy-confirm" data-id="'+id+'">Confirm purchase</button>');
    }
    if(action==='buy-confirm'){
     const name=control.dataset.id==='1'?'Xanax':control.dataset.id==='2'?'Shark Fin':'Plushie';
     if(mode==='failure'){nativeResult(name+' purchase failed: insufficient cash.');return;}
     if(mode==='unknown'){nativeResult('Success');return;}
     if(mode==='pending')return;
     nativeResult('You bought 3 x '+name+' for $1,500.');document.querySelector('[data-carry-used]').dataset.carryUsed='18';document.querySelector('[data-cash]').dataset.cash='1500';
    }
    if(action==='home'){control.setAttribute('aria-expanded','true');control.insertAdjacentHTML('afterend','<button type="button" data-action="return-confirm">Confirm return flight</button>');}
   });
  },platform);await setup();
  await page.addScriptTag({content:read('src/core/abroad-stocks.js')});await page.addScriptTag({content:read('src/core/torn-components.js')});
  const script=platform==='extension'?read('src/modules/travel-run.js'):fs.readFileSync(pda+'/src/addons/travel-run.js','utf8');
  const inject=()=>page.addScriptTag({content:script});await inject();
  const ui=page.locator('#slink-travel-run');await ui.waitFor();assert.equal(await ui.count(),1);assert.equal(await page.evaluate(()=>activeObservers.size),2);
  assert.equal(await page.evaluate(()=>cacheReads.filter(k=>k!=='ui.monitoring.travel-run.enabled').length),0,'Mounting the checklist never reads stock or prices');
  await ui.getByRole('button',{name:'Set up Travel Run',exact:true}).click();await ui.locator('[name=sell]').fill('Opium');await ui.locator('[name=buys]').fill('Xanax\nShark Fin\nPlushie');
  await ui.locator('#planner summary').click();await ui.locator('[name=capacity]').fill('5');await ui.locator('[name=cash]').fill('3000');await ui.locator('[name=nextTrips]').fill('Mexico');
  await ui.getByRole('button',{name:'Read cached trip suggestions',exact:true}).click();await ui.locator('#planning-results').getByText('Canada',{exact:true}).waitFor();
  assert.match(await ui.locator('#planning-results').textContent(),/27 min each way/);assert.match(await ui.locator('#planning-results').textContent(),/Potential profit \$2,500/);assert.equal(await page.evaluate(()=>nativeClicks.length),0,'Planning never opens native controls');
  assert.equal(await page.evaluate(()=>cacheReads.filter(k=>k!=='ui.monitoring.travel-run.enabled').length),platform==='pda'?1:3,'Planning only reads the existing caches once');
  await ui.getByRole('button',{name:'Use Canada',exact:true}).click();await ui.getByRole('button',{name:'Save and start run',exact:true}).click();
  for(const name of ['Select Opium to sell','Open Sell for Opium','Set maximum sale quantity'])await ui.getByRole('button',{name,exact:true}).click();
  assert.match(await ui.locator('#status').textContent(),/not complete/);assert.equal(await ui.locator('#progress li').count(),0);
  await page.locator('[data-action=sell-confirm]').click();await page.waitForFunction(()=>document.querySelector('#slink-travel-run').shadowRoot.querySelector('#status').textContent.includes('Next: Buy Xanax'));
  assert.equal(await ui.locator('#progress li').count(),1);assert.equal(await page.evaluate(()=>nativeClicks.length),4,'No next gameplay control is clicked after observing success');
  await ui.getByRole('button',{name:'Set maximum quantity for Xanax',exact:true}).click();assert.equal(await page.locator('#item-1-form input:not([type=button])').inputValue(),'5');
  assert.equal(await ui.locator('#progress li').count(),1,'Setting maximum quantity is not a purchase');
  await ui.getByRole('button',{name:'Open Buy for Xanax',exact:true}).click();assert.equal(await ui.locator('#progress li').count(),1,'Opening a purchase panel is not a purchase');
  await page.evaluate(()=>mode='failure');await page.locator('[data-action=buy-confirm][data-id="1"]').click();await ui.getByText(/Torn reported a failed/).waitFor();assert.equal(await ui.locator('#progress li').count(),1);
  await page.evaluate(()=>{mode='pending';document.querySelector('#native-result').textContent='';});await page.locator('[data-action=buy-confirm][data-id="1"]').click();
  await page.evaluate(()=>nativeResult('You bought 3 x Plushie for $300.'));await page.waitForTimeout(50);assert.equal(await ui.locator('#progress li').count(),1,'Unrelated item feedback must not advance a run');
  await page.evaluate(()=>{mode='portal';nativeResult('You bought 3 x Xanax for $1,500.');});await page.waitForFunction(()=>document.querySelector('#slink-travel-run').shadowRoot.querySelector('#status').textContent.includes('Next: Buy Shark Fin'));
  assert.match(await ui.locator('#limits').textContent(),/spaces: 2.*\$1,500/);assert.match(await ui.locator('#availability').textContent(),/sold out/);assert.equal(await ui.locator('#progress li').count(),2,'Only the purchased priority completes');
  await ui.getByRole('button',{name:'Unavailable · next priority',exact:true}).click();assert.match(await ui.locator('#status').textContent(),/Next: Buy Plushie/);
  await page.evaluate(()=>nativeResult('You bought 3 x Xanax for $1,500.'));await page.waitForTimeout(50);assert.equal(await ui.locator('#progress li').count(),3,'Late receipt cannot advance a different priority');
  await page.reload();await setup();await page.addScriptTag({content:read('src/core/abroad-stocks.js')});await page.addScriptTag({content:read('src/core/torn-components.js')});await inject();await ui.waitFor();assert.match(await ui.locator('#status').textContent(),/Next: Buy Plushie/);assert.equal(await ui.locator('#progress li').count(),3,'Reload preserves confirmed purchases and skipped priorities');
  // Replacing Torn's application must preserve the current plan and one observer set.
  await page.evaluate(()=>{const root=document.querySelector('#travel-root'),replacement=root.cloneNode(true);replacement.querySelector('#slink-travel-run').remove();root.replaceWith(replacement);});
  await page.waitForFunction(()=>document.querySelector('#travel-root > #slink-travel-run'));assert.equal(await ui.count(),1);assert.match(await ui.locator('#status').textContent(),/Next: Buy Plushie/);assert.equal(await page.evaluate(()=>activeObservers.size),2);
  await ui.getByRole('button',{name:'Set maximum quantity for Plushie',exact:true}).click();assert.equal(await page.locator('#item-3-form input:not([type=button])').inputValue(),'2');await ui.getByRole('button',{name:'Open Buy for Plushie',exact:true}).click();
  await page.evaluate(()=>mode='pending');await page.locator('[data-action=buy-confirm][data-id="3"]').click();await page.evaluate(()=>setMonitoring(false));await ui.waitFor({state:'detached'});await page.evaluate(()=>nativeResult('You bought 2 Plushie for $200.'));await page.evaluate(()=>setMonitoring(true));await ui.waitFor();assert.equal(await ui.locator('#progress li').count(),3,'A late receipt after disabling cannot complete the old attempt');
  await page.evaluate(()=>mode='unknown');await page.locator('[data-action=buy-confirm][data-id="3"]').click();await page.waitForTimeout(50);assert.match(await ui.locator('#status').textContent(),/Waiting for Torn/);assert.equal(await ui.locator('#progress li').count(),3);
  await ui.getByRole('button',{name:'Confirm manually: Buy Plushie done',exact:true}).click();assert.match(await ui.locator('#status').textContent(),/Next: Return to Torn/);
  await ui.getByRole('button',{name:'Open Travel Home',exact:true}).click();assert.equal(await page.evaluate(()=>nativeClicks.filter(x=>x==='return-confirm').length),0,'Opening return panel never confirms a flight');
  await page.locator('[data-action=return-confirm]').click();await ui.getByRole('button',{name:'Confirm return started',exact:true}).click();assert.match(await ui.locator('#status').textContent(),/Run complete/);
  await ui.getByRole('button',{name:'Prepare next trip',exact:true}).click();assert.equal(await ui.locator('[name=destination]').inputValue(),'Mexico');assert.equal(await page.evaluate(()=>nativeClicks.filter(x=>x==='return-confirm').length),1,'Preparing another trip does not initiate travel');
  await ui.getByRole('button',{name:'Save and start run',exact:true}).click();const saved=await ui.locator('#status').textContent();
  await page.evaluate(()=>setMonitoring(false));await ui.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>activeObservers.size),0);
  const before=await page.evaluate(()=>cacheReads.length);await page.evaluate(()=>{for(let i=0;i<10;i++)document.querySelector('#travel-root').append(document.createElement('span'));});await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>cacheReads.length),before,'Disabled Travel Run performs no cache or API work');
  await page.evaluate(()=>setMonitoring(true));await ui.waitFor();assert.equal(await ui.count(),1);assert.equal(await page.evaluate(()=>activeObservers.size),2);assert.equal(await ui.locator('#status').textContent(),saved);
  await inject();assert.equal(await ui.count(),1,'Reinjection must not duplicate UI or observers');assert.equal(await page.evaluate(()=>activeObservers.size),2);
  // Keep native controls untouched and use the same real theme component in both modes.
  for(const [background,color]of [['#201429','#fff3f8'],['#fffaf1','#251c16']]){
   await ui.evaluate((host,{background,color})=>{host.style.setProperty('--slink-bg',background);host.style.setProperty('--slink-text',color);},{background,color});
   await ui.getByRole('button',{name:'Edit plan',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('#item-1-form').count(),1);
  }
  await page.evaluate(()=>{failPlanning=true;});await ui.locator('#planner summary').click();await ui.getByRole('button',{name:'Read cached trip suggestions',exact:true}).click();await ui.getByText(/Could not read planning data/).waitFor();assert.equal(await ui.getByRole('button',{name:'Read cached trip suggestions',exact:true}).isDisabled(),false);await page.evaluate(()=>{failPlanning=false;cache['abroadStocks.runtime.v1'].rows=[];});await ui.locator('[name=destination]').fill('');await ui.getByRole('button',{name:'Read cached trip suggestions',exact:true}).click();await ui.getByText(/No fresh matching stock is cached/).waitFor();
  await page.evaluate(()=>{window.module={exports:{}};});await inject();const guards=await page.evaluate(()=>{const T=module.exports,root=document.querySelector('#travel-root'),control=root.querySelector('[data-action="open-buy"][data-id="1"]');control.disabled=true;const disabled=T.nativeAction(root,{type:'buy',item:'Xanax'},new WeakSet(),{capacity:5,cash:3000})===null;control.disabled=false;control.classList.add('disabled___fixture');const cssDisabled=T.nativeAction(root,{type:'buy',item:'Xanax'},new WeakSet(),{capacity:5,cash:3000})===null;control.classList.remove('disabled___fixture');const full=T.nativeAction(root,{type:'buy',item:'Xanax'},new WeakSet(),{capacity:0,cash:3000})===null;const row=control.closest('article,.row___fixture'),copy=row.cloneNode(true);root.append(copy);const ambiguous=T.nativeAction(root,{type:'buy',item:'Xanax'},new WeakSet(),{capacity:5,cash:3000})===null;copy.remove();return {disabled,cssDisabled,full,ambiguous};});assert.deepEqual(guards,{disabled:true,cssDisabled:true,full:true,ambiguous:true});
  assert.deepEqual(errors,[]);assert(requests.every(url=>url.includes('/images/')||url.endsWith('/favicon.ico')),'No Torn gameplay endpoints or stock providers may be called');
  console.log(platform+' '+width+'px: native variants, sale/purchase evidence, failures, priority order, limits, cached planning, next-trip preparation, rerender restoration, and disable/re-enable passed.');await page.close();
 }
}finally{await browser.close();}
