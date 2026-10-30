(function installFairFightBackup(global){
'use strict';
const DAY=86400000,MAX=200;
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
function normalize(value,now=Date.now()){
 if(!value||value.source!=='ffscouter-bss')return null;
 const id=number(value.player_id),bs=number(value.bs_estimate),bss=number(value.bss_public),at=number(value.ff_last_updated);
 if(!Number.isSafeInteger(id)||id>999999999||!bs||bs>Number.MAX_SAFE_INTEGER||!bss||bss>1e12||!Number.isSafeInteger(at)||at<946684800||at>Math.floor(now/1000)+300)return null;
 return {player_id:id,bs_estimate:bs,bss_public:bss,ff_last_updated:at,source:'ffscouter-bss',slink_observed_at:Math.min(now,number(value.slink_observed_at)||now)};
}
function publicRecord(row,now=Date.now()){
 const value=row?.available_estimates?.bss;
 const publicValue=value&&typeof value==='object'?value:row?.source==='bss'?row:null;
 if(!publicValue)return null;
 return normalize({player_id:row.player_id,bs_estimate:publicValue.bs_estimate,bss_public:publicValue.bss_public,ff_last_updated:publicValue.last_updated??publicValue.bss_public_timestamp,source:'ffscouter-bss',slink_observed_at:now},now);
}
function freshness(row,now=Date.now()){
 const days=Math.max(0,(now-row.ff_last_updated*1000)/DAY);
 return {ageMs:days*DAY,label:days<1?'Fresh':days<7?'Recent':days<30?'Old':'Stale',text:days<1?Math.floor(days*24)+'h old':Math.floor(days)+'d old'};
}
function fallbackRow(row,ownScore,now=Date.now()){
 const age=freshness(row,now);
 return {player_id:row.player_id,bs_estimate:row.bs_estimate,bss_public:row.bss_public,last_updated:row.ff_last_updated,
 fair_fight:number(ownScore)?Math.round((1+(8/3)*row.bss_public/ownScore)*100)/100:null,
 source:'SLINK Backup • '+age.text,backup:true,backup_age_ms:age.ageMs,backup_freshness:age.label};
}
// A separate, namespaced IndexedDB avoids Chrome storage.local quota and never rewrites settings.
function openStore(indexedDB=global.indexedDB){
 let opening;const memory={records:new Map(),pending:new Map(),meta:new Map()};
 function db(){if(!indexedDB?.open)return Promise.resolve(null);return opening||=(new Promise((resolve,reject)=>{const r=indexedDB.open('slink-ff-public-backup-v1',1);r.onupgradeneeded=()=>{for(const name of ['records','pending','meta'])r.result.createObjectStore(name);};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Backup database busy'));})).catch(error=>{opening=null;throw error;});}
 async function tx(names,mode,action){const d=await db();if(!d)return action(null);return new Promise((resolve,reject)=>{const t=d.transaction(names,mode);let out;action(t,value=>{out=value;});t.oncomplete=()=>resolve(out);t.onabort=()=>reject(t.error||Error('Backup write interrupted'));t.onerror=()=>{};});}
 const get=(t,name,key,done)=>{if(!t)return done(memory[name].get(key));const r=t.objectStore(name).get(key);r.onsuccess=()=>done(r.result);};
 const put=(t,name,key,value)=>t?t.objectStore(name).put(value,key):memory[name].set(key,value);
 return {
 async negatives(ids,until){const out={};await tx(['meta'],until?'readwrite':'readonly',(t,done)=>{for(const id of ids){const key='negative:'+id;if(until)put(t,'meta',key,until);else get(t,'meta',key,value=>{out[id]=Number(value)||0;});}done?.(out);});return out;},
 async getMany(ids){const rows={};await tx(['records'],'readonly',(t,done)=>{if(!t){ids.forEach(id=>{if(memory.records.has(id))rows[id]=memory.records.get(id);});return;}for(const id of ids)get(t,'records',id,value=>{if(value)rows[id]=value;});done(rows);});return rows;},
 async putMany(rows,contribute){return tx(['records','pending'],'readwrite',t=>{
  function apply(count){for(const row of rows)get(t,'records',row.player_id,old=>{if(old&&old.ff_last_updated>=row.ff_last_updated)return;put(t,'records',row.player_id,row);if(contribute)get(t,'pending',row.player_id,queued=>{if(queued||count<2000){put(t,'pending',row.player_id,row);if(!queued)count++;}});});}
  if(t&&contribute){const r=t.objectStore('pending').count();r.onsuccess=()=>apply(r.result);}else apply(memory.pending.size);
 });},
 async pending(){let out=[];await tx(['pending'],'readonly',(t,done)=>{if(!t){out=[...memory.pending.values()];return;}const r=t.objectStore('pending').getAll(undefined,2000);r.onsuccess=()=>{out=r.result;done(out);};});return out;},
 async ack(rows){return tx(['pending'],'readwrite',t=>{for(const row of rows)get(t,'pending',row.player_id,current=>{if(current?.ff_last_updated===row.ff_last_updated){if(t)t.objectStore('pending').delete(row.player_id);else memory.pending.delete(row.player_id);}});});},
 async meta(key,value){let out;await tx(['meta'],value===undefined?'readonly':'readwrite',(t,done)=>{if(value!==undefined){put(t,'meta',key,value);out=value;done?.(value);}else get(t,'meta',key,v=>{out=v;done?.(v);});});return out;},
 async reserve(now){let reserved=false;await tx(['meta'],'readwrite',(t,done)=>get(t,'meta','upload',old=>{const day=Math.floor(now/DAY),s=old?.day===day?old:{day,count:0,at:0};if(s.count<5&&now-s.at>=900000){put(t,'meta','upload',{day,count:s.count+1,at:now});reserved=true;}done?.(reserved);}));return reserved;}
 };
}
function create({store,transport,session=async()=>null,ownScore=async()=>null,now=Date.now,active=()=>true}){
 let failures=[],openUntil=0,probe=false,flushing=null,lookupRetry=0;const pendingLookups=new Map();
 const safe=async(fn,fallback,ms=4500)=>{let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise(resolve=>{timer=global.setTimeout(()=>resolve(fallback),ms);})]);}catch{return fallback;}finally{global.clearTimeout(timer);}};
 async function remote(action,body,token){let timer;try{return await Promise.race([transport(action,body,token),new Promise((_,reject)=>{timer=global.setTimeout(()=>reject(Error('Backup timed out')),4000);})]);}finally{global.clearTimeout(timer);}}
 async function flush(force=false){
  if(flushing)return flushing;
  flushing=(async()=>{if(!active())return;const rows=await store.pending();if(!rows.length)return;
   let first=await store.meta('firstQueued');if(!first){first=Math.min(...rows.map(r=>r.slink_observed_at));await store.meta('firstQueued',first);}
   if(!force&&rows.length<100&&now()-first<3600000)return;
   const auth=await session();if(!auth?.token||!await store.reserve(now()))return;
   const batch=rows.slice(0,MAX);const response=await remote('contribute',{records:batch},auth.token);
   const accepted=new Map((response.acknowledged||[]).map(r=>[Number(r.player_id),Number(r.ff_last_updated)]));
   await store.ack(batch.filter(r=>accepted.get(r.player_id)>=r.ff_last_updated));await store.meta('firstQueued',now());
  })().catch(()=>{}).finally(()=>{flushing=null;});return flushing;
 }
 async function capture(rows){const records=rows.map(r=>publicRecord(r,now())).filter(Boolean);if(!records.length)return;await store.putMany(records,true);void flush();}
 async function fallback(ids){
  const local=await safe(()=>store.getMany(ids),{}),absent=ids.filter(id=>!local[id]);
  const negatives=await safe(()=>store.negatives(absent),{}),missing=absent.filter(id=>now()>=Number(negatives[id]||0));
  if(missing.length&&now()>=lookupRetry&&active()){
   const auth=await safe(session,null);if(auth?.token)for(let i=0;i<missing.length;i+=MAX){
    const batch=missing.slice(i,i+MAX),key=batch.join(',');let task=pendingLookups.get(key);
    if(!task){task=remote('lookup',{player_ids:batch},auth.token);pendingLookups.set(key,task);}
    try{const response=await task;if(response?.ok===false||!Array.isArray(response?.records))throw Error('Invalid backup response');const rows=response.records.map(r=>normalize(r,now())).filter(r=>r&&batch.includes(r.player_id));await store.putMany(rows,false);rows.forEach(r=>{local[r.player_id]=r;});await store.negatives(batch.filter(id=>!local[id]),now()+600000);}
    catch{lookupRetry=now()+600000;break;}finally{pendingLookups.delete(key);}
   }
  }
  const score=await safe(ownScore,null);return ids.filter(id=>local[id]).map(id=>fallbackRow(local[id],score,now()));
 }
 async function run(url,primary){
  const u=new URL(url);
  if(u.hostname==='ffscouter.com'&&u.pathname.endsWith('/get-targets')){const response=await primary();if(Array.isArray(response?.targets))await safe(()=>capture(response.targets),null,150);return response;}
  if(u.hostname!=='ffscouter.com'||!u.pathname.endsWith('/get-stats'))return primary();
  const ids=[...new Set((u.searchParams.get('targets')||'').split(',').map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,205);
  if(!ids.length)return primary();
  if(now()<openUntil||probe)return safe(()=>fallback(ids),[]);
  const halfOpen=openUntil>0;if(halfOpen)probe=true;
  try{
   const response=await primary(),rows=Array.isArray(response)?response:response?.data??response?.results;
   if(response?.error||!Array.isArray(rows))throw Error('Invalid FF response');
   failures=[];openUntil=0;await safe(()=>capture(rows.filter(r=>ids.includes(Number(r?.player_id)))),null,150);
   const usable=new Set(rows.filter(r=>number(r?.bs_estimate)||number(r?.fair_fight)).map(r=>Number(r.player_id)));
   const absent=ids.filter(id=>!usable.has(id));if(!absent.length)return response;
   const replacements=await safe(()=>fallback(absent),[]);if(!replacements.length)return response;
   const replace=new Set(replacements.map(r=>r.player_id));const merged=[...rows.filter(r=>!replace.has(Number(r.player_id))),...replacements];
   return Array.isArray(response)?merged:{...response,[Array.isArray(response.data)?'data':'results']:merged};
  }catch(error){
   // Invalid/revoked keys are not disguised as an outage.
   if([400,401,403].includes(Number(error.status)))throw error;
   failures=failures.filter(at=>now()-at<=60000);failures.push(now());
   if(failures.length>=3||halfOpen||Number(error.status)===429)openUntil=now()+Math.max(180000,Math.min(1800000,Number(error.retryAfterMs)||0));
   const rows=await safe(()=>fallback(ids),[]);if(rows.length)return rows;throw error;
  }finally{probe=false;}
 }
 return {run,capture,fallback,flush,status:()=>({degraded:now()<openUntil,retryAt:openUntil})};
}
global.SLINK_FF_BACKUP=Object.freeze({normalize,publicRecord,freshness,fallbackRow,openStore,create});
})(globalThis);
