// Read-only Hustling guidance. Only uses values Torn exposes in the current page.
(function(g){
'use strict';
const route=()=>g.location.pathname==='/page.php'&&new URLSearchParams(g.location.search).get('sid')==='crimes'&&/^#\/?hustling(?:[/?]|$)/i.test(g.location.hash);
const audienceSelector='[class*="audienceSection___"]';
const gameSelector='.crime-option:has([class*="techniqueBar___"])';
const panelSelector='[data-slink-hustling]';
function percent(label,key){
 const match=String(label??'').match(new RegExp('\\b'+key+'\\s+(\\d+(?:\\.\\d+)?)\\s*%?(?![\\d.])','i'));
 const value=match?Number(match[1]):NaN;
 return Number.isFinite(value)&&value>=0&&value<=100?value:null;
}
function describe(members,games){
 const known=members.map(label=>[percent(label,'attention'),percent(label,'suspicion')]);
 const attention=known.map(x=>x[0]).filter(x=>x!==null), suspicion=known.map(x=>x[1]).filter(x=>x!==null);
 const parts=[members.length+' in audience'];
 if(members.length&&attention.length===members.length)parts.push('Peak attention '+Math.max(...attention)+'%');
 if(members.length&&suspicion.length===members.length)parts.push('Peak suspicion '+Math.max(...suspicion)+'%');
 return [parts.join(' · '),...games.map(({name,bet,hype})=>name+': '+(bet>0?'$'+bet.toLocaleString('en-US')+' in bets · Win attempts to take the pot; Lose gives it up to build interest.':hype&&members.length?'No bets · Hype to build interest.':'No bets.'))];
}
function connect({eligible}){
 const d=g.document;let enabled=false,observer=null,frame=0,panel=null;
 const active=()=>enabled&&!d.hidden&&route()&&eligible();
 function stop(){observer?.disconnect();observer=null;if(frame)g.cancelAnimationFrame(frame);frame=0;panel?.remove();panel=null;}
 function render(){
  frame=0;if(!active()){stop();return;}
  const audience=d.querySelector(audienceSelector);
  const header=d.querySelector('.crimes-app-header');
  if(!audience||!header){panel?.remove();panel=null;return;}
  const members=[...audience.querySelectorAll('[class*="audienceMember___"]')].map(n=>n.getAttribute('aria-label'));
  const games=[...d.querySelectorAll(gameSelector)].flatMap(row=>{
   const name=row.querySelector('[class*="flexGrow___"][class*="title___"]')?.textContent.trim();
   const raw=row.querySelector('[class*="betAmount___"]')?.textContent.trim();
   if(!name||!/^\$\s*\d[\d,]*$/.test(raw??''))return [];
   const hype=[...row.querySelectorAll('button [class*="title___"]')].some(n=>/^hype$/i.test(n.textContent.trim()));
   return [{name,bet:Number(raw.replace(/[^\d]/g,'')),hype}];
  });
  if(!panel?.isConnected){
   panel=d.createElement('aside');panel.setAttribute('data-slink-hustling','');panel.setAttribute('aria-label','Hustling helper');
   panel.style.cssText='padding:6px 8px;margin:4px 0;font-size:12px;line-height:1.4;white-space:pre-line;overflow-wrap:anywhere';
   header.after(panel);
  }
  const message=describe(members,games).join('\n');
  if(panel.textContent!==message)panel.textContent=message;
 }
 function schedule(){if(!frame)frame=g.requestAnimationFrame(render);}
 function sync(){
  if(!active()){stop();return;}
  if(!observer&&d.body){
   const watched=audienceSelector+','+gameSelector+',.crimes-app-header';
   observer=new g.MutationObserver(records=>{
    if(records.some(r=>(r.target.nodeType===1?r.target:r.target.parentElement)?.closest(watched)||[...r.addedNodes,...r.removedNodes].some(n=>!n.matches?.(panelSelector)&&(n.matches?.(watched)||n.querySelector?.(watched)))))schedule();
   });
   observer.observe(d.querySelector('#mainContainer')||d.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label']});
  }
  schedule();
 }
 const events=[[g,'hashchange',sync],[g,'popstate',sync],[g,'focus',sync],[g,'pageshow',sync],[g,'pagehide',stop],[d,'visibilitychange',sync]];
 for(const [node,event,fn] of events)node.addEventListener(event,fn);
 return {sync,setEnabled(value){enabled=value===true;sync();},dispose(){enabled=false;stop();for(const [node,event,fn] of events)node.removeEventListener(event,fn);}};
}
if(typeof module==='object'&&module.exports){module.exports={describe,percent};return;}
g.SLINK_HUSTLING=Object.freeze({connect});
const S=g.SLINK_EXTENSION;
if(!S?.core?.pageActivity||!g.document||new URLSearchParams(g.location.search).get('sid')!=='crimes')return;
const activity=S.core.pageActivity,key='crimes.hustling.enabled',session='access.session.v1';let revision=0,expiry=0;
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
