import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const loader=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8'),core=fs.readFileSync(new URL('./src/00-runtime-core.part',import.meta.url),'utf8');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const native=new Map(),browser=new Map(),legacy=new Map(),listeners=new Map();
const doc={addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);}};
class Event{constructor(type,options){this.type=type;this.detail=options.detail;}}
let release,fail=false;
const store={get:async(key,fallback)=>clone(native.get(key)??fallback),set:async(key,value)=>{if(release)await new Promise(resolve=>{release=resolve;});if(fail){const error=fail;fail=false;throw error;}native.set(key,clone(value));},delete:async key=>native.delete(key)};
const localStorage={getItem:key=>browser.get(key)??null,setItem:(key,value)=>browser.set(key,value),removeItem:key=>browser.delete(key)};
const keys={DATA_STORAGE_KEY:'data',DATA_MIRROR_KEY:'mirror',OWN_BATTLE_STATS_STORAGE_KEY:'stats',UI_STORAGE_KEY:'ui',STORAGE_KEY:'ui',ALERT_SNOOZE_STORAGE_KEY:'snoozes',TARGET_RECORDS_KEY:'targets'};
const ctx=vm.createContext({...keys,setTimeout,clearTimeout,n:'data',s:'mirror',i:'stats',l:'ui',c:'snoozes',u:'targets',m:'write',d:new Set(['data','stats','ui','snoozes','targets']),BRIDGED_STORAGE_KEYS:new Set(['data','stats','ui','snoozes']),STORAGE_WRITE_EVENT:'write',CustomEvent:Event,document:doc,globalThis:{localStorage,PDA_storage:store,GM_getValue:async(key,fallback)=>clone(legacy.get(key)??fallback),GM_setValue:async(key,value)=>legacy.set(key,clone(value))}});
vm.runInContext(loader.slice(loader.indexOf('function isRecord(value)'),loader.indexOf('function validBundle(value)')),ctx);
const loaderBridgeStart=loader.indexOf('!function(){let e=Promise.resolve();'),loaderBridgeEnd=loader.indexOf(',await loadRuntime()',loaderBridgeStart);
assert(loaderBridgeStart>=0&&loaderBridgeEnd>loaderBridgeStart,'The actual PDA launcher must register its storage acknowledgement bridge.');
vm.runInContext(loader.slice(loaderBridgeStart,loaderBridgeEnd),ctx);
legacy.set('data',{_savedAt:1,apiKey:'synthetic',settings:{plugins:{chat:{term:'keep'}}},caches:{targetList:{'1':{name:'A',description:'old'},'2':{name:'B'}}}});
const boot=await ctx.collectBootstrap();assert.equal(native.get('data').settings.plugins.chat.term,'keep','Legacy data must migrate non-destructively to available native storage');assert.equal(legacy.get('data').apiKey,'synthetic');
const beforeReadFailure=clone(native.get('data')),getBeforeFailure=store.get;
localStorage.setItem('mirror',JSON.stringify({data:{_savedAt:999999,apiKey:'stale-browser',settings:{},caches:{}}}));
assert.equal((await ctx.readPersistedData()).apiKey,'synthetic','An established native primary must not be overwritten by a stale browser snapshot with a newer clock stamp');
store.get=async(key,fallback)=>{if(key==='data')throw Error('temporary read failure');return getBeforeFailure(key,fallback);};
await ctx.readPersistedData();assert.deepEqual(native.get('data'),beforeReadFailure,'A failed primary read must never trigger mirror repair into that unread primary');store.get=getBeforeFailure;
const runtime=vm.createContext({...keys,PDA_BOOTSTRAP:boot,PDA_STORAGE_WRITE_EVENT:'write',CustomEvent:Event,document:doc,global:{localStorage,setTimeout,clearTimeout},GM_API:{},moduleRoot:()=>null,
 writeDataMirror:value=>localStorage.setItem('data',JSON.stringify(value))});
