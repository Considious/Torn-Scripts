import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const root=new URL('./',import.meta.url);
const source=fs.readFileSync(new URL('src/00-shared-data.part',root),'utf8');
const context=vm.createContext({crypto:webcrypto,TextEncoder});
vm.runInContext(source,context);
const factory=context.SLINK_SHARED_DATA;
const clone=value=>JSON.parse(JSON.stringify(value));
let state={},now=1000,calls=[],hold=[],failWrite=false;
let response={profile:{id:123,level:25},battlestats:{strength:100,defense:400,speed:900,dexterity:1600}};
const provider=factory.create({now:()=>now,read:async()=>clone(state),write:async value=>{
 if(failWrite){failWrite=false;throw Error('disk failed');}state=clone(value);
},request:async(kind,key)=>{calls.push({kind,key});if(hold.length)return hold.shift();return response;},
normalizeItems:body=>body.items.map(item=>({id:item.id,name:item.name,marketPrice:item.value?.market_price??0}))});
let records=await Promise.all([provider.personal({key:'a'}),provider.personal({key:'a'})]);
assert.equal(calls.length,1,'Concurrent compatible personal requests must coalesce.');
assert.equal(records[0].total,3000);assert.equal(records[0].score,100);
assert.equal(records[0].accountId,123);assert.equal(records[0].level,25);
records[0].components.strength=9999;
assert.equal((await provider.peekPersonal({key:'a'})).components.strength,100,'Readers must not mutate stored records.');
assert.equal(await provider.peekPersonal({key:'b'}),null,'Different credentials cannot inherit an unvalidated identity.');
assert.ok(!JSON.stringify(state).includes('"a"'),'Raw credentials must not be stored.');
now=2000;let releaseOld,releaseNew;
hold=[new Promise(resolve=>releaseOld=resolve),new Promise(resolve=>releaseNew=resolve)];
const old=provider.personal({key:'a',maxAgeMs:0});
while(calls.length<2)await new Promise(resolve=>setImmediate(resolve));
const forced=provider.personal({key:'a',force:true});
while(calls.length<3)await new Promise(resolve=>setImmediate(resolve));
releaseNew({...response,battlestats:{strength:400,defense:400,speed:900,dexterity:1600}});await forced;
releaseOld(response);await old;
assert.equal((await provider.peekPersonal({key:'a'})).total,3300,'An older in-flight response cannot replace a forced refresh.');
now=3000;failWrite=true;
await assert.rejects(provider.personal({key:'a',force:true}),/disk failed/);
assert.equal((await provider.personal({key:'a',force:true})).total,3000,'A failed write cannot poison the queue.');
response={profile:{id:123,level:25},battlestats:{strength:1}};
await assert.rejects(provider.personal({key:'a',force:true}),/incomplete/);
assert.equal((await provider.peekPersonal({key:'a'})).total,3000,'Incomplete stats must not erase good data.');
assert.throws(()=>factory.personalRecord({profile:{id:123,level:25},battlestats:{total:3000}},1,2,'x'),/incomplete/,'A legacy total cannot reconstruct distribution-dependent scores.');
response={items:[{id:1,name:'A',value:{market_price:50}},{id:2,name:'B',value:{market_price:0}}]};
calls=[];
const catalogs=await Promise.all([provider.catalog({key:'a',needPrices:true}),provider.catalog({key:'b',needPrices:true})]);
assert.equal(calls.length,1,'Public full-catalog requests can coalesce across credentials.');
assert.equal(catalogs[0].items[1].marketPrice,0,'Explicit zero is authoritative.');
const originalPriceAt=state.catalog.items[0].priceCheckedAt;
now=4000;response={items:[{id:1,name:'A',value:{}},{id:2,name:'B',value:{market_price:5}}]};
const partial=await provider.catalog({key:'a',force:true});
assert.equal(partial.items[0].marketPrice,50);assert.equal(partial.items[0].priceCheckedAt,originalPriceAt);
await assert.rejects(provider.catalog({key:'a',needPrices:true,maxAgeMs:500}),/incomplete/);
assert.equal(state.catalog.items[0].marketPrice,50,'Missing prices retain previous values, not fake zero.');
await assert.rejects(provider.catalog({key:'a',category:'flowers'}),/All-category/);

const intelContext=vm.createContext({console});

