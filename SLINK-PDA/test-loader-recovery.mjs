import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
assert(source.includes('sourceRevision:e.revision'),'The launcher must supply the live source revision to the runtime without per-addon version literals.');
const runtimeCore=fs.readFileSync(new URL('./src/00-runtime-core.part',import.meta.url),'utf8');
assert.match(runtimeCore,/global\.__SLINK_PDA_BOOTSTRAP__\?\.sourceRevision/,'Runtime UI/API identity must come from the fetched manifest revision.');
const cacheKey=source.match(/['"](slink-pda-dashboard:runtime-cache:v1(?::feature-[^'"]+)?)['"]/)?.[1];
const runtime='/*'+'.'.repeat(1200)+'*/';
const addon='/*'+'.'.repeat(150)+'*/';
const bundle={schema:1,storageProtocol:3,revision:'new',signature:'cached',runtimeSource:runtime,addonSources:[addon],savedAt:Date.now()};
async function run({cache=null,checked=null,hint='',refuse=false,denyAll=false,native=true,stageStore=null,meta=null,failExecution=false}={}) {
 const saved=new Map([['slink-pda-dashboard:data:v1',{settings:{alerts:{off:true}},targets:{42:{note:'retain'}},_savedAt:10}]]);
 const original=JSON.stringify(saved.get('slink-pda-dashboard:data:v1'));
 if(cache)saved.set(cacheKey,cache);if(checked)saved.set(cacheKey+':update-check',checked);
 if(meta)saved.set(cacheKey+':stage',meta);
 const requests=[],events=[];let inFlight=0,maxInFlight=0,executions=0,host=null,banner=null,reloads=0;
 const local=new Map(),session=new Map();
 if(hint)session.set(cacheKey+':pending',hint);
 const store=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
 async function download(url) {
  requests.push(url);events.push('fetch');inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
  try {
   await new Promise(resolve=>setTimeout(resolve,1));
   if(denyAll||(refuse&&url.startsWith('https://raw.')))throw Error('ClientException SocketConnection refused errno=61');
   const path=url.split('/SLINK-PDA/')[1]?.split('?')[0];
   const data=path==='source-manifest.json'?JSON.stringify({mode:'direct-source',storageProtocol:3,revision:'new',fragments:['src/one.part','src/two.part'],startupAddons:[{source:'src/addon.js'}]}):path==='src/addon.js'?addon:runtime;
   return {status:200,data};
  }finally{inFlight--;}
 }
 const context={console:{error(){},warn(){},debug(){}},Date,Promise,URL,TextEncoder,setTimeout,clearTimeout,
  localStorage:store(local),sessionStorage:store(session),location:{reload(){reloads++;}},
  document:{getElementById:id=>id==='slink-pda-dashboard-host'?host:banner,addEventListener(){},
   createElement:()=>({style:{},addEventListener(){},remove(){banner=null;}}),body:{appendChild:node=>{banner=node;}}},
  GM_getValue:async(key,fallback)=>saved.has(key)?saved.get(key):fallback,GM_setValue:async(key,value)=>saved.set(key,value),
  PDA_evaluateJavascript:async()=>{executions++;events.push('execute');if(failExecution)throw Error('Bad fixture release');host={dataset:{slinkReady:'true',slinkAddonsReady:'true'}};}};
 if(stageStore)Object.assign(context,{crypto:webcrypto,Response,caches:{open:async()=>({put:async(url,r)=>stageStore.set(url,await r.text()),match:async url=>stageStore.has(url)?new Response(stageStore.get(url)):null,delete:async url=>stageStore.delete(url)})}});
 if(native)context.PDA_httpGet=download;
 else context.fetch=async url=>{const response=await download(url);return{ok:true,status:response.status,text:async()=>response.data};};
 await vm.runInNewContext(source,context);
 for(let i=0;i<25&&stageStore&&cache?.revision==='older'&&!hint&&!session.has(cacheKey+':pending');i++)await new Promise(resolve=>setTimeout(resolve,10));
 await new Promise(resolve=>setTimeout(resolve,8));
 assert.equal(JSON.stringify(saved.get('slink-pda-dashboard:data:v1')),original,'Network recovery must not reset settings, keys or targets');
 return{requests,maxInFlight,executions,banner,saved,session,reloads,events};
}
const warm=await run({cache:bundle,denyAll:true});
assert.equal(warm.executions,1);assert(warm.requests.every(url=>url.includes('source-manifest.json')),'A valid cached runtime should check only the small manifest before using the cache');
const cold=await run({refuse:true});assert.equal(cold.executions,1);assert.equal(cold.maxInFlight,2);assert.equal(cold.requests.filter(url=>url.startsWith('https://raw.')).length,1);
assert(cold.requests.some(url=>url.startsWith('https://cdn.jsdelivr.net/gh/Considious/Torn-Scripts@')));assert.equal(cold.banner,null);
const fallback=await run({cache:{...bundle,revision:'older'},denyAll:true});assert.equal(fallback.executions,1);assert.equal(fallback.banner,null);
const unavailable=await run({denyAll:true});assert.equal(unavailable.executions,0);assert.match(unavailable.banner.textContent,/Torn is unaffected/);
const browser=await run({native:false,refuse:true});assert.equal(browser.executions,1,'Browser transport must also recover via the public mirror');
const older={...bundle,revision:'older'};
const check=await run({cache:older});
assert.equal(check.executions,1);assert.equal(check.saved.get(cacheKey).revision,'older');assert.equal(check.session.get(cacheKey+':pending'),'fetch:new');
assert.equal(check.events[0],'execute','A warm page must execute before any network fetch');
assert(check.requests.every(url=>url.includes('source-manifest.json')),'Without staging storage, only record a known update after the cached page is ready');
const refresh=await run({cache:older,hint:'fetch:new'});
assert.equal(refresh.executions,1);assert(refresh.requests.some(url=>url.includes('src/one.part')),'The next page must load the known available update');assert.equal(refresh.saved.get(cacheKey).revision,'new');
const stagedFiles=new Map();
const stage=await run({cache:older,stageStore:stagedFiles});
assert.equal(stage.events[0],'execute');assert.equal(stage.saved.get(cacheKey).revision,'older');assert.equal(stage.session.get(cacheKey+':pending'),'staged:new');
const meta=stage.saved.get(cacheKey+':stage'),untampered=new Map(stagedFiles);
const failed=await run({cache:older,stageStore:new Map(untampered),meta,hint:'staged:new',failExecution:true});
assert.equal(failed.reloads,1);assert.equal(failed.saved.get(cacheKey).revision,'older');assert.equal(failed.session.get('slink-pda-dashboard:runtime-cache-retry:v1'),'1');
for(const [url,data] of stagedFiles)stagedFiles.set(url,data.replace('runtimeSource','tamperedSource'));
const rejected=await run({cache:older,stageStore:stagedFiles,meta,hint:'staged:new',denyAll:true});
assert.equal(rejected.saved.get(cacheKey).revision,'older');assert.equal(rejected.executions,1);
const promoted=await run({cache:older,stageStore:untampered,meta,hint:'staged:new',denyAll:true});
assert.equal(promoted.saved.get(cacheKey).revision,'new');assert.equal(promoted.requests.length,0);
console.log('PDA dynamic-branch startup, manifest-based cache validation, refused-origin recovery, bounded downloads, retry banner and retained user data passed.');

