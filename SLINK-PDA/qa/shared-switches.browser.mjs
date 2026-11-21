import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const candidates=['./src__core__torn-components.js','../src/core/torn-components.js','../src/00-torn-components.part'];
const source=fs.readFileSync(new URL(candidates.find(p=>fs.existsSync(new URL(p,import.meta.url))),import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{for(const mobile of [false,true]){
 const page=await browser.newPage({viewport:{width:mobile?360:1100,height:800},hasTouch:mobile}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<label><input id="torn-native" type="checkbox">Torn native selection</label><section id="slink-owner" class="slink-page-ui"><label><input id="enabled" type="checkbox" role="switch" class="slink-switch">Enable helper</label><label><input id="off" type="checkbox" role="switch" class="slink-switch">Play sounds</label><label><input id="terms" type="checkbox">I agree to terms</label><label><input id="scope" type="checkbox">Grant API access</label><label><input id="completed" type="checkbox" data-racing-toggle data-switch-exempt checked>Completed</label><button class="slink-switch-button" role="switch" aria-checked="false">Stakeout</button></section>');
 await page.addScriptTag({content:source});await page.waitForFunction(()=>document.querySelector('#enabled').getAttribute('role')==='switch');
 assert.equal(await page.getByRole('switch').count(),3);assert.equal(await page.locator('#off').isChecked(),false);assert.equal(await page.locator('#torn-native').getAttribute('role'),null);assert.equal(await page.locator('#terms').getAttribute('role'),null);assert.equal(await page.locator('#scope').getAttribute('role'),null);assert.equal(await page.locator('#completed').getAttribute('role'),null);
 await page.evaluate(()=>{window.changes=0;document.querySelector('#enabled').onchange=()=>changes++;const button=document.querySelector('button');button.onclick=()=>button.setAttribute('aria-checked',String(button.getAttribute('aria-checked')!=='true'));});
 await page.locator('#enabled').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#enabled').isChecked(),true);assert.equal(await page.evaluate(()=>changes),1);
 await page.getByRole('switch',{name:'Stakeout'}).focus();await page.keyboard.press('Space');assert.equal(await page.getByRole('switch',{name:'Stakeout'}).getAttribute('aria-checked'),'true');
 await page.evaluate(()=>document.querySelector('#slink-owner').insertAdjacentHTML('beforeend','<label><input id="new" type="checkbox" role="switch" class="slink-switch">Show guidance</label>'));await page.waitForFunction(()=>document.querySelector('#new').getAttribute('role')==='switch');assert.equal(await page.evaluate(()=>changes),1,'Styling must not fire saves or change values');
 const size=await page.locator('#enabled').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,focus:getComputedStyle(e).outlineStyle}));assert.equal(size.width,36);assert.equal(size.height,22);assert.equal(await page.locator('#completed').evaluate(e=>e.getBoundingClientRect().width),18);
 await page.evaluate(()=>{const host=document.createElement('section');host.dataset.slinkFactionNode='';const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<label><input type="checkbox" role="switch" class="slink-switch" id="room" checked>Show faction rooms</label>';document.body.append(host);SLINK_TORN_COMPONENTS.install(shadow);});
 await page.waitForFunction(()=>document.querySelector('[data-slink-faction-node]').shadowRoot.querySelector('#room').getAttribute('role')==='switch');assert.equal(await page.getByRole('switch',{name:'Show faction rooms'}).isChecked(),true);
 for(const [bg,fg,accent] of [['#24132b','#fff5df','#9438df'],['#f4ede4','#241d17','#6e287a']]){
  await page.evaluate(({bg,fg,accent})=>{const n=document.querySelector('#slink-owner');n.style.setProperty('--s-control',bg);n.style.setProperty('--s-text',fg);n.style.setProperty('--s-accent',accent);},{bg,fg,accent});
  const color=await page.locator('#off').evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(color,bg==='#24132b'?'rgb(36, 19, 43)':'rgb(244, 237, 228)');
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close();
}console.log('Shared switches: scoped styling, consent exclusions, native events, keyboard, state buttons, mobile, themes and nested roots passed.');}finally{await browser.close();}
