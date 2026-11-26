// ==UserScript==
// @name         SLINK PDA Runtime Cache Test
// @namespace    Considious SLINK PDA runtime-cache test
// @version      0.4.283
// @description  Mobile-first SLINK dashboard for Torn PDA with Combat, Efficiency, Quality of Life, and shared permissions.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/review/pda-verified-runtime-cache/SLINK-PDA/SLINK_PDA_Runtime_Cache_Test.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/review/pda-verified-runtime-cache/SLINK-PDA/SLINK_PDA_Runtime_Cache_Test.user.js
// @match        https://www.torn.com/*
// @grant        GM_addElement
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @connect      api.kalends.dev
// @connect      api.torn.com
// @connect      slink-chat-central-test.richard-johnson554.workers.dev
// @connect      slink-faction-node-46978-test.richard-johnson554.workers.dev
// @connect      api.giphy.com
// @connect      chatsticker.com
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @connect      ffscouter.com
// @connect      weav3r.dev
// @connect      slink-ranked-gear-preview.richard-johnson554.workers.dev
// @connect      yata.yt
// @connect      prombot.co.uk
// @connect      torn-intel.com
// @connect      droqsdb.com
// @connect      slinkyleveling.richard-johnson554.workers.dev
// @connect      slinkcontributionworker.richard-johnson554.workers.dev
// @connect      slinkwarworker.richard-johnson554.workers.dev
// @connect      slinkmuggingworker.richard-johnson554.workers.dev
// @run-at       document-end
// ==/UserScript==
(async()=>{'use strict';const e='https://raw.githubusercontent.com/Considious/Torn-Scripts/review/pda-verified-runtime-cache/SLINK-PDA/',t=e+'source-manifest.json',r=String('###PDA-APIKEY###').trim(),o='slink-pda-runtime-load-error',a='slink-pda-dashboard-host',n='slink-pda-dashboard:data:v1',s='slink-pda-dashboard:data:mirror:v1',i='slink-pda-dashboard:own-battle-stats:v1',l='slink-pda-dashboard:ui:v1',c='slink-pda-dashboard:alert-snoozes:v1',u='slink-pda-dashboard:targets:v1',d=new Set([n,i,l,c,u]),f='slink-pda-dashboard:runtime-cache:v1:feature-verified-runtime-test',g='slink-pda-dashboard:runtime-cache-retry:v1:feature-verified-runtime-test';let h=!1,w=null;const residentBridge=globalThis.__SLINK_PDA_STORAGE_BRIDGE__;const m=residentBridge?.protocol===1&&residentBridge.document===document&&typeof residentBridge.channel==='string'?residentBridge.channel:'slink-pda-storage-write:'+(globalThis.crypto?.randomUUID?.()||String(Date.now())+':'+Math.random());function showFailure(e){const t=String(e?.message||e||'Unknown startup error');console.error('SLINK PDA runtime failed to load:',e),document.getElementById(o)?.remove();const r=document.createElement('button');r.id=o,r.type='button',r.textContent='SLINK could not load. '+t.replace(/([?&](?:key|api_key|token)=)[^&#\\s]+/gi,'$1[redacted]').slice(0,350)+' Torn is unaffected — tap to retry',r.title='Startup files could not finish loading. Check your connection, tap Retry once, then update SLINK if it continues. Saved settings have not been cleared. [SLINK_RUNTIME_LOAD]',r.style.cssText='position:fixed;right:10px;bottom:76px;z-index:2147483647;max-width:calc(100vw - 20px);white-space:normal;overflow-wrap:anywhere;padding:10px 12px;border:2px solid #111;border-radius:8px;background:#b91c1c;color:#fff;font:bold 12px Arial,sans-serif',r.addEventListener('click',()=>{r.remove(),loadRuntime(!0)}),(document.body||document.documentElement).appendChild(r)}function isRecord(value){return Boolean(value&&'object'==typeof value&&!Array.isArray(value))}function hasData(value){return Boolean(isRecord(value)&&Object.keys(value).length)}function savedAt(value){return Math.max(0,Number(isRecord(value)?value._savedAt||value.savedAt:0)||0)}function writeMirror(value){if(isRecord(value))try{globalThis.localStorage?.setItem(s,JSON.stringify({schema:1,savedAt:Date.now(),data:value})),globalThis.localStorage?.setItem(n,JSON.stringify(value))}catch{}}async function readPersistedData(){
 const native=nativeStorage();
 async function read(store){
  readPersistedData.failed=false;
  let primary=null,primaryFailed=false;
  try{
   if(store){
    const value=await store.get(n,null);
    if(hasData(value)){writeMirror(value);return value;}
   }
   const value=await gmRead(n,{},store);
   if(isRecord(value))primary=value;
  }catch{primaryFailed=true;readPersistedData.failed=true;}
  const mirror=(()=>{
   try{const saved=JSON.parse(globalThis.localStorage?.getItem(s)||'null');return isRecord(saved?.data)?saved.data:isRecord(saved)?saved:null;}
   catch{return null;}
  })();
  let selected=hasData(primary)?primary:mirror||{};
  if(hasData(mirror)&&savedAt(mirror)>savedAt(selected))selected=mirror;
  if(hasData(selected))writeMirror(selected);
  if(selected===mirror&&selected!==primary&&!primaryFailed){
   if(store)await store.set(n,selected);
   else await gmWrite(n,selected);
  }
  return selected;
 }
 return native?native.transaction(read):read(null);
}
async function collectBootstrap(){const[nativeData,e,catalog]=await Promise.all([readPersistedData(),gmRead(i,null),nativeStorage()?stockCatalogTransaction():null]),data=catalog?hydrateStockCatalog(nativeData,catalog):nativeData,t=u;let r;try{if(r=await targetJournal(),readPersistedData.failed&&!r.ops.some(e=>'migration'===e.kind))throw Error('Legacy target storage could not be read.')}catch{r={ops:[],error:'Target storage is unavailable. Reload to retry; saved targets have not been changed.'}}let o=null;try{o=JSON.parse(globalThis.localStorage?.getItem(i)||'null')}catch{}const a=[e,o,data?.caches?.ownBattleStats].filter(value=>isRecord(value)&&Number(value.total)>0).sort((e,t)=>Number(t.checkedAt||0)-Number(e.checkedAt||0))[0]||null;return{[n]:data,[i]:a,[t]:r,storageAutoRecovery:nativeStorage.automaticRecovery||null,storageWriteEvent:m,[l]:await gmRead(l,{}),[c]:await gmRead(c,{})}}function nativeStorage(){
 const store=typeof PDA_storage==='object'?PDA_storage:globalThis.PDA_storage;
 if(!store||typeof store.get!=='function'||typeof store.set!=='function')return null;
 const key=value=>{if(typeof value!=='string'||!value)throw Error('SLINK storage requires a non-empty key.');return value};
 const castError=error=>/type ['"]Null['"] is not a subtype of type ['"]String['"]/i.test(String(error?.code||error?.message||error));
 const rowTooBig=error=>/Row too big to fit into CursorWindow|SQLiteBlobTooBigException/i.test([error?.code,error?.message,String(error)].join(' '));
 const recoverableRead=error=>rowTooBig(error)||(castError(error)&&error.code===error.message);
 const canSegment=()=>!!globalThis.navigator?.locks?.request&&!!globalThis.crypto?.subtle?.digest&&typeof store.getMany==='function'&&typeof store.setMany==='function'&&typeof store.list==='function';
 // Automatic repair requires a committed native checkpoint with verified parts.
 // Legacy records without one still require the explicit Access rebuild.
 const selector=n+':manual-recovery:v2',legacySelector=n+':manual-recovery:v1',prefix=n+':manual-recovery:v2:record:',legacyPrefix=n+':manual-recovery:v1:record:';
 async function selectedRecord(){
  if(!nativeStorage.selection)nativeStorage.selection=(async()=>{
   if(typeof store.list!=='function')return n;
   const names=await store.list();if(!Array.isArray(names))throw Error('PDA native record listing could not be read.');
   const selected=names.includes(selector)?selector:names.includes(legacySelector)?legacySelector:null;if(!selected)return n;
   const value=await store.get(selected,null);
   if(!isRecord(value)||value.schema!==1||typeof value.record!=='string'||!value.record.startsWith(prefix)&&!value.record.startsWith(legacyPrefix)||!/^[a-zA-Z0-9:_-]+$/.test(value.record.slice(value.record.startsWith(prefix)?prefix.length:legacyPrefix.length)))throw Error('The native recovery selection is unreadable. Saved records have not been changed.');
   return value.record;
  })().catch(error=>{nativeStorage.selection=null;throw error;});
  return nativeStorage.selection;
 }
 const segmented=value=>isRecord(value)&&value.$slinkNativeParts===1;
 const webLocks=globalThis.navigator?.locks;
 const coordinationUnavailable=()=>Error('This WebView cannot coordinate segmented native saving safely. Original records were not replaced. [SLINK_STORAGE_COORDINATION_UNAVAILABLE]');
 const lock=run=>{
  if(!webLocks?.request)throw coordinationUnavailable();
  return webLocks.request('slink-pda-recovered-settings-v2',run);
 };
 function coordinate(run){
  if(webLocks?.request)return lock(run);
  const next=(nativeStorage.pending||Promise.resolve()).then(run);
  nativeStorage.pending=next.catch(()=>{});
  return next;
 }
 const digest=async text=>[...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 const invalidParts=message=>Object.assign(Error(message),{code:'SLINK_NATIVE_SEGMENTS_INVALID'});
 function validateParts(header){if(!segmented(header)||!['a','b'].includes(header.bank)||!Number.isSafeInteger(header.count)||header.count<1||header.count>65536||!Number.isSafeInteger(header.length)||header.length<1||!/^[a-f0-9]{64}$/.test(header.sha256||''))throw invalidParts('Recovered settings have an invalid native segment header. Saved records were not cleared.');}
 async function readParts(record,header){
  validateParts(header);const cached=nativeStorage.partsCache?.get(record);if(cached?.header===JSON.stringify(header))return JSON.parse(cached.source);let source='';
  for(let offset=0;offset<header.count;offset+=4){
   const keys=Array.from({length:Math.min(4,header.count-offset)},(_,index)=>record+':part:'+header.bank+':'+(offset+index));
   const values=await store.getMany(keys);
   for(const name of keys){if(typeof values?.[name]!=='string')throw invalidParts('A recovered settings segment is missing. Keep this page open; no settings were cleared.');source+=values[name];}
  }
  if(source.length!==header.length||await digest(source)!==header.sha256)throw invalidParts('Recovered settings segments did not pass verification. Keep this page open; no settings were cleared.');
  (nativeStorage.partsCache ||= new Map()).set(record,{header:JSON.stringify(header),source});return JSON.parse(source);
 }
 function quotaFailure(operation,error){
  const pattern=/\b(?:GlobalQuotaExceeded|QuotaExceeded)\b/i;
  const code=String(error?.code??'').match(pattern)?.[0]||String(error?.message??error).match(pattern)?.[0];
  if(!code)return null;
  const shared=code.toLowerCase()==='globalquotaexceeded';
  const validBytes=value=>Number.isSafeInteger(value)&&value>=0;
  const usage={...validBytes(error?.used)&&{used:error.used},...validBytes(error?.quota)&&{quota:error.quota}};
  nativeStorage.lastQuotaFailure={scope:shared?'global':'script',code,operation,...usage,at:Date.now()};
  const mib=bytes=>(bytes/1048576).toFixed(2);
  const limits=[
   usage.used===undefined?'':mib(usage.used)+' MiB attempted',
   usage.quota===undefined?'':mib(usage.quota)+' MiB limit'
  ].filter(Boolean);
  const detail=limits.length?' ('+limits.join(', ')+')':'';
  const message=shared
   ?"Torn PDA's shared userscript storage quota exceeded"+detail+". Review storage used by installed scripts in PDA Dev Tools → Storage, then retry. [SLINK_STORAGE_GLOBAL_FULL]"
   :"SLINK's Torn PDA storage quota exceeded"+detail+". Increase SLINK's limit in PDA Dev Tools → Storage, then retry. [SLINK_STORAGE_FULL]";
  return Object.assign(new Error(message+' ('+code+')',{cause:error}),{code,...usage,nativeQuota:true});
 }
 async function withNativeQuota(operation,write){
  try{return await write();}catch(error){throw quotaFailure(operation,error)||error;}
 }
 async function writeParts(record,value){
  return withNativeQuota('segmented settings write',()=>writePartsInner(record,value));
 }
 async function writePartsInner(record,value){
  const old=await store.get(record,null),bank=segmented(old)&&old.bank==='a'?'b':'a',source=JSON.stringify(value),count=Math.ceil(source.length/48000);
  if(segmented(old)){
   const saved=await readParts(record,old);
   // No-op saves must not rotate banks or destroy the last distinct checkpoint.
   if(JSON.stringify(saved)===source){await saveCheckpoint(record,old);return;}
   await saveCheckpoint(record,old);
  }
  // Fixed A/B slots bound storage growth. Only the inactive bank is changed;
  // its small header is committed after every segment has been read back.
  // 48000 is a transport batch choice, NOT a claimed PDA storage-size limit.
  for(let offset=0;offset<count;offset+=4){
   const parts=Object.fromEntries(Array.from({length:Math.min(4,count-offset)},(_,index)=>[record+':part:'+bank+':'+(offset+index),source.slice((offset+index)*48000,(offset+index+1)*48000)]));
   const before=await store.getMany(Object.keys(parts)),changed=Object.fromEntries(Object.entries(parts).filter(([key,value])=>before?.[key]!==value));
   if(Object.keys(changed).length){await store.setMany(changed);const saved=await store.getMany(Object.keys(changed));for(const [name,text]of Object.entries(changed))if(saved?.[name]!==text)throw Error('PDA did not retain a new settings segment. The previous saved bank remains selected.');}
  }
  const header={$slinkNativeParts:1,bank,count,length:source.length,sha256:await digest(source),generation:(Number.isSafeInteger(old?.generation)&&old.generation>=0?old.generation:0)+1};
  await store.set(record,header);
  const saved=await store.get(record,null);if(JSON.stringify(saved)!==JSON.stringify(header))throw Error('PDA did not confirm the segmented settings save. Keep this page open; original records were not cleared.');
  (nativeStorage.partsCache ||= new Map()).set(record,{header:JSON.stringify(saved),source});
  await saveCheckpoint(record,saved);
 }
 const checkpointKey=(record,bank)=>record+':checkpoint:'+bank;
 async function saveCheckpoint(record,header){
  validateParts(header);const name=checkpointKey(record,header.bank),signature=JSON.stringify(header);
  if(nativeStorage.checkpointCache?.get(name)===signature)return;
  try{
   const previous=await store.get(name,null);
   if(previous?.schema!==1||previous.record!==record||JSON.stringify(previous.header)!==signature){
    const checkpoint={schema:1,record,header,committedAt:Date.now()};await store.set(name,checkpoint);
    if(JSON.stringify(await store.get(name,null))!==JSON.stringify(checkpoint))throw Error('Checkpoint was not acknowledged.');
   }
   (nativeStorage.checkpointCache ||= new Map()).set(name,signature);
   nativeStorage.checkpointStatus='verified';
  }catch(error){quotaFailure('settings checkpoint',error);nativeStorage.checkpointStatus='unavailable';}
 }
 async function automaticallyRecoverLocked(record){
  if(!canSegment()||typeof store.delete!=='function')return false;
   nativeStorage.selection=null;if(await selectedRecord()!==record)return true;
   const names=await store.list(),checkpoints=[];
   // Never read loadAll or adopt arbitrary mirrors/orphaned recovery roots.
   for(const bank of ['a','b']){
    const name=checkpointKey(record,bank);if(!names.includes(name))continue;
    try{const cp=await store.get(name,null);if(cp?.schema!==1||cp.record!==record||cp.header?.bank!==bank)continue;validateParts(cp.header);checkpoints.push(cp);}catch{}
   }
   if(!checkpoints.length)return false;
   let currentHeader=null;
   const knownFailure=error=>recoverableRead(error)||error?.code==='SLINK_NATIVE_SEGMENTS_INVALID';
   // Two independent requested-key reads must confirm the failure. A network,
   // quota, timeout or readable replacement can never authorize deletion.
   for(const batch of [true,false]){
    try{
     currentHeader=batch?(await store.getMany([record]))?.[record]:await store.get(record,null);
     if(currentHeader===null||currentHeader===undefined)continue;
     if(!segmented(currentHeader))return false;
     nativeStorage.partsCache?.delete(record);await readParts(record,currentHeader);return true;
    }catch(error){if(!knownFailure(error))return false;}
   }
   checkpoints.sort((a,b)=>(Number(b.header.generation)||0)-(Number(a.header.generation)||0)||(Number(b.committedAt)||0)-(Number(a.committedAt)||0));
   let verified=null,value=null;
   for(const cp of checkpoints){try{nativeStorage.partsCache?.delete(record);const candidate=await readParts(record,cp.header);if(!isRecord(candidate)||!isRecord(candidate.settings))continue;verified=cp;value=candidate;break;}catch{}}
   if(!verified)return false;
   // Keep checkpoint metadata and BOTH banks intact. Only the confirmed broken
   // header is deleted; the validated native snapshot is never removed.
   try{
    if(names.includes(record)){await store.delete(record);if((await store.list()).includes(record))throw Error('Header deletion was not acknowledged.');}
    await store.set(record,verified.header);
    const restored=await store.get(record,null);if(JSON.stringify(restored)!==JSON.stringify(verified.header))throw Error('Restored header was not acknowledged.');
    nativeStorage.partsCache?.delete(record);if(JSON.stringify(await readParts(record,restored))!==JSON.stringify(value))throw Error('Restored settings did not match the checkpoint.');
   }catch(error){
    nativeStorage.partsCache?.delete(record);
    const quota=quotaFailure('automatic settings recovery',error);
    throw new Error('SLINK could not finish automatic storage repair. The verified checkpoint is retained; keep this page open and retry saving or reload once. [SLINK_STORAGE_AUTORECOVERY_FAILED]'+(quota?' '+quota.message:''),{cause:quota||error});
   }
   const report={status:'recovered',restoredAt:Date.now(),generation:Number(verified.header.generation)||0,usedPrevious:!currentHeader||verified!==checkpoints[0]||Number(currentHeader?.generation)>Number(verified.header.generation)};
   nativeStorage.automaticRecovery=report;nativeStorage.segmentFailure=null;
   if(typeof m==='string')try{globalThis.document?.dispatchEvent(new CustomEvent(m+':repaired',{detail:JSON.stringify(report)}));}catch{}
   return true;
 }
 async function recoverSettings(value,confirmed){return lock(async()=>{
  return recoverSettingsLocked(value,confirmed);
 });}
 async function recoverSettingsLocked(value,confirmed){
  if(confirmed!==true||!isRecord(value)||!isRecord(value.settings))throw Error('Settings recovery must be confirmed manually from Access.');
  if(typeof store.list!=='function')throw Error('This PDA storage version does not support safe settings recovery.');
  nativeStorage.selection=null;
  const previous=await selectedRecord();
  const names=await store.list();if(!names.includes(previous))throw Error('The original settings record is not listed. Recovery was not started.');
  for(const read of [async()=>{const result=(await store.getMany([previous]))?.[previous];return segmented(result)?readParts(previous,result):result;},async()=>{const result=await store.get(previous,null);return segmented(result)?readParts(previous,result):result;}]){
   let failure;try{await read();}catch(error){failure=error;}
   if(!failure||!castError(failure)||failure.code!==failure.message)throw Error('Recovery is only available for the confirmed native Null/String settings-read failure. No selection was changed. For an oversized row use Delete unreadable records and rebuild.');
  }
  return installRecoveredSettings(value);
 }
 async function installRecoveredSettings(value,originalPreserved=true){
  const record=prefix+(globalThis.crypto?.randomUUID?.()||String(Date.now())+':'+Math.random().toString(36).slice(2));
  const snapshot=JSON.parse(JSON.stringify(value));
  await writeParts(record,snapshot);
  const selection={schema:1,record};
  await withNativeQuota('settings recovery selection',()=>store.set(selector,selection));
  if(JSON.stringify(await store.get(selector,null))!==JSON.stringify(selection))throw Error('PDA did not confirm the recovery selection. Keep this page open and copy a storage report; do not clear saved data.');
  nativeStorage.selection=Promise.resolve(record);
  return {recovered:true,originalPreserved};
 }
 async function resetSettings(value,confirmed){
  if(confirmed!==true||!isRecord(value)||!isRecord(value.settings))throw Error('Deleting unreadable settings requires explicit confirmation from Access.');
  const snapshot=JSON.parse(JSON.stringify(value));
  if(typeof store.delete!=='function'||typeof store.list!=='function')throw Error('PDA native deletion is unavailable. No data was removed.');
  return lock(async()=>{
   nativeStorage.selection=null;const selected=await selectedRecord();nativeStorage.partsCache?.delete(selected);
   const read=async(record,batch)=>{const value=batch?(await store.getMany([record]))?.[record]:await store.get(record,null);return segmented(value)?readParts(record,value):value;};
   const unreadable=async record=>{for(const batch of [true,false]){try{await read(record,batch);return false;}catch(error){if(!recoverableRead(error))return false;}}return true;};
   if(!await unreadable(selected))throw Error('The selected settings record does not have a confirmed native Null/String or oversized-row read failure. Nothing was deleted.');
   const names=await store.list(),roots=names.filter(name=>name===n||[prefix,legacyPrefix].some(start=>name.startsWith(start)&&!/:[p]art:/.test(name.slice(start.length))&&/^[a-zA-Z0-9:_-]+$/.test(name.slice(start.length))));
   const broken=[];for(const record of roots){nativeStorage.partsCache?.delete(record);if(await unreadable(record))broken.push(record);}
   if(!broken.includes(selected))throw Error('The selected settings failure changed during the check. Nothing was deleted.');
   const removing=new Set(broken);
   for(const record of broken)for(const bank of ['a','b'])if(names.includes(checkpointKey(record,bank)))removing.add(checkpointKey(record,bank));
   for(const name of names)for(const record of broken)if(name.startsWith(record+':part:')&&/^[ab]:[0-9]+$/.test(name.slice((record+':part:').length)))removing.add(name);
   for(const name of [selector,legacySelector])if(names.includes(name)){const pointer=await store.get(name,null);if(broken.includes(pointer?.record))removing.add(name);}
   let deleted=0;
   try{for(const name of removing){await store.delete(name);deleted++;}const remaining=await store.list();if([...removing].some(name=>remaining.includes(name)))throw Error('PDA did not confirm every requested deletion.');}
   catch{throw Error('PDA could not confirm deletion of the unreadable settings records. Rebuilding was stopped before writing a replacement. Keep this page open and copy a storage report. [SLINK_STORAGE_RESET_DELETE_FAILED]');}
   nativeStorage.selection=null;nativeStorage.segmentFailure=null;for(const record of broken)nativeStorage.partsCache?.delete(record);
   try{return {...await installRecoveredSettings(snapshot,false),deleted};}
   catch(error){throw Error('Unreadable records were deleted, but the clean replacement was NOT confirmed. Your current settings remain on this page; do not close it. '+String(error?.message||error)+' [SLINK_STORAGE_RESET_REBUILD_FAILED]');}
  });
 }
 const failed=(operation,error)=>new Error('PDA native storage '+operation+' failed: '+String(error?.message||error?.code||error||'No acknowledgement'));
 async function readManyOnce(keys,allowFullStore){
  keys.forEach(key);
  try {
   const values=typeof store.getMany==='function'?await store.getMany(keys):Object.fromEntries(await Promise.all(keys.map(async k=>[k,await store.get(k,null)])));
   if(!isRecord(values))throw Error('PDA returned an unreadable storage result.');
   return values;
  }catch(error){
   if(rowTooBig(error)){
    const kind=keys.every(k=>k===n)?'settings':keys.every(k=>k.startsWith(prefix)||k.startsWith(legacyPrefix))?'recovered settings':'requested records';
    const failure=failed('read',Error("Android cannot read one oversized SLINK record. This is not the phone's free space. Keep this page open, review your settings, then use Access → Storage troubleshooting → Delete unreadable records and rebuild. This deletes confirmed unreadable settings and saves the settings on this page in smaller records. [SLINK_STORAGE_ROW_TOO_LARGE]"));
    failure.message+=' [SLINK_NATIVE_READ: record='+kind+'; batch=RowTooBig; single=not retried; all=not attempted]';throw failure;
   }
   // On this exact bridge cast, read a single requested record through
   // the documented single-key API. A full-store read must not be the only
   // recovery path: one unreadable unrelated record can make loadAll fail.
   if(castError(error)){
    let singleError;
    if(keys.length===1){
     try{return {[keys[0]]:await store.get(keys[0],null)};}
     catch(retry){singleError=retry;}
    }
    let allError;
    if(allowFullStore&&typeof store.loadAll==='function'&&!keys.some(k=>k.startsWith(prefix)||k.startsWith(legacyPrefix))&&(typeof f!=='string'||!keys.includes(f))){
     try{const all=await store.loadAll();if(!isRecord(all))throw Error('PDA returned an unreadable storage result.');return Object.fromEntries(keys.map(k=>[k,all[k]??null]));}
     catch(retry){allError=retry;}
    }
    const describe=value=>!value?'unavailable':castError(value)?'Null/String':'other failure';
    const kind=keys.every(k=>k===n)?'settings':keys.every(k=>k.startsWith(prefix)||k.startsWith(legacyPrefix))?'recovered settings':keys.every(k=>k===i)?'battle stats':keys.every(k=>k===l)?'window preferences':keys.every(k=>k===c)?'alert snoozes':'requested records';
    const failure=failed(allError?'loadAll read':'read',allError||singleError||error);
    failure.message+=' [SLINK_NATIVE_READ: record='+kind+'; batch='+describe(error)+'; single='+(keys.length===1?describe(singleError):'not attempted for bulk read')+'; all='+describe(allError)+']';
    throw failure;
   }
   throw failed('read',error);
  }
 }
 async function getManyLegacy(keys,allowFullStore=true){
  try{return await readManyOnce(keys,allowFullStore);}
  catch(first){
   if(!castError(first))throw first;
   // A native bridge cast can be temporary. Retry only reads, with a finite
   // budget, before the write circuit decides the store is unavailable.
   // The broad loadAll compatibility read above is never repeated here.
   for(const delay of [200,800]){
    if(typeof globalThis.setTimeout==='function')await new Promise(resolve=>globalThis.setTimeout(resolve,delay));
    try{
     const values=typeof store.getMany==='function'?await store.getMany(keys):Object.fromEntries(await Promise.all(keys.map(async k=>[k,await store.get(k,null)])));
     if(!isRecord(values))throw Error('PDA returned an unreadable storage result.');
     return values;
    }catch(retry){if(!castError(retry))throw failed('read retry',retry);}
   }
   // Read-only, once per exhausted read. Do not clear, rewrite, migrate or
   // switch stores when the existing primary record cannot be inspected.
   let listing='unavailable';
   if(typeof store.list==='function')try{
    const names=await store.list();
    listing=Array.isArray(names)&&names.every(name=>typeof name==='string')?(keys.every(k=>names.includes(k))?'requested records listed':'requested records not all listed'):'invalid result';
   }catch(error){listing=castError(error)?'Null/String':'other failure';}
   first.message+=' [SLINK_NATIVE_RECOVERY: targeted retries=2; list='+listing+']';
   throw first;
  }
 }
 async function readTargetRecords(keys){
  const records={};
  const batchSize=32;
  for(let offset=0;offset<keys.length;offset+=batchSize){
   const batch=keys.slice(offset,offset+batchSize);
   // A supported targeted read must not fall back to the whole database
   // when the bridge rejects one batch.
   const values=await getManyLegacy(batch,false);
   for(const key of batch){
    if(values?.[key]==null)throw Error('Target journal read incomplete.');
    records[key]=values[key];
   }
  }
  return records;
 }
 async function getManyLocked(keys,allowAutomatic=true){
  const selected=keys.includes(n)?await selectedRecord():n;
  const physical=keys.map(k=>k===n?selected:k);let values;
  try{values=await getManyLegacy(physical);}
  catch(error){if(!allowAutomatic||keys.length!==1||keys[0]!==n||!await automaticallyRecoverLocked(selected))throw error;return getManyLocked(keys,false);}
  if(allowAutomatic&&keys.length===1&&keys[0]===n&&values[selected]==null&&await automaticallyRecoverLocked(selected))return getManyLocked(keys,false);
  const out={};for(let index=0;index<keys.length;index++){
   const value=values[physical[index]];
   if(keys[index]===n&&segmented(value)){
    try{
     if(!webLocks?.request)throw coordinationUnavailable();
     const header=await store.get(selected,null);
     out[keys[index]]=await readParts(selected,header);
     await saveCheckpoint(selected,header);
     nativeStorage.segmentFailure=null;
    }catch(error){if(allowAutomatic&&keys.length===1&&keys[0]===n&&await automaticallyRecoverLocked(selected))return getManyLocked(keys,false);nativeStorage.segmentFailure=castError(error)&&error.code===error.message?{record:selected,kind:'Null/String',stage:'native-response'}:null;const wrapped=failed('recovered settings segment read',error);wrapped.message+=' [SLINK_NATIVE_READ: record=recovered settings; batch='+(castError(error)?'Null/String':'other failure')+'; single=segment read; all=not attempted]';throw wrapped;}
   }else out[keys[index]]=value;
  }return out;
 }
 async function setManyLocked(values,expectedSelection){
  const logicalKeys=Object.keys(values);
  const selected=logicalKeys.includes(n)?await selectedRecord():n;
  if(logicalKeys.includes(n)&&canSegment()){
   if(expectedSelection!==undefined&&selected!==expectedSelection)throw Error('SLINK storage was migrated on another page. Retry saving so SLINK can merge the latest settings; no saved record was overwritten. [SLINK_STORAGE_SELECTION_CHANGED]');
   if(selected.startsWith(prefix))await writeParts(selected,values[n]);
   else {
    // A readable legacy record can migrate on a normal save.
    if(selected===n)await getManyLegacy([selected]);else await store.get(selected,null);
    await installRecoveredSettings(values[n]);
   }
   values=Object.fromEntries(logicalKeys.filter(k=>k!==n).map(k=>[k,values[k]]));
   if(!Object.keys(values).length)return;
  }else if(logicalKeys.includes(n)&&selected!==n&&selected.startsWith(prefix)){
   throw Error('This WebView cannot coordinate segmented native saving safely. Update PDA; earlier saved records were not replaced. [SLINK_STORAGE_COORDINATION_UNAVAILABLE]');
  }else if(logicalKeys.includes(n)&&JSON.stringify(values[n]).length>48000){
   throw Error('SLINK needs coordinated small-record saving for these settings, but this WebView does not provide it. Update PDA before retrying. No oversized record was written. [SLINK_STORAGE_COORDINATION_UNAVAILABLE]');
  }else if(selected!==n)values=Object.fromEntries(logicalKeys.map(k=>[k===n?selected:k,values[k]]));
  if(!isRecord(values))throw Error('SLINK storage requires a record.');
  const keys=Object.keys(values);keys.forEach(key);
  try{
   if(typeof store.setMany==='function')await store.setMany(values);
   else for(const k of keys)await store.set(k,values[k]);
  }catch(error){
   if(castError(error)&&typeof store.setMany==='function'){
    // Retry only this structural bridge error with explicit single-key writes.
    // Quota/network errors do not trigger retries or another storage backend.
    try{for(const k of keys)await store.set(k,values[k]);}
    catch(retry){throw quotaFailure('single-key write',retry)||failed('single-key write',retry);}
   }else throw quotaFailure('native write',error)||failed('write',error);
  }
  // The optional downloaded-code cache is disposable and can be large. Verify
  // user records, not an extra full cache read on every page startup.
  if(typeof f==='string'&&keys.every(k=>k===f))return;
  const targetWrite=typeof u==='string'&&keys.length>0&&keys.every(k=>k.startsWith(u+':op:'));
  const saved=targetWrite?await readTargetRecords(keys):await getManyLegacy(keys);
  for(const k of keys)if(JSON.stringify(saved[k])!==JSON.stringify(values[k]))throw Error('PDA native storage did not retain the '+(k===n?'settings':k===i?'battle stats':k===l?'window preferences':k===c?'alert snoozes':'target record')+' write. Keep this page open and retry; existing stored data was not cleared.');
 }
 const scoped={
  get:async(k,fallback)=>{key(k);return (await getManyLocked([k]))[k]??fallback;},
  set:(k,value)=>{key(k);return setManyLocked({[k]:value});},
  getMany:getManyLocked,setMany:setManyLocked,readTargetRecords,
  ...(typeof store.list==='function'?{list:()=>store.list()}:{}),
  ...(typeof store.loadAll==='function'?{loadAll:()=>store.loadAll()}:{}),
  ...(typeof store.delete==='function'?{delete:async k=>store.delete(key(k)===n?await selectedRecord():k)}:{})
 };
 function transaction(run){
  return coordinate(()=>{
   // A different page may have migrated or reset the settings selection.
   nativeStorage.selection=null;
   return run(scoped);
  });
 }
 async function setMany(values){
  const selected=Object.hasOwn(values,n)&&canSegment()?await selectedRecord():undefined;
  return transaction(()=>setManyLocked(values,selected));
 }
 return {
  ...scoped,
  transaction,
  get:(k,fallback)=>k===n?transaction(()=>scoped.get(k,fallback)):scoped.get(k,fallback),
  getMany:keys=>keys.includes(n)?transaction(()=>scoped.getMany(keys)):scoped.getMany(keys),
  set:(k,value)=>{key(k);return setMany({[k]:value});},
  setMany,recoverSettings,resetSettings,
   runtimeCache:{
    get:k=>store.get(k,null),
    getMany:typeof store.getMany==='function'?keys=>store.getMany(keys):null,
    set:(k,value)=>withNativeQuota('runtime cache metadata write',()=>store.set(k,value)),
    setMany:typeof store.setMany==='function'?values=>withNativeQuota('runtime cache segment write',()=>store.setMany(values)):null,
    list:typeof store.list==='function'?()=>store.list():null,
    delete:typeof store.delete==='function'?k=>store.delete(k):null,
    lock:globalThis.navigator?.locks?.request?lock:null
   },
  async diagnose(){
   const active=await selectedRecord().catch(()=>n);
   const report={nativeAvailable:true,manualRecoveryVersion:3,manualResetVersion:2,automaticRecoveryVersion:1,automaticRecovery:nativeStorage.automaticRecovery||null,checkpointStatus:nativeStorage.checkpointStatus||'not-created',lastQuotaFailure:nativeStorage.lastQuotaFailure||null,coordinationAvailable:canSegment(),selectedRecord:active===n?'original':'recovered',reads:{}};
   const type=value=>value===null?'null':Array.isArray(value)?'array':typeof value;
   for(const [name,run,summarize]of [
    ['settingsBatch',async()=>({[n]:(await store.getMany([active]))?.[active]}),value=>({resultType:type(value),recordPresent:value?.[n]!=null,segmented:segmented(value?.[n]),...(segmented(value?.[n])?{segmentCount:value[n].count,serializedCharacters:value[n].length}:{})})],
    ['settingsSingle',()=>store.get(active,null),value=>({resultType:type(value),recordPresent:value!=null,segmented:segmented(value)})],
    ['list',()=>store.list(),value=>({resultType:type(value),keyCount:Array.isArray(value)?value.length:null,settingsListed:Array.isArray(value)?value.includes(active):null})],
    ['usage',()=>store.usage(),value=>({usedBytes:Number.isFinite(value?.used)?value.used:null,quotaBytes:Number.isFinite(value?.quota)?value.quota:null})]
   ]){
    const method={settingsBatch:'getMany',settingsSingle:'get'}[name]||name;if(typeof store[method]!=='function'){report.reads[name]={status:'unavailable'};continue;}
    let timer;try{const value=await Promise.race([Promise.resolve().then(run),new Promise((_,reject)=>{timer=globalThis.setTimeout(()=>reject(Object.assign(Error('diagnostic timeout'),{diagnosticTimeout:true})),2000);})]);report.reads[name]={status:'ok',...summarize(value)};}
    catch(error){report.reads[name]={status:error.diagnosticTimeout?'timeout':'failed',kind:rowTooBig(error)?'RowTooBig':castError(error)?'Null/String':/QuotaExceeded/i.test(String(error.code||''))?'quota':'other',stage:rowTooBig(error)||typeof error.code==='string'&&error.code===error.message?'native-response':'bridge-or-helper-rejection'};if(error.diagnosticTimeout)break;}
    finally{globalThis.clearTimeout(timer);}
   }
   report.recoveryActive=await selectedRecord().then(record=>record!==n,()=>false);
   report.segmentReadFailure=nativeStorage.segmentFailure?.record===active?{kind:nativeStorage.segmentFailure.kind,stage:nativeStorage.segmentFailure.stage}:null;
   const failures=['Null/String','RowTooBig'];
   const repairable=report.coordinationAvailable&&report.reads.list?.settingsListed===true&&((report.reads.settingsBatch?.stage==='native-response'&&failures.includes(report.reads.settingsBatch?.kind)&&report.reads.settingsSingle?.stage==='native-response'&&failures.includes(report.reads.settingsSingle?.kind))||report.segmentReadFailure?.stage==='native-response');
   report.canRecoverSettings=repairable&&((report.reads.settingsBatch?.kind==='Null/String'&&report.reads.settingsSingle?.kind==='Null/String')||report.segmentReadFailure?.kind==='Null/String');
   report.canResetSettings=repairable&&typeof store.delete==='function';
   return report;
  },
  ...(scoped.delete?{delete:k=>transaction(()=>scoped.delete(k))}:{})
 };
}async function targetJournal(request={},store=nativeStorage()){
 if(store?.transaction&&!request.readOnly&&request.ops?.length){
  return store.transaction(scoped=>targetJournal(request,scoped));
 }
 const prefix=u+':op:';
 async function read(){
  let records;
  if(store){
   if(typeof store.list==='function'){
    const keys=(await store.list()).filter(key=>key.startsWith(prefix));
    records=await store.readTargetRecords(keys);
   }else{
    if(typeof store.loadAll!=='function')throw Error('Native target storage enumeration unavailable.');
    records=await store.loadAll();
   }
  }else{
   records={};
   const local=globalThis.localStorage;
   if(!local||typeof local.key!=='function')throw Error('Target storage unavailable.');
   for(let index=0;index<local.length;index++){
    const key=local.key(index);
    if(key?.startsWith(prefix))records[key]=JSON.parse(local.getItem(key));
   }
  }
  if(!isRecord(records))throw Error('Target journal read failed.');
  const entries=Object.entries(records).filter(([key])=>key.startsWith(prefix));
  if(entries.some(([key,value])=>!isRecord(value)||value.schema!==1||key!==prefix+value.id))throw Error('Target journal is damaged or unsupported.');
  return Object.fromEntries(entries);
 }
 const existing=await read(),pending={};
 const operations=request.readOnly?[]:request.ops||[];
 for(const op of operations){
  if(!isRecord(op)||op.schema!==1||!/^[a-zA-Z0-9:_-]{1,160}$/.test(op.id||'')||!['seed','add','patch','remove','migration'].includes(op.kind))throw Error('Invalid target operation.');
  const key=prefix+op.id;
  if(existing[key]&&JSON.stringify(existing[key])!==JSON.stringify(op))throw Error('Target operation identity collision.');
  if(!existing[key])pending[key]=op;
 }
 const hasPending=Object.keys(pending).length>0;
 if(hasPending){
  if(store)await store.setMany(pending);
  else for(const [key,op] of Object.entries(pending))globalThis.localStorage.setItem(key,JSON.stringify(op));
 }
 const saved=hasPending?await read():existing;
 for(const op of operations){
  if(JSON.stringify(saved[prefix+op.id])!==JSON.stringify(op))throw Error('Target journal write was not retained.');
 }
 return {ops:Object.values(saved)};
}
function mergeChanges(e,current,t){if(JSON.stringify(e)===JSON.stringify(current))return t;if(!isRecord(e)||!isRecord(current)||!isRecord(t))return current;const r={...t};for(const key of new Set([...Object.keys(e),...Object.keys(current)]))['__proto__','constructor','prototype'].includes(key)||(Object.hasOwn(current,key)?r[key]=mergeChanges(e[key],current[key],t[key]):Object.hasOwn(e,key)&&delete r[key]);return r}async function gmRead(key,fallback=null,store=nativeStorage()){
 if(store){
  const value=await store.get(key,null);
  if(value!=null)return value;
 }
 let legacy;
 try{legacy=typeof globalThis.GM_getValue==='function'?await globalThis.GM_getValue(key,fallback):fallback;}
 catch(error){if(d.has(key))throw error;return fallback;}
 if(!store||!isRecord(legacy)||!Object.keys(legacy).length||!d.has(key))return legacy;
 async function migrate(scoped){
  const current=await scoped.get(key,null);
  if(current!=null)return current;
  await scoped.set(key,legacy);
  return legacy;
 }
 return store.transaction?store.transaction(migrate):migrate(store);
}
// Store public stock definitions separately. The Alerts snapshot also
// contains personal data and stays on the existing native path.
function publicStockCatalog(value){
 if(!Number.isSafeInteger(value?.at)||value.at<=0||value.at>Date.now()+300000)return null;
 const stocks=Array.isArray(value.data)?value.data:value.data?.stocks;
 if(!Array.isArray(stocks)||stocks.length>512)return null;
 const rows=[];
 for(const stock of stocks){
  const id=Number(stock?.id);
  if(!Number.isSafeInteger(id)||id<=0||typeof stock.name!=='string'||stock.name.length>160||
     typeof stock.acronym!=='string'||stock.acronym.length>24||typeof stock.bonus?.passive!=='boolean')return null;
  rows.push({id,name:stock.name,acronym:stock.acronym,bonus:{passive:stock.bonus.passive}});
 }
 return {at:value.at,data:{stocks:rows}};
}
function hydrateStockCatalog(data,cached){
 const native=data.caches?.stockCatalog;
 if(Object.hasOwn(data.caches||{},'stockCatalog')&&(!publicStockCatalog(native)||native.at>=cached.at))return data;
 return {...data,caches:{...data.caches,stockCatalog:cached}};
}
function stockCatalogTransaction(candidate=null){
 return new Promise(resolve=>{
  let db,tx,settled=false;
  const finish=value=>{
   if(settled)return;
   settled=true;clearTimeout(timer);db?.close();resolve(value);
  };
  function abort(){
   try{tx?.abort();}catch{}
   finish(null);
  }
  const timer=setTimeout(abort,650);
  try{
   const indexedDB=globalThis.indexedDB;
   if(!indexedDB){finish(null);return;}
   const open=indexedDB.open(f+':public-data:v1',1);
   open.onblocked=open.onerror=()=>finish(null);
   open.onupgradeneeded=()=>{
    if(settled){try{open.transaction.abort();}catch{}return;}
    open.result.createObjectStore('catalogs');
   };
   open.onsuccess=()=>{
    db=open.result;
    if(settled){db.close();return;}
    try{
     tx=db.transaction('catalogs',candidate?'readwrite':'readonly');
     let saved=null;
     tx.oncomplete=()=>finish(saved);
     tx.onerror=tx.onabort=()=>finish(null);
     const store=tx.objectStore('catalogs'),read=store.get('stockCatalog');
     read.onsuccess=()=>{
      if(settled)return;
      try{
       saved=publicStockCatalog(read.result);
       if(candidate&&(!saved||candidate.at>saved.at)){
        store.put(candidate,'stockCatalog');
        saved=candidate;
       }
      }catch{abort();}
     };
    }catch{abort();}
   };
  }catch{finish(null);}
 });
}
async function persistStockCatalog(value,current,submitted){
 const selected=publicStockCatalog(value.caches?.stockCatalog);
 const pending=publicStockCatalog(submitted.caches?.stockCatalog);
 const previous=publicStockCatalog(current?.caches?.stockCatalog);
 const latest=[selected,pending,previous].reduce((best,row)=>row&&(!best||row.at>best.at)?row:best,null);
 if(!latest||!await stockCatalogTransaction(latest))return null;
 if(!selected)return value;
 const caches={...value.caches};
 delete caches.stockCatalog;
 return {...value,caches};
}
async function gmWrite(key,value,store=nativeStorage()){
 if(store){await store.set(key,value);return;}
 if(typeof globalThis.GM_setValue!=='function')throw Error('Browser storage unavailable.');
 await globalThis.GM_setValue(key,value);
 if(typeof globalThis.GM_getValue==='function'&&JSON.stringify(await globalThis.GM_getValue(key,null))!==JSON.stringify(value))throw Error('Browser storage write was not retained.');
}
function validBundle(value){return Boolean(isRecord(value)&&1===value.schema&&[2,3].includes(value.storageProtocol)&&'string'==typeof value.runtimeSource&&value.runtimeSource.length>1e3&&Array.isArray(value.addonSources)&&value.addonSources.every(source=>'string'==typeof source&&source.length>100))}async function requestSource(e){if('function'==typeof globalThis.PDA_httpGet){const t=await globalThis.PDA_httpGet(e),r=Number(t?.status||t?.statusCode||200);if(r<200||r>=300)throw new Error('SLINK source download returned HTTP '+r+'.');const o=String(t?.data??t?.responseText??'');if(t?.error||!o.trim()||/^error[, :]|^Exception:/i.test(o))throw new Error('SLINK source connection failed.');return o}if('function'==typeof globalThis.GM_xmlhttpRequest)return await new Promise((t,r)=>{globalThis.GM_xmlhttpRequest({method:'GET',url:e,timeout:2e4,onload:e=>e.status>=200&&e.status<300?t(String(e.responseText||'')):r(new Error('SLINK source download returned HTTP '+e.status+'.')),onerror:()=>r(new Error('SLINK source download failed.')),ontimeout:()=>r(new Error('SLINK source download timed out.'))})});if('function'==typeof globalThis.fetch){const t='function'==typeof AbortController?new AbortController:null,r=globalThis.setTimeout(()=>t?.abort(),8e3);try{const r=await globalThis.fetch(e,{signal:t?.signal,credentials:'omit'});if(!r.ok)throw new Error('SLINK source download returned HTTP '+r.status+'.');return await r.text()}finally{globalThis.clearTimeout(r)}}throw new Error('No SLINK source download transport is available.')}async function fetchSource(e){const mirror=e.replace('https://raw.githubusercontent.com/Considious/Torn-Scripts/','https://cdn.jsdelivr.net/gh/Considious/Torn-Scripts@'),t=h?[mirror,e]:[e,mirror];
// Only the script's public source URL is mirrored; never API keys or user data.
let r;for(const e of[...new Set(t)]){let t;try{const r=await Promise.race([requestSource(e),new Promise((e,r)=>{t=globalThis.setTimeout(()=>r(new Error('SLINK source download timed out.')),9e3)})]);if(!String(r).trim())throw new Error('SLINK source download was empty.');return h=e===mirror,r}catch(e){r=e}finally{globalThis.clearTimeout(t)}}throw r||new Error('SLINK source download unavailable.')}function safeSourcePath(value){const e=String(value||'').trim();if(!/^src\/[A-Za-z0-9._/-]+$/.test(e)||e.includes('..'))throw new Error('The SLINK source manifest contains an invalid path.');return e}function parseSourceManifest(response){let manifest;try{manifest=JSON.parse(response)}catch{throw new Error('The SLINK source manifest was not valid JSON.')}if('direct-source'!==manifest?.mode||![2,3].includes(manifest.storageProtocol)||!Array.isArray(manifest.fragments)||!manifest.fragments.length)throw new Error('The SLINK source manifest is incomplete.');return manifest}async function readSourceManifest(timeoutMs=0){const request=fetchSource(t+'?t='+Date.now());if(!timeoutMs)return parseSourceManifest(await request);let timer;try{return parseSourceManifest(await Promise.race([request,new Promise((resolve,reject)=>{timer=globalThis.setTimeout(()=>reject(new Error('SLINK manifest check timed out.')),timeoutMs)})]))}finally{globalThis.clearTimeout(timer)}}async function fetchBundle(a){const r=Date.now();a=a||await readSourceManifest();const n=a.fragments.map(safeSourcePath),s=(a.startupAddons||[]).map(e=>safeSourcePath(e?.source)),revision=String(a.revision||'unversioned'),i='?v='+encodeURIComponent(revision)+'&t='+r,l=[...n,...s],sources=new Array(l.length);let c=0,u=!1;await Promise.all(Array.from({length:Math.min(2,l.length)},async()=>{for(;!u&&c<l.length;){const t=c++;try{sources[t]=await fetchSource(e+l[t]+i)}catch(e){throw u=!0,e}}}));const d=sources.slice(0,n.length),addonSources=sources.slice(n.length);if(d.some(source=>source.length<100))throw new Error('A SLINK runtime source file was empty or incomplete.');if(addonSources.some(source=>source.length<100))throw new Error('A SLINK startup add-on was empty or incomplete.');const runtimeSource=d.join(''),f=await async function(runtimeSource,addonSources){const e=[runtimeSource,...addonSources].join('\n;\n');try{const t=(new TextEncoder).encode(e),r=await globalThis.crypto.subtle.digest('SHA-256',t);return[...new Uint8Array(r)].map(e=>e.toString(16).padStart(2,'0')).join('')}catch{let t=2166136261;for(let r=0;r<e.length;r+=1)t^=e.charCodeAt(r),t=Math.imul(t,16777619);return e.length+':'+(t>>>0).toString(16)}}(runtimeSource,addonSources);return{schema:1,storageProtocol:a.storageProtocol,revision:revision,signature:f,runtimeSource:runtimeSource,addonSources:addonSources,savedAt:Date.now()}}async function waitUntilReady(){const e=Date.now()+2e4;for(;Date.now()<e;){const e=document.getElementById(a);if('true'===e?.dataset?.slinkReady&&'true'===e?.dataset?.slinkAddonsReady)return void document.getElementById(o)?.remove();await new Promise(e=>globalThis.setTimeout(e,100))}throw new Error('Runtime did not signal readiness within 20 seconds.')}
async function executeBrowserSource(source){
 const add=typeof GM_addElement==='function'?GM_addElement:globalThis.GM?.addElement?.bind(globalThis.GM);
 if(typeof add!=='function')throw Error('Desktop userscript execution requires GM_addElement support. Update this script and use a userscript manager that supports it. [SLINK_BROWSER_EXECUTION_UNAVAILABLE]');
 const eventName=m+':browser',executionEvent=m+':executed';
 const request=typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:globalThis.GM_xmlhttpRequest;
 const notify=typeof GM_notification==='function'?GM_notification:globalThis.GM_notification;
 const menu=typeof GM_registerMenuCommand==='function'?GM_registerMenuCommand:globalThis.GM_registerMenuCommand;
 const allowed=new Set(['https://api.torn.com','https://ffscouter.com','https://weav3r.dev','https://yata.yt','https://prombot.co.uk:8443','https://torn-intel.com','https://droqsdb.com','https://api.giphy.com','https://chatsticker.com','https://slinkcontributionworker.richard-johnson554.workers.dev','https://slinkyleveling.richard-johnson554.workers.dev','https://slinkwarworker.richard-johnson554.workers.dev','https://slinkmuggingworker.richard-johnson554.workers.dev']);
 // Keep GM privileges in the installed userscript context. The page receives
 // only this bounded service transport, not unrestricted GM APIs.
 if(!executeBrowserSource.bound){
  executeBrowserSource.bound=true;
  const reply=value=>document.dispatchEvent(new CustomEvent(eventName+':ack',{detail:JSON.stringify(value)}));
  document.addEventListener(eventName,event=>{
   let job;try{job=JSON.parse(String(event.detail||''));}catch{return;}
   if(!job||typeof job.id!=='number')return;
   if(job.action==='menu'){
    if(typeof menu==='function'&&['Open SLINK PDA Dashboard','Reset SLINK PDA layout'].includes(job.title))menu(job.title,()=>reply({id:job.id,event:'click'}));
    return;
   }
   if(job.action==='notify'){
    if(typeof notify==='function')notify({...job.options,onclick:()=>reply({id:job.id,event:'click'})});
    return;
   }
   if(job.action!=='http'||typeof request!=='function')return reply({id:job.id,error:'Userscript HTTP transport is unavailable.'});
   let url;try{url=new URL(job.url);}catch{return reply({id:job.id,error:'Invalid SLINK service URL.'});}
   const method=String(job.method||'GET').toUpperCase();
   if(!allowed.has(url.origin)||url.username||url.password||!['GET','POST'].includes(method)||(method==='POST'&&!url.hostname.endsWith('.workers.dev')))return reply({id:job.id,error:'SLINK blocked an unsupported service request.'});
   try{request({method,url:url.href,headers:job.headers||{},data:job.data,anonymous:true,timeout:30000,
    onload:r=>reply({id:job.id,response:{status:r.status,statusText:r.statusText||'',responseText:r.responseText||'',responseHeaders:r.responseHeaders||''}}),
    onerror:()=>reply({id:job.id,error:'The userscript manager could not reach the service.'}),
    ontimeout:()=>reply({id:job.id,timeout:true,error:'The service request timed out.'})});}catch{reply({id:job.id,error:'The userscript manager rejected the service request before an HTTP response was received. [SLINK_BROWSER_REQUEST_FAILED]'});}
  });
 }
 // Installed only in the browser execution branch. Native PDA execution and
 // its scoped storage/HTTP objects are untouched.
 const prelude='globalThis.SLINK_PDA_BROWSER_TRANSPORT||=('+function(name){
  const pending=new Map();let sequence=0;
  document.addEventListener(name+':ack',event=>{let reply;try{reply=JSON.parse(String(event.detail||''));}catch{return;}const job=pending.get(reply.id);if(!job)return;if(reply.event==='click'){job.click?.();return;}clearTimeout(job.timer);pending.delete(reply.id);if(reply.error)(reply.timeout?job.options.ontimeout:job.options.onerror)?.({error:reply.error});else job.options.onload?.(reply.response);});
  const send=job=>document.dispatchEvent(new CustomEvent(name,{detail:JSON.stringify(job)}));
  return {
   request(options){const id=++sequence,job={options,timer:setTimeout(()=>{pending.delete(id);options.ontimeout?.();},31000)};pending.set(id,job);send({id,action:'http',method:options.method,url:options.url,headers:options.headers,data:options.data});return {abort(){clearTimeout(job.timer);pending.delete(id);}};},
   menu(title,click){const id=++sequence;pending.set(id,{click});send({id,action:'menu',title});},
   notify(options){const id=++sequence;pending.set(id,{click:options.onclick,timer:setTimeout(()=>pending.delete(id),Math.max(1000,Math.min(60000,Number(options.timeout)||12000))+1000)});send({id,action:'notify',options:{title:String(options.title||''),text:String(options.text||''),tag:options.tag,timeout:options.timeout,silent:options.silent}});}
  };
 }.toString()+')('+JSON.stringify(eventName)+');';
 const code='try {\n'+prelude+'\n'+source+'\ndocument.dispatchEvent(new CustomEvent('+JSON.stringify(executionEvent)+',{detail:JSON.stringify({ok:true})}));\n}catch(error){document.dispatchEvent(new CustomEvent('+JSON.stringify(executionEvent)+',{detail:JSON.stringify({ok:false,message:String(error.message||error)})}));}\n//# sourceURL=SLINK_PDA_Browser_Bundle.js';
 await new Promise((resolve,reject)=>{
  let node;const finish=error=>{clearTimeout(timer);document.removeEventListener(executionEvent,done);node?.remove?.();error?reject(error):resolve();};
  const done=event=>{let result;try{result=JSON.parse(String(event.detail||''));}catch{return;}finish(result.ok?null:Error('SLINK browser runtime failed: '+result.message));};
  const timer=setTimeout(()=>finish(Error('The userscript manager did not confirm runtime execution. [SLINK_BROWSER_EXECUTION_UNCONFIRMED]')),20000);
  document.addEventListener(executionEvent,done);
  try{Promise.resolve(add('script',{textContent:code})).then(element=>{node=element;if(!node)finish(Error('The userscript manager could not insert the SLINK runtime. [SLINK_BROWSER_EXECUTION_UNAVAILABLE]'));else node.remove?.();},finish);}catch(error){finish(error);}
 });
}
async function executeBundle(e){const t=document.getElementById(a),o='true'===t?.dataset?.slinkReady;if(o&&'true'===t?.dataset?.slinkAddonsReady)return;t&&(t.dataset.slinkAddonsReady='false');const sources=['globalThis.__SLINK_PDA_ADDONS_READY__=false;'];if(!o){startupMark('storage-start');const bootstrap=await collectBootstrap();startupMark('storage-end');const t='globalThis.__SLINK_PDA_BOOTSTRAP__='+JSON.stringify({...bootstrap,sourceRevision:e.revision,clientVersion:e.clientVersion})+';';sources.push(t+'\n'+e.runtimeSource.split('###PDA-APIKEY###').join(r)+'\n//# sourceURL=SLINK_PDA_Direct_Runtime.js\n')}e.addonSources.forEach((source,e)=>{sources.push(source.split('###PDA-APIKEY###').join(r)+'\n//# sourceURL=SLINK_PDA_Direct_Addon_'+(e+1)+'.js\n')}),sources.push(`globalThis.__SLINK_PDA_ADDONS_READY__=true;\n(() => {\nconst slinkReadyHost=document.getElementById(${JSON.stringify(a)});\nif(slinkReadyHost) slinkReadyHost.dataset.slinkAddonsReady='true';\n})();`),await async function(source){'function'==typeof globalThis.PDA_evaluateJavascript?await globalThis.PDA_evaluateJavascript(source):await executeBrowserSource(source)}(sources.join('\n;\n')),await waitUntilReady();startupMark('ready');}
function startupMark(phase){try{globalThis.performance?.mark?.('slink-pda:'+phase);}catch{}}
const updateHint=f+':pending',updateCheck=f+':checked',rejectedRevision=f+':rejected',stageMeta=f+':stage';
const stageCacheName='slink-pda-public-runtime-test',stageUrl=t+'?slink-staged=1';
const sessionGet=k=>{try{return globalThis.sessionStorage?.getItem(k)||'';}catch{return '';}};
const sessionSet=(k,v)=>{try{if(v)globalThis.sessionStorage?.setItem(k,v);else globalThis.sessionStorage?.removeItem(k);}catch{}};
function boundStartup(task,ms){let timer;return Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Optional startup cache timed out.')),ms);})]).finally(()=>clearTimeout(timer));}
async function stageDigest(text){
 const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
}
const runtimeMetaKey=f+':verified:v1',runtimePartPrefix=runtimeMetaKey+':part:';
const runtimePartLength=48000,runtimeMaxParts=160;
const runtimeDigestPattern=/^[a-f0-9]{64}$/;
const runtimeCacheUrl=digest=>t+'?slink-runtime='+digest;
const runtimePartKey=(digest,index)=>runtimePartPrefix+digest+':'+index;
function nativeRuntimeText(bundle){
 const {savedAt,...verified}=bundle;
 return JSON.stringify(verified);
}
function validRuntimeEntry(entry){
 return isRecord(entry)&&runtimeDigestPattern.test(entry.digest)&&typeof entry.revision==='string'&&
  [2,3].includes(entry.storageProtocol)&&Number.isSafeInteger(entry.length)&&entry.length>0&&
  Math.ceil(entry.length/runtimePartLength)<=runtimeMaxParts;
}
async function readRuntimeMetadata(store){
 const meta=await store.get(runtimeMetaKey);
 if(meta===null||meta===undefined)return null;
 if(meta.schema!==1||!validRuntimeEntry(meta.active)||meta.previous!==null&&!validRuntimeEntry(meta.previous)){
  throw Error('SLINK runtime cache metadata is invalid.');
 }
 return meta;
}
async function verifyNativeRuntime(bundle,{legacy=false}={}){
 if(!validBundle(bundle)||!globalThis.crypto?.subtle)throw Error('SLINK runtime cannot be verified.');
 const digest=await stageDigest([bundle.runtimeSource,...bundle.addonSources].join('\n;\n'));
 // Older direct-source manifests used opaque revision labels.
 if(bundle.signature!==digest||!legacy&&bundle.revision.startsWith('sha256-')&&bundle.revision!=='sha256-'+digest){
  throw Error('SLINK runtime did not match its SHA-256 revision.');
 }
 return bundle;
}
async function readRuntimeWebCache(entry){
 if(!globalThis.caches)return null;
 const cache=await globalThis.caches.open(stageCacheName);
 const response=await cache.match(runtimeCacheUrl(entry.digest));
 return response?await response.text():null;
}
async function writeRuntimeWebCache(text,digest){
 if(!globalThis.caches||typeof Response!=='function')return;
 const cache=await globalThis.caches.open(stageCacheName);
 await cache.put(runtimeCacheUrl(digest),new Response(text));
}
async function readRuntimeParts(store,entry){
 if(!store.getMany)return null;
 const count=Math.ceil(entry.length/runtimePartLength),parts=[];
 for(let offset=0;offset<count;offset+=4){
  const keys=Array.from({length:Math.min(4,count-offset)},(_,index)=>runtimePartKey(entry.digest,offset+index));
  const values=await store.getMany(keys);
  for(let index=0;index<keys.length;index++){
   const part=values?.[keys[index]],remaining=entry.length-(offset+index)*runtimePartLength;
   if(typeof part!=='string'||part.length!==Math.min(runtimePartLength,remaining))return null;
   parts.push(part);
  }
 }
 return parts.join('');
}
async function verifyRuntimeEntry(text,entry){
 if(typeof text!=='string'||text.length!==entry.length||await stageDigest(text)!==entry.digest)return null;
 const bundle=JSON.parse(text);
 return validBundle(bundle)&&bundle.revision===entry.revision&&bundle.storageProtocol===entry.storageProtocol?bundle:null;
}
async function readNativeRuntime(store){
 if(!globalThis.crypto?.subtle)return{bundle:null,entry:null,meta:undefined};
 const meta=await boundStartup(readRuntimeMetadata(store),2000).catch(()=>undefined);
 const rejected=sessionGet(rejectedRevision);
 for(const entry of [meta?.active,meta?.previous]){
  if(!entry||entry.revision===rejected)continue;
  const web=await boundStartup((async()=>verifyRuntimeEntry(await readRuntimeWebCache(entry),entry))(),400).catch(()=>null);
  if(web)return{bundle:web,entry,meta};
  const native=await boundStartup((async()=>{
   const text=await readRuntimeParts(store,entry);
   const bundle=await verifyRuntimeEntry(text,entry);
   return bundle?{bundle,text}:null;
  })(),6500).catch(()=>null);
  if(native)return{...native,entry,meta};
 }
 const legacy=await boundStartup((async()=>{
  const bundle=await store.get(f);
  if(!validBundle(bundle)||bundle.revision===rejected)return null;
  return verifyNativeRuntime(bundle,{legacy:true});
 })(),2500).catch(()=>null);
 return{bundle:legacy,entry:null,meta};
}
async function removeUnreferencedRuntimeParts(store,keep){
 if(!store.list||!store.delete)return;
 const keys=await store.list();
 if(!Array.isArray(keys))return;
 for(const key of keys){
  if(typeof key!=='string'||!key.startsWith(runtimePartPrefix))continue;
  const match=/^([a-f0-9]{64}):\d+$/.exec(key.slice(runtimePartPrefix.length));
  if(match&&!keep.has(match[1]))await store.delete(key);
 }
}
async function persistNativeRuntime(store,bundle,observed){
 if(!store.lock||!store.getMany||!store.setMany||observed?.meta===undefined)return false;
 const text=nativeRuntimeText(bundle),digest=await stageDigest(text);
 const entry={revision:bundle.revision,storageProtocol:bundle.storageProtocol,digest,length:text.length};
 if(!validRuntimeEntry(entry))return false;
 const committed=await store.lock(async()=>{
  const current=await readRuntimeMetadata(store);
  // A slower page cannot replace a runtime published after that page read the index.
  if(current?.active.digest!==observed.meta?.active.digest)return false;
  if(current?.active.digest===digest&&await verifyRuntimeEntry(await readRuntimeParts(store,entry),entry))return true;
  const previous=observed.entry||null;
  const keep=new Set([digest,current?.active.digest,current?.previous?.digest]);
  await removeUnreferencedRuntimeParts(store,keep);
  const count=Math.ceil(text.length/runtimePartLength);
  for(let offset=0;offset<count;offset+=4){
   const parts=Object.fromEntries(Array.from({length:Math.min(4,count-offset)},(_,index)=>{
    const part=offset+index;
    return [runtimePartKey(digest,part),text.slice(part*runtimePartLength,(part+1)*runtimePartLength)];
   }));
   await store.setMany(parts);
  }
  if(!await verifyRuntimeEntry(await readRuntimeParts(store,entry),entry))throw Error('PDA did not retain the verified SLINK runtime.');
  const meta={schema:1,active:entry,previous:previous?.digest===digest?current?.previous||null:previous,legacyRetired:current?.legacyRetired===true};
  await store.set(runtimeMetaKey,meta);
  const saved=await readRuntimeMetadata(store);
  if(saved?.active.digest!==digest||saved?.previous?.digest!==meta.previous?.digest)throw Error('PDA did not confirm the SLINK runtime index.');
  await removeUnreferencedRuntimeParts(store,new Set([digest,saved.previous?.digest])).catch(()=>{});
  const retired=current?.previous?.digest;
  if(retired&&retired!==digest&&retired!==saved.previous?.digest&&globalThis.caches){
   const staged=await store.get(stageMeta).catch(()=>undefined);
   if(staged!==undefined&&retired!==staged?.digest){
    await boundStartup(globalThis.caches.open(stageCacheName).then(cache=>cache.delete(runtimeCacheUrl(retired))),1000).catch(()=>{});
   }
  }
  return true;
 });
 if(committed)await boundStartup(writeRuntimeWebCache(text,digest),1000).catch(()=>{});
 return committed;
}
async function retireLegacyRuntime(store,entry){
 if(!store.lock||!store.list||!store.delete)return;
 await store.lock(async()=>{
  const current=await readRuntimeMetadata(store);
  if(current?.active.digest!==entry.digest||current.legacyRetired)return;
  const keys=await store.list();
  if(!Array.isArray(keys))return;
  if(keys.includes(f)){
   // Prove a later boot can recover from privileged native segments alone.
   if(!await verifyRuntimeEntry(await readRuntimeParts(store,entry),entry))return;
   await store.delete(f);
   const remaining=await store.list();
   if(!Array.isArray(remaining)||remaining.includes(f))return;
  }
  await store.set(runtimeMetaKey,{...current,legacyRetired:true});
 });
}
async function saveStaged(bundle){
 if(!globalThis.caches||!globalThis.crypto?.subtle||typeof Response!=='function')return false;
 const store=nativeStorage()?.runtimeCache;
 const text=store?nativeRuntimeText(bundle):JSON.stringify(bundle);
 const digest=await stageDigest(text),cache=await globalThis.caches.open(stageCacheName);
 if(store){
  if(!store.lock)return false;
  await verifyNativeRuntime(bundle);
  return store.lock(async()=>{
   const previous=await store.get(stageMeta);
   await boundStartup(writeRuntimeWebCache(text,digest),1500);
   await store.set(stageMeta,{revision:bundle.revision,digest});
   const saved=await store.get(stageMeta);
   if(saved?.digest!==digest||saved?.revision!==bundle.revision)return false;
   if(runtimeDigestPattern.test(previous?.digest)&&previous.digest!==digest){
    const current=await readRuntimeMetadata(store).catch(()=>undefined);
    if(current!==undefined&&previous.digest!==current?.active.digest&&previous.digest!==current?.previous?.digest){
     await boundStartup(cache.delete(runtimeCacheUrl(previous.digest)),1000).catch(()=>{});
    }
   }
   return true;
  });
 }
 await cache.put(stageUrl,new Response(text));
 // This digest is held in privileged storage: Torn-origin storage alone cannot authorize code.
 await gmWrite(stageMeta,{revision:bundle.revision,digest});
 return true;
}
async function readStaged(revision){
 if(!globalThis.caches||!globalThis.crypto?.subtle)return null;
 const store=nativeStorage()?.runtimeCache;
 const [meta,cache]=await Promise.all([store?store.get(stageMeta):gmRead(stageMeta,null),globalThis.caches.open(stageCacheName)]);
 if(meta?.revision!==revision||!meta.digest)return null;
 if(store&&!runtimeDigestPattern.test(meta.digest))return null;
 const result=await cache.match(store?runtimeCacheUrl(meta.digest):stageUrl),text=await result?.text();
 if(!text||await stageDigest(text)!==meta.digest)return null;
 const bundle=JSON.parse(text);
 if(!validBundle(bundle)||bundle.revision!==revision)return null;
 return store?verifyNativeRuntime(bundle):bundle;
}
async function stageUpdate(current){
 const now=Date.now(),last=Number(sessionGet(updateCheck))||0;
 if(now-last<5*60_000)return;
 sessionSet(updateCheck,String(now));
 try{
  const manifest=await readSourceManifest(4000),revision=String(manifest.revision||'unversioned');
  if(revision===current.revision&&manifest.storageProtocol===current.storageProtocol||revision===sessionGet(rejectedRevision))return;
  if(!globalThis.caches||!globalThis.crypto?.subtle){sessionSet(updateHint,'fetch:'+revision);return;}
  const bundle=await fetchBundle(manifest);
  try{if(await saveStaged(bundle)){sessionSet(updateHint,'staged:'+revision);return;}}catch{}
  sessionSet(updateHint,'fetch:'+revision);
 }catch{}
}
function loadRuntime(force=false){
 if(w)return w;
 w=(async()=>{
  startupMark('cache-start');
  const store=nativeStorage()?.runtimeCache;
  const observed=store?await readNativeRuntime(store):null;
  const cached=store?observed.bundle:await gmRead(f,null).catch(()=>null);
  startupMark(validBundle(cached)?'cache-hit':'cache-miss');
  const retry=sessionGet(g);
  if(retry){
   sessionSet(g,'');
   if(!validBundle(cached))return showFailure(Error('No known-working SLINK runtime is cached yet.'));
   try{return await executeBundle(cached);}catch(error){return showFailure(error);}
  }
  let next=null;
  if(!force&&validBundle(cached)){
   const hint=sessionGet(updateHint);
   if(hint.startsWith('staged:')&&hint.slice(7)!==cached.revision){
    next=await boundStartup(readStaged(hint.slice(7)),store?1000:200).catch(()=>null);
    if(!next){sessionSet(updateHint,'');sessionSet(updateCheck,'');}
   }else if(hint.startsWith('fetch:')&&hint.slice(6)!==cached.revision){
    sessionSet(updateHint,'');
    try{const manifest=await readSourceManifest(2500);if(manifest.revision===hint.slice(6)&&manifest.revision!==sessionGet(rejectedRevision)){
     const candidate=await fetchBundle(manifest);
     next=store&&globalThis.crypto?.subtle?await verifyNativeRuntime(candidate):candidate;
    }}catch{}
   }
   if(!next){
    try{
     await executeBundle(cached);void stageUpdate(cached);
     if(store){
      if(observed.entry){
       if(observed.text)void writeRuntimeWebCache(observed.text,observed.entry.digest).catch(()=>{});
       if(!observed.meta?.legacyRetired)void retireLegacyRuntime(store,observed.entry).catch(()=>{});
      }else{
       void persistNativeRuntime(store,cached,observed).catch(()=>{});
      }
     }
     return;
    }catch(error){
     if(store&&observed.entry&&cached.revision&&sessionGet(rejectedRevision)!==cached.revision){
      sessionSet(rejectedRevision,cached.revision);
      sessionSet(updateHint,'');
      if(sessionGet(rejectedRevision)===cached.revision){globalThis.location.reload();return;}
     }
     return showFailure(error);
    }
   }
  }
  if(!next)try{
   const candidate=await fetchBundle();
   next=store&&globalThis.crypto?.subtle?await verifyNativeRuntime(candidate):candidate;
   if(store&&next.revision===sessionGet(rejectedRevision))throw Error('The current SLINK release did not start. Retry after an update is available.');
  }catch(error){
   if(!validBundle(cached))return showFailure(error);
   try{return await executeBundle(cached);}catch(fallback){return showFailure(fallback);}
  }
  try{
   await executeBundle(next);
   try{
    if(store)await persistNativeRuntime(store,next,observed);
    else await gmWrite(f,next);
    sessionSet(updateHint,'');sessionSet(updateCheck,String(Date.now()));
    if(!store&&globalThis.caches)void globalThis.caches.open(stageCacheName).then(cache=>cache.delete(stageUrl)).catch(()=>{});
   }catch{console.warn('[SLINK PDA] Runtime cache not saved; running source remains active.');}
  }catch(error){
   if(validBundle(cached)&&cached.signature!==next.signature)try{
    sessionSet(updateHint,'');sessionSet(rejectedRevision,next.revision);sessionSet(g,'1');
    if(sessionGet(g)==='1'){globalThis.location.reload();return;}
   }catch{}
   showFailure(error);
  }
 })().finally(()=>{w=null;});
 return w;
}
!function(){let e=Promise.resolve();const resident=globalThis.__SLINK_PDA_STORAGE_BRIDGE__;if(resident?.protocol===1&&resident.document===document&&resident.channel===m)return;
let storagePaused=false,nativeOutstanding=false,storageReadFailure='';
const storageLabel=()=>nativeStorage()?"PDA's native storage":"The userscript's storage";
const pausedStorageError=()=>new Error(storageLabel()+(nativeOutstanding
 ? " is still not responding. Further saves are paused, not queued. Keep this page open; retry local saving only after storage responds. [SLINK_STORAGE_NATIVE_STALLED]"
 : " failed. Automatic saves are paused; your changes remain on this page. Use Retry saving local changes in Access to try again. [SLINK_STORAGE_PAUSED]")+(storageReadFailure?' '+storageReadFailure:''));
function runStorageJob(run){
 if(storagePaused)return Promise.reject(pausedStorageError());
 nativeOutstanding=true;storageReadFailure='';
 const operation=Promise.resolve().then(run);
 return new Promise((resolve,reject)=>{
  let expired=false;
  const timer=setTimeout(()=>{
   expired=true;storagePaused=true;
   reject(new Error(storageLabel()+" did not complete this save within 25 seconds. Further saves are paused, not queued. [SLINK_STORAGE_NATIVE_TIMEOUT]"));
  },25000);
  operation.then(value=>{
   clearTimeout(timer);nativeOutstanding=false;
   if(expired)storagePaused=false;
   resolve(value);
  },error=>{
   clearTimeout(timer);nativeOutstanding=false;
   const readContext=String(error?.message||error).match(/\[SLINK_NATIVE_(?:READ|RECOVERY):[^\]]*\]/g);
   if(error?.nativeQuota)storageReadFailure=error.message;
   else if(readContext)storageReadFailure=readContext.join(' ');
   if(expired||/type ['"]Null['"] is not a subtype of type ['"]String['"]|QuotaExceeded|quota exceeded|Row too big|SLINK_STORAGE_ROW_TOO_LARGE|SLINK_STORAGE_AUTORECOVERY_FAILED/i.test(String(error?.message||error)))storagePaused=true;
   reject(error);
  });
 });
}
const acknowledge=(payload,e,t='',value,phase)=>{try{document.dispatchEvent(new CustomEvent(m+':ack',{detail:JSON.stringify({id:payload.id,ok:e,backend:nativeStorage()?'pda':'browser',error:t,value:value,phase:phase})}))}catch{}};document.addEventListener(m,event=>{let payload;try{payload=JSON.parse(String(event?.detail||''))}catch{return}if(isRecord(payload)&&payload.action==='diagnose'&&typeof payload.id==='string'){
 const reply=report=>document.dispatchEvent(new CustomEvent(m+':diagnostic',{detail:JSON.stringify({id:payload.id,report})}));
 if(nativeOutstanding){reply({nativeAvailable:!!nativeStorage(),status:'operation-still-pending'});return;}
 const store=nativeStorage();if(!store){reply({nativeAvailable:false});return;}
 void store.diagnose().then(reply,()=>reply({nativeAvailable:true,status:'diagnostic-failed'}));return;
}if(isRecord(payload)&&['recover-settings','reset-settings'].includes(payload.action)&&typeof payload.id==='string'){
 const reply=(ok,error='',result=null)=>document.dispatchEvent(new CustomEvent(m+':recovered',{detail:JSON.stringify({id:payload.id,ok,error,result})}));
 if(nativeOutstanding){reply(false,'A native save is still pending. Recovery cannot run concurrently.');return;}
 const store=nativeStorage();if(!store){reply(false,'Native storage is unavailable.');return;}
 nativeOutstanding=true;
 // Join the existing queue, including jobs already waiting when recovery began.
 e=e.catch(()=>{}).then(()=>payload.action==='reset-settings'?store.resetSettings(payload.value,payload.confirmed):store.recoverSettings(payload.value,payload.confirmed)).then(result=>{storagePaused=false;storageReadFailure='';reply(true,'',result);},error=>{reply(false,String(error?.message||error));}).finally(()=>{nativeOutstanding=false;});return;
}
 async function applyStoragePayload(payload,store){
  if(payload.key===u)return targetJournal(payload.value,store);
  if(payload.remove){
   if(store){
    if(typeof store.delete!=='function')throw Error('Storage delete unavailable.');
    await store.delete(payload.key);
   }else{
    if(typeof globalThis.GM_deleteValue!=='function')throw Error('Storage delete unavailable.');
    await globalThis.GM_deleteValue(payload.key);
   }
   try{globalThis.localStorage?.removeItem(s);globalThis.localStorage?.removeItem(n);}catch{}
   return;
  }
  const current=await gmRead(payload.key,null,store);
  if(payload.key===i&&Number(current?.checkedAt||0)>Number(payload.value?.checkedAt||0))return;
  let value=payload.value;
  if(payload.key===n&&isRecord(current)&&isRecord(payload.base)){
   const settings=mergeChanges(payload.base.settings,value.settings,current.settings||{});
   const targetList=mergeChanges(payload.base.targetList,value.caches?.targetList||{},current.caches?.targetList||{});
   const latest=savedAt(current)>savedAt(value)?current:value;
   value={...latest,settings,caches:{...latest.caches,targetList},_savedAt:Math.max(savedAt(current),savedAt(value))+1};
  }else if(savedAt(current)>savedAt(value))return;
  if(payload.base?.protected&&current)for(const key of Object.keys(payload.base.protected)){
   value[key]=mergeChanges(payload.base.protected[key],payload.value[key],Object.hasOwn(current,key)?current[key]:value[key]);
  }
  if(store&&payload.key===n){
   const migrated=await persistStockCatalog(value,current,payload.value);
   if(migrated){
    value=migrated;
    // A cache-only save can finish after IndexedDB commits. Comparing the
    // full durable payload still sends migration and ordinary edits to PDA.
    if(isRecord(current)&&JSON.stringify({...current,_savedAt:0})===JSON.stringify({...value,_savedAt:0}))return;
   }
  }
  await gmWrite(payload.key,value,store);
 }
 if(isRecord(payload)&&payload.action==='retry'){
  if(!nativeOutstanding)storagePaused=false;
  return;
 }
 if(!isRecord(payload)||!d.has(payload.key)||(payload.remove&&payload.key!==n)||(!payload.remove&&!isRecord(payload.value)))return;
 if(storagePaused){acknowledge(payload,false,pausedStorageError().message);return;}
 if(!payload.remove&&payload.key!==u){
  if(payload.key===n)writeMirror(payload.value);
  else try{globalThis.localStorage?.setItem(payload.key,JSON.stringify(payload.value));}catch{}
 }
 if(payload.protocol===2)acknowledge(payload,false,'',undefined,'queued');
 e=e.catch(()=>{}).then(()=>runStorageJob(async()=>{
  if(payload.protocol===2)acknowledge(payload,false,'',undefined,'working');
  const native=nativeStorage();
  return native?native.transaction(store=>applyStoragePayload(payload,store)):applyStoragePayload(payload,null);
 })).then(value=>acknowledge(payload,true,'',value),error=>acknowledge(payload,false,String(error?.message||error?.code||'Storage write failed')));
});Object.defineProperty(globalThis,'__SLINK_PDA_STORAGE_BRIDGE__',{value:Object.freeze({protocol:1,document,channel:m}),configurable:true});}(),await loadRuntime()})();
