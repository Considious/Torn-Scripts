(function installMuggingFairFight(global){
 'use strict';
 const positive=v=>v!=null&&typeof v!=='boolean'&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
 function publicEstimate(row,now){
  const source=row?.available_estimates?.bss??(row?.source==='bss'?row:null);if(!source)return null;
  const id=Number(row.player_id??row.id),estimate=positive(source.bs_estimate),raw=Number(source.last_updated??source.bss_public_timestamp),at=raw>1e10?raw:raw*1000;
  if(!Number.isSafeInteger(id)||id<=0||!estimate||!Number.isFinite(at)||at<946684800000||at>now+300000)return null;
  return {playerId:id,observedAt:now,estimateOnly:true,record:{playerId:id,battleStatsEstimate:estimate,battleStatsCheckedAt:at,fieldMeta:{battleStatsEstimate:{at,source:'ffscouter-bss'}}}};
 }
 // FFScouter's score uses square-root-weighted battle stats, never a ratio of raw totals.
 function applyRange(targets, results, ownScore, min, max, limit){
  const matched=[],unchecked=[];
  for(const target of targets){
   const score=results?.get(Number(target.id));
   const fromBss=score?.bss&&positive(ownScore)?Number((1+(8/3)*score.bss/ownScore).toFixed(2)):null;
   const direct=score?.ff??null;
   if(fromBss!==null&&fromBss>3)continue;
   const ff=direct??fromBss;
   if(ff!==null&&(ff<min||ff>max))continue;
   if(ff===null||(ff===3&&fromBss===null)){
    unchecked.push({...target,fair_fight:null,rough_fair_fight:null,estimate_kind:'unchecked',confidence:'FF unverified — not a safe attack recommendation'});continue;
   }
   matched.push({...target,fair_fight:ff,rough_fair_fight:null,estimate_kind:direct!==null?'ffscouter':'bss',confidence:direct!==null?'FFScouter estimate':'Battle Stat Score estimate'});
  }
  return [...matched,...unchecked].slice(0,limit);
 }
 function create({key,request,queue,now=Date.now}){
  const cache=new Map();let running=null,nextAt=0,cacheKey='';
  async function check(targets, assignments=false){
   if(running){if(!assignments)return running;await running.catch(()=>null);return check(targets,true);}
   running=(async()=>{
    const ids=[...new Set((targets||[]).filter(t=>assignments||t.needs_estimate===true||t.estimateKind==='unchecked'||t.estimate_kind==='unchecked'||(t.needs_estimate!==false&&!positive(t.battleStatsEstimate??t.battle_stats_estimate))).map(t=>Number(t.player_id??t.playerId??t.id)).filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,200);
    if(!ids.length)return {checked:0,queued:0};
    const apiKey=String(await key()||'').trim();
    if(apiKey!==cacheKey){cache.clear();cacheKey=apiKey;nextAt=0;}
    const scores=()=>new Map(ids.flatMap(id=>{const row=cache.get(id);return row?.score&&row.until>now()?[[id,row.score]]:[];}));
    const at=now(),cached=ids.map(id=>cache.get(id)).filter(row=>row?.observation&&row.until>at).map(row=>row.observation),missing=ids.filter(id=>!cache.has(id)||cache.get(id).until<=at);
    if(cached.length)await queue(cached);
    if(!apiKey||!missing.length||at<nextAt)return {checked:0,queued:cached.length,keyMissing:!apiKey,scores:scores()};
    nextAt=at+60000;
    let timer;const controller=global.AbortController?new global.AbortController():null;
    try{
     const body=await Promise.race([request(missing,apiKey,controller?.signal),new Promise((_,reject)=>{timer=global.setTimeout(()=>{controller?.abort();reject(Error('FFScouter timed out'));},6000);})]),rows=Array.isArray(body)?body:body?.data??body?.results;
     if(!Array.isArray(rows)||body?.error)throw Error('FFScouter returned no usable response');
     const found=new Map(),personal=new Map(),requested=new Set(missing);
     for(const row of rows){
      const observation=publicEstimate(row,now());if(!observation||!requested.has(observation.playerId))continue;
      found.set(observation.playerId,observation);
      if(now()-observation.record.battleStatsCheckedAt>30*86400000)continue;
      const bss=positive((row.available_estimates?.bss??row).bss_public);
      const raw=row.source==='bss'?positive(row.fair_fight):null;
      personal.set(observation.playerId,{bss,ff:raw!==null&&raw>=1&&raw<=3?raw:null});
     }
     for(const id of missing)cache.set(id,{observation:found.get(id)||null,score:personal.get(id)||null,until:now()+(found.has(id)?3600000:600000)});
     while(cache.size>500)cache.delete(cache.keys().next().value);
     const observations=[...found.values()];if(observations.length)await queue(observations);
     return {checked:missing.length,queued:cached.length+observations.length,scores:scores()};
    }catch(error){nextAt=now()+Math.max(60000,Math.min(300000,Number(error.retryAfterMs)||0));return {checked:0,queued:cached.length,scores:scores(),error:'Fair Fight checks delayed; unchecked targets remain available.'};}finally{global.clearTimeout(timer);}
   })().finally(()=>running=null);return running;
  }
  return Object.freeze({check});
 }
 global.SLINK_MUGGING_FF=Object.freeze({positive,publicEstimate,applyRange,create});
})(globalThis);
