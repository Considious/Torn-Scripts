import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const extensionSource=new URL('../src/core/ranked-gear-panel.js',import.meta.url);
const source=fs.readFileSync(process.argv[2]||(fs.existsSync(extensionSource)?extensionSource:new URL('../src/00-ranked-gear-panel.part',import.meta.url)),'utf8');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://slink.test/**',route=>route.fulfill({contentType:'text/html',body:'<main></main>'}));await page.goto('https://slink.test/');
 await page.addScriptTag({content:source});
 await page.evaluate(()=>{window.calls=[];SLINK_RANKED_GEAR.mount(document.querySelector('main'),{request:async(path,body)=>{calls.push({path,body});return {summary:{count:0},rows:[],source:'Test fixture'};}});document.querySelector('[data-slink-ranked-gear]').open=true;});
 const input=n=>page.locator('form').first().locator('[name="'+n+'"]');
 const options=async n=>input(n).locator('option').evaluateAll(els=>els.map(e=>e.value));
 const change=async(n,value)=>{if(n==='item'){await input(n).fill(value);await input(n).dispatchEvent('change');}else await input(n).selectOption(value);};
 const itemOptions=()=>page.locator('main datalist').first().locator('option').evaluateAll(els=>els.map(e=>e.value));
 assert.equal((await itemOptions()).length,88);assert.equal((await options('bonus1')).length,53);
 assert(!(await itemOptions()).includes('Gold Plated AK-47'));assert(!(await itemOptions()).includes('SIG 550'));assert(!(await itemOptions()).includes('Taser'));
 await change('weaponClass','smg');assert((await options('bonus1')).includes('Revitalize'));assert(!(await options('bonus1')).includes('Execute'));assert(!(await options('bonus1')).includes('Deadly'));
 await change('bonus1','Revitalize');assert(!(await options('bonus2')).includes('Revitalize'));await change('bonus2','Comeback');
 await change('category','secondary');assert((await itemOptions()).includes('BT MP9'));assert(!(await itemOptions()).includes('P90'));
 await change('item','p90');assert.equal(await input('item').inputValue(),'P90');assert.equal(await input('category').inputValue(),'');
 await change('weaponClass','');await change('item','');await change('bonus1','');await change('bonus2','');await change('category','melee');
 assert.deepEqual(await options('weaponClass'),['','clubbing','piercing','slashing']);assert(!(await options('bonus1')).includes('Execute'));
 await change('item','Katana');assert(!(await options('bonus1')).includes('Crusher'));assert((await options('bonus1')).includes('Bloodlust'));
 await change('bonus1','Bloodlust');await change('bonus2','Parry');await change('rarity','yellow');assert.equal(await input('bonus2').isDisabled(),true);assert.equal(await input('bonus2').inputValue(),'');await change('rarity','orange');assert.equal(await input('bonus2').isEnabled(),true);
 await page.locator('.rg-advanced > summary').click();await input('minDamage').fill('65');await input('minDate').fill('2026-11-01');await input('maxDate').fill('2026-11-21');await page.getByRole('button',{name:'Search completed sales'}).click();
 let calls=await page.evaluate(()=>calls);assert.equal(calls.length,1);const query=new URL(calls[0].path,'https://test/').searchParams;
 assert.equal(query.get('item'),'Katana');assert.equal(query.get('category'),'melee');assert.equal(query.get('bonus1'),'Bloodlust');assert.equal(query.get('minDamage'),'65');assert.equal(query.get('maxDate'),String(Date.parse('2026-11-21T23:59:59Z')/1000));assert.equal(query.get('bonus2'),null);
 await change('item','Not a weapon');await page.getByRole('button',{name:'Search completed sales'}).click();assert.equal(await page.evaluate(()=>calls.length),1);
 await change('item','');
 for(const theme of ['extension-dark','pda-dark','extension-light','pda-light'])for(const width of [320,430,900]){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>{
   const dark=theme.endsWith('dark'),prefix=theme.startsWith('pda')?'--s-':'--slink-';const root=document.querySelector('main');root.removeAttribute('style');root.style.setProperty(prefix+(prefix==='--s-'?'control':'bg-control'),dark?'#223140':'#f4ede4');root.style.setProperty(prefix+'text',dark?'#edf7ff':'#241d17');root.style.setProperty(prefix+'border','#8f7554');document.body.style.margin='8px';root.style.colorScheme=dark?'dark':'light';document.querySelector('.rg-advanced').open=true;
  },theme);
  const result=await input('minDate').evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));assert.equal(result.background,theme.endsWith('dark')?'rgb(34, 49, 64)':'rgb(244, 237, 228)');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,theme+' overflow at '+width);
 }
 assert.deepEqual(errors,[]);console.log('Ranked gear: catalog, cascading filters, requests, invalid item, theme colors and responsive grid passed.');
}finally{await browser.close();}
