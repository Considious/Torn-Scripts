import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
const cacheKey='slink-pda-dashboard:runtime-cache:v1';
const runtime='/*'+'.'.repeat(1200)+'*/';
const addon='/*'+'.'.repeat(150)+'*/';
const bundle={schema:1,revision:'cached',signature:'cached',runtimeSource:runtime,addonSources:[addon],savedAt:Date.now()};
async function run({cache=null,checked=null,refuse=false,denyAll=false,native=true}={}) {
 const saved=new Map([['slink-pda-dashboard:data:v1',{settings:{alerts:{off:true}},targets:{42:{note:'retain'}},_savedAt:10}]]);
 const original=JSON.stringify(saved.get('slink-pda-dashboard:data:v1'));
 if(cache)saved.set(cacheKey,cache);if(checked)saved.set(cacheKey+':update-check',checked);
 const requests=[];let inFlight=0,maxInFlight=0,executions=0,host=null,banner=null;
 const local=new Map(),session=new Map();
 const store=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
 async function download(url) {
  requests.push(url);inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
  try {
   await new Promise(resolve=>setTimeout(resolve,1));
   if(denyAll||(refuse&&url.startsWith('https://raw.')))throw Error('ClientException SocketConnection refused errno=61');
   const path=url.split('/SLINK-PDA/')[1]?.split('?')[0];
   const data=path==='source-manifest.json'?JSON.stringify({mode:'direct-source',revision:'new',sourceRef:'a'.repeat(40),fragments:['src/one.part','src/two.part'],startupAddons:[{source:'src/addon.js'}]}):path==='src/addon.js'?addon:runtime;
   return {status:200,data};
  }finally{inFlight--;}
 }
 const context={console:{error(){},warn(){},debug(){}},Date,Promise,URL,TextEncoder,setTimeout,clearTimeout,
  localStorage:store(local),sessionStorage:store(session),location:{reload(){throw Error('Unexpected reload');}},
  document:{getElementById:id=>id==='slink-pda-dashboard-host'?host:banner,addEventListener(){},
   createElement:()=>({style:{},addEventListener(){},remove(){banner=null;}}),body:{appendChild:node=>{banner=node;}}},
  GM_getValue:async(key,fallback)=>saved.has(key)?saved.get(key):fallback,GM_setValue:async(key,value)=>saved.set(key,value),
  PDA_evaluateJavascript:async()=>{executions++;host={dataset:{slinkReady:'true',slinkAddonsReady:'true'}};}};
 if(native)context.PDA_httpGet=download;
 else context.fetch=async url=>{const response=await download(url);return{ok:true,status:response.status,text:async()=>response.data};};
 await vm.runInNewContext(source,context);
 await new Promise(resolve=>setTimeout(resolve,8));
 assert.equal(JSON.stringify(saved.get('slink-pda-dashboard:data:v1')),original,'Network recovery must not reset settings, keys or targets');
 return{requests,maxInFlight,executions,banner,saved};
}
const warm=await run({cache:bundle,checked:{revision:'cached',checkedAt:Date.now()},denyAll:true});
assert.equal(warm.executions,1);assert.equal(warm.requests.length,0,'Warm page load must not wait for a source download');
const cold=await run({refuse:true});assert.equal(cold.executions,1);assert.equal(cold.maxInFlight,2);assert.equal(cold.requests.filter(url=>url.startsWith('https://raw.')).length,1);
assert(cold.requests.some(url=>url.startsWith('https://cdn.jsdelivr.net/gh/Considious/Torn-Scripts@')));assert.equal(cold.banner,null);
assert(cold.requests.filter(url=>!url.includes('source-manifest.json')).every(url=>url.includes('@'+'a'.repeat(40)+'/')),'Fallback fragments must stay on one immutable manifest reference');
const fallback=await run({cache:bundle,checked:{revision:'new',checkedAt:Date.now()},denyAll:true});assert.equal(fallback.executions,1);assert.equal(fallback.banner,null);
const unavailable=await run({denyAll:true});assert.equal(unavailable.executions,0);assert.match(unavailable.banner.textContent,/Torn is unaffected/);
const browser=await run({native:false,refuse:true});assert.equal(browser.executions,1,'Browser transport must also recover via the public mirror');
const refresh=await run({cache:bundle});assert.equal(refresh.executions,1);assert.equal(refresh.requests.length,1,'Warm update discovery downloads only the manifest, not every source');assert.equal(refresh.saved.get(cacheKey).signature,'cached');assert.equal(refresh.saved.get(cacheKey+':update-check').revision,'new');
console.log('PDA cached-first startup, refused-origin mirror recovery, bounded downloads, manual retry banner and retained user data passed.');
