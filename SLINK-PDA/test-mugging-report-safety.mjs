import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const pda=import.meta.url.endsWith('/test-mugging-report-safety.mjs');
const source=fs.readFileSync(new URL(pda?'./src/30-dashboard-combat.part':'../src/background/mugging-service.js',import.meta.url),'utf8');
const constants=pda?fs.readFileSync(new URL('./src/00-runtime-core.part',import.meta.url),'utf8'):source;
assert.match(constants,pda?/MUGGING_SYNC_INTERVAL_MS = 5 \* 60_000/:/SYNC_INTERVAL_MS = 5 \* 60_000/);
const reportName=pda?'muggingContributorReport':'reportForObservation';
const reportStart=source.indexOf('function '+reportName+'(');
const reportEnd=source.indexOf(pda?'async function syncMuggingContributorReports(':'async function syncPending(',reportStart);
const syncStart=reportEnd;
const syncEnd=source.indexOf(pda?'async function runMuggingContribution(':'async function maybeRefreshActiveAssignments(',syncStart);
let now=Date.parse('2026-10-25T12:00:00Z'),requests=0,fail=true,inject=null;
const map=new Map(),state={settings:{mugging:{enabled:true}},caches:{muggingPendingSync:{}}};
const rows=()=>pda?Object.values(state.caches.muggingPendingSync):map.get('pending')||[];
const setRows=value=>{if(pda)state.caches.muggingPendingSync=Object.fromEntries(value.map(row=>[row.playerId,row]));else map.set('pending',structuredClone(value));};
async function transport(body){
 requests++;if(fail)throw Error('synthetic temporary failure');
 if(inject)inject();
 for(const row of body.reports)assert.equal(row.fairFight,null);
 return {acknowledged_report_ids:body.reports.map(row=>row.report_id)};
}
const context=vm.createContext({console,Date:class extends Date{static now(){return now;}},
 dataState:state,writeDataState(){},muggingSyncBusy:false,
 MUGGING_SYNC_INTERVAL_MS:300000,MUGGING_SYNC_RETRY_MS:60000,MUGGING_SYNC_BATCH_SIZE:100,MUGGING_SYNC_MAX_BATCHES:5,
 hasScope:()=>true,muggingClientId:()=> 'synthetic',muggingRequest:async(_,options)=>transport(options.body),errorMessage:error=>error.message,
 validPlayerIntelligenceId:value=>Number(value)>0?Number(value):null,
 SYNC_INTERVAL_MS:300000,SYNC_RETRY_MS:60000,SYNC_BATCH_SIZE:100,SYNC_MAX_BATCHES:5,
 SYNC_KEY:'sync',PENDING_KEY:'pending',SETTINGS_KEY:'settings',REQUIRED_SCOPE:'slink.mugging',BASE_URL:'https://synthetic.invalid',syncing:null,
 clientId:async()=> 'synthetic',SLINK:{core:{storage:{get:async(key,fallback)=>structuredClone(map.get(key)??fallback),set:async(key,value)=>map.set(key,structuredClone(value))},
 permissions:{hasScope:()=>true},http:{requestJson:async(_,url,options)=>transport(JSON.parse(options.body))}},services:{permissionAccess:{ensureSession:async()=>({token:'synthetic'})}}}});
map.set('settings',{enabled:true});
vm.runInContext(source.slice(reportStart,reportEnd)+source.slice(syncStart,syncEnd),context);
const report=context[reportName],sync=context[pda?'syncMuggingContributorReports':'syncPending'];
for(const value of [undefined,null,0,-1,'',true,NaN,Infinity])assert.equal(report({playerId:42,record:{battleStatsEstimate:value}},'synthetic').battleStatsEstimate,null);
assert.equal(report({playerId:42,record:{battleStatsEstimate:500000,fieldMeta:{battleStatsEstimate:{at:1234}}}},'synthetic').battle_stats_observed_at,1234);
setRows([{playerId:42,observedAt:now,record:{state:'Okay',battleStatsEstimate:null}}]);
const failed=await sync();assert.equal(requests,1);assert.equal(failed.nextAttemptAt,now+60000);assert.equal(rows().length,1);
now+=59999;await sync();assert.equal(requests,1,'Retry must respect the one-minute backoff.');
now++;fail=false;
const success=await sync();assert.equal(requests,2);assert.equal(rows().length,0);assert.equal(success.error,'');assert.equal(success.consecutiveFailures,0);
const fresh={playerId:42,observedAt:now+1000,record:{state:'Okay',battleStatsEstimate:null}};
setRows([fresh]);await sync();assert.equal(requests,2,'Successful uploads must be batched rather than sent per target.');
now+=300000;
inject=()=>{setRows([{...fresh,observedAt:now+1}]);inject=null;};
await sync();assert.equal(requests,3);assert.equal(rows().length,1,'An older acknowledgement must not delete a newer observation.');
assert.equal(rows()[0].observedAt,now+1);
setRows([]);now+=300000;const empty=await sync();assert.equal(requests,3,'Empty queues must not issue upload requests.');
assert.equal(empty.lastSuccessAt,now-300000,'An empty queue is not a new successful delivery.');
console.log((pda?'PDA':'Extension')+' contributor report safety, original estimate age, acknowledgement preservation and bounded retry passed.');
