(function(g){
  'use strict';
  const type=v=>{
    const s=String(v??'').trim().toLowerCase().replace(/[_-]/g,' ').replace(/\s+/g,' ').replace(/(?: weapon)? mastery$/,'');
    if (/^sub ?machine guns?$/.test(s))return 'smg';
    if(s==='machine guns')return 'machine gun';
    if(/^(rifle|shotgun|pistol|club)s$/.test(s))return s.slice(0,-1);
    return s==='club'||s==='clubbing'?'club':['heavy artillery','machine gun','rifle','smg','shotgun','pistol','piercing','slashing','mechanical','temporary'].includes(s)?s:'';
  };
  function perks(body){
    const entries=body?.perks?.merit;
    if(!Array.isArray(entries))throw Error('Torn did not return merit perks.');
    const out={};
    for(const line of entries){
      const m=String(line).trim().match(/^(?:merit:\s*)?\+?\s*(heavy artillery|machine gun|rifle|smg|shotgun|pistol|club(?:bing)?|piercing|slashing|mechanical|temporary)(?: mastery)?\s+\+?\s*(\d+)%\s+damage\s*\/\s*\+?\s*(\d+(?:\.\d+)?)\s+accuracy$/i);
      if(!m)continue;
      const n=Number(m[2]),accuracy=Number(m[3]);
      if(n>=1&&n<=10&&Math.abs(accuracy-n/5)<1e-8)out[type(m[1])]=n;
    }
    return out;
  }
  function upgrades(user, catalogue){
    const rows=user?.merits?.upgrades, definitions=catalogue?.merits;
    if(!Array.isArray(rows)||!Array.isArray(definitions))throw Error('Torn did not return weapon mastery upgrade data.');
    const byId=new Map(definitions.map(row=>{
      const name=String(row.name||''),desc=String(row.description||'');
      const category=type(name)||type(name.replace(/^(?:weapon )?mastery\s*[:–-]\s*/i,''))||type(name.replace(/\s+weapon damage$/i,''));
      const match=desc.match(/\b(heavy artillery|machine guns?|rifles?|smg|sub[- ]?machine guns?|shotguns?|pistols?|clubs?|clubbing|piercing|slashing|mechanical|temporary)\b/i);
      return [Number(row.id),category||(/damage/i.test(desc)&&/accuracy/i.test(desc)&&match?type(match[1]):'')];
    }));
    if(![...byId.values()].some(Boolean))throw Error('No weapon mastery categories could be identified in Torn’s merit catalogue.');
    return Object.fromEntries(rows.map(row=>[byId.get(Number(row.id)),Number(row.level)]).filter(([kind,level])=>kind&&Number.isInteger(level)&&level>0&&level<=10));
  }
  function catalogue(body){
    if(!Array.isArray(body?.items))throw Error('Torn did not return the weapon catalogue.');
    const out={};
    for(const row of body.items){
      const k=type(row?.sub_type),id=Number(row?.id);
      if(!k||!Number.isSafeInteger(id)||id<=0||row.type!=='Weapon'||(k==='temporary'&&!(Number(row.details?.base_stats?.damage)>0)))continue;
      out[id]=k;
    }
    return out;
  }
  function suffix(level,stat){
    if(!Number.isInteger(level)||level<1||level>10)return '';
    return stat==='damage'?'(+'+level+'%)':stat==='accuracy'?'(+'+(level/5).toFixed(1)+')':'';
  }
  g.SLINK_WEAPON_MERITS=Object.freeze({perks,upgrades,catalogue,suffix});
})(globalThis);
