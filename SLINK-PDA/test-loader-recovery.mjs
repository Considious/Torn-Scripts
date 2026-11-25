import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
assert(source.includes('sourceRevision:e.revision'),'The launcher must supply the live source revision to the runtime without per-addon version literals.');
const runtimeCore=fs.readFileSync(new URL('./src/00-runtime-core.part',import.meta.url),'utf8');
assert.match(runtimeCore,/global\.__SLINK_PDA_BOOTSTRAP__\?\.sourceRevision/,'Runtime UI/API identity must come from the fetched manifest revision.');
const cacheKey=source.match(/['"](slink-pda-dashboard:runtime-cache:v1(?::(?:main|feature-[^'"]+))?)['"]/)?.[1];
assert(cacheKey,'The launcher must declare a runtime cache key.');
const runtime='/*'+'.'.repeat(1200)+'*/';
const addon='/*'+'.'.repeat(150)+'*/';
const bundle={schema:1,storageProtocol:3,revision:'new',signature:'cached',runtimeSource:runtime,addonSources:[addon],savedAt:Date.now()};
const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
const nativeSource=label=>'/*'+(label+'🙂').repeat(26000)+'*/';
const nativeRevision=label=>'sha256-'+sha256([nativeSource(label).repeat(2),addon].join('\n;\n'));
async function run({cache=null,checked=null,hint='',refuse=false,denyAll=false,native=true,stageStore=null,meta=null,failExecution=false,pda=null,session=new Map(),label='A',hasLocks=true,beforeManifest,waitForStage=false}={}) {
 const saved=new Map([['slink-pda-dashboard:data:v1',{settings:{alerts:{off:true}},targets:{42:{note:'retain'}},_savedAt:10}]]);
 const original=JSON.stringify(saved.get('slink-pda-dashboard:data:v1'));
 if(cache)saved.set(cacheKey,cache);if(checked)saved.set(cacheKey+':update-check',checked);
 if(meta)saved.set(cacheKey+':stage',meta);
  const requests=[],events=[],executedRevisions=[];let inFlight=0,maxInFlight=0,executions=0,host=null,banner=null,reloads=0;
  const local=new Map();
 if(hint)session.set(cacheKey+':pending',hint);
 const store=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
 async function download(url) {
  requests.push(url);events.push('fetch');inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
  try {
   await new Promise(resolve=>setTimeout(resolve,1));
   if(denyAll||(refuse&&url.startsWith('https://raw.')))throw Error('ClientException SocketConnection refused errno=61');
   const path=url.split('/SLINK-PDA/')[1]?.split('?')[0];
   if(path==='source-manifest.json'&&beforeManifest)await beforeManifest();
   const data=path==='source-manifest.json'?JSON.stringify({mode:'direct-source',storageProtocol:3,revision:pda?nativeRevision(label):'new',fragments:['src/one.part','src/two.part'],startupAddons:[{source:'src/addon.js'}]}):path==='src/addon.js'?addon:pda?nativeSource(label):runtime;
   return {status:200,data};
  }finally{inFlight--;}
 }
 const context={console:{error(){},warn(){},debug(){}},Date,Promise,URL,TextEncoder,setTimeout,clearTimeout,
  localStorage:store(local),sessionStorage:store(session),location:{reload(){reloads++;}},
  document:{getElementById:id=>id==='slink-pda-dashboard-host'?host:banner,addEventListener(){},
   createElement:()=>({style:{},addEventListener(){},remove(){banner=null;}}),body:{appendChild:node=>{banner=node;}}},
  GM_getValue:async(key,fallback)=>saved.has(key)?saved.get(key):fallback,GM_setValue:async(key,value)=>saved.set(key,value),
   PDA_evaluateJavascript:async code=>{executions++;events.push('execute');executedRevisions.push(code.match(/"sourceRevision":"([^"]+)"/)?.[1]);if(failExecution)throw Error('Bad fixture release');host={dataset:{slinkReady:'true',slinkAddonsReady:'true'}};}};
 if(stageStore)Object.assign(context,{crypto:webcrypto,Response,caches:{open:async()=>({put:async(url,r)=>stageStore.set(url,await r.text()),match:async url=>stageStore.has(url)?new Response(stageStore.get(url)):null,delete:async url=>stageStore.delete(url)})}});
  if(pda)Object.assign(context,{PDA_storage:pda.store,crypto:webcrypto,navigator:hasLocks?{locks:pda.locks}:{}});
 if(native)context.PDA_httpGet=download;
 else context.fetch=async url=>{const response=await download(url);return{ok:true,status:response.status,text:async()=>response.data};};
 await vm.runInNewContext(source,context);
  for(let i=0;i<25&&(waitForStage||stageStore&&cache?.revision==='older'&&!hint)&&!session.has(cacheKey+':pending');i++)await new Promise(resolve=>setTimeout(resolve,10));
 await new Promise(resolve=>setTimeout(resolve,8));
 assert.equal(JSON.stringify(saved.get('slink-pda-dashboard:data:v1')),original,'Network recovery must not reset settings, keys or targets');
  return{requests,maxInFlight,executions,banner,saved,session,reloads,events,executedRevisions};
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

const indexKey=cacheKey+':verified:v1',partPrefix=indexKey+':part:';
function nativeFixture(){
 const settingsKey='slink-pda-dashboard:data:v1';
 const settings={settings:{theme:'saved'},apiKey:'fixture-key',caches:{targetList:{42:{note:'saved'}}}};
 const data=new Map([[settingsKey,settings]]),writes=[],deletes=[];
 let queue=Promise.resolve();
 const fixture={
  data,writes,deletes,settings,settingsKey,
  locks:{request:(_name,run)=>{const job=queue.then(run);queue=job.catch(()=>{});return job;}},
  idle:()=>queue,
  store:{
   get:async(key,fallback)=>structuredClone(data.get(key)??fallback),
   getMany:async keys=>Object.fromEntries(keys.map(key=>[key,structuredClone(data.get(key)??null)])),
   list:async()=>[...data.keys()],
   set:async(key,value)=>{
    if(fixture.failIndex&&key===indexKey)throw Error('Interrupted index write');
    assert.notEqual(key,cacheKey,'Never write the oversized legacy row');
    writes.push(key);data.set(key,structuredClone(value));
   },
   setMany:async values=>{
    assert(Object.keys(values).length<=4);
    for(const [key,value] of Object.entries(values)){
     assert(key.startsWith(partPrefix));assert(value.length<=48000);
     await fixture.store.set(key,value);
     if(fixture.failParts)throw Error('Interrupted segment write');
    }
   },
   delete:async key=>{deletes.push(key);data.delete(key);}
  }
 };
 return fixture;
}
const pda=nativeFixture(),webCache=new Map();
const nativeCold=await run({pda,stageStore:webCache});
assert.equal(nativeCold.executions,1);
const firstIndex=structuredClone(pda.data.get(indexKey));
assert.equal(firstIndex.active.revision,nativeRevision('A'));
assert.equal(firstIndex.previous,null);
assert(webCache.size);
const warmNative=await run({pda,stageStore:webCache,session:nativeCold.session,denyAll:true});
assert.equal(warmNative.executions,1);assert.equal(warmNative.requests.length,0);
await pda.idle();
const offline=await run({pda,stageStore:new Map(),session:new Map(nativeCold.session),denyAll:true});
assert.equal(offline.executions,1);assert.equal(offline.requests.length,0);

for(const failure of ['failParts','failIndex']){
 pda[failure]=true;
 const attempted=await run({pda,stageStore:webCache,hint:'fetch:'+nativeRevision('B'),label:'B'});
 assert.equal(attempted.executions,1);
 assert.equal(pda.data.get(indexKey).active.digest,firstIndex.active.digest);
 const retained=await run({pda,stageStore:new Map(),session:new Map(nativeCold.session),denyAll:true});
 assert.equal(retained.executions,1);
 pda[failure]=false;
}
const updated=await run({pda,stageStore:webCache,hint:'fetch:'+nativeRevision('B'),label:'B'});
assert.equal(updated.executions,1);
const index=pda.data.get(indexKey);
assert.equal(index.active.revision,nativeRevision('B'));
assert.equal(index.previous.digest,firstIndex.active.digest);
const damagedChunk=partPrefix+index.active.digest+':0';
pda.data.set(damagedChunk,pda.data.get(damagedChunk).replace('B','X'));
for(const url of webCache.keys())if(url.endsWith(index.active.digest))webCache.set(url,'tampered');
const rollback=await run({pda,stageStore:webCache,session:new Map(updated.session),denyAll:true});
assert.equal(rollback.executions,1);assert.equal(rollback.requests.length,0);
assert.deepEqual(rollback.executedRevisions,[nativeRevision('A')]);
assert.deepEqual(pda.data.get(pda.settingsKey),pda.settings);

const concurrentPda=nativeFixture();
await run({pda:concurrentPda});
let resumeSlow,manifestRequested;
const manifestGate=new Promise(resolve=>{resumeSlow=resolve;}),slowReady=new Promise(resolve=>{manifestRequested=resolve;});
const slow=run({pda:concurrentPda,hint:'fetch:'+nativeRevision('C'),label:'C',beforeManifest:()=>{manifestRequested();return manifestGate;}});
await slowReady;
try{
 const fast=await run({pda:concurrentPda,hint:'fetch:'+nativeRevision('B'),label:'B'});
 assert.deepEqual(fast.executedRevisions,[nativeRevision('B')]);
}finally{resumeSlow();}
assert.deepEqual((await slow).executedRevisions,[nativeRevision('C')]);
assert.equal(concurrentPda.data.get(indexKey).active.revision,nativeRevision('B'),'An in-flight view cannot publish over an intervening commit');

const stagedPda=nativeFixture(),nativeStaging=new Map();
await run({pda:stagedPda,stageStore:nativeStaging});
const discovered=await run({pda:stagedPda,stageStore:nativeStaging,label:'B',waitForStage:true});
assert.equal(discovered.events[0],'execute','Checking for updates must follow warm startup');
assert.equal(discovered.session.get(cacheKey+':pending'),'staged:'+nativeRevision('B'));
const bootStaged=await run({pda:stagedPda,stageStore:nativeStaging,session:discovered.session,denyAll:true});
assert.deepEqual(bootStaged.executedRevisions,[nativeRevision('B')]);assert.equal(bootStaged.requests.length,0);

const legacyPda=nativeFixture(),legacyWebCache=new Map();
const legacySource=nativeSource('L').repeat(2);
legacyPda.data.set(cacheKey,{...bundle,revision:nativeRevision('L'),runtimeSource:legacySource,signature:sha256([legacySource,addon].join('\n;\n'))});
const legacyBoot=await run({pda:legacyPda,stageStore:legacyWebCache,denyAll:true});
await legacyPda.idle();
assert.equal(legacyBoot.executions,1);
assert(legacyPda.data.has(cacheKey),'The migration boot retains the legacy row');
assert.equal(legacyPda.data.get(indexKey).active.revision,nativeRevision('L'));
const laterBoot=await run({pda:legacyPda,stageStore:new Map(),denyAll:true});
await legacyPda.idle();
assert.equal(laterBoot.executions,1);
assert(!legacyPda.data.has(cacheKey),'A later boot confirms the native segments before deleting the legacy row');
assert.deepEqual(legacyPda.deletes,[cacheKey]);
const unlocked=nativeFixture();
assert.equal((await run({pda:unlocked,hasLocks:false})).executions,1);
assert.equal(unlocked.writes.length,0);
console.log('PDA verified runtime: warm and offline starts, interrupted writes, damaged-cache rollback, legacy retirement and no-lock startup passed.');
