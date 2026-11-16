// Read-only Hustling guidance. Only uses values Torn exposes in the current page.
(function(g){
'use strict';
const audienceSelector='[class*="audienceSection___"]';
const gameSelector='.crime-option:has([class*="techniqueBar___"])';
const panelSelector='[data-slink-hustling]';
function percent(label,key){
 const match=String(label??'').match(new RegExp('\\b'+key+'\\s*:?\\s*(\\d+(?:\\.\\d+)?)\\s*%?(?![\\d.])','i'));
 const value=match?Number(match[1]):NaN;
 return Number.isFinite(value)&&value>=0&&value<=100?value:null;
}
function describe(members,{bet,hype,demo,noAudience,canWin,canLose}){
 if(noAudience)return 'Wait for a crowd before using Demo.';
 if(bet===0&&members.length&&hype)return 'Use Hype to build interest and attract bets.';
 if(bet===0&&demo)return 'Use Demo to build audience interest before taking bets.';
 if(bet<=0)return '';
 const stake='$'+bet.toLocaleString('en-US');
 const result=[stake+' in bets.'];
 if(canWin&&canLose)result.push('Win attempts to take the pot. Lose attempts to build interest at the cost of the stake if it succeeds.');
 else if(canWin)result.push('Win attempts to take the pot.');
 for(const label of ['attention','suspicion']){
  const values=members.map(member=>percent(member,label));
  if(values.length&&values.every(value=>value!==null))result.push('Peak '+label+' '+Math.max(...values)+'%.');
 }
 return result.join(' ');
}

function gameControls(row){
 const buttons=Array.from(row.querySelectorAll('button'));
 const caption=button=>button.querySelector('[class*="title___"]')?.textContent.trim()||button.textContent.trim();
 const enabled=name=>buttons.some(button=>!button.disabled&&button.getAttribute('aria-disabled')!=='true'&&
  !button.closest('[hidden],[aria-hidden="true"]')&&button.getClientRects().length&&caption(button).toLowerCase()===name);
 return {
  hype:enabled('hype'),demo:enabled('demo'),canWin:enabled('win'),canLose:enabled('lose'),
  noAudience:buttons.some(button=>button.getAttribute('aria-disabled')==='true'&&
   /no audience/i.test(button.getAttribute('aria-label')||''))
 };
}

function connect({eligible}){
 const d=g.document;
 const panels=new Map();
 let enabled=false,observer=null,frame=null;
 const active=()=>enabled&&!d.hidden&&g.SLINK_CRIME_LIFECYCLE.currentCrime()==='hustling'&&eligible();

 function stop(){
  observer?.disconnect();
  observer=null;
  if(frame!==null)g.cancelAnimationFrame(frame);
  frame=null;
  for(const panel of panels.values())panel.remove();
  panels.clear();
 }

 function render(){
  frame=null;
  if(!active())return;
  const members=Array.from(d.querySelectorAll(audienceSelector+' [class*="audienceMember___"]'),node=>node.getAttribute('aria-label'));
  const seen=new Set();
  for(const row of d.querySelectorAll(gameSelector)){
   const title=row.querySelector('.crime-option-sections > [class*="flexGrow___"][class*="title___"]');
   const raw=row.querySelector('[class*="betAmount___"]')?.textContent.trim();
   if(!title||!/^\$\s*\d[\d,]*$/.test(raw||'')||row.closest('[hidden],[aria-hidden="true"]')||!row.getClientRects().length)continue;
   const bet=Number(raw.replace(/[^\d]/g,''));
   const message=describe(members,{bet,...gameControls(row)});
   if(!message)continue;
   seen.add(title);
   let panel=panels.get(title);
   if(panel?.parentElement!==title){
    panel=d.createElement('small');
    panel.setAttribute('data-slink-hustling','');
    globalThis.SLINK_TORN_COMPONENTS?.mark(panel,'slink-page-note');
    panel.style.cssText='display:block;width:fit-content;max-width:100%;font-size:.82em;line-height:1.4;white-space:normal;overflow-wrap:anywhere;pointer-events:none';
    title.append(panel);
    panels.set(title,panel);
   }
   if(panel.textContent!==message)panel.textContent=message;
  }
  for(const [title,panel] of panels)if(!seen.has(title)){
   panel.remove();
   panels.delete(title);
  }
 }

 function schedule(){
  if(active()&&frame===null)frame=g.requestAnimationFrame(render);
 }

 function sync(){
  if(!observer&&d.body){
   const watched=audienceSelector+','+gameSelector;
   observer=new g.MutationObserver(records=>{
    if(records.some(record=>{
     const target=record.target.nodeType===1?record.target:record.target.parentElement;
     return !target?.closest(panelSelector)&&(
      target?.closest(watched)&&(
       record.type!=='childList'||[...record.addedNodes,...record.removedNodes].some(node=>!node.matches?.(panelSelector))
      )||[...record.addedNodes,...record.removedNodes].some(node=>node.matches?.(watched)||node.querySelector?.(watched))||
      record.type==='attributes'&&target?.querySelector(watched)
     );
    }))schedule();
   });
   observer.observe(d.querySelector('#mainContainer')||d.body,{
    subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','aria-label','aria-disabled','aria-hidden','disabled','hidden']
   });
  }
  schedule();
 }

 const lifecycle=g.SLINK_CRIME_LIFECYCLE.connect('hustling',{eligible:active,sync,stop});
 return {sync:lifecycle.sync,setEnabled(value){enabled=value===true;lifecycle.sync();},dispose(){enabled=false;lifecycle.dispose();}};
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
