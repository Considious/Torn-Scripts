import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const ctx=vm.createContext({URL,setTimeout,clearTimeout,console});vm.runInContext(readFileSync(new URL('./src/00-ff-backup.part',import.meta.url),'utf8'),ctx);const B=ctx.SLINK_FF_BACKUP;
let clock=1793289600000,requests=[],auth=true,primaryCalls=0;const store=B.openStore(null);
const row=(id,delta=0)=>({player_id:id,source:'bss',bs_estimate:100000+id,bss_public:400,last_updated:Math.floor(clock/1000)+delta,fair_fight:2});
const engine=B.create({store,now:()=>clock,session:async()=>auth?{token:'session-only'}:null,ownScore:async()=>800,
 transport:async(action,body,token)=>{requests.push({action,body,token});return action==='contribute'?{acknowledged:body.records}:{records:body.player_ids.filter(id=>id!==99).map(id=>B.publicRecord(row(id),clock))};}});
assert.equal(B.publicRecord({...row(1),source:'premium'}),null);
const pub=B.publicRecord({...row(1),source:'premium',spies:[{strength:123}],api_key:'private',available_estimates:{bss:{...row(1)},premium:{bs_estimate:999999}}},clock);
assert.equal(pub.bs_estimate,100001);assert.equal(pub.fair_fight,undefined);assert.equal(pub.api_key,undefined);assert.equal(pub.spies,undefined);
assert.equal(B.publicRecord({...row(1),last_updated:null},clock),null);assert.equal(B.normalize({...pub,ff_last_updated:Math.floor(clock/1000)+999},clock),null);
const url='https://ffscouter.com/api/v1/get-stats?key=not-saved&targets=1,2';
const live=[row(1),row(2)];assert.equal(await engine.run(url,async()=>{primaryCalls++;return live;}),live);assert.equal(requests.filter(x=>x.action==='lookup').length,0);
assert.equal((await store.pending()).length,2);await engine.capture(live);assert.equal((await store.pending()).length,2);
await engine.capture([row(1,-100)]);assert.equal((await store.getMany([1]))[1].ff_last_updated,pub.ff_last_updated);
await engine.flush();clock+=3600001;await engine.flush();assert.equal(requests.filter(x=>x.action==='contribute').length,1);assert.equal((await store.pending()).length,0);
const unavailable=async()=>{primaryCalls++;throw Error('network');};
let result=await engine.run(url,unavailable);assert.equal(result.length,2);assert.equal(result[0].fair_fight,2.33);assert.match(result[0].source,/SLINK Backup/);assert.equal(requests.filter(x=>x.action==='lookup').length,0);
result=await engine.run(url+'&targets=1',unavailable); // Same requested IDs; no crawler.
await engine.run(url,unavailable);const previous=primaryCalls;await engine.run(url,unavailable);assert.equal(primaryCalls,previous,'Circuit stops provider calls');
result=await engine.run('https://ffscouter.com/api/v1/get-stats?targets=1,3,99',unavailable);assert.equal(requests.at(-1).action,'lookup');assert.deepEqual(Array.from(requests.at(-1).body.player_ids),[3,99]);assert.equal(result.length,2);
const before=requests.length;await engine.run('https://ffscouter.com/api/v1/get-stats?targets=1,3,99',unavailable);assert.equal(requests.length,before,'Positive and negative results persisted locally');
assert.equal((await store.pending()).length,0,'Downloaded backup rows are never recontributed');
clock+=180001;const recovery=[row(1)];assert.equal(await engine.run('https://ffscouter.com/api/v1/get-stats?targets=1',async()=>recovery),recovery);assert.equal(engine.status().degraded,false);
auth=false;const count=requests.length;await engine.fallback([100]);assert.equal(requests.length,count,'No authentication or Torn request to obtain a backup session');
const unauth=Object.assign(Error('Invalid key'),{status:401});await assert.rejects(engine.run(url,async()=>{throw unauth;}),/Invalid key/);
const failed=B.create({store:B.openStore(null),session:async()=>({token:'x'}),now:()=>clock,transport:async()=>{throw Error('backup down');}});
assert.equal((await failed.fallback([1])).length,0);assert.deepEqual(await failed.run(url,async()=>live),live,'Backup failure must not break live response');
assert.equal(B.fallbackRow(pub,null,clock).fair_fight,null,'Never reuse another observer FF or guess private BSS from a total');
for(const [days,label]of [[0,'Fresh'],[2,'Recent'],[8,'Old'],[31,'Stale']])assert.equal(B.freshness(pub,pub.ff_last_updated*1000+days*86400000).label,label);
const queued=(await store.pending()).length;await engine.capture([row(4)]);clock+=3600001;await engine.flush();assert.equal((await store.pending()).length,queued+1,'No session preserves queue');
console.log('Public FF backup: primary priority, privacy, dedupe, acknowledged uploads, local/remote fallback, negative cache, circuit/recovery, provenance and graceful errors passed.');
let massTime=clock;const batches=[],massStore=B.openStore(null),mass=B.create({store:massStore,now:()=>massTime,session:async()=>({token:'existing-session'}),transport:async(action,body)=>{assert.equal(action,'contribute');batches.push(body.records);return {acknowledged:body.records};}});
const many=Array.from({length:500},(_,i)=>({...row(i+1000),last_updated:Math.floor(massTime/1000)}));await mass.capture(many);await mass.flush();
for(let i=0;i<2;i++){massTime+=900001;await mass.flush(true);}
assert.equal(batches.length,3);assert.deepEqual(batches.map(x=>x.length),[200,200,100]);assert.equal((await massStore.pending()).length,0);
await mass.capture(many);await mass.flush(true);assert.equal(batches.length,3,'Repeat sightings do not re-upload');
const fault=B.create({store:{putMany:async()=>{throw Error('Quota');}},transport:async()=>{throw Error('must not upload');}});assert.equal(await fault.run(url,async()=>live),live,'Local quota failures preserve primary success');
const stalled=B.create({store:{putMany:()=>new Promise(()=>{})},transport:async()=>{}});const start=Date.now();assert.equal(await stalled.run(url,async()=>live),live);assert.ok(Date.now()-start<1000,'Stalled IndexedDB must not hold the primary response indefinitely');
