import fs from 'node:fs';
// Manual Playwright regression; every account, network reply and native record
// is synthetic. No real Torn session or user storage is opened or cleared.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({...(process.env.SLINK_BROWSER_EXECUTABLE?{executablePath:process.env.SLINK_BROWSER_EXECUTABLE}:{channel:'msedge'}),headless:true});
const base=new URL('../',import.meta.url);
try{
 const page=await browser.newPage(),errors=[],native=new Map();let authCount=0,nativeCalls=0;
 native.set('fixture-padding','x'.repeat(4900000));
 native.set('slink-pda-dashboard:data:v1',{_savedAt:1,apiKey:'',settings:{plugins:{chat:{ffBubbles:false}},alerts:{enabledTypes:{cityItems:false}}},caches:{}});
 page.on('pageerror',error=>{errors.push(error.message);console.log('PAGE ERROR',error.stack);});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin==='https://www.torn.com')return route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self' 'nonce-fixture'; object-src 'none'"},body:'<!doctype html><html><body><main>Native-storage fixture, not a live Torn session</main></body></html>'});
  const marker='/SLINK-PDA/',index=url.pathname.indexOf(marker);
  if(index>=0){const file=new URL(url.pathname.slice(index+marker.length),base);if(fs.existsSync(file))return route.fulfill({contentType:file.pathname.endsWith('.json')?'application/json':'text/javascript',body:fs.readFileSync(file,'utf8')});}
  const terms={version:'current',sha256:'hash',url:'https://example.test/terms',summary:'Fixture terms'};
  if(url.pathname.endsWith('/terms'))return route.fulfill({json:{terms,version:'current',document_sha256:'hash',disclosure_version:'current',disclosure_sha256:'hash'}});
  if(url.pathname==='/api/permissions/auth'){
   authCount++;assert.equal(route.request().postDataJSON().api_key,'member-public-key');
   return route.fulfill({json:{ok:true,authenticated:true,session_token:'fixture-session',expires_at:new Date(Date.now()+3600000).toISOString(),user_id:9002,faction_id:46978,scopes:['slink.qol.chat'],roles:['member']}});
  }
  return route.fulfill({json:{}});
 });
 await page.exposeFunction('__fixtureStorage',async(sid,method,payload)=>{
  assert.equal(sid,'fixture-script-namespace');nativeCalls++;
  if(method==='get')return {ok:true,value:structuredClone(native.get(payload.key)??payload.def)};
  if(method==='getMany')return {ok:true,value:Object.fromEntries(payload.keys.map(key=>[key,structuredClone(native.get(key)??null)]))};
  if(method==='list')return {ok:true,value:[...native.keys()]};
  if(method==='loadAll')return {ok:true,value:Object.fromEntries(native)};
  if(method==='set'||method==='setMany'){
   const values=method==='set'?{[payload.key]:payload.value}:payload.obj;
   const next=new Map(native);for(const [key,value]of Object.entries(values))next.set(key,value);
   const used=[...next].reduce((size,[key,value])=>size+Buffer.byteLength(key)+Buffer.byteLength(JSON.stringify(value)),0);
   if(used>10*1024*1024)return {ok:false,error:'QuotaExceeded'};
   for(const [key,value]of Object.entries(values))native.set(key,structuredClone(value));
   return {ok:true,value:null};
  }
  throw Error('Unexpected native operation '+method);
 });
 await page.exposeFunction('__fixtureEvaluate',async source=>{await page.evaluate(source);});
 await page.goto('https://www.torn.com/');
 const quota=await page.evaluate(()=>{
  localStorage.setItem('slink-pda-dashboard:settings:v1',JSON.stringify({savedAt:1,data:{alerts:{enabledTypes:{cityItems:true}}}}));
  let index=0;
  for(const length of [65536,1024,1]){
   const text='x'.repeat(length);
   for(let count=0;count<10000;count++)try{localStorage.setItem('fixture:full:'+(index++),text);}catch{break;}
  }
  let denied=false;try{localStorage.setItem('fixture:must-fail','x'.repeat(1024));}catch(error){denied=error.name==='QuotaExceededError';}
  return {denied,characters:Object.keys(localStorage).reduce((n,key)=>n+key.length+localStorage.getItem(key).length,0)};
 });
 assert.equal(quota.denied,true,'The actual browser fixture must reject additional localStorage writes');
 console.log('BROWSER STORAGE FULL',quota);
 const installNativeHelpers=()=>{
  window.__PDA_platformReadyPromise=Promise.resolve();
  window.flutter_inappwebview={callHandler:async(name,...args)=>{
   if(name==='PDA_storage')return window.__fixtureStorage(...args);
   if(name==='PDA_evaluateJavascript')return window.__fixtureEvaluate(args[0]);
   const response=await fetch(args[0],{method:name==='PDA_httpPost'?'POST':'GET',headers:args[1],body:args[2]});return {status:response.status,data:await response.text()};
  }};
  window.PDA_httpGet=(url,headers)=>flutter_inappwebview.callHandler('PDA_httpGet',url,headers||{});
  window.PDA_httpPost=(url,headers,body)=>flutter_inappwebview.callHandler('PDA_httpPost',url,headers||{},body);
  window.PDA_evaluateJavascript=source=>flutter_inappwebview.callHandler('PDA_evaluateJavascript',source);
  window.__pdaStorageFactory=sid=>{
   const call=async(method,payload,fallback)=>{await window.__PDA_platformReadyPromise;const result=await window.flutter_inappwebview.callHandler('PDA_storage',sid,method,payload||{});if(result&&result.ok===false)throw Error(result.error);return result?result.value:fallback;};
   return {get:(key,def)=>call('get',{key,def},def),set:(key,value)=>call('set',{key,value}),getMany:keys=>call('getMany',{keys},{}),setMany:obj=>call('setMany',{obj}),list:()=>call('list',{},[]),loadAll:()=>call('loadAll',{}, {})};
  };
 };
 await page.addInitScript(installNativeHelpers);
 await page.evaluate(installNativeHelpers);
 const source=fs.readFileSync(new URL('SLINK_PDA_Dashboard.user.js',base),'utf8');
 await page.evaluate('(function(){const PDA_storage=window.__pdaStorageFactory("fixture-script-namespace");'+source+'\n})()');
 await page.waitForFunction(()=>document.getElementById('slink-pda-dashboard-host')?.dataset.slinkAddonsReady==='true',{},{timeout:25000});
 await page.evaluate(()=>SLINK_PDA_DASHBOARD.open());
 await page.locator('#slink-pda-dashboard-host [data-page="access"]').click();
 await page.locator('#slink-pda-dashboard-host [data-field="api-key"]').fill('member-public-key');
 await page.locator('#slink-pda-dashboard-host [data-action="load-terms"]').click();
 await page.waitForTimeout(300);
 await page.locator('#slink-pda-dashboard-host [data-field="accept-terms"]').check();
 await page.locator('#slink-pda-dashboard-host [data-action="save-access"]').click();
 await page.waitForTimeout(1500);
 const status=await page.evaluate(()=>SLINK_PDA_DASHBOARD.storage.status());
 console.log('NATIVE RESULT',{authCount,nativeCalls,status,keySaved:native.get('slink-pda-dashboard:data:v1')?.apiKey==='member-public-key'});
 assert(authCount>0);assert.equal(native.get('slink-pda-dashboard:data:v1').apiKey,'member-public-key');
 assert.equal(status.failed,0);assert.equal(status.pending,0);assert.equal(status.backend,'pda');assert.deepEqual(errors,[]);
 assert.equal(native.get('slink-pda-dashboard:data:v1').settings.alerts.enabledTypes.cityItems,false,'An unchanged saved alert choice must not be erased by failed browser mirrors');
 assert.equal(native.get('slink-pda-dashboard:data:v1').sessions.permission.token,'fixture-session','The authenticated session must also be saved natively');
 await page.reload();
 await page.evaluate('(function(){const PDA_storage=window.__pdaStorageFactory("fixture-script-namespace");'+source+'\n})()');
 await page.waitForFunction(()=>document.getElementById('slink-pda-dashboard-host')?.dataset.slinkAddonsReady==='true',{},{timeout:25000});
 await page.evaluate(()=>SLINK_PDA_DASHBOARD.open());
 await page.locator('#slink-pda-dashboard-host [data-page="access"]').click();
 assert.equal(await page.locator('#slink-pda-dashboard-host [data-field="api-key"]').inputValue(),'member-public-key','Reload must recover the key from native storage, without any browser mirror');
 assert.equal(await page.locator('#slink-pda-dashboard-host [data-field="accept-terms"]').isChecked(),true,'Current accepted terms remain retained after a fresh document');
 assert.deepEqual(errors,[]);
 console.log('Actual launcher/runtime, lexical native binding, FULL browser localStorage: startup, authentication and acknowledged native save passed.');
}finally{await browser.close();}

