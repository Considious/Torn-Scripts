(function(g){
  'use strict';
  const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
  const epoch=n=>positive(n)?n*(n<1e10?1000:1):0;
  const recent=(at,now,age)=>positive(at)&&at<=now&&now-at<=age;
  function timers(snapshot,now){
    const out={}, a=snapshot?.alerts, body=a?.data??a?.body, at=a?.fetchedAt??a?.at;
    if(recent(at,now,15*60000)){
      for(const key of ['medical','drug','booster']){
        const seconds=body?.cooldowns?.[key];
        if(positive(seconds)&&at+seconds*1000>now)out[key]={end:at+seconds*1000,at};
      }
    }
    if(recent(at,now,60*60000)){
      const education=epoch(body?.education?.current?.until);
      const crime=body?.organizedcrime??body?.organizedCrime;
      const oc=epoch(crime?.ready_at);
      if(education>now)out.education={end:education,at};
      if(oc>now&&!epoch(crime?.executed_at))out.oc={end:oc,at};
    }
    const war=snapshot?.war;
    const start=epoch(war?.startedAt??war?.start);
    if(start>now&&recent(war?.detectedAt,now,60*60000))out.war={end:start,at:war.detectedAt};
    const v=snapshot?.virus;
    if(recent(v?.at,now,60*60000)&&positive(v?.seconds)&&v.at+v.seconds*1000>now)out.virus={end:v.at+v.seconds*1000,at:v.at};
    return out;
  }
  g.SLINK_INLINE_STATUS=Object.freeze({timers});
  if(!g.document)return;
  const ext=g.SLINK_EXTENSION,pda=g.SLINK_PDA_PLUGIN_API;
  if(!ext&&!pda?.inlineStatus)return;
  const names={medical:'Medical cooldown',drug:'Drug cooldown',booster:'Booster cooldown',education:'Education ends',oc:'Organized crime ready',war:'Ranked war starts',virus:'Virus coding ends'};
  const el=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=value;return node;};
  const fmt=n=>new Date(n).toLocaleString();
  const elapsed=ms=>{const m=Math.max(1,Math.ceil(ms/60000)),d=Math.floor(m/1440),h=Math.floor(m%1440/60);return [d?d+'d':'',h?h+'h':'',m%60?m%60+'m':''].filter(Boolean).join(' ')||'under 1m';};
  async function extensionStatus(){
    const storage=ext.core.storage;
    const [session,alerts,company,war]=await Promise.all(['access.session.v1','adhd.runtime.v1','company.runtime.v1','war.activeWar.v1'].map(k=>storage.get(k,null)));
    if(!session?.token||session.expiresAt<=Date.now()||!session.userId)return null;
    const scope=s=>ext.core.permissions.hasScope(session,s);
    const a=alerts?.snapshot, user=Number(a?.data?.profile?.id??a?.data?.profile?.player_id??a?.data?.player_id);
    return {owner:session.userId,expiresAt:session.expiresAt,canVirus:scope('slink.adhd.alerts'),canCompany:scope('slink.qol.company'),canWar:scope('slink.war'),
      alerts:scope('slink.adhd.alerts')&&user===Number(session.userId)?a:null,
      company:scope('slink.qol.company')&&company?.snapshot?.userId===Number(session.userId)?company.snapshot:null,
      war:scope('slink.war')&&war&&Number(war.ownFactionId)===Number(session.factionId)?war:null};
  }
  let data=null, virus=null, busy=false, feedback='', running=false, dirty=false, queued=false, sidebar=null, main=null;
  const visible=()=>document.visibilityState!=='hidden';
  function pageKeys(){
    if(location.pathname==='/education.php')return ['education'];
    if(location.pathname==='/factions.php'&&new URLSearchParams(location.search).get('step')==='your')return ['oc','war'];
    if(['/joblist.php','/companies.php'].includes(location.pathname))return ['company'];
    return [];
  }
  function panel(current,target,title){
    if(current?.node.parentNode===target){if(current.heading.textContent!==title)current.heading.textContent=title;return current;}
    current?.node.remove();
    if(!target)return null;
    const node=el('details');node.className='slink-inline-status';
    node.style.cssText='padding:.4rem;margin:.35rem 0;border:1px solid currentColor;border-radius:.35rem;overflow-wrap:anywhere';
    const heading=el('summary',title), content=el('div');node.append(heading,content);target.prepend(node);
    return {node,heading,content,signature:''};
  }
  function paint(){
    if(!visible())return;
    const now=Date.now(), current=data?.expiresAt>now?data:null;
    const out=timers(current?{...current,virus:virus?.owner===current.owner?virus:null}:null,now);
    const side=document.querySelector('#sidebar');
    const keys=pageKeys(), target=keys.length?(document.querySelector('#mainContainer')||document.querySelector('.content-wrapper[role="main"]')||document.querySelector('#mainwrap')):null;
    sidebar=panel(sidebar,current&&(current.canVirus||out.medical||out.drug||out.booster)?side:null,'SLINK timers');
    const allowed=keys[0]==='company'?current?.canCompany:current?.canVirus||(keys.includes('war')&&current?.canWar);
    main=panel(main,allowed?target:null,keys[0]==='company'?'SLINK · Your company':'SLINK · Timers');
    function update(box,list,sidePanel){
      if(!box)return;
      const rows=[];
      for(const key of list){
        if(out[key])rows.push(`${names[key]}: ${elapsed(out[key].end-now)} left · ${fmt(out[key].end)} (checked ${fmt(out[key].at)})`);
      }
      if(list.includes('company')){
        const c=current?.company;
        if(c?.company?.id&&recent(c.fetchedAt,now,60*60000)){
          const employee=e=>{
            const last=epoch(e.lastAction?.timestamp);
            return [e.name,Number.isFinite(e.addictionPenalty)?'addiction penalty '+(e.addictionPenalty?-e.addictionPenalty:0):'addiction penalty unavailable',Number.isFinite(e.totalEffectiveness)?'effectiveness '+e.totalEffectiveness:'effectiveness unavailable',last&&last<=now?'last active '+elapsed(now-last)+' ago':'last active unavailable'].join(' · ');
          };
          rows.push((c.company.name||'Your company')+' · checked '+fmt(c.fetchedAt));
          if(c.self)rows.push(employee(c.self));
          if(c.director===true)for(const e of (c.employees||[]))if(e.id!==c.self?.id)rows.push(employee(e));
        }else rows.push('No recent company information. Refresh Company in SLINK.');
      }
      if(!rows.length)rows.push('No active timer in the recent SLINK data.');
      const canCheck=sidePanel&&current?.canVirus;
      const signature=JSON.stringify([rows,canCheck,busy,sidePanel?feedback:'']);
      if(signature===box.signature)return;
      box.signature=signature;
      const listNode=el('ul');for(const row of rows)listNode.append(el('li',row));
      box.content.replaceChildren(listNode);
      if(canCheck){
        const button=el('button',busy?'Checking…':'Check virus timer');button.type='button';button.disabled=busy;
        button.addEventListener('click',()=>void checkVirus());box.content.append(button);
        if(feedback){const status=el('p',feedback);status.setAttribute('role','status');box.content.append(status);}
      }
    }
    update(sidebar,['medical','drug','booster','virus'],true);update(main,keys,false);
  }
  async function checkVirus(){
    if(busy||!data?.canVirus||data.expiresAt<=Date.now()||!visible())return;
    busy=true;feedback='';const owner=data.owner;paint();
    try{
      const reply=ext?await ext.core.messaging.send('inline-status.virus'):await pda.tornJson('/v2/user/virus','SLINK virus timer');
      if(data?.owner!==owner)return;
      const value=reply?.virus;
      if(value!==null&&!Number.isFinite(value?.time_left))throw Error('Torn did not return a usable virus timer.');
      virus={owner,at:Date.now(),seconds:value?.time_left};
      if(!positive(virus.seconds))feedback='Torn reports no active virus timer.';
    }catch(e){feedback=e.message||'Could not check the virus timer.';}
    finally{busy=false;paint();}
  }
  async function refresh(){
    if(!visible())return;
    if(running){dirty=true;return;}
    running=true;
    try{
      do{dirty=false;data=ext?await extensionStatus():pda.inlineStatus();}while(dirty&&visible());
    }catch{data=null;}
    finally{running=false;paint();}
  }
  function schedule(){if(queued||!visible())return;queued=true;requestAnimationFrame(()=>{queued=false;paint();});}
  function watch(){
    if(!document.body)return;
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    void refresh();
  }
  if(ext)g.chrome?.storage?.onChanged?.addListener(changes=>{
    if(['access.session.v1','adhd.runtime.v1','company.runtime.v1','war.activeWar.v1'].some(k=>Object.hasOwn(changes,ext.core.storage.fullKey(k))))void refresh();
  });
  document.addEventListener('visibilitychange',()=>{if(visible())void refresh();});
  g.addEventListener('hashchange',schedule);
  setInterval(()=>{if(visible()){if(pda&&!ext)void refresh();else paint();}},15000);
  if(document.body)watch();else document.addEventListener('DOMContentLoaded',watch,{once:true});
})(globalThis);
