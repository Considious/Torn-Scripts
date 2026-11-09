// Scamming guidance uses Torn's visible persuasion bar; it never selects or submits a reply.
(function(g){
'use strict';
const container='[class*="persuasionBarContainer___"]';
const liveBar='[class*="persuasionBar___"]:not([aria-hidden="true"]):not([class*="fadingBar___"])';
const rangeSelector='[class*="pipRange___"]';
const mark='data-slink-scamming';
const rowSelector='.virtual-item,[class*="virtualItem___"]';
const route=()=>g.location.pathname==='/page.php'&&new URLSearchParams(g.location.search).get('sid')==='crimes'&&/^#\/?scamming(?:[/?]|$)/i.test(g.location.hash);
function numberClass(node,prefix){
 const match=(node?.getAttribute('class')||'').match(new RegExp('(?:^|\\s)'+prefix+'-(\\d+)___'));
 return match?Number(match[1]):null;
}
function span(node,prefix){
 const start=numberClass(node,prefix),size=numberClass(node,'size');
 return Number.isSafeInteger(start)&&Number.isSafeInteger(size)&&size>0&&start+size<=50?[start+1,start+size]:null;
}
function describe(bar,row){
 const zones=[...bar.querySelectorAll('[class*="zone___"][aria-label]')];
 const position=zones.map(n=>n.getAttribute('aria-label').match(/^Current state .+ at (\d+)$/i)).find(Boolean);
 const parts=[];
 if(position&&+position[1]>=1&&+position[1]<=50)parts.push('Current tile: '+position[1]+'.');
 const buttons=[...row.querySelectorAll('button.response-type-button[aria-label]')];
 const enabled=n=>n.getAttribute('aria-disabled')==='false'&&!n.disabled;
 if(buttons.some(n=>/^capitalize$/i.test(n.getAttribute('aria-label'))&&enabled(n)))parts.push('Capitalize is available.');
 const selected=buttons.find(n=>n.getAttribute('aria-pressed')==='true'&&enabled(n)&&!/^capitalize$/i.test(n.getAttribute('aria-label')));
 const range=bar.querySelector(rangeSelector);
 const landing=selected&&range&&!range.hidden&&range.getAttribute('aria-hidden')!=='true'&&!/\bhidden___/.test(range.getAttribute('class')||'')?span(range,'from'):null;
 if(landing){
  parts.push('Possible landing tiles: '+(landing[0]===landing[1]?landing[0]:landing.join('–'))+'.');
  const failure=zones.filter(n=>/^Failure\b/i.test(n.getAttribute('aria-label'))).map(n=>span(n,'start')).filter(Boolean);
  if(failure.some(([first,last])=>first<=landing[1]&&last>=landing[0]))parts.push('Warning: this range includes a failure tile.');
 }else if(selected)parts.push('Torn is not showing a landing range for this response.');
 return parts.join(' ');
}
function connect({eligible}){
 const d=g.document,panels=new Map();let enabled=false,observer=null,frame=0;
 const active=()=>enabled&&!d.hidden&&route()&&eligible();
 function stop(){observer?.disconnect();observer=null;if(frame)g.cancelAnimationFrame(frame);frame=0;for(const panel of panels.values())panel.remove();panels.clear();}
 function render(){
  frame=0;if(!active()){stop();return;}
  const seen=new Set();
  for(const node of d.querySelectorAll(container)){
   const bar=node.querySelector(liveBar),row=node.closest(rowSelector);
   if(!bar||!row)continue;
   const message=describe(bar,row);if(!message)continue;
   seen.add(node);let panel=panels.get(node);
   if(!panel?.isConnected){
    panel=d.createElement('small');panel.setAttribute(mark,'');panel.setAttribute('role','status');
    panel.style.cssText='display:block;margin:3px 0;line-height:1.35;overflow-wrap:anywhere';
    node.after(panel);panels.set(node,panel);
   }
   if(panel.textContent!==message)panel.textContent=message;
  }
  for(const [node,panel] of panels)if(!seen.has(node)){panel.remove();panels.delete(node);}
 }
 function schedule(){if(!frame)frame=g.requestAnimationFrame(render);}
 function sync(){
  if(!active()){stop();return;}
  if(!observer&&d.body){
   const watched=container+',.response-type-button';
   observer=new g.MutationObserver(records=>{
    if(records.some(r=>{const node=r.target.nodeType===1?r.target:r.target.parentElement;return !node?.closest('['+mark+']')&&(node?.closest(watched)||[...r.addedNodes,...r.removedNodes].some(n=>n.matches?.(watched)||n.querySelector?.(watched)));}))schedule();
   });
   observer.observe(d.querySelector('#mainContainer')||d.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed','aria-disabled','aria-label','aria-hidden','disabled','hidden']});
  }
  schedule();
 }
 const events=[[g,'hashchange',sync],[g,'popstate',sync],[g,'focus',sync],[g,'pageshow',sync],[g,'pagehide',stop],[d,'visibilitychange',sync]];
 for(const [node,event,fn] of events)node.addEventListener(event,fn);
 return {sync,setEnabled(value){enabled=value===true;sync();},dispose(){enabled=false;stop();for(const [node,event,fn] of events)node.removeEventListener(event,fn);}};
}
if(typeof module==='object'&&module.exports){module.exports={describe,span};return;}
g.SLINK_SCAMMING=Object.freeze({connect});
const S=g.SLINK_EXTENSION;
if(!S?.core?.pageActivity||!g.document||new URLSearchParams(g.location.search).get('sid')!=='crimes')return;
const activity=S.core.pageActivity,key='crimes.scamming.enabled',session='access.session.v1';let revision=0,expiry=0;
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