const pdaCore=fs.readFileSync(new URL('src/00-runtime-core.part',root),'utf8');
vm.runInContext(pdaCore.slice(pdaCore.indexOf('function validPlayerIntelligenceId('),pdaCore.indexOf('function effectivePlayerIntelligenceStatus(')),intelContext);
const pdaIntel={normalizeRecord:intelContext.normalizePlayerIntelligenceRecord,mergeRecord:intelContext.mergePlayerIntelligenceRecord};
function verifyIntel(core){
 let row=core.normalizeRecord({playerId:42,name:'Fresh',level:30,state:'Okay',battleStatsEstimate:500,bountyCount:3,bountyTotal:1000,observedAt:200,source:'new'});
 row=core.mergeRecord(row,{playerId:42,name:'Old',level:5,state:'Hospital',battleStatsEstimate:10,bountyCount:1,bountyTotal:1,observedAt:100,source:'old'});
 assert.equal(row.name,'Fresh');assert.equal(row.level,30);assert.equal(row.battleStatsEstimate,500);assert.equal(row.bountyCount,3);assert.equal(row.state,'Okay');
 row=core.mergeRecord(row,{playerId:42,state:'Hospital',until:1000,observedAt:400,source:'status'});
 assert.equal(row.fieldMeta.battleStatsEstimate.at,200,'Status refresh must not refresh estimates.');
 row=core.mergeRecord(row,{playerId:42,level:35,observedAt:300,source:'profile'});
 assert.equal(row.level,35,'An older profile can still be newer than the previous profile.');assert.equal(row.observedAt,400);
 row=core.mergeRecord(row,{playerId:42,bountyCount:null,bountyTotal:null,observedAt:500});assert.equal(row.bountyCount,3);
 row=core.mergeRecord(row,{playerId:42,bountyCount:0,bountyTotal:0,observedAt:600});assert.equal(row.bountyCount,0);
 const persisted=clone(row);row=core.mergeRecord(persisted,{playerId:42,battleStatsEstimate:20,observedAt:150});assert.equal(row.battleStatsEstimate,500);
 assert.equal(core.normalizeRecord({playerId:42}).fairFight,null);
}
verifyIntel(pdaIntel);
console.log('PDA shared provider and field freshness checks passed.');
// Coverage and freshness belong to each field, not whichever response arrives last.
{
 let saved={},time=10,requests=0,releases=[];
 const shared=factory.create({now:()=>time,read:async()=>clone(saved),write:async value=>{saved=clone(value);},
  request:async()=>{requests++;return new Promise(resolve=>releases.push(resolve));},
  normalizeItems:body=>(Array.isArray(body.items)?body.items:Object.entries(body.items).map(([id,row])=>({...row,id:Number(id)}))).map(row=>({id:row.id,name:row.name}))});
 const stats={profile:{id:321},battlestats:{strength:100,defense:100,speed:100,dexterity:100}};
 const ordinary=shared.personal({key:'coverage'}),needsLevel=shared.personal({key:'coverage',requireLevel:true});
 while(requests<1)await new Promise(resolve=>setImmediate(resolve));releases.shift()(stats);
 const outcomes=await Promise.allSettled([ordinary,needsLevel]);
 assert.equal(requests,1);assert.equal(outcomes[0].status,'fulfilled');assert.equal(outcomes[0].value.total,400);
 assert.equal(outcomes[1].status,'rejected','A coalesced caller must enforce its own coverage requirement');
 assert.equal((await shared.peekPersonal({key:'coverage'})).total,400,'Valid authenticated stats survive missing profile-level coverage');
 time=100;const early=shared.personal({key:'coverage',maxAgeMs:0});while(requests<2)await new Promise(resolve=>setImmediate(resolve));
 time=200;const later=shared.personal({key:'coverage',force:true});while(requests<3)await new Promise(resolve=>setImmediate(resolve));
 const older=releases.shift(),newer=releases.shift();newer({...stats,battlestats:{strength:400,defense:100,speed:100,dexterity:100}});await later;
 older({...stats,profile:{id:321,level:40}});await early;
 const merged=await shared.peekPersonal({key:'coverage'});assert.equal(merged.total,700);assert.equal(merged.statsAt,200);assert.equal(merged.level,40);assert.equal(merged.levelAt,100);
 assert.equal(await shared.peekPersonal({key:'other-account'}),null);
 time=1000;const catalogOld=shared.catalog({key:'coverage'});while(requests<4)await new Promise(resolve=>setImmediate(resolve));
 time=2000;const catalogNew=shared.catalog({key:'coverage',force:true});while(requests<5)await new Promise(resolve=>setImmediate(resolve));
 const oldCatalog=releases.shift(),newCatalog=releases.shift();
 time=2010;newCatalog({items:[{id:1,name:'New A',value:{}},{id:2,name:'New B',value:{market_price:200}},{id:4,name:'New D',value:{}}]});await catalogNew;
 time=2020;oldCatalog({items:[{id:1,name:'Old A',value:{market_price:50}},{id:2,name:'Old B',value:{market_price:0}},{id:3,name:'Removed C',value:{market_price:99}}]});await catalogOld;
 assert.equal(saved.catalog.metadataAt,2000);assert.equal(saved.catalog.fetchedAt,2010);
 assert.deepEqual(saved.catalog.items.map(row=>row.id),[1,2,4],'Older responses must not resurrect removed catalog entries');
 assert.equal(saved.catalog.items[0].name,'New A');assert.equal(saved.catalog.items[0].marketPrice,50);assert.equal(saved.catalog.items[0].priceCheckedAt,1000);
 assert.equal(saved.catalog.items[1].marketPrice,200);assert.equal(saved.catalog.items[1].priceCheckedAt,2000,'An older zero must not replace a newer price');
 assert.equal(saved.catalog.items[2].priceAvailable,false);assert.equal(saved.catalog.pricesAt,0);assert.equal(saved.catalog.partialPrices,true);
 time=3000;const keyed=shared.catalog({key:'coverage',force:true,needPrices:true});while(requests<6)await new Promise(resolve=>setImmediate(resolve));
 releases.shift()({items:{1:{name:'Keyed A',value:{market_price:0}},2:{name:'Keyed B',value:{market_price:250}}}});
 const keyedResult=await keyed;assert.equal(keyedResult.items[0].marketPrice,0);assert.equal(keyedResult.items[0].priceCheckedAt,3000,'Object-keyed IDs and authoritative zero prices must be retained');
}
console.log('Shared field coverage: mixed consumers, partial level, late useful prices, no metadata rollback/resurrection and keyed zero prices passed.');


