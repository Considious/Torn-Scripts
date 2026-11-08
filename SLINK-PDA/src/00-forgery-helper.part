// Project ratings adapted from Emforus’s Torn Forgery guide (thread 16388086).
(function(g){
'use strict';
const ratings=new Map(Object.entries({
  "driver's license":'Lower risk','parking permit':'Lower risk','prescription':'Lower risk',
  'concert ticket':'Moderate','diploma':'Moderate',
  'license plate':'Risky','skeleton key':'Risky','police badge':'Risky','atm key':'Risky',
  'birth certificate':'High risk','travel visa':'High risk','id badge':'High risk','bank check':'High risk','passport':'High risk'
}));
const rate=name=>ratings.get(String(name??'').trim().toLowerCase())||'Unrated';
const route=()=>g.location.pathname==='/page.php'&&new URLSearchParams(g.location.search).get('sid')==='crimes'&&/^#\/?forgery(?:[/?]|$)/i.test(g.location.hash);
const picker='.crime-option:has(.crime-image img[srcset*="/11-forgery/forgery_new_project"])';
const option='[data-testid="dropdown-list"] [role="option"]';
const mark='data-slink-forgery-risk';
const css='['+mark+']::after{content:attr('+mark+');display:inline-block;margin-inline-start:.35em;font-size:10px;font-weight:600;white-space:nowrap;opacity:.85;pointer-events:none}';
function connect({eligible}){
 const d=g.document;let enabled=false,observer=null,frame=0,style=null,marked=new Set();
 const active=()=>enabled&&!d.hidden&&route()&&eligible();
 function stop(){
  observer?.disconnect();observer=null;
  if(frame)g.cancelAnimationFrame(frame);frame=0;
  for(const node of marked)node.removeAttribute(mark);
  marked.clear();style?.remove();style=null;
 }
 function render(){
  frame=0;if(!active()){stop();return;}
  const next=new Set();
  for(const row of d.querySelectorAll(picker))for(const entry of row.querySelectorAll(option)){
   const name=entry.querySelector('[class*="optionWithLevelRequirement___"] [class*="name___"]');
   if(!name?.textContent.trim())continue;
   next.add(name);
   const risk=rate(name.textContent);
   if(name.getAttribute(mark)!==risk)name.setAttribute(mark,risk);
  }
  for(const node of marked)if(!next.has(node))node.removeAttribute(mark);
  marked=next;
 }
 function schedule(){if(!frame)frame=g.requestAnimationFrame(render);}
 function sync(){
  if(!active()){stop();return;}
  if(!observer&&d.body){
   style=d.createElement('style');style.textContent=css;(d.head||d.body).append(style);
   observer=new g.MutationObserver(records=>{
    if(records.some(r=>(r.target.nodeType===1?r.target:r.target.parentElement)?.closest(picker)||[...r.addedNodes,...r.removedNodes].some(n=>n.matches?.(picker)||n.querySelector?.(picker))))schedule();
   });
   observer.observe(d.querySelector('#mainContainer')||d.body,{subtree:true,childList:true,characterData:true});
  }
  schedule();
 }
 const events=[[g,'hashchange',sync],[g,'popstate',sync],[g,'focus',sync],[g,'pageshow',sync],[g,'pagehide',stop],[d,'visibilitychange',sync]];
 for(const [node,event,fn] of events)node.addEventListener(event,fn);
 return {sync,setEnabled(value){enabled=value===true;sync();},dispose(){enabled=false;stop();for(const [node,event,fn] of events)node.removeEventListener(event,fn);}};
}
if(typeof module==='object'&&module.exports){module.exports={rate};return;}
g.SLINK_FORGERY=Object.freeze({rate,connect});
const S=g.SLINK_EXTENSION;
if(!S?.core?.pageActivity||!g.document||new URLSearchParams(g.location.search).get('sid')!=='crimes')return;
const activity=S.core.pageActivity,key='crimes.forgery.enabled',session='access.session.v1';let revision=0,expiry=0;
const helper=connect({eligible:()=>expiry>Date.now()&&activity.eligible()});
async function refresh(){
 const rev=++revision;
 try{
  const [enabled,access]=await Promise.all([S.core.storage.get(key,false),S.core.storage.get(session,null)]);
  if(rev!==revision)return;
  expiry=Number(access?.expiresAt)||0;helper.setEnabled(enabled===true&&S.core.permissions.hasScope(access||{},'slink.adhd.alerts'));
 }catch{if(rev===revision)helper.setEnabled(false);}
}
activity.subscribe(()=>{helper.sync();if(activity.eligible())void refresh();});
g.chrome?.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&[key,session].some(k=>Object.hasOwn(changes,S.STORAGE_PREFIX+k)))void refresh();});
void refresh();
})(globalThis);
