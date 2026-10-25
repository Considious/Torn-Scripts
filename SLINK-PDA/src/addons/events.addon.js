(function installEventsPda(global) {
'use strict';
const api = global.SLINK_PDA_PLUGIN_API;
if (!api) throw new Error('SLINK PDA plugin API is unavailable.');
const ID = 'events';
const SCOPE = 'slink.qol.events';
const CACHE_MS = 6 * 60 * 60_000;
const CALENDAR_URL = 'https://www.torn.com/calendar.php';
const GUIDE_URL = 'https://www.torn.com/forums.php?p=threads&f=61&t=16192843&b=0&a=0';
const OVERLAY_ID = 'slink-pda-halloween-upgrade-guide';
const STYLE_ID = 'slink-pda-halloween-upgrade-guide-style';
const HALLOWEEN_GUIDE_EVENT=Object.freeze({id:'guide:halloween',name:'Halloween',startAt:0,endAt:0,description:'Preparation guide available year-round.',personalized:false,state:'unscheduled',guideOnly:true});
const BASKET_RANKS = Object.freeze(['Spooky','Creepy','Freaky','Frightful','Haunting','Shocking','Terrifying','Horrifying','Petrifying','Nightmarish','Apocalyptic']);
const UPGRADE_ORDER = Object.freeze([
{step:1,upgradeId:1,name:'I See Dead People',cost:3},
{step:2,upgradeId:2,name:"Here's Johnny",cost:5},
{step:3,upgradeId:3,name:'Doubler',cost:25},
{step:4,upgradeId:4,name:'Tripler',cost:50},
{step:5,upgradeId:5,name:'Quadrupler',cost:75},
{step:6,upgradeId:13,name:'Cat in Hell',cost:13},
{step:7,upgradeId:6,name:'Quintupler',cost:100},
{step:8,upgradeId:23,name:'Shadow of Doubt',cost:1000,note:'Awards 1,100 treats and advances basket progress.'},
{step:9,upgradeId:19,name:'Multipack',cost:180},
{step:10,upgradeId:20,name:'Deal with the Devil',cost:320},
{step:11,upgradeId:18,name:'Dark Power',cost:285},
{step:12,upgradeId:15,name:'Freebie',cost:120},
{step:13,upgradeId:9,name:'Bloody Mary',cost:15},
{step:14,upgradeId:10,name:'Nice Chianti',cost:30},
{step:15,upgradeId:11,name:'Nightcrawler',cost:45},
{step:16,upgradeId:12,name:"It's Alive",cost:90},
{step:17,upgradeId:17,name:'Cashback',cost:230},
{step:18,upgradeId:7,name:'Candyman',cost:5},
{step:19,upgradeId:8,name:'Sweet Release',cost:10},
{step:20,upgradeId:16,name:'Cold Sweat',cost:170,optional:true,note:'The guide marks this final step as optional.'}
].map(entry=>Object.freeze(entry)));
const SKIPPED = Object.freeze(['Save Your Tears',"Mortal Coil (except M'aol path)","Inflation (except M'aol path)","Summon Him (except M'aol path)"]);
const RELICS = Object.freeze([
{name:"M'aol Tentacle",effect:'Doubles energy and nerve capacity and regeneration.'},
{name:'Nol Cloachra',effect:'Consumables can be used without being consumed.'},
{name:'Ladso Eye',effect:'Allows books to be read repeatedly.'},
{name:'Asmol Knuckle',effect:'Provides a passive +100% damage bonus.'},
{name:'Sylo Tooth',effect:'Provides +25% additive critical-hit chance.'},
{name:'Dyno Sac',effect:'Removes negative drug effects, including addiction.'}
]);
let busy=false,error='',observer=null,scanTimer=null,lastSignature='';

function rows(value){if(Array.isArray(value))return value.map((entry,index)=>({key:String(index),value:entry}));if(value&&typeof value==='object')return Object.entries(value).map(([key,entry])=>({key,value:entry}));return[]}
function timestampMs(value){if(value===null||value===undefined||value==='')return 0;const numeric=Number(value);if(Number.isFinite(numeric)&&numeric>0)return numeric<10000000000?Math.trunc(numeric*1000):Math.trunc(numeric);const parsed=Date.parse(String(value));return Number.isFinite(parsed)?parsed:0}
function plainText(value){return String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()}
function eventRows(payload={}){const source=payload.calendar??payload.events??payload.competitions??payload;return rows(source).map(({key,value})=>{if(value===null||value===undefined)return null;const item=typeof value==='object'?value:{start:value},name=plainText(item.name??item.title??item.event??item.description??key);if(!name)return null;return{id:String(item.id??item.event_id??item.slug??key??name).trim()||name,name,startAt:timestampMs(item.start??item.start_time??item.starts_at??item.from??item.timestamp??item.time),endAt:timestampMs(item.end??item.end_time??item.ends_at??item.to),description:plainText(item.description??item.details??item.text??''),personalized:false}}).filter(Boolean)}
function identity(event){return String(event.id||event.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'')}
function mergeCalendars(tornPayload={},userPayload={},now=Date.now()){const globalEvents=eventRows(tornPayload),personalEvents=eventRows(userPayload),personal=new Map;for(const event of personalEvents){personal.set(identity(event),event);personal.set(event.name.toLowerCase(),event)}const source=globalEvents.length?globalEvents:personalEvents;const events=source.map(event=>{const override=personal.get(identity(event))||personal.get(event.name.toLowerCase()),startAt=override?.startAt||event.startAt,endAt=override?.endAt||event.endAt,state=startAt&&startAt<=now&&(!endAt||endAt>now)?'active':startAt>now?'upcoming':endAt&&endAt<=now?'past':'unscheduled';return{...event,startAt,endAt,description:event.description||override?.description||'',personalized:Boolean(override?.startAt),state}}).sort((left,right)=>{const rank={active:0,upcoming:1,unscheduled:2,past:3};return(rank[left.state]??9)-(rank[right.state]??9)||(left.startAt||Number.MAX_SAFE_INTEGER)-(right.startAt||Number.MAX_SAFE_INTEGER)||left.name.localeCompare(right.name)});if(!events.some(event=>isHalloween(event)))events.push({...HALLOWEEN_GUIDE_EVENT});const next=events.find(event=>!event.guideOnly&&event.state==='active')||events.find(event=>!event.guideOnly&&event.state==='upcoming')||events.find(event=>!event.guideOnly)||events[0]||null;return{at:now,events,nextId:next?.id||'',next}}
let selectedId='';
function settings(){return api.settings(ID,{})}
function guideCalendar(){const halloween={...HALLOWEEN_GUIDE_EVENT};return{at:Date.now(),events:[halloween],nextId:halloween.id,next:halloween}}
function cache(){const current=api.cache(ID,{fetchedAt:0,calendar:null});if(!current.calendar?.events?.length)current.calendar=guideCalendar();return current}
function selectedEvent(calendar){const id=String(selectedId||'');return calendar?.events?.find(event=>event.id===id)||calendar?.events?.find(event=>event.id===calendar.nextId)||calendar?.events?.[0]||null}
function dateTime(timestamp){if(!Number(timestamp))return'Schedule not published';return new Intl.DateTimeFormat(undefined,{timeZone:'UTC',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Number(timestamp)))+' TCT'}
function countdown(timestamp){const ms=Number(timestamp)-Date.now();if(!Number(timestamp)||ms<=0)return'';const days=Math.floor(ms/86400000),hours=Math.floor((ms%86400000)/3600000),minutes=Math.ceil((ms%3600000)/60000);return days?days+'d '+hours+'h':hours?hours+'h '+minutes+'m':minutes+'m'}
function isHalloween(event){return/halloween|halloweek|trick\s*or\s*treat/i.test(String(event?.name||event?.id||''))}
function basketRank(value){const text=plainText(value);if(!/Halloween Basket/i.test(text))return'';return BASKET_RANKS.find(rank=>new RegExp('(?:^|\\W)'+rank+'(?:$|\\W)','i').test(text))||''}
function recommendations(records=[],limit=3){const states=new Map;for(const record of records){const upgradeId=Number(record?.upgradeId??record?.id);if(Number.isInteger(upgradeId)&&upgradeId>0)states.set(upgradeId,{unlocked:record?.unlocked===true,disabled:record?.disabled===true})}const remaining=UPGRADE_ORDER.filter(upgrade=>!states.get(upgrade.upgradeId)?.unlocked);return{complete:remaining.length===0,completedCount:UPGRADE_ORDER.length-remaining.length,total:UPGRADE_ORDER.length,recommendations:remaining.slice(0,Math.max(1,Number(limit)||3)).map((upgrade,index)=>({...upgrade,disabled:states.get(upgrade.upgradeId)?.disabled===true,current:index===0}))}}
let activeBasket=null;
let helperHidden=false;
function basketVisible(element){
return Boolean(element?.isConnected&&element.getClientRects().length&&global.getComputedStyle(element).visibility!=='hidden');
}
function readBasketDom(){
const basket=[...document.querySelectorAll('.use-halloween-basket')].find(basketVisible);
const container=basket?.querySelector('.item-cont'),grid=container?.querySelector('.updates-grid'),wrapper=grid?.querySelector('.updates-grid-slides-wrapper');
const nameNode=basket?.closest('li[data-item]')?.querySelector('span.name,.name');
if(!nameNode||!container||!grid||!wrapper)return null;
return{basket,container,grid,wrapper,rank:basketRank(nameNode.textContent),upgrades:[...wrapper.querySelectorAll('.basket-update[data-basket-action="upgrade"][data-upgradeid]')].map(button=>({upgradeId:Number(button.dataset.upgradeid),name:button.querySelector('.update-name')?.textContent||'',unlocked:button.classList.contains('unlocked'),disabled:Boolean(button.disabled||button.closest('.updates-grid-slide')?.classList.contains('disabled'))}))};
}
function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID}{position:relative!important;inset:auto!important;display:block;clear:both;box-sizing:border-box;min-width:0;max-width:100%;margin:6px 0;padding:7px 9px;border:1px solid #ff8a00;border-radius:7px;background:#17120d;color:#f5f5f5;font:12px/1.35 Arial,sans-serif}
      #${OVERLAY_ID} .slink-halloween-head{display:flex;align-items:start;justify-content:space-between;gap:9px;flex-wrap:wrap}
      #${OVERLAY_ID} h3{margin:0;color:#ffb347;font-size:13px}#${OVERLAY_ID} p{margin:2px 0 0;color:#ccc}
      #${OVERLAY_ID} .slink-halloween-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#${OVERLAY_ID} .slink-halloween-actions a{color:#8dd4ff}#${OVERLAY_ID} button{min-height:30px;padding:3px 8px;border:1px solid #777;border-radius:5px;background:#29231b;color:#eee;font:inherit;cursor:pointer}
      #${OVERLAY_ID} ol{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:5px;margin:6px 0 0;padding:0;list-style:none}
      #${OVERLAY_ID} li{display:grid;grid-template-columns:24px minmax(0,1fr);gap:5px;align-items:start;padding:5px;border:1px solid #555;border-radius:5px;background:#24201b;min-width:0}
      #${OVERLAY_ID} li[data-current="true"]{border-color:#ff8a00;box-shadow:inset 3px 0 #ff8a00}
      #${OVERLAY_ID} li[data-disabled="true"]{opacity:.8}#${OVERLAY_ID} .slink-step{font-weight:900;color:#ffb347}
      #${OVERLAY_ID} small{display:block;color:#aaa}#${OVERLAY_ID} .slink-state{display:block;font-size:11px;font-weight:700;color:#9ee493}
      #${OVERLAY_ID} li[data-disabled="true"] .slink-state{color:#ffd166}
    `;
    (document.head || document.documentElement).append(style);
  }
function resetBasketSession(){
document.getElementById(OVERLAY_ID)?.remove();
lastSignature='';activeBasket=null;helperHidden=false;
}
function scanBasket(){
if(!global.SLINK_PDA_PAGE_ACTIVITY.eligible())return;
const snapshot=/\/items?\.php$/i.test(global.location.pathname)?readBasketDom():null;
if(!snapshot){resetBasketSession();return;}
if(snapshot.basket!==activeBasket){resetBasketSession();activeBasket=snapshot.basket;}
if(helperHidden)return;
const guide=recommendations(snapshot.upgrades,3),signature=JSON.stringify([snapshot.rank,snapshot.upgrades.map(item=>[item.upgradeId,item.unlocked,item.disabled])]);
if(signature===lastSignature&&document.getElementById(OVERLAY_ID))return;
lastSignature=signature;ensureStyle();
let overlay=document.getElementById(OVERLAY_ID);
if(!overlay){
overlay=document.createElement('section');overlay.id=OVERLAY_ID;
overlay.addEventListener('click',event=>{
if(!event.target.closest('[data-slink-hide-helper]'))return;
event.preventDefault();event.stopPropagation();helperHidden=true;overlay.remove();
});
}
if(overlay.parentElement!==snapshot.container||overlay.nextElementSibling!==snapshot.grid)snapshot.container.insertBefore(overlay,snapshot.grid);
overlay.innerHTML='<div class="slink-halloween-head"><div><h3>SLINK Halloween Guide</h3><p>'+api.escapeHtml(snapshot.rank||'Halloween Basket')+' · '+guide.completedCount+'/'+guide.total+' complete</p></div><div class="slink-halloween-actions"><a href="'+GUIDE_URL+'">Full guide</a><button type="button" data-slink-hide-helper>Hide helper</button></div></div>'+(guide.complete?'<p><strong>Normal guide path complete.</strong></p>':'<ol>'+guide.recommendations.map(upgrade=>'<li data-current="'+String(upgrade.current)+'" data-disabled="'+String(upgrade.disabled)+'"><span class="slink-step">#'+upgrade.step+'</span><span><strong>'+api.escapeHtml(upgrade.name)+'</strong><small>'+upgrade.cost.toLocaleString()+' treats'+(upgrade.note?' · '+api.escapeHtml(upgrade.note):'')+'</small><span class="slink-state">'+(upgrade.disabled?'Locked—evolve basket':upgrade.current?'Next':'Then')+'</span></span></li>').join('')+'</ol>');
}
function scheduleScan(){if(scanTimer||!global.SLINK_PDA_PAGE_ACTIVITY.eligible())return;scanTimer=global.setTimeout(()=>{scanTimer=null;scanBasket()},80)}
function halloweenCard(){return'<article class="card wide"><div class="card-head"><div><h2>Halloween basket guide</h2><span class="muted">Exact tested progression from the linked community guide</span></div>'+api.actionLink('Open guide',GUIDE_URL)+'</div><div class="grid">'+UPGRADE_ORDER.map(upgrade=>'<div class="card"><strong>'+upgrade.step+'. '+api.escapeHtml(upgrade.name)+'</strong>'+(upgrade.optional?'<span class="muted">Optional</span>':'')+'</div>').join('')+'</div><p><strong>Normal path skips:</strong> '+SKIPPED.map(api.escapeHtml).join(', ')+'.</p><h3>Relics</h3>'+RELICS.map(relic=>'<p><strong>'+api.escapeHtml(relic.name)+'</strong><br><span class="muted">'+api.escapeHtml(relic.effect)+'</span></p>').join('')+'</article>'}
function render(){const root=api.root(ID);if(!root)return;if(!api.hasScope(SCOPE)){root.innerHTML=api.lockedModule(SCOPE,'Events');return}const current=cache(),calendar=current.calendar,selected=selectedEvent(calendar);if(!calendar?.events?.length||!selected){root.innerHTML='<div class="grid"><article class="card wide"><div class="card-head"><div><h2>Torn Events</h2><span class="muted">Official Torn calendar data with personal start times when available.</span></div><button type="button" data-events-refresh>'+(busy?'Checking…':'Refresh')+'</button></div>'+(error?api.moduleMessage(error,'error'):'')+'<p>Refresh to load Torn’s current event calendar.</p></article></div>';bind(root);return}root.innerHTML='<div class="grid"><article class="card wide"><div class="card-head"><div><h2>Torn Events</h2><span class="muted">Updated '+api.relativeTime(current.fetchedAt)+' · every published event plus year-round preparation guides</span></div><button type="button" data-events-refresh>'+(busy?'Checking…':'Refresh')+'</button></div>'+(error?api.moduleMessage(error,'error'):'')+'<label>Choose event<select data-events-select style="width:100%;min-height:44px;margin-top:5px">'+calendar.events.map(event=>'<option value="'+api.escapeHtml(event.id)+'" '+(event.id===selected.id?'selected':'')+'>'+api.escapeHtml(event.name)+' · '+(event.guideOnly?'guide available year-round':api.escapeHtml(event.state==='unscheduled'?'schedule not published':event.state))+'</option>').join('')+'</select></label></article><article class="card wide"><div class="card-head"><div><h2>'+api.escapeHtml(selected.name)+'</h2><span class="muted">'+api.escapeHtml(selected.state)+(selected.personalized?' · personalized Torn start time':'')+'</span></div>'+api.actionLink('Open Torn calendar',CALENDAR_URL)+'</div><div class="stats"><div><strong>'+api.escapeHtml(dateTime(selected.startAt))+'</strong><span>Starts'+(selected.startAt>Date.now()?' · '+api.escapeHtml(countdown(selected.startAt)):'')+'</span></div><div><strong>'+api.escapeHtml(dateTime(selected.endAt))+'</strong><span>Ends</span></div><div><strong>'+calendar.events.filter(event=>!event.guideOnly).length+'</strong><span>Published events</span></div></div>'+(selected.description?'<p>'+api.escapeHtml(selected.description)+'</p>':'')+'</article>'+(isHalloween(selected)?halloweenCard():'<article class="card wide"><h2>Event guide in progress</h2><p>Event-specific preparation and SLINK best practices will be added here without guessing at unfinished guidance.</p></article>')+'</div>';bind(root)}
function bind(root){if(root.dataset.eventsBound==='true')return;root.dataset.eventsBound='true';root.addEventListener('click',event=>{if(event.target.closest('[data-events-refresh]'))void refresh(true)});root.addEventListener('change',event=>{const select=event.target.closest('[data-events-select]');if(!select)return;selectedId=String(select.value||'');render()})}
async function refresh(force=false){const current=cache();if(busy)return current.calendar;if(!force&&current.calendar&&Date.now()-Number(current.fetchedAt||0)<CACHE_MS){render();return current.calendar}busy=true;error='';render();try{await api.ensurePermission(false);if(!api.hasScope(SCOPE))throw new Error('Your SLINK account does not have '+SCOPE+' permission.');const[tornResult,userResult]=await Promise.allSettled([api.tornJson('/v2/torn/calendar','SLINK PDA events calendar'),api.tornJson('/v2/user/calendar','SLINK PDA personal event times')]);if(tornResult.status==='rejected'&&userResult.status==='rejected')throw tornResult.reason;const calendar=mergeCalendars(tornResult.status==='fulfilled'?tornResult.value:{},userResult.status==='fulfilled'?userResult.value:{});if(!calendar.events.length)throw new Error('Torn returned no calendar events.');current.calendar=calendar;current.fetchedAt=Date.now();api.save();return calendar}catch(caught){error=api.errorMessage(caught);throw caught}finally{busy=false;render()}}
global.SLINK_PDA_PAGE_ACTIVITY.subscribe(active=>{observer?.disconnect();clearTimeout(scanTimer);scanTimer=null;if(active&&observer){observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','disabled','style','hidden','aria-hidden','aria-expanded']});scheduleScan();}});
function start(){if(api.hasScope(SCOPE))void refresh(false).catch(()=>undefined);global.setInterval(()=>{if(api.hasScope(SCOPE)&&Date.now()-Number(cache().fetchedAt||0)>=CACHE_MS)void refresh(false).catch(()=>undefined)},60000);if(!observer&&document.body){observer=new MutationObserver(mutations=>{if(!global.SLINK_PDA_PAGE_ACTIVITY.eligible())return;if(activeBasket&&!basketVisible(activeBasket))resetBasketSession();if(mutations.every(mutation=>mutation.target?.closest?.('#'+OVERLAY_ID+',#slink-pda-dashboard-host')))return;scheduleScan()});observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','disabled','style','hidden','aria-hidden','aria-expanded']});global.addEventListener('hashchange',scheduleScan);global.addEventListener('popstate',scheduleScan);scheduleScan()}}
api.register({id:ID,title:'Events',shortTitle:'Events',scope:SCOPE,render,refresh,start,test:Object.freeze({eventRows,mergeCalendars,selectedEvent,timestampMs,basketRank,recommendations,isHalloween,UPGRADE_ORDER})});
})(globalThis);

