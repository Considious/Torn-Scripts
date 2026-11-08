// Safety ratings based on Emforus's Disposal guide: Torn forum thread 16367936.
(function(g){
'use strict';
const rows=new Map(Object.entries({
 'general waste':['Bury'],'broken appliance':['Sink'],'old furniture':['Burn'],'building debris':['Sink'],vehicle:['Sink'],documents:['Burn'],
 'industrial waste':['Sink'],'biological waste':['Sink'],firearm:['Sink','No method rated Safe'], 'murder weapon':['Sink'],'body part':['Dissolve'],'dead body':['Dissolve','Limited data']
}));
const advise=label=>rows.get(String(label??'').trim().replace(/\s+/g,' ').toLowerCase())||null;
const route=()=>g.location.pathname==='/page.php'&&new URLSearchParams(g.location.search).get('sid')==='crimes'&&/^#\/?disposal(?:[/?]|$)/i.test(g.location.hash);
function connect({eligible}){
 const d=g.document,selector='.disposal-root,[class*="currentCrime___"]',rowSelector='[class*="crimeOptionWrapper___"],.crime-option';
 let enabled=false,root=null,discover=null,watch=null,frame=0;
 const badges=new Map();
 const active=()=>enabled&&!d.hidden&&route()&&eligible();
 const clean=()=>{for(const badge of badges.values())badge.remove();badges.clear();};
 function stop(){discover?.disconnect();discover=null;watch?.disconnect();watch=null;root=null;if(frame)g.cancelAnimationFrame(frame);frame=0;clean();}
 function render(){
  frame=0;if(!active()||!root?.isConnected)return;
  const seen=new Set();
  for(const row of root.querySelectorAll(rowSelector)){
   const title=[...row.querySelectorAll('[class*="title___"],[class*="name___"],[class*="titleAnd"]')].find(el=>advise(el.textContent));
   if(!title)continue;
   const [method,caution]=advise(title.textContent);seen.add(row);
   let badge=badges.get(row);
   if(!badge||badge.previousElementSibling!==title){badge?.remove();badge=d.createElement('small');badge.dataset.slinkDisposalAdvice='';badge.style.cssText='display:block;position:static;pointer-events:none;overflow-wrap:anywhere;color:inherit;font-weight:600';title.after(badge);badges.set(row,badge);}
   const label=caution?method+' · '+caution:'Safest documented: '+method;
   if(badge.textContent!==label)badge.textContent=label;
  }
  for(const [row,badge] of badges)if(!seen.has(row)){badge.remove();badges.delete(row);}
 }
 function schedule(){if(active()&&!frame)frame=g.requestAnimationFrame(render);}
 function mount(){
  const next=d.querySelector('.disposal-root')||d.querySelector(selector);if(next===root)return;
  watch?.disconnect();clean();root=next;if(!root)return;
  watch=new g.MutationObserver(records=>{if(records.some(r=>!(r.target.nodeType===1?r.target:r.target.parentElement)?.closest('[data-slink-disposal-advice]')&&!(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].every(n=>n.matches?.('[data-slink-disposal-advice]')))))schedule();});
  watch.observe(root,{childList:true,subtree:true,characterData:true});schedule();
 }
 function sync(){
  if(!active()){stop();return;}
  if(!discover&&d.body){discover=new g.MutationObserver(records=>{if(!root?.isConnected||records.some(r=>[...r.addedNodes].some(n=>n.matches?.(selector)||n.querySelector?.(selector))))mount();});discover.observe(d.querySelector('#mainContainer')||d.body,{childList:true,subtree:true});}
  mount();schedule();
 }
 const events=[[g,'hashchange',sync],[g,'popstate',sync],[g,'focus',sync],[g,'blur',sync],[g,'pageshow',sync],[g,'pagehide',stop],[d,'visibilitychange',sync]];
 for(const [node,event,fn] of events)node.addEventListener(event,fn);
 return {sync,setEnabled(value){enabled=value===true;sync();},dispose(){enabled=false;stop();for(const [node,event,fn] of events)node.removeEventListener(event,fn);}};
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
