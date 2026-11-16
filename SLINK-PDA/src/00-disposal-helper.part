// Safety ratings based on Emforus's Disposal guide: Torn forum thread 16367936.
(function(g){
'use strict';
const rows=new Map(Object.entries({
 'general waste':['Bury'],'broken appliance':['Sink'],'old furniture':['Burn'],'building debris':['Sink'],vehicle:['Sink'],documents:['Burn'],
 'industrial waste':['Sink'],'biological waste':['Sink'],firearm:['Sink','No method rated Safe'], 'murder weapon':['Sink'],'body part':['Dissolve'],'dead body':['Dissolve','Limited data']
}));
const advise=label=>rows.get(String(label??'').trim().replace(/\s+/g,' ').toLowerCase())||null;
const adviceSelector='[data-slink-disposal-advice]';
const currentTitles='.crime-option-sections > [class*="crimeOptionSection___"][class*="flexGrow___"]';
const legacyTitles=':is([class*="crimeOptionWrapper___"],.crime-option) :is([class*="title___"],[class*="name___"],[class*="titleAnd"])';

function jobName(title){
 return Array.from(title.childNodes)
  .filter(node=>!node.matches?.(adviceSelector))
  .map(node=>node.textContent).join('');
}

function connect({eligible}){
 const d=g.document;
 const selector=['.disposal-root','[class*="currentCrime___"]','.crimes-app'];
 let enabled=false,root=null,watch=null,frame=null;
 const badges=new Map();
 const active=()=>enabled&&!d.hidden&&g.SLINK_CRIME_LIFECYCLE.currentCrime()==='disposal'&&eligible();

 function clean(){
  for(const badge of badges.values())badge.remove();
  badges.clear();
 }

 function stop(){
  watch?.disconnect();
  watch=null;
  root=null;
  if(frame!==null)g.cancelAnimationFrame(frame);
  frame=null;
  clean();
 }

 function render(){
  frame=null;
  if(!active()||!root?.isConnected)return;
  const seen=new Set();
  const jobs=new Set();
  for(const title of root.querySelectorAll(currentTitles+','+legacyTitles)){
   const result=advise(jobName(title));
   if(!result||title.closest('[hidden],[aria-hidden="true"]')||!title.getClientRects().length)continue;
   const job=title.closest('.crime-option-sections')||title.closest('.crime-option,[class*="crimeOptionWrapper___"]');
   if(!job||jobs.has(job))continue;
   jobs.add(job);
   seen.add(title);
   const [method,caution]=result;
   let badge=badges.get(title);
   if(badge?.parentElement!==title){
    badge=d.createElement('small');
    badge.dataset.slinkDisposalAdvice='';
    globalThis.SLINK_TORN_COMPONENTS?.mark(badge,'slink-page-note');
    badge.style.cssText='display:block;width:fit-content;max-width:100%;pointer-events:none;overflow-wrap:anywhere';
    title.append(badge);
    badges.set(title,badge);
   }
   const label=caution?method+' · '+caution:'Safest documented: '+method;
   if(badge.textContent!==label)badge.textContent=label;
  }
  for(const [title,badge] of badges)if(!seen.has(title)){
   badge.remove();
   badges.delete(title);
  }
 }

 function schedule(){
  if(active()&&frame===null)frame=g.requestAnimationFrame(render);
 }

 function sync(next){
  if(next!==root){
   stop();
   root=next;
   if(root){
    watch=new g.MutationObserver(records=>{
     if(records.some(record=>{
      const target=record.target.nodeType===1?record.target:record.target.parentElement;
      return !target?.closest(adviceSelector)&&(record.type!=='childList'||
       [...record.addedNodes,...record.removedNodes].some(node=>!node.matches?.(adviceSelector)));
     }))schedule();
    });
    watch.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
   }
  }
  schedule();
 }

 const lifecycle=g.SLINK_CRIME_LIFECYCLE.connect('disposal',{eligible:active,sync,stop,selector});
 return {sync:lifecycle.sync,setEnabled(value){enabled=value===true;lifecycle.sync();},dispose(){enabled=false;lifecycle.dispose();}};
}
g.SLINK_DISPOSAL=Object.freeze({advise,connect});
const S=g.SLINK_EXTENSION;if(!S?.core?.pageActivity||!g.document||new URLSearchParams(g.location.search).get('sid')!=='crimes')return;
const activity=S.core.pageActivity,key='crimes.disposal.enabled',session='access.session.v1';let revision=0,allowed=false,expiry=0;
const helper=connect({eligible:()=>allowed&&expiry>Date.now()&&activity.eligible()});
async function refresh(){
 const rev=++revision;
 try{const [enabled,access]=await Promise.all([S.core.storage.get(key,false),S.core.storage.get(session,null)]);if(rev!==revision)return;allowed=enabled===true&&S.core.permissions.hasScope(access||{},'slink.adhd.alerts');expiry=Number(access?.expiresAt)||0;helper.setEnabled(allowed);}
 catch{if(rev===revision){allowed=false;helper.setEnabled(false);}}
}
activity.subscribe(()=>{helper.sync();if(activity.eligible())void refresh();});
g.chrome?.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&[key,session].some(k=>Object.hasOwn(changes,S.STORAGE_PREFIX+k)))void refresh();});
void refresh();
})(globalThis);
