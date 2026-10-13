(function installEventsPda(global) {
'use strict';
const api = global.SLINK_PDA_PLUGIN_API;
if (!api) throw new Error('SLINK PDA plugin API is unavailable.');
const ID = 'events';
const SCOPE = 'slink.qol.events';
const CACHE_MS = 6 * 60 * 60_000;
const CALENDAR_URL = 'https://www.torn.com/calendar.php';
let busy = false;
let error = '';

function rows(value) {
if (Array.isArray(value)) return value.map((entry,index) => ({key:String(index),value:entry}));
if (value && typeof value === 'object') return Object.entries(value).map(([key,entry]) => ({key,value:entry}));
return [];
}
function timestampMs(value) {
if (value === null || value === undefined || value === '') return 0;
const numeric = Number(value);
if (Number.isFinite(numeric) && numeric > 0) return numeric < 10000000000 ? Math.trunc(numeric*1000) : Math.trunc(numeric);
const parsed = Date.parse(String(value));
return Number.isFinite(parsed) ? parsed : 0;
}
function plainText(value) {
return String(value || '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
}
function eventRows(payload = {}) {
const source = payload.calendar ?? payload.events ?? payload.competitions ?? payload;
return rows(source).map(({key,value}) => {
if (value === null || value === undefined) return null;
const item = typeof value === 'object' ? value : {start:value};
const name = plainText(item.name ?? item.title ?? item.event ?? item.description ?? key);
if (!name) return null;
return {
id:String(item.id ?? item.event_id ?? item.slug ?? key ?? name).trim() || name,
name,
startAt:timestampMs(item.start ?? item.start_time ?? item.starts_at ?? item.from ?? item.timestamp ?? item.time),
endAt:timestampMs(item.end ?? item.end_time ?? item.ends_at ?? item.to),
description:plainText(item.description ?? item.details ?? item.text ?? ''),
personalized:false
};
}).filter(Boolean);
}
function identity(event) { return String(event.id || event.name || '').toLowerCase().replace(/[^a-z0-9]+/g,''); }
function mergeCalendars(tornPayload = {}, userPayload = {}, now = Date.now()) {
const globalEvents = eventRows(tornPayload), personalEvents = eventRows(userPayload), personal = new Map();
for (const event of personalEvents) { personal.set(identity(event),event); personal.set(event.name.toLowerCase(),event); }
const source = globalEvents.length ? globalEvents : personalEvents;
const events = source.map(event => {
const override = personal.get(identity(event)) || personal.get(event.name.toLowerCase());
const startAt = override?.startAt || event.startAt, endAt = override?.endAt || event.endAt;
const state = startAt && startAt <= now && (!endAt || endAt > now) ? 'active' : startAt > now ? 'upcoming' : endAt && endAt <= now ? 'past' : 'unscheduled';
return {...event,startAt,endAt,description:event.description || override?.description || '',personalized:Boolean(override?.startAt),state};
}).sort((left,right) => {
const rank={active:0,upcoming:1,unscheduled:2,past:3};
return (rank[left.state]??9)-(rank[right.state]??9) || (left.startAt||Number.MAX_SAFE_INTEGER)-(right.startAt||Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name);
});
const next=events.find(event=>event.state==='active') || events.find(event=>event.state==='upcoming') || events[0] || null;
return {at:now,events,nextId:next?.id||'',next};
}
function settings() { return api.settings(ID,{selectedId:''}); }
function cache() { return api.cache(ID,{fetchedAt:0,calendar:null}); }
function selectedEvent(calendar) {
const id=String(settings().selectedId||'');
return calendar?.events?.find(event=>event.id===id) || calendar?.events?.find(event=>event.id===calendar.nextId) || calendar?.events?.[0] || null;
}
function dateTime(timestamp) {
if (!Number(timestamp)) return 'Schedule not published';
return new Intl.DateTimeFormat(undefined,{timeZone:'UTC',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Number(timestamp)))+' TCT';
}
function countdown(timestamp) {
const ms=Number(timestamp)-Date.now();
if (!Number(timestamp) || ms<=0) return '';
const days=Math.floor(ms/86400000),hours=Math.floor((ms%86400000)/3600000),minutes=Math.ceil((ms%3600000)/60000);
return days?days+'d '+hours+'h':hours?hours+'h '+minutes+'m':minutes+'m';
}
function render() {
const root=api.root(ID); if(!root)return;
if(!api.hasScope(SCOPE)){root.innerHTML=api.lockedModule(SCOPE,'Events');return}
const current=cache(),calendar=current.calendar,selected=selectedEvent(calendar);
if(!calendar?.events?.length||!selected){
root.innerHTML='<div class="grid"><article class="card wide"><div class="card-head"><div><h2>Torn Events</h2><span class="muted">Official Torn calendar data with personal start times when available.</span></div><button type="button" data-events-refresh>'+(busy?'Checking…':'Refresh')+'</button></div>'+(error?api.moduleMessage(error,'error'):'')+'<p>Refresh to load Torn’s current event calendar.</p></article></div>';
bind(root);return;
}
root.innerHTML='<div class="grid"><article class="card wide"><div class="card-head"><div><h2>Torn Events</h2><span class="muted">Updated '+api.relativeTime(current.fetchedAt)+' · one permission covers every event</span></div><button type="button" data-events-refresh>'+(busy?'Checking…':'Refresh')+'</button></div>'+(error?api.moduleMessage(error,'error'):'')+'<label>Choose event<select data-events-select style="width:100%;min-height:44px;margin-top:5px">'+calendar.events.map(event=>'<option value="'+api.escapeHtml(event.id)+'" '+(event.id===selected.id?'selected':'')+'>'+api.escapeHtml(event.name)+' · '+api.escapeHtml(event.state)+'</option>').join('')+'</select></label></article>'+
'<article class="card wide"><div class="card-head"><div><h2>'+api.escapeHtml(selected.name)+'</h2><span class="muted">'+api.escapeHtml(selected.state)+(selected.personalized?' · personalized Torn start time':'')+'</span></div>'+api.actionLink('Open Torn calendar',CALENDAR_URL)+'</div><div class="stats"><div><strong>'+api.escapeHtml(dateTime(selected.startAt))+'</strong><span>Starts'+(selected.startAt>Date.now()?' · '+api.escapeHtml(countdown(selected.startAt)):'')+'</span></div><div><strong>'+api.escapeHtml(dateTime(selected.endAt))+'</strong><span>Ends</span></div><div><strong>'+calendar.events.length+'</strong><span>Published events</span></div></div>'+(selected.description?'<p>'+api.escapeHtml(selected.description)+'</p>':'')+'</article>'+
'<article class="card wide"><h2>Event guide in progress</h2><p>Event-specific guides, preparation checklists, and SLINK best practices will be added here later. The framework is ready; this update does not guess at unfinished guidance.</p></article></div>';
bind(root);
}
function bind(root) {
if(root.dataset.eventsBound==='true')return;
root.dataset.eventsBound='true';
root.addEventListener('click',event=>{if(event.target.closest('[data-events-refresh]'))void refresh(true)});
root.addEventListener('change',event=>{
const select=event.target.closest('[data-events-select]');if(!select)return;
settings().selectedId=String(select.value||'');api.save();render();
});
}
async function refresh(force=false) {
const current=cache();
if(busy)return current.calendar;
if(!force&&current.calendar&&Date.now()-Number(current.fetchedAt||0)<CACHE_MS){render();return current.calendar}
busy=true;error='';render();
try{
await api.ensurePermission(false);
if(!api.hasScope(SCOPE))throw new Error('Your SLINK account does not have '+SCOPE+' permission.');
const [tornResult,userResult]=await Promise.allSettled([
api.tornJson('/v2/torn/calendar','SLINK PDA events calendar'),
api.tornJson('/v2/user/calendar','SLINK PDA personal event times')
]);
if(tornResult.status==='rejected'&&userResult.status==='rejected')throw tornResult.reason;
const calendar=mergeCalendars(tornResult.status==='fulfilled'?tornResult.value:{},userResult.status==='fulfilled'?userResult.value:{});
if(!calendar.events.length)throw new Error('Torn returned no calendar events.');
current.calendar=calendar;current.fetchedAt=Date.now();api.save();return calendar;
}catch(caught){error=api.errorMessage(caught);throw caught}finally{busy=false;render()}
}
function start() {
if(api.hasScope(SCOPE))void refresh(false).catch(()=>undefined);
global.setInterval(()=>{if(api.hasScope(SCOPE)&&Date.now()-Number(cache().fetchedAt||0)>=CACHE_MS)void refresh(false).catch(()=>undefined)},60000);
}
api.register({id:ID,title:'Events',shortTitle:'Events',scope:SCOPE,render,refresh,start,test:Object.freeze({eventRows,mergeCalendars,selectedEvent,timestampMs})});
})(globalThis);
