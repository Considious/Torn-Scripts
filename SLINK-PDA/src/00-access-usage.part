(function(g){
 'use strict';
 const G=60_000,H=60*G,MAX=6000;
 const names={access:'Access',alerts:'Efficiency alerts',market:'Market Watch',mugging:'Mugging',leveling:'Leveling',war:'War',bounties:'Bounties',targets:'Target List',merits:'Merits',faction:'Faction tools',travel:'Travel tools',racing:'Racing',company:'Company',crimes:'Crime helpers',stats:'Player Stats',intelligence:'Player intelligence',qol:'Page Tools',money:'Money & Property',stocks:'Stocks',bank:'Bank',missions:'Mission Rewards',events:'Events',museums:'Museums',officers:'Faction Officers',rooms:'Faction Rooms',shared:'Shared data',maintenance:'SLINK Maintenance',legacy:'Earlier client version',external:'Other scripts'};
 const priorities={high:'Direct / urgent',alerts:'Critical alerts',market:'Market checks',normal:'Normal',low:'Background',contribution:'Shared maintenance'};
 function safeEndpoint(value){
  const raw=String(value||''),s=raw.split(/[?#]/,1)[0].replace(/^https:\/\/api\.torn\.com/i,'');
  const safeSegments=new Set('user faction market torn key company property racing basic profile personalstats battlestats bars cooldowns events education organizedcrime organizedcrimes travel stocks skills crimes bounties awards medals honors inventory workstats perks merits weaponexp attacks attacksfull revives members wars rankedwars rankedwarreport warfareranked news armory armoury items itemmarket pointsmarket bazaar timestamp lookup info races racingrecords refills reports calendar jobpoints ammo itemmods money bank properties property gym gyms icons job positions employees stocktransactions enlistedcars networth factions chains chain logs donator organizedcrime'.split(' '));
  let endpoint=/^\/(?:v[12]\/)?(?:user|faction|market|torn|key|company|property|racing)(?:\/(?:[a-z0-9_-]{1,40}|:id|:selection)){0,4}\/?$/i.test(s)?s.split('/').map((part,i)=>!part||part===':id'||part===':selection'||i===1&&/^v[12]$/i.test(part)||safeSegments.has(part.toLowerCase())?part.toLowerCase():/^\d+$/.test(part)?':id':':selection').join('/'):'Endpoint not recorded (earlier version)';
  if(/^\/api\/(?:permissions\/auth|auth)$/.test(s))endpoint=s;
  const selections=raw.match(/[?&]selections=([^&#]*)/i)?.[1];
  if(selections){
   let decoded='';try{decoded=decodeURIComponent(selections);}catch{}
   const selected=[...new Set(decoded.toLowerCase().split(',').filter(part=>safeSegments.has(part)))].sort();
   if(selected.length)endpoint+='?selections='+selected.join(',');
  }
  return endpoint;
 }
 function event(input){
  const at=Number(input?.at),p=Object.hasOwn(priorities,input?.priority)?input.priority:'normal';
  if(!Number.isFinite(at))return null;
  const endpoint=safeEndpoint(input.endpoint);
  const identity=String(input.script||''),usesSLINK=/^(slink\b|$)/i.test(identity)||String(input.id||'').startsWith('slink-');
  const rules=[
   ['missions',/\bmissions?\b/i],['rooms',/faction rooms/i],['officers',/faction officer/i],
   ['mugging',/mugging|mug targets|\bmug\b|\bstake\b/i],['targets',/target list|target monitor|\btgt\b/i],
   ['shared',/shared data/i],['market',/market watch|market polling/i],
   ['war',/\bwar\b|retal|chain watcher/i],['leveling',/leveling|\blvl\b|\bpoll\b/i],
   ['bounties',/bounties/i],['travel',/travel|abroad/i],['racing',/racing/i],
   ['company',/company/i],['museums',/museum/i],['events',/events|calendar|event times/i],
   ['bank',/\bbank\b/i],['merits',/merits?|award catalog/i],
   ['money',/money|property|stock benefit|stock names/i],['stocks',/\bstocks\b/i],
   ['faction',/armory|armoury|faction|\boc (?:item|member)/i],
   ['crimes',/crime|arson|cracking|shoplifting|unique windows/i],
   ['stats',/player stats|player history|personalstats/i],
   ['intelligence',/player intelligence|\bintel\b/i],
   ['qol',/page tools|weapon xp|weapon mastery|quick use|rehab|gym/i],
   ['access',/permission|access|key info|identity/i],
   ['alerts',/alerts|efficiency|city item|city stock/i]
  ];
  const matched=rules.find(([,re])=>re.test(identity))?.[0];
  const module=!usesSLINK?'external':p==='contribution'?'maintenance':matched||
    (p==='market'?'market':p==='alerts'?'alerts':/^\/(?:v2\/)?key\/info$/i.test(endpoint)?'access':'legacy');
  const operation=module==='maintenance'?(rules.find(([,re])=>re.test(identity))?.[0]||'shared contribution')+' · '+endpoint:endpoint;
  return {at,module,operation,priority:p};
 }
 function prune(history,now=Date.now()){
  return (Array.isArray(history)?history:[]).filter(e=>e?.at>now-H&&e.at<=now+5000&&(Object.hasOwn(names,e.module)||e.module==='unknown')&&typeof e.operation==='string').slice(-MAX).map(e=>({...e,module:e.module==='unknown'?'legacy':e.module,operation:e.operation.replaceAll('Unknown endpoint','Endpoint not recorded (earlier version)')}));
 }
 function snapshot(recent,history,info={},now=Date.now()){
  const local=prune(history,now),shared=(recent||[]).map(event).filter(e=>e?.at>now-G);
  const breakdown={};
  for(const e of local){
   const row=breakdown[e.module]??={minute:0,hour:0,lastAt:0,operations:{}};
   row.hour++;row.lastAt=Math.max(row.lastAt,e.at);
   const key=e.operation;
   const op=row.operations[key]??={calls:0,lastAt:0,priority:e.priority};
   op.calls++;op.lastAt=Math.max(op.lastAt,e.at);
  }
  for(const e of shared)(breakdown[e.module]??={minute:0,hour:0,lastAt:0,operations:{}}).minute++;
  return {minute:shared.length,last5:local.filter(e=>e.at>now-5*G).length,lastHour:local.length,
   limit:info.limit,constrained:info.cooldownUntil>now||shared.length>=info.limit,foreground:info.foreground||{},maintenance:info.maintenance||{},breakdown};
 }
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function html(data){
  const {breakdown={}}=data;
  const rows=Object.entries(breakdown).filter(([k])=>k!=='maintenance').sort((a,b)=>b[1].minute-a[1].minute||b[1].hour-a[1].hour);
  const lead=rows.find(([k,v])=>k!=='external'&&k!=='legacy'&&v.minute>0);
  const demand=data.foreground||{};
  const line=(k,v)=>'<tr><th scope="row">'+esc(names[k])+'</th><td>'+v.minute+'</td><td>'+v.hour+'</td></tr>';
  const details=Object.entries(breakdown).flatMap(([module,row])=>Object.entries(row.operations).map(([op,v])=>[module,op,v])).sort((a,b)=>b[2].calls-a[2].calls);
  return '<h2>Torn API usage</h2><p><strong>'+(data.constrained?'API capacity constrained':'Capacity available')+'</strong> · '+data.minute+' / '+data.limit+' in the last minute</p>'+
   '<p>SLINK on this client: '+data.last5+' requests in 5 minutes · '+data.lastHour+' in 1 hour. The rolling minute includes compatible scripts; the longer windows do not include remote Worker traffic.</p>'+
   (lead?'<p>Largest identified user module: '+esc(names[lead[0]])+' · '+lead[1].minute+'/min</p>':'')+
   '<div style="overflow:auto"><table style="width:100%"><thead><tr><th>Module</th><th>Last minute</th><th>Local hour</th></tr></thead><tbody>'+(rows.map(([k,v])=>line(k,v)).join('')||'<tr><td colspan="3">No recent requests observed.</td></tr>')+'</tbody></table></div>'+
   '<p>Forecast capacity: Alerts '+Number(demand.alerts||0)+' · Market Watch '+Number(demand.market||0)+' requests/min. These estimates change with enabled watches and activity.</p>'+
   '<details><summary>Priority and advanced diagnostics</summary><p>Alerts and Market Watch have protected capacity. Direct and normal work can proceed ahead of waiting maintenance.</p>'+
   (details.length?'<ul>'+details.map(([k,op,v])=>'<li>'+esc(names[k])+' → '+esc(op)+' · '+v.calls+' · '+esc(priorities[v.priority]||'Normal')+' · last '+esc(new Date(v.lastAt).toLocaleTimeString())+'</li>').join('')+'</ul>':'<p>No local operation history yet.</p>')+'</details>';
 }
 g.SLINK_ACCESS_USAGE=Object.freeze({event,prune,snapshot,html,endpoint:safeEndpoint});
})(globalThis);
