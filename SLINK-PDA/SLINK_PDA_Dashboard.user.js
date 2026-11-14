// ==UserScript==
// @name         SLINK PDA Dashboard
// @namespace    Considious [3853023]
// @version      0.4.239
// @description  Mobile-first SLINK dashboard for Torn PDA with Combat, Efficiency, Quality of Life, and shared permissions.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/feature/qol-batch-6/SLINK-PDA/SLINK_PDA_Dashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/feature/qol-batch-6/SLINK-PDA/SLINK_PDA_Dashboard.user.js
// @match        https://www.torn.com/*
// @grant        GM_addElement
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
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
(async()=>{'use strict';const e='https://raw.githubusercontent.com/Considious/Torn-Scripts/feature/qol-batch-6/SLINK-PDA/',t=e+'source-manifest.json',r=String('###PDA-APIKEY###').trim(),o='slink-pda-runtime-load-error',a='slink-pda-dashboard-host',n='slink-pda-dashboard:data:v1',s='slink-pda-dashboard:data:mirror:v1',i='slink-pda-dashboard:own-battle-stats:v1',l='slink-pda-dashboard:ui:v1',c='slink-pda-dashboard:alert-snoozes:v1',u='slink-pda-dashboard:targets:v1',d=new Set([n,i,l,c,u]),f='slink-pda-dashboard:runtime-cache:v1:feature-qol-batch-3',g='slink-pda-dashboard:runtime-cache-retry:v1';let h=!1,w=null;const residentBridge=globalThis.__SLINK_PDA_STORAGE_BRIDGE__;const m=residentBridge?.protocol===1&&residentBridge.document===document&&typeof residentBridge.channel==='string'?residentBridge.channel:'slink-pda-storage-write:'+(globalThis.crypto?.randomUUID?.()||String(Date.now())+':'+Math.random());function showFailure(e){const t=String(e?.message||e||'Unknown startup error');console.error('SLINK PDA runtime failed to load:',e),document.getElementById(o)?.remove();const r=document.createElement('button');r.id=o,r.type='button',r.textContent='SLINK could not load. '+t.replace(/([?&](?:key|api_key|token)=)[^&#\\s]+/gi,'$1[redacted]').slice(0,350)+' Torn is unaffected — tap to retry',r.title='Startup files could not finish loading. Check your connection, tap Retry once, then update SLINK if it continues. Saved settings have not been cleared. [SLINK_RUNTIME_LOAD]',r.style.cssText='position:fixed;right:10px;bottom:76px;z-index:2147483647;max-width:calc(100vw - 20px);white-space:normal;overflow-wrap:anywhere;padding:10px 12px;border:2px solid #111;border-radius:8px;background:#b91c1c;color:#fff;font:bold 12px Arial,sans-serif',r.addEventListener('click',()=>{r.remove(),loadRuntime(!0)}),(document.body||document.documentElement).appendChild(r)}function isRecord(value){return Boolean(value&&'object'==typeof value&&!Array.isArray(value))}function hasData(value){return Boolean(isRecord(value)&&Object.keys(value).length)}function savedAt(value){return Math.max(0,Number(isRecord(value)?value._savedAt||value.savedAt:0)||0)}function writeMirror(value){if(isRecord(value))try{globalThis.localStorage?.setItem(s,JSON.stringify({schema:1,savedAt:Date.now(),data:value})),globalThis.localStorage?.setItem(n,JSON.stringify(value))}catch{}}async function readPersistedData(){readPersistedData.failed=!1;let primary=null,primaryFailed=!1;try{const e=nativeStorage();if(e){const value=await e.get(n,null);if(hasData(value))return writeMirror(value),value}const value=await gmRead(n,{});isRecord(value)&&(primary=value)}catch{primaryFailed=!0,readPersistedData.failed=!0}const mirror=function(){try{const e=JSON.parse(globalThis.localStorage?.getItem(s)||'null');return isRecord(e?.data)?e.data:isRecord(e)?e:null}catch{return null}}();let selected=hasData(primary)?primary:mirror||{};return hasData(mirror)&&savedAt(mirror)>savedAt(selected)&&(selected=mirror),hasData(selected)&&writeMirror(selected),selected!==mirror||selected===primary||primaryFailed||await gmWrite(n,selected),selected}async function collectBootstrap(){const[data,e]=await Promise.all([readPersistedData(),gmRead(i,null)]),t=u;let r;try{if(r=await targetJournal(),readPersistedData.failed&&!r.ops.some(e=>'migration'===e.kind))throw Error('Legacy target storage could not be read.')}catch{r={ops:[],error:'Target storage is unavailable. Reload to retry; saved targets have not been changed.'}}let o=null;try{o=JSON.parse(globalThis.localStorage?.getItem(i)||'null')}catch{}const a=[e,o,data?.caches?.ownBattleStats].filter(value=>isRecord(value)&&Number(value.total)>0).sort((e,t)=>Number(t.checkedAt||0)-Number(e.checkedAt||0))[0]||null;return{[n]:data,[i]:a,[t]:r,storageAutoRecovery:nativeStorage.automaticRecovery||null,storageWriteEvent:m,[l]:await gmRead(l,{}),[c]:await gmRead(c,{})}}function nativeStorage(){
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
 const lock=run=>{const locks=globalThis.navigator?.locks;if(!locks?.request)throw Error('This WebView cannot coordinate segmented native saving safely. Original records were not replaced. [SLINK_STORAGE_COORDINATION_UNAVAILABLE]');return locks.request('slink-pda-recovered-settings-v2',run);};
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
 async function writeParts(record,value){
  try{return await writePartsInner(record,value);}catch(error){
   if(/QuotaExceeded/i.test(String(error?.code||error?.message||error)))throw Error("PDA's native SLINK storage quota exceeded while preserving earlier records. Increase SLINK's per-script limit in PDA Dev Tools → Storage, or send a storage report before removing anything. This is not the phone's free-space or notifications permission. [SLINK_STORAGE_FULL]");
   throw error;
  }
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
  }catch{nativeStorage.checkpointStatus='unavailable';}
 }
 async function automaticallyRecover(record){
  if(!canSegment()||typeof store.delete!=='function')return false;
  return lock(async()=>{
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
   }catch{nativeStorage.partsCache?.delete(record);throw Error('SLINK could not finish automatic storage repair. The verified checkpoint is retained; keep this page open and retry saving or reload once. [SLINK_STORAGE_AUTORECOVERY_FAILED]');}
   const report={status:'recovered',restoredAt:Date.now(),generation:Number(verified.header.generation)||0,usedPrevious:!currentHeader||verified!==checkpoints[0]||Number(currentHeader?.generation)>Number(verified.header.generation)};
   nativeStorage.automaticRecovery=report;nativeStorage.segmentFailure=null;
   if(typeof m==='string')try{globalThis.document?.dispatchEvent(new CustomEvent(m+':repaired',{detail:JSON.stringify(report)}));}catch{}
   return true;
  });
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
  await store.set(selector,selection);
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
 async function readManyOnce(keys){
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
    if(typeof store.loadAll==='function'&&!keys.some(k=>k.startsWith(prefix)||k.startsWith(legacyPrefix))&&(typeof f!=='string'||!keys.includes(f))){
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
 async function getManyLegacy(keys){
  try{return await readManyOnce(keys);}
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
 async function getMany(keys,allowAutomatic=true){
  const selected=keys.includes(n)?await selectedRecord():n;
  const physical=keys.map(k=>k===n?selected:k);let values;
  try{values=await getManyLegacy(physical);}
  catch(error){if(!allowAutomatic||keys.length!==1||keys[0]!==n||!await automaticallyRecover(selected))throw error;return getMany(keys,false);}
  if(allowAutomatic&&keys.length===1&&keys[0]===n&&values[selected]==null&&await automaticallyRecover(selected))return getMany(keys,false);
  const out={};for(let index=0;index<keys.length;index++){
   const value=values[physical[index]];
   if(keys[index]===n&&segmented(value)){
    try{out[keys[index]]=await lock(async()=>{const header=await store.get(selected,null),value=await readParts(selected,header);await saveCheckpoint(selected,header);return value;});nativeStorage.segmentFailure=null;}
    catch(error){if(allowAutomatic&&keys.length===1&&keys[0]===n&&await automaticallyRecover(selected))return getMany(keys,false);nativeStorage.segmentFailure=castError(error)&&error.code===error.message?{record:selected,kind:'Null/String',stage:'native-response'}:null;const wrapped=failed('recovered settings segment read',error);wrapped.message+=' [SLINK_NATIVE_READ: record=recovered settings; batch='+(castError(error)?'Null/String':'other failure')+'; single=segment read; all=not attempted]';throw wrapped;}
   }else out[keys[index]]=value;
  }return out;
 }
 async function setMany(values){
  const logicalKeys=Object.keys(values),selected=logicalKeys.includes(n)?await selectedRecord():n;
  if(logicalKeys.includes(n)&&canSegment()){
   await lock(async()=>{
    // Another page may have completed migration while this page waited for the
    // lock. Re-resolve the pointer before selecting an inactive bank.
    nativeStorage.selection=null;const active=await selectedRecord();
    if(active!==selected)throw Error('SLINK storage was migrated on another page. Retry saving so SLINK can merge the latest settings; no saved record was overwritten. [SLINK_STORAGE_SELECTION_CHANGED]');
    if(active.startsWith(prefix))await writeParts(active,values[n]);
    else {
     // A readable legacy record can migrate on a normal save. An unreadable
     // legacy record requires the explicit recovery action, never a blind reset.
     if(active===n)await getManyLegacy([active]);else await store.get(active,null);
     await installRecoveredSettings(values[n]);
    }
   });
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
    catch(retry){throw failed('single-key write',retry);}
   }else throw failed('write',error);
  }
  // The optional downloaded-code cache is disposable and can be large. Verify
  // user records, not an extra full cache read on every page startup.
  if(typeof f==='string'&&keys.every(k=>k===f))return;
  const saved=await getManyLegacy(keys);
  for(const k of keys)if(JSON.stringify(saved[k])!==JSON.stringify(values[k]))throw Error('PDA native storage did not retain the '+(k===n?'settings':k===i?'battle stats':k===l?'window preferences':k===c?'alert snoozes':'target record')+' write. Keep this page open and retry; existing stored data was not cleared.');
 }
 return {
  get:async(k,fallback)=>{key(k);return (await getMany([k]))[k]??fallback},
  set:(k,value)=>{key(k);return setMany({[k]:value})},
  getMany,setMany,recoverSettings,resetSettings,
  async diagnose(){
   const active=await selectedRecord().catch(()=>n);
   const report={nativeAvailable:true,manualRecoveryVersion:3,manualResetVersion:2,automaticRecoveryVersion:1,automaticRecovery:nativeStorage.automaticRecovery||null,checkpointStatus:nativeStorage.checkpointStatus||'not-created',coordinationAvailable:canSegment(),selectedRecord:active===n?'original':'recovered',reads:{}};
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
  ...(typeof store.list==='function'?{list:()=>store.list()}:{}),
  ...(typeof store.loadAll==='function'?{loadAll:()=>store.loadAll()}:{}),
  ...(typeof store.delete==='function'?{delete:async k=>store.delete(key(k)===n?await selectedRecord():k)}:{})
 };
}async function targetJournal(request={}){const e=nativeStorage(),t=u+':op:';async function read(){let r;if(e)if('function'==typeof e.list&&'function'==typeof e.getMany){const o=(await e.list()).filter(key=>key.startsWith(t));if(r=o.length?await e.getMany(o):{},o.some(key=>null==r?.[key]))throw Error('Target journal read incomplete.')}else{if('function'!=typeof e.loadAll)throw Error('Native target storage enumeration unavailable.');r=await e.loadAll()}else{r={};const e=globalThis.localStorage;if(!e||'function'!=typeof e.key)throw Error('Target storage unavailable.');for(let o=0;o<e.length;o++){const key=e.key(o);key?.startsWith(t)&&(r[key]=JSON.parse(e.getItem(key)))}}if(!isRecord(r))throw Error('Target journal read failed.');const o=Object.entries(r).filter(([key])=>key.startsWith(t));if(o.some(([key,e])=>!isRecord(e)||1!==e.schema||key!==t+e.id))throw Error('Target journal is damaged or unsupported.');return Object.fromEntries(o)}const r=await read(),o={};if(!request.readOnly)for(const e of request.ops||[]){if(!isRecord(e)||1!==e.schema||!/^[a-zA-Z0-9:_-]{1,160}$/.test(e.id||'')||!['seed','add','patch','remove','migration'].includes(e.kind))throw Error('Invalid target operation.');const key=t+e.id;if(r[key]&&JSON.stringify(r[key])!==JSON.stringify(e))throw Error('Target operation identity collision.');r[key]||(o[key]=e)}if(Object.keys(o).length)if(e&&'function'==typeof e.setMany)await e.setMany(o);else for(const[key,t]of Object.entries(o))e?await e.set(key,t):globalThis.localStorage.setItem(key,JSON.stringify(t));const a=Object.keys(o).length?await read():r;for(const e of request.readOnly?[]:request.ops||[])if(JSON.stringify(a[t+e.id])!==JSON.stringify(e))throw Error('Target journal write was not retained.');return{ops:Object.values(a)}}function mergeChanges(e,current,t){if(JSON.stringify(e)===JSON.stringify(current))return t;if(!isRecord(e)||!isRecord(current)||!isRecord(t))return current;const r={...t};for(const key of new Set([...Object.keys(e),...Object.keys(current)]))['__proto__','constructor','prototype'].includes(key)||(Object.hasOwn(current,key)?r[key]=mergeChanges(e[key],current[key],t[key]):Object.hasOwn(e,key)&&delete r[key]);return r}async function gmRead(key,e=null){const t=nativeStorage();if(t){const value=await t.get(key,null);if(null!=value)return value}let r;try{r='function'==typeof globalThis.GM_getValue?await Promise.resolve(globalThis.GM_getValue(key,e)):e}catch(t){if(d.has(key))throw t;return e}return t&&isRecord(r)&&Object.keys(r).length&&d.has(key)&&null==await t.get(key,null)&&await t.set(key,r),r}async function gmWrite(key,value){const e=nativeStorage();if(e)await e.set(key,value);else{if('function'!=typeof globalThis.GM_setValue)throw Error('Browser storage unavailable.');if(await Promise.resolve(globalThis.GM_setValue(key,value)),'function'==typeof globalThis.GM_getValue&&JSON.stringify(await globalThis.GM_getValue(key,null))!==JSON.stringify(value))throw Error('Browser storage write was not retained.')}}function validBundle(value){return Boolean(isRecord(value)&&1===value.schema&&[2,3].includes(value.storageProtocol)&&'string'==typeof value.runtimeSource&&value.runtimeSource.length>1e3&&Array.isArray(value.addonSources)&&value.addonSources.every(source=>'string'==typeof source&&source.length>100))}async function requestSource(e){if('function'==typeof globalThis.PDA_httpGet){const t=await globalThis.PDA_httpGet(e),r=Number(t?.status||t?.statusCode||200);if(r<200||r>=300)throw new Error('SLINK source download returned HTTP '+r+'.');const o=String(t?.data??t?.responseText??'');if(t?.error||!o.trim()||/^error[, :]|^Exception:/i.test(o))throw new Error('SLINK source connection failed.');return o}if('function'==typeof globalThis.GM_xmlhttpRequest)return await new Promise((t,r)=>{globalThis.GM_xmlhttpRequest({method:'GET',url:e,timeout:2e4,onload:e=>e.status>=200&&e.status<300?t(String(e.responseText||'')):r(new Error('SLINK source download returned HTTP '+e.status+'.')),onerror:()=>r(new Error('SLINK source download failed.')),ontimeout:()=>r(new Error('SLINK source download timed out.'))})});if('function'==typeof globalThis.fetch){const t='function'==typeof AbortController?new AbortController:null,r=globalThis.setTimeout(()=>t?.abort(),8e3);try{const r=await globalThis.fetch(e,{signal:t?.signal,credentials:'omit'});if(!r.ok)throw new Error('SLINK source download returned HTTP '+r.status+'.');return await r.text()}finally{globalThis.clearTimeout(r)}}throw new Error('No SLINK source download transport is available.')}async function fetchSource(e){const mirror=e.replace('https://raw.githubusercontent.com/Considious/Torn-Scripts/','https://cdn.jsdelivr.net/gh/Considious/Torn-Scripts@'),t=h?[mirror,e]:[e,mirror];
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
const stageCacheName='slink-pda-public-runtime',stageUrl=t+'?slink-staged=1';
const sessionGet=k=>{try{return globalThis.sessionStorage?.getItem(k)||'';}catch{return '';}};
const sessionSet=(k,v)=>{try{if(v)globalThis.sessionStorage?.setItem(k,v);else globalThis.sessionStorage?.removeItem(k);}catch{}};
function boundStartup(task,ms){let timer;return Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Optional startup cache timed out.')),ms);})]).finally(()=>clearTimeout(timer));}
async function stageDigest(text){
 const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
}
async function saveStaged(bundle){
 if(!globalThis.caches||!globalThis.crypto?.subtle||typeof Response!=='function')return false;
 const text=JSON.stringify(bundle),digest=await stageDigest(text),cache=await globalThis.caches.open(stageCacheName);
 await cache.put(stageUrl,new Response(text));
 // This digest is held in privileged storage: Torn-origin storage alone cannot authorize code.
 await gmWrite(stageMeta,{revision:bundle.revision,digest});
 return true;
}
async function readStaged(revision){
 if(!globalThis.caches||!globalThis.crypto?.subtle)return null;
 const [meta,cache]=await Promise.all([gmRead(stageMeta,null),globalThis.caches.open(stageCacheName)]);
 if(meta?.revision!==revision||!meta.digest)return null;
 const result=await cache.match(stageUrl),text=await result?.text();
 if(!text||await stageDigest(text)!==meta.digest)return null;
 const bundle=JSON.parse(text);
 return validBundle(bundle)&&bundle.revision===revision?bundle:null;
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
  const cached=await gmRead(f,null).catch(()=>null);
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
    next=await boundStartup(readStaged(hint.slice(7)),200).catch(()=>null);
    if(!next){sessionSet(updateHint,'');sessionSet(updateCheck,'');}
   }else if(hint.startsWith('fetch:')&&hint.slice(6)!==cached.revision){
    sessionSet(updateHint,'');
    try{const manifest=await readSourceManifest(2500);if(manifest.revision===hint.slice(6)&&manifest.revision!==sessionGet(rejectedRevision))next=await fetchBundle(manifest);}catch{}
   }
   if(!next){
    try{await executeBundle(cached);void stageUpdate(cached);return;}catch(error){return showFailure(error);}
   }
  }
  if(!next)try{next=await fetchBundle();}catch(error){
   if(!validBundle(cached))return showFailure(error);
   try{return await executeBundle(cached);}catch(fallback){return showFailure(fallback);}
  }
  try{
   await executeBundle(next);
   try{
    await gmWrite(f,next);sessionSet(updateHint,'');sessionSet(updateCheck,String(Date.now()));
    if(globalThis.caches)void globalThis.caches.open(stageCacheName).then(cache=>cache.delete(stageUrl)).catch(()=>{});
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
   if(readContext)storageReadFailure=readContext.join(' ');
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
}if(isRecord(payload)&&payload.action==='retry'){if(!nativeOutstanding)storagePaused=false;return;}if(isRecord(payload)&&d.has(payload.key)&&(!payload.remove||payload.key===n)&&(payload.remove||isRecord(payload.value))){if(storagePaused){acknowledge(payload,false,pausedStorageError().message);return;}if(!payload.remove&&payload.key!==u)if(payload.key===n)writeMirror(payload.value);else try{globalThis.localStorage?.setItem(payload.key,JSON.stringify(payload.value))}catch{}if(payload.protocol===2)acknowledge(payload,false,'',undefined,'queued');e=e.catch(()=>{}).then(()=>runStorageJob(async()=>{if(payload.protocol===2)acknowledge(payload,false,'',undefined,'working');if(payload.key===u)return targetJournal(payload.value);if(payload.remove){const e=nativeStorage();if(e){if('function'!=typeof e.delete)throw Error('Storage delete unavailable.');await e.delete(payload.key)}else{if('function'!=typeof globalThis.GM_deleteValue)throw Error('Storage delete unavailable.');await Promise.resolve(globalThis.GM_deleteValue(payload.key))}try{globalThis.localStorage?.removeItem(s),globalThis.localStorage?.removeItem(n)}catch{}}else{const e=await gmRead(payload.key,null);if(payload.key===i&&Number(e?.checkedAt||0)>Number(payload.value?.checkedAt||0))return;let value=payload.value;if(payload.key===n&&isRecord(e)&&isRecord(payload.base)){const t=mergeChanges(payload.base.settings,value.settings,e.settings||{}),r=mergeChanges(payload.base.targetList,value.caches?.targetList||{},e.caches?.targetList||{});value={...savedAt(e)>savedAt(value)?e:value,settings:t,caches:{...savedAt(e)>savedAt(value)?e.caches:value.caches,targetList:r},_savedAt:Math.max(savedAt(e),savedAt(value))+1}}else if(savedAt(e)>savedAt(value))return;if(payload.base?.protected&&e)for(const key of Object.keys(payload.base.protected))value[key]=mergeChanges(payload.base.protected[key],payload.value[key],Object.hasOwn(e,key)?e[key]:payload.value[key]);await gmWrite(payload.key,value)}})).then(value=>acknowledge(payload,!0,'',value),e=>acknowledge(payload,!1,String(e?.message||e?.code||'Storage write failed')))}});Object.defineProperty(globalThis,'__SLINK_PDA_STORAGE_BRIDGE__',{value:Object.freeze({protocol:1,document,channel:m}),configurable:true});}(),await loadRuntime()})();
