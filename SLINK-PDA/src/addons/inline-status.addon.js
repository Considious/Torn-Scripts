(function(g){
 'use strict';
 const minute=60000,day=86400000,companyKey='inline-status.companyDaily.v1';
 const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
 const epoch=n=>positive(n)?n*(n<1e10?1000:1):0;
 const recent=(at,now,age)=>positive(at)&&at<=now&&now-at<=age;
 const dailyWindow=now=>{const d=new Date(now);return d.getUTCHours()===18&&d.getUTCMinutes()===15;};
 const elapsed=ms=>{const m=Math.max(0,Math.floor(ms/minute));return [m>=1440?Math.floor(m/1440)+'d':'',m>=60?Math.floor(m%1440/60)+'h':'',m%60+'m'].filter(Boolean).join(' ');};
 function timers(snapshot,now){
  const out={},a=snapshot?.alerts,body=a?.data??a?.body,at=a?.fetchedAt??a?.at;
  const crime=body?.organizedCrime??body?.organizedcrime;
  const oc=epoch(crime?.ready_at),expired=epoch(crime?.expired_at);
  if(recent(at,now,60*minute)&&oc&&!epoch(crime?.executed_at)&&(!expired||expired>now))out.oc={end:oc};
  const war=snapshot?.war,start=epoch(war?.startedAt??war?.start);
  if(start>now&&recent(war?.detectedAt,now,60*minute))out.war={end:start};
  const v=snapshot?.virus,end=epoch(v?.until);
  if(end>now&&recent(v?.at,now,60*minute))out.virus={end};
  return out;
 }
 g.SLINK_INLINE_STATUS=Object.freeze({timers,elapsed,dailyWindow});
 if(!g.document)return;
 const ext=g.SLINK_EXTENSION,pda=g.SLINK_PDA_PLUGIN_API;
 if(!ext&&!pda?.inlineStatus)return;
 const make=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
  async function extensionStatus(){
    const storage=ext.core.storage;
    const [session,alerts,company,war,companyDaily]=await Promise.all(['access.session.v1','adhd.runtime.v1','company.runtime.v1','war.activeWar.v1',companyKey].map(k=>storage.get(k,null)));
    if(!session?.token||session.expiresAt<=Date.now()||!session.userId)return null;
    const preferences=await storage.get('qol.page-tools.v1:'+session.userId,{});
    const scope=s=>ext.core.permissions.hasScope(session,s);
    const a=alerts?.snapshot, user=Number(a?.data?.profile?.id??a?.data?.profile?.player_id??a?.data?.player_id);
    return {timersEnabled:preferences?.enabled!==false&&preferences?.timers!==false,companyDaily,owner:session.userId,expiresAt:session.expiresAt,canVirus:scope('slink.adhd.alerts'),canCompany:scope('slink.qol.company'),canWar:scope('slink.war'),
      alerts:scope('slink.adhd.alerts')&&user===Number(session.userId)?a:null,
      company:scope('slink.qol.company')&&company?.snapshot?.userId===Number(session.userId)?company.snapshot:null,
      war:scope('slink.war')&&war&&Number(war.ownFactionId)===Number(session.factionId)?war:null};
  }

 let data=null,virus=null,company=null,sidebar=null,running=false,dirty=false,queued=false,checking=false,lastVirusAttempt=0,companyAttempt='';
 const visible=()=>document.visibilityState!=='hidden';
 function paint(){
  if(!visible())return;
  const now=Date.now(),current=data?.expiresAt>now&&data.timersEnabled!==false?data:null;
  const hosts=[...document.querySelectorAll('[class^="userInformation___"],[class*=" userInformation___"]')];
  const target=hosts.find(n=>n.getClientRects().length);
  if(!target||!current){sidebar?.remove();sidebar=null;return;}
  if(!sidebar?.isConnected||sidebar.parentNode!==target){
   sidebar?.remove();sidebar=make('section');sidebar.dataset.slinkSidebarTimers='';sidebar.setAttribute('aria-label','SLINK sidebar information');
   sidebar.style.cssText='font-size:12px;line-height:1.4;margin-block:5px;color:inherit';target.append(sidebar);
  }
  const out=timers({...current,virus:virus?.owner===String(current.owner)?virus:null},now),rows=[];
  for(const [key,title,href] of [['oc','OC','/factions.php?step=your#/tab=crimes'],['war','RW','/factions.php?step=your#/tab=war'],['company','Company Addiction','/companies.php#/option=employees'],['virus','Virus','/computer.php']]){
   let value;
   if(key==='company'){
    if(!current.canCompany)continue;
    const saved=company?.owner===String(current.owner)?company:current.companyDaily;
    const penalty=saved?.owner===String(current.owner)?saved.penalty:current.company?.self?.addictionPenalty;
    if(typeof penalty==='number'&&Number.isFinite(penalty))value=String(penalty?-Math.abs(penalty):0);
   }else if(out[key])value=elapsed(out[key].end-now);
   if(value!=null)rows.push([title,value,href]);
  }
  const signature=JSON.stringify(rows);if(sidebar.dataset.signature===signature)return;sidebar.dataset.signature=signature;
  sidebar.replaceChildren(...rows.map(([title,value,href])=>{const row=make('div'),link=make('a',title+': ');link.href=href;link.style.cssText='color:inherit;text-decoration:none';row.append(link,make('span',value));return row;}));sidebar.hidden=!rows.length;
 }
 async function checkData(){
  if(checking||!visible()||!data||data.timersEnabled===false||data.expiresAt<=Date.now())return;
  checking=true;const current=data,owner=String(current.owner),now=Date.now();
  try{
   if(pda?.moduleMonitoringEnabled?.('alerts')!==false&&current.canVirus&&now-lastVirusAttempt>=15*minute){
    lastVirusAttempt=now;
    try{
     const cache=pda?.cache('sidebarVirus',{});
     const cached=cache?.owner===owner&&recent(cache.at,now,15*minute);
     const reply=cached?cache:ext?await ext.core.messaging.send('inline-status.virus'):await pda.tornJson('/v2/user/virus','SLINK virus timer');
     const value=cached?reply.until:reply?.virus?.until;
     if(value!=null&&!positive(value))throw Error('Invalid virus timestamp');
     if(String(data?.owner)===owner){virus={owner,at:cached?cache.at:Date.now(),until:value??null};if(cache&&!cached){Object.assign(cache,virus);pda.persist?.();}}
    }catch{}
   }
   const date=new Date(now).toISOString().slice(0,10),attempt=owner+':'+date;
   if(pda?.moduleMonitoringEnabled?.('company')!==false&&current.canCompany&&dailyWindow(now)&&companyAttempt!==attempt){
    companyAttempt=attempt;
    try{
     if(ext)company=await ext.core.messaging.send('inline-status.company');
     else{
      const cache=pda.cache('sidebarCompanyDaily',{});
      if(cache.owner!==owner||cache.date!==date){
       Object.assign(cache,{owner,date,at:now,penalty:null});pda.persist?.();
       const result=await pda.tornJson('/v2/company/employees','SLINK Company sidebar');
       const self=(Array.isArray(result.employees)?result.employees:Object.values(result.employees||{})).find(e=>Number(e.id??e.user_id)===Number(owner));
       const penalty=self?.effectiveness?.addiction;
       if(String(data?.owner)===owner){cache.penalty=typeof penalty==='number'&&Number.isFinite(penalty)?Math.min(0,penalty):null;pda.persist?.();}
      }
      company={...cache};
     }
    }catch{}
   }
  }finally{checking=false;paint();}
 }
 async function refresh(){
  if(!visible())return;
  if(running){dirty=true;return;}running=true;
  try{do{dirty=false;const next=ext?await extensionStatus():pda.inlineStatus();if(String(next?.owner)!==String(data?.owner)){virus=null;company=null;lastVirusAttempt=0;companyAttempt='';}data=next;
   if(pda&&data){const c=pda.cache('sidebarCompanyDaily',{});data.companyDaily=c;const settings=pda.settings?.('pageTools',{accounts:{}})?.accounts?.[String(data.owner)];data.timersEnabled=settings?.enabled!==false&&settings?.timers!==false;}
   if(data?.canCompany){
    const owner=String(data.owner),saved=data.companyDaily;
    if(saved?.owner===owner)company=saved;
    else if(typeof data.company?.self?.addictionPenalty==='number'){
     company={owner,date:'',at:Date.now(),penalty:data.company.self.addictionPenalty};
     if(ext)await ext.core.storage.set(companyKey,company);else{Object.assign(pda.cache('sidebarCompanyDaily',{}),company);pda.persist?.();}
    }
   }
  }while(dirty&&visible());}catch{data=null;}
  finally{running=false;paint();void checkData();}
 }
 function schedule(){if(queued||!visible())return;queued=true;requestAnimationFrame(()=>{queued=false;paint();});}
 function start(){
  new MutationObserver(records=>{if(sidebar&&!sidebar.isConnected||records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('[class*="userInformation___"]')||n.querySelector('[class*="userInformation___"]')))))schedule();}).observe(document.body,{childList:true,subtree:true});
  void refresh();
 }
 if(ext)g.chrome?.storage?.onChanged?.addListener(changes=>{if(['access.session.v1','adhd.runtime.v1','company.runtime.v1','war.activeWar.v1',companyKey].some(k=>Object.hasOwn(changes,ext.core.storage.fullKey(k)))||data&&Object.hasOwn(changes,ext.core.storage.fullKey('qol.page-tools.v1:'+data.owner)))void refresh();});
 document.addEventListener('visibilitychange',()=>{if(visible())void refresh();});g.addEventListener('hashchange',()=>void refresh());g.addEventListener('slink:qol-settings',()=>void refresh());
 setInterval(()=>void refresh(),15000);
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
