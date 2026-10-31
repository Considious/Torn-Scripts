import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const base=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];
page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE',msg.text());});
page.on('pageerror',error=>{errors.push(error.message);console.log('PAGE ERROR',error.stack);});
await page.route('**/*',route=>{
 const u=new URL(route.request().url());
 if(u.origin==='https://www.torn.com')return route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self' 'nonce-slink-test-manager'; object-src 'none'"},body:'<!doctype html><html><body><main id="mainContainer">Test Torn page</main></body></html>'});
 const marker='/SLINK-PDA/',at=u.pathname.indexOf(marker);
 if(at>=0){const path=u.pathname.slice(at+marker.length);if(fs.existsSync(base+path))return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:fs.readFileSync(base+path,'utf8')});}
 const terms={version:'current',sha256:'hash',url:'https://example.test/terms',summary:'Fixture terms'};
 if(u.pathname==='/api/permissions/terms')return route.fulfill({json:{terms}});
 if(u.pathname==='/api/terms')return route.fulfill({json:{terms,version:'current',document_sha256:'hash',disclosure_version:'current',disclosure_sha256:'hash'}});
 if(u.pathname==='/api/permissions/auth'){
  const b=route.request().postDataJSON();
  if(b.api_key!=='member-public-key')return route.fulfill({status:400,json:{error:'Unexpected fixture key'}});
  return route.fulfill({json:{ok:true,authenticated:true,session_token:'fixture-session',expires_at:new Date(Date.now()+3600000).toISOString(),user_id:9002,user_name:'Fixture Member',faction_id:46978,scopes:['slink.qol.chat'],roles:['member']}});
 }
 return route.fulfill({json:{}});
});
await page.goto('https://www.torn.com/');
if(process.env.SLINK_PERF_PROFILE)await page.evaluate(()=>{
 const counts=window.fixturePerf={observers:{},queries:{}};
 const Native=window.MutationObserver;
 window.MutationObserver=class extends Native{constructor(callback){const site=new Error().stack.split('\n').slice(2,5).join(' ');super((records,observer)=>{counts.observers[site]=(counts.observers[site]||0)+1;callback(records,observer);});}};
 for(const proto of [Document.prototype,Element.prototype,DocumentFragment.prototype])for(const name of ['querySelector','querySelectorAll']){const original=proto[name];if(!original)continue;proto[name]=function(selector){counts.queries[selector]=(counts.queries[selector]||0)+1;return original.call(this,selector);};}
});
const session=await page.context().newCDPSession(page);
const {frameTree}=await session.send('Page.getFrameTree');
const {executionContextId}=await session.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'mock-userscript-manager'});
await session.send('Runtime.evaluate',{contextId:executionContextId,expression:'('+(()=>{
 const store=new Map();window.fixtureStore=store;window.authBodies=[];
 window.GM_getValue=(key,fallback)=>store.has(key)?structuredClone(store.get(key)):fallback;
 window.GM_setValue=(key,value)=>store.set(key,structuredClone(value));
 window.GM_deleteValue=key=>store.delete(key);window.GM_registerMenuCommand=()=>{};
 window.GM_xmlhttpRequest=options=>{if(options.url.includes('/api/permissions/auth'))window.authBodies.push(JSON.parse(options.data));fetch(options.url,{method:options.method,headers:options.headers,body:options.data}).then(async r=>options.onload({status:r.status,responseText:await r.text()})).catch(error=>options.onerror?.({error:error.message}));};
 // Test-manager privilege shim only: its own known test nonce authorizes script
 // insertion while page eval stays forbidden. Product code never copies nonces.
 window.GM_addElement=(tag,attrs)=>{const el=document.createElement(tag);el.nonce='slink-test-manager';Object.assign(el,attrs);document.head.append(el);return el;};
}).toString()+')()'});
const blocked=await session.send('Runtime.evaluate',{expression:"(()=>{try{(0,eval)('1');return false;}catch{return true;}})()",allowUnsafeEvalBlockedByCSP:false,returnByValue:true});
assert.equal(blocked.result.value,true,'Page CSP must forbid eval during this test');
assert.equal(await page.evaluate(()=>typeof window.GM_xmlhttpRequest),'undefined','GM APIs must not leak into the runtime page world');
await session.send('Runtime.evaluate',{contextId:executionContextId,expression:fs.readFileSync(base+'SLINK_PDA_Dashboard.user.js','utf8')});
try{await page.waitForFunction(()=>document.getElementById('slink-pda-dashboard-host')?.dataset.slinkAddonsReady==='true',{},{timeout:25000});}
catch(error){console.log('STARTUP STATE',await page.evaluate(()=>({banner:document.getElementById('slink-pda-runtime-load-error')?.textContent,host:document.getElementById('slink-pda-dashboard-host')?.dataset,errors:window.__SLINK_PDA_STARTUP_ERROR__})));throw error;}
await page.evaluate(()=>window.SLINK_PDA_DASHBOARD.open());
await page.locator('#slink-pda-dashboard-host [data-page="access"]').click();
console.log('READY',await page.evaluate(()=>({host:document.getElementById('slink-pda-dashboard-host').dataset,fields:[...document.getElementById('slink-pda-dashboard-host').shadowRoot.querySelectorAll('[data-field]')].slice(0,10).map(e=>e.dataset.field)})));
await page.locator('#slink-pda-dashboard-host [data-field="api-key"]').fill('member-public-key');
await page.locator('#slink-pda-dashboard-host [data-action="load-terms"]').click();
await page.waitForTimeout(400);
await page.locator('#slink-pda-dashboard-host [data-field="accept-terms"]').check();
await page.locator('#slink-pda-dashboard-host [data-action="save-access"]').click();
await page.waitForTimeout(1000);
const result=await session.send('Runtime.evaluate',{contextId:executionContextId,expression:JSON.stringify('placeholder').replace('"placeholder"','JSON.stringify({authCount:window.authBodies.length,keyWasSubmitted:window.authBodies[0]?.api_key===\'member-public-key\',saved:window.fixtureStore.get(\'slink-pda-dashboard:data:v1\')?.apiKey===\'member-public-key\'})')});
const saved=JSON.parse(result.result.value);console.log('AFTER SAVE',saved);assert.equal(saved.keyWasSubmitted,true);assert.equal(saved.saved,true);
assert.deepEqual(errors,[]);
if(process.env.SLINK_PERF_PROFILE){
 await page.waitForTimeout(2000);
 await page.evaluate(()=>{window.fixturePerf.observers={};window.fixturePerf.queries={};});
 await page.waitForTimeout(3000);
 console.log('PERF IDLE',await page.evaluate(()=>window.fixturePerf));
 await page.evaluate(()=>{window.fixturePerf.observers={};window.fixturePerf.queries={};const root=document.createElement('div');root.id='unrelated-page-ticker';document.body.append(root);window.fixtureTick=setInterval(()=>{root.textContent=String(Date.now());root.style.color=root.style.color==='red'?'blue':'red';},16);});
 await page.waitForTimeout(3000);
 console.log('PERF CHURN',await page.evaluate(()=>{clearInterval(window.fixtureTick);return window.fixturePerf;}));
}
if(process.env.SLINK_BROWSER_SCREENSHOT)await page.screenshot({path:process.env.SLINK_BROWSER_SCREENSHOT});
}finally{await browser.close();}
