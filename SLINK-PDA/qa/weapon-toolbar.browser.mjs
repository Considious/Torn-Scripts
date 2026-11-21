import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const local=new URL('./weapon-details.js',import.meta.url),extension=new URL('../src/content/weapon-details.js',import.meta.url);
const paths=fs.existsSync(local)?['torn-components.js','weapon-merits-model.js','weapon-merits.js','weapon-details.js']:fs.existsSync(extension)?['../src/core/torn-components.js','../src/core/weapon-merits.js','../src/content/weapon-merits.js','../src/content/weapon-details.js']:['../src/00-torn-components.part','../src/addons/weapon-merits-model.js','../src/addons/weapon-merits.addon.js','../src/addons/weapon-details.addon.js'];
const sources=paths.map(name=>fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const row='<li data-item="1"><img src="/images/items/1/large.png"><div><i class="bonus-attachment-item-damage-bonus"></i><span>65</span></div><div><i class="bonus-attachment-item-accuracy-bonus"></i><span>50</span></div><i data-bonus-attachment-title="Revitalize" data-bonus-attachment-description="12% chance of restoring energy"></i></li>';
try{
 for(const pda of [false,true])for(const armory of [false,true]){
  const page=await browser.newPage({viewport:{width:pda?390:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const content='<main id="mainContainer"><section id="'+(armory?'faction-armoury':'items')+'">'+(armory?'<hr>':'<div class="equipped-items-wrap"></div>')+'<ul class="item-list">'+row+'</ul></section></main>';
  await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:content}));
  await page.goto('https://www.torn.com/'+(armory?'factions.php#tab=armoury':'item.php'));await page.bringToFront();
  await page.evaluate(pda=>{
   const snapshots={weaponXpSnapshot:{owner:'7',at:Date.now(),values:{1:50}},weaponMeritCatalogue:{at:Date.now(),classes:{1:'smg'},merits:{schema:2,owner:'7',at:Date.now(),levels:{smg:3}}}};
   window.requests=[];
   if(pda)window.SLINK_PDA_PLUGIN_API={accountId:()=>7,cache:n=>snapshots[n],persist:()=>{},tornJson:async path=>{requests.push(path);throw Error('Fresh fixtures should be cached');}};
   else window.SLINK_EXTENSION={core:{storage:{get:async()=>({userId:7,token:'fixture',expiresAt:Date.now()+60000}),fullKey:k=>k},messaging:{send:async name=>{requests.push(name);return name==='qol.weaponMerits'?{levels:{smg:3},classes:{1:'smg'}}:{1:50};}}}};
  },pda);
  for(const source of sources)await page.addScriptTag({content:source});
  const toggle=page.getByRole('switch',{name:'Show ranked perks'});await toggle.waitFor();assert.equal(await toggle.isChecked(),true);
  await page.waitForFunction(()=>document.querySelector('[data-slink-weapon-merit]')&&document.querySelector('[data-slink-weapon-xp]'));
  assert.equal(await page.getByText('Weapon mastery',{exact:true}).count(),0);assert.equal(await page.getByText('Weapon experience',{exact:true}).count(),0);
  assert.equal(await page.locator('[data-slink-weapon-xp]').first().textContent(),'+5%');
  const labels=await page.locator('.slink-weapon-modifiers').allTextContents();
  await toggle.uncheck();assert.equal(await page.locator('[data-slink-weapon-details]').count(),0);assert.deepEqual(await page.locator('.slink-weapon-modifiers').allTextContents(),labels);
  await toggle.check();assert.equal(await page.locator('[data-slink-weapon-details]').count(),1);
  await page.evaluate(content=>{const fresh=new DOMParser().parseFromString(content,'text/html').querySelector('main').innerHTML;document.querySelector('main').innerHTML=fresh;},content);
  await page.waitForFunction(()=>document.querySelectorAll('[data-slink-weapon-perks-toolbar]').length===1&&document.querySelector('[data-slink-weapon-xp]'));
  // Replacing Torn's container must recover once, with no summary cards or duplicated stats.
  assert.equal(await page.locator('[data-slink-weapon-perks-toolbar]').count(),1);assert.equal(await page.locator('[data-slink-weapon-xp]').count(),2);assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('Weapon toolbars: Items and Armory, Extension and PDA, switch, inline modifiers and remount passed.');
}finally{await browser.close();}