const bridgeStart=core.indexOf('const pendingStorageWrites='),bridgeEnd=core.indexOf('try { delete global[PDA_BOOTSTRAP_KEY]',bridgeStart);
const writeStart=core.indexOf('function storageWrite('),writeEnd=core.indexOf('function storageDelete(',writeStart);
vm.runInContext(core.slice(bridgeStart,bridgeEnd)+core.slice(writeStart,writeEnd),runtime);
let settled=false;release=true;
const pending=runtime.storageWrite('ui',{_savedAt:2,theme:'halloween-2026'}).then(()=>{settled=true;});
await new Promise(resolve=>setTimeout(resolve,5));assert.equal(settled,false,'UI may not claim completion before native acknowledgement');release();release=null;await pending;
assert.equal(native.get('ui').theme,'halloween-2026');await runtime.flushPdaStorage();
fail=Object.assign(Error('quota'),{code:'GlobalQuotaExceeded',quota:262144000});
await assert.rejects(()=>runtime.storageWrite('ui',{_savedAt:3,theme:'failed'}),/shared userscript storage.*250.00 MiB limit.*GlobalQuotaExceeded/);
await assert.rejects(()=>runtime.flushPdaStorage(),/could not be saved/);
await assert.rejects(()=>runtime.storageWrite('ui',{_savedAt:4,theme:'queued'}),/paused.*shared userscript storage/);
assert.equal(native.get('ui').theme,'halloween-2026','Quota failure must not fall back and pretend the native write succeeded');
doc.dispatchEvent(new Event('write',{detail:JSON.stringify({action:'retry'})}));
await runtime.storageWrite('ui',{_savedAt:4,theme:'retry'});await runtime.flushPdaStorage();
const initial=clone(native.get('data'));
const removed=clone(initial);delete removed.caches.targetList['1'];removed._savedAt=10;
await runtime.storageWrite('data',removed,{settings:initial.settings,targetList:initial.caches.targetList});
const stale=clone(initial);stale._savedAt=11;
await runtime.storageWrite('data',stale,{settings:initial.settings,targetList:initial.caches.targetList});
assert.equal(Object.hasOwn(native.get('data').caches.targetList,'1'),false,'An unchanged stale snapshot must not resurrect a removed target');
const base=clone(native.get('data')),note=clone(base),name=clone(base);note.caches.targetList['2'].description='new note';note._savedAt=20;name.caches.targetList['2'].name='new name';name._savedAt=21;
await runtime.storageWrite('data',note,{settings:base.settings,targetList:base.caches.targetList});
await runtime.storageWrite('data',name,{settings:base.settings,targetList:base.caches.targetList});
assert.equal(native.get('data').caches.targetList['2'].description,'new note');assert.equal(native.get('data').caches.targetList['2'].name,'new name');
const authBase=clone(native.get('data'));authBase.sessions={permission:{token:'synthetic-before'}};native.set('data',clone(authBase));
const authNew=clone(authBase);authNew.apiKey='synthetic-fresh';authNew.sessions.permission.token='synthetic-after';authNew._savedAt=30;
await runtime.storageWrite('data',authNew,{settings:authBase.settings,targetList:authBase.caches.targetList,protected:{apiKey:authBase.apiKey,sessions:authBase.sessions}});
const authStale=clone(authBase);authStale._savedAt=31;
await runtime.storageWrite('data',authStale,{settings:authBase.settings,targetList:authBase.caches.targetList,protected:{apiKey:authBase.apiKey,sessions:authBase.sessions}});
assert.equal(native.get('data').apiKey,'synthetic-fresh');assert.equal(native.get('data').sessions.permission.token,'synthetic-after','Unchanged stale background records must not replace current credentials or sessions');
browser.clear();legacy.clear();const reloaded=await ctx.collectBootstrap();assert.equal(reloaded.data.apiKey,'synthetic-fresh');assert.equal(reloaded.data.settings.plugins.chat.term,'keep');assert.equal(reloaded.ui.theme,'retry');
const normalizer=vm.createContext({...keys,storageRead:()=>reloaded.data,global:{localStorage},SETTINGS_STORAGE_KEY:'safe',storedRecord:value=>value&&typeof value==='object'?value:null,storedRecordSavedAt:value=>value?._savedAt||0,recordHasData:value=>Boolean(value&&Object.keys(value).length),mergeAlertSnoozes:()=>({}),readAlertSnoozes:()=>({}),normalizePdaAlertTypes:value=>value,normalizeRacingState:value=>value});
vm.runInContext(core.slice(core.indexOf('function readDataState()'),core.indexOf('function portableBackupPayload()')),normalizer);
assert.equal(normalizer.readDataState().settings.plugins.chat.term,'keep','Startup normalization must preserve unknown/add-on settings');
runtime.SETTINGS_STORAGE_KEY='safe';runtime.dataState=clone(reloaded.data);runtime.dataState.settings.alerts={enabledTypes:{cityItems:true}};
runtime.lastPersistedSettings=clone(runtime.dataState.settings);runtime.lastPersistedTargets=clone(runtime.dataState.caches.targetList);
runtime.lastPersistedProtected={apiKey:runtime.dataState.apiKey,sessions:clone(runtime.dataState.sessions)};
runtime.storageRead=(_key,fallback)=>JSON.parse(localStorage.getItem('data')||'null')||fallback;
runtime.writeAlertSnoozes=()=>{};runtime.storedRecord=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;runtime.recordHasData=value=>Boolean(value&&Object.keys(value).length);runtime.storedRecordSavedAt=value=>value?._savedAt||0;
vm.runInContext(core.slice(core.indexOf('function cloneSettings('),core.indexOf('function readDataState()'))+core.slice(core.indexOf('function writeDataState()'),core.indexOf('function currentApiKey()')),runtime);
vm.runInContext('acknowledgedDataBase={settings:cloneSettings(lastPersistedSettings),targetList:cloneSettings(lastPersistedTargets),protected:cloneSettings(lastPersistedProtected)};',runtime);
native.set('data',clone(runtime.dataState));localStorage.setItem('data',JSON.stringify(runtime.dataState));localStorage.setItem('safe',JSON.stringify({data:runtime.dataState.settings}));
runtime.dataState.settings.alerts.enabledTypes.cityItems=false;fail=true;
await assert.rejects(()=>runtime.writeDataState(),/failed/);
const unhandled=[];const onUnhandled=error=>unhandled.push(error);process.on('unhandledRejection',onUnhandled);
fail=true;const ignoredBackgroundSave=runtime.writeDataState();
await new Promise(resolve=>setTimeout(resolve,15));
assert.equal(unhandled.length,0,'Ignored background aggregates must not flood the console with unhandled rejections');
await assert.rejects(ignoredBackgroundSave,/failed/,'Explicit callers must still receive the actual save failure');
process.removeListener('unhandledRejection',onUnhandled);
runtime.dataState.caches.targetList['2'].description='After failed preference save';await runtime.writeDataState();
assert.equal(native.get('data').settings.alerts.enabledTypes.cityItems,false,'A later successful save must retain changes from an earlier failed native write');
assert.equal(native.get('data').caches.targetList['2'].description,'After failed preference save');
const shell=fs.readFileSync(new URL('./src/90-shell-bootstrap.part',import.meta.url),'utf8');
const saveBlock=shell.slice(shell.indexOf("if (action === 'save-target-list')"),shell.indexOf("if (action === 'toggle-target-stakeout')"));
let resolveSave,rejectSave,submitted;
const targetState={formOpen:true,editingId:0},fields=new Map([['target-list-id','42'],['target-list-name','Synthetic'],['target-list-description','Before'],['target-list-stakeout-interval','60']]);let edited=false;
const targetContext=vm.createContext({action:'save-target-list',moduleState:{targetList:targetState},moduleRoot:()=>({querySelector:selector=>({value:fields.get(selector.match(/data-field="([^"]+)"/)?.[1])||'',checked:false}),querySelectorAll:()=>[]}),editableState:{begin:()=>({}),commit:()=>!edited},addPdaTarget:value=>{submitted=value;},updatePdaTarget(){},flushPdaStorage:()=>new Promise((yes,no)=>{resolveSave=yes;rejectSave=no;}),renderTargetList(){},errorMessage:e=>e.message});
vm.runInContext('async function saveTarget(){'+saveBlock+'}',targetContext);
const saving=targetContext.saveTarget();await targetContext.saveTarget();assert.equal(targetState.saving,true,'A duplicate click must not release the original pending-save guard');assert.equal(targetState.formOpen,true);
edited=true;fields.set('target-list-description','After');assert.equal(submitted.description,'Before');resolveSave();await saving;assert.equal(targetState.formOpen,true,'A confirmed older save must not close a newer draft');assert.equal(targetState.saving,false);
const failedSave=targetContext.saveTarget();await new Promise(resolve=>setImmediate(resolve));rejectSave(Error('native quota'));await failedSave;assert.match(targetState.error,/quota/);assert.equal(targetState.formOpen,true);assert.notEqual(targetState.notice,'Target saved.');
console.log('PDA native acknowledgement, legacy migration, quota/retry, browser-cache-clear recovery, target deletion/note merges and add-on preference preservation passed.');

 // A native single-key bridge may reject nullable/key payloads on an app build.
 // The documented getMany/setMany paths must retain the same namespace and data.
 const originalGet=store.get,originalSet=store.set;
 store.get=async()=>{throw Error("type 'Null' is not a subtype of type 'String' in type cast");};
 store.set=store.get;
 store.getMany=async keys=>Object.fromEntries(keys.map(key=>[key,clone(native.get(key)??null)]));
 store.setMany=async values=>{for(const [key,value]of Object.entries(values))native.set(key,clone(value));};
 await ctx.gmWrite('ui',{theme:'halloween-2026'});
 const saved=clone(native.get('data'));saved.settings.plugins.chat.ffBubbles=true;await ctx.gmWrite('data',saved);
 browser.clear();
 assert.equal((await ctx.gmRead('ui',null)).theme,'halloween-2026');
 assert.equal((await ctx.readPersistedData()).settings.plugins.chat.ffBubbles,true);
 assert.equal(native.get('data').apiKey,saved.apiKey,'The native key must remain unchanged');
 store.get=originalGet;store.set=originalSet;
 console.log('Native batch bridge retains Halloween theme and Chat FF preferences through the exact nullable single-key error and browser-cache loss.');

// Exercise the actual storage bridge and bootstrap around the optional IDB
// transaction. Requests can succeed and still be rolled back before commit.
let idbValue,mode='complete',dataWrites=0;
const batchWrite=store.setMany;
store.setMany=async values=>{
 if(Object.hasOwn(values,'data'))dataWrites++;
 return batchWrite(values);
};
ctx.f='test-runtime';
ctx.globalThis.indexedDB={
 open(){
  const request={};
  setImmediate(()=>{
   if(mode==='blocked'){request.onblocked();return;}
   request.result={
    close(){},
    transaction(){
     let active=true,pending;
     const tx={
      abort(){if(active){active=false;tx.onabort();}},
      objectStore(){return {
       get(){
        const read={};
        if(mode!=='timeout')setImmediate(()=>{
         if(!active)return;
         read.result=clone(idbValue);read.onsuccess();
         if(!active)return;
         if(mode==='abort'){tx.abort();return;}
         if(pending)idbValue=clone(pending);
         active=false;tx.oncomplete();
        });
        return read;
       },
       put(value){pending=value;}
      };}
     };
     return tx;
    }
   };
   request.onsuccess();
  });
  return request;
 }
};
const when=Date.now()-10000;
const catalog=(at,name)=>({at,data:{stocks:[{id:1,name,acronym:'TST',bonus:{passive:false},extra:'not-public-output'}]}});
const originalData=clone(native.get('data'));
originalData.caches.alertNotificationIds=['durable-alert'];
originalData.caches.abroadStocks={watches:['durable-watch'],snoozes:{one:100}};
originalData.caches.plugins={arson:{pending:['unsent']}};
const saveCatalog=(stockCatalog,stamp)=>runtime.storageWrite('data',{...originalData,_savedAt:stamp,caches:{...originalData.caches,stockCatalog}});
const first=catalog(when,'First');
mode='abort';await saveCatalog(first,Date.now()+1);
assert.deepEqual(native.get('data').caches.stockCatalog,first,'An aborted IDB transaction must retain the native cache');
assert.equal(idbValue,undefined);
mode='complete';await saveCatalog(first,Date.now()+2);
assert(!Object.hasOwn(native.get('data').caches,'stockCatalog'),'The committed migration removes only the catalog from native storage');
assert.equal(idbValue.data.stocks[0].extra,undefined);
assert.equal((await ctx.collectBootstrap()).data.caches.stockCatalog.data.stocks[0].name,'First');
for(const key of ['targetList','alertNotificationIds','abroadStocks','plugins'])assert.deepEqual(native.get('data').caches[key],originalData.caches[key]);
assert.equal(native.get('data').apiKey,originalData.apiKey);
assert.deepEqual(native.get('data').sessions,originalData.sessions);
const priorWrites=dataWrites;
const secondDocument=new EventTarget();
const secondView=vm.createContext({setTimeout,clearTimeout,n:'data',s:'mirror',i:'stats',l:'ui',c:'snoozes',u:'targets',f:'test-runtime',m:'second-view',
 d:new Set(['data','stats','ui','snoozes','targets']),CustomEvent,document:secondDocument,globalThis:{...ctx.globalThis}});
vm.runInContext(loader.slice(loader.indexOf('function isRecord(value)'),loader.indexOf('function validBundle(value)')),secondView);
vm.runInContext(loader.slice(loaderBridgeStart,loaderBridgeEnd),secondView);
function saveFromSecondView(stockCatalog){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Missing second WebView acknowledgement')),2000);
  secondDocument.addEventListener('second-view:ack',event=>{
   const ack=JSON.parse(event.detail);
   if(ack.id!=='stale-catalog'||ack.phase)return;
   clearTimeout(timer);
   if(ack.ok)resolve();else reject(Error(ack.error));
  });
  secondDocument.dispatchEvent(new CustomEvent('second-view',{detail:JSON.stringify({protocol:2,id:'stale-catalog',key:'data',
   value:{...originalData,_savedAt:Date.now()+4,caches:{...originalData.caches,stockCatalog}}
  })}));
 });
}
await saveCatalog(catalog(when+20,'Newer'),Date.now()+3);
await saveFromSecondView(catalog(when+10,'Stale view'));
assert.equal(idbValue.data.stocks[0].name,'Newer','A stale page save cannot overwrite a newer catalog');
assert.equal(dataWrites,priorWrites,'A cache-only update should not rewrite the native main record');
mode='blocked';const blocked=catalog(when+30,'Blocked');await saveCatalog(blocked,Date.now()+5);
assert.deepEqual(native.get('data').caches.stockCatalog,blocked,'A previous successful transaction does not authorize stripping a failed write');
assert.equal((await ctx.collectBootstrap()).data.caches.stockCatalog.data.stocks[0].name,'Blocked');
mode='timeout';const delayed=catalog(when+40,'Timed out');await saveCatalog(delayed,Date.now()+6);
assert.deepEqual(native.get('data').caches.stockCatalog,delayed,'Timed-out IDB operations must fall back to native acknowledgement');
mode='complete';await saveCatalog(delayed,Date.now()+7);
idbValue={...delayed,data:{stocks:[{id:1,name:'malformed'}]}};
assert(!Object.hasOwn((await ctx.collectBootstrap()).data.caches,'stockCatalog'),'Malformed browser records are ignored');
idbValue=undefined;
const afterEviction=await ctx.collectBootstrap();
assert(!Object.hasOwn(afterEviction.data.caches,'stockCatalog'),'An evicted public catalog is rebuilt on refresh');
assert.deepEqual(clone(afterEviction.data.caches.plugins),originalData.caches.plugins);
console.log('Public stock cache: committed migration, native fallback, stale views, eviction and durable-data retention passed.');
