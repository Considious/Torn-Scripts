import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const local=fs.existsSync(new URL('./kal.addon.js',import.meta.url));const read=f=>fs.readFileSync(new URL(local?'./'+f:'../src/addons/'+(f==='kal.js'?'kal-model.js':f),import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:390,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<section id="access"><div data-kal-settings></div><p data-kal-module-status></p></section><div class="user-profile"><div class="profile-wrapper">Profile</div><div class="profile-wrapper medals-wrapper">Medals</div></div>'}));await page.goto('https://www.torn.com/profiles.php?XID=42');
 await page.evaluate(()=>{
  window.enabled=false;window.requests=[];window.records=new Map();window.pending=false;window.openedAccess=0;
  window.snapshot={user_id:42,name:'Fixture',observed_at:1786331700,equipment:[{id:25,name:'P90',slot_name:'primary'}],pagination:{next_cursor:null}};
  window.SLINK_PDA_PLUGIN_API={root:()=>document.getElementById('access'),register:p=>{window.plugin=p;p.render();if(enabled)p.start();},kal:{enabled:()=>enabled,monitor:async value=>{enabled=value;},host:()=>document.documentElement,theme:()=>({'--slink-text':'#eee','--slink-bg-control':'#222'}),renderAccess:()=>{const node=document.createElement('div');node.dataset.kalSettings='';document.querySelector('[data-kal-settings]').replaceWith(node);plugin.render();},openAccess:()=>openedAccess++,storage:{get:async n=>records.get(n),set:async(n,v)=>records.set(n,v),remove:async n=>records.delete(n)},request:async(url,options)=>{
   requests.push({url,method:options.method,header:options.headers.Authorization});
   if(new URL(url).pathname==='/check-key')return {status:200,text:'{"is_registered":true}'};
   if(pending)return new Promise(resolve=>window.finish=()=>resolve({status:200,text:JSON.stringify(snapshot)}));
   return {status:200,text:JSON.stringify(snapshot)};
  }}};
 });
 for(const file of ['kal.js','kal-ui.js','kal.addon.js'])await page.addScriptTag({content:read(file)});
 assert.equal(await page.evaluate(()=>enabled),false);assert.equal(await page.evaluate(()=>requests.length),0);assert.equal(await page.locator('#slink-kal-panel').count(),0);
 assert.match(await page.evaluate(()=>plugin.setEnabled(true).then(()=>'',e=>e.message)),/Connect a registered KAL key/);assert.equal(await page.evaluate(()=>enabled),false);assert.equal(await page.evaluate(()=>requests.length),0);
 await page.getByLabel('KAL API Key',{exact:true}).fill('abcdefghijklmnop');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Connect / Validate',exact:true}).click();await page.getByText(/KAL key validated/).waitFor();assert.equal(await page.evaluate(()=>enabled),false);assert.equal(await page.evaluate(()=>requests.length),1);
 await page.getByRole('button',{name:'Enable integration',exact:true}).click();await page.getByRole('button',{name:'Load equipment',exact:true}).waitFor();assert.equal(await page.evaluate(()=>enabled),true);assert.equal(await page.evaluate(()=>requests.length),1);
 await page.getByRole('button',{name:'Load equipment',exact:true}).click();await page.getByText('P90',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>requests.length),2);
 await page.evaluate(()=>plugin.setEnabled(false));assert.equal(await page.locator('#slink-kal-panel').count(),0);await page.evaluate(()=>{for(let i=0;i<10;i++)document.body.append(document.createElement('div'));dispatchEvent(new PopStateEvent('popstate'));});assert.equal(await page.evaluate(()=>requests.length),2);
 await page.locator('select').selectOption('slink');await page.getByText(/Integration disabled/).waitFor();await page.evaluate(async()=>{await SLINK_KAL.openCache(indexedDB,'slink-kal-pda-cache').clear();pending=true;void plugin.setEnabled(true);});await page.waitForFunction(()=>!!window.finish);await page.evaluate(()=>plugin.setEnabled(false));await page.evaluate(()=>finish());assert.equal(await page.locator('#slink-kal-panel').count(),0,'An in-flight result must not restore disabled UI');
 const calls=await page.evaluate(()=>requests);assert(calls.every(x=>new URL(x.url).origin==='https://api.kalends.dev'&&x.method==='GET'));assert.equal(calls.some(x=>x.url.includes('abcdefghijklmnop')),false);
 await page.getByRole('button',{name:'Disconnect / Clear key',exact:true}).click();await page.getByText(/Not connected/).waitFor();assert.equal(await page.evaluate(()=>records.has('credentials')),false);assert.equal(await page.evaluate(()=>enabled),false);assert.deepEqual(errors,[]);
 console.log('PDA KAL: explicit connection consent, opt-in startup, enable/disable, no reads when off, stale-result cleanup, disconnect and KAL-only requests passed.');
}finally{await browser.close();}
