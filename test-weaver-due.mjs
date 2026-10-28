import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pda=import.meta.url.endsWith('/test-weaver-due.mjs');
const source=fs.readFileSync(new URL(pda?'./src/10-market-runtime.part':'../src/background/market-service.js',import.meta.url),'utf8');
const start=source.indexOf(pda?'async function pollMarketWeaverTargets(':'  async function pollWeaverTargets(');
const end=source.indexOf(pda?'function marketErrorSummary(':'  function nextAt(',start);
assert(start>=0&&end>start,'Weaver polling function boundaries are missing');
const functionSource=source.slice(start,end);
const now=1800000000000;
let summaries=0,details=[];
const watches=[{uid:'a',itemId:1},{uid:'b',itemId:2}];
let targets=watches.map(watch=>({itemId:watch.itemId,threshold:100,manual:[watch],pricelist:false}));
const runtime={results:{a:{bazaar:{nextCheckAt:now+5000,marker:'cached-a'}},b:{bazaar:{nextCheckAt:now+5000,marker:'cached-b'}}},pricelistResults:{}};
const summary=async()=>{summaries++;return {fetchedAt:now,items:[{itemId:1,lowestPrice:50},{itemId:2,lowestPrice:50}]};};
const request=async url=>{details.push(url);return {listings:[{price:50}]};};
const store=(target,current,payload)=>{
  for(const watch of target.manual)current.results[watch.uid].bazaar=payload;
  if(target.pricelist)current.pricelistResults[target.itemId]={bazaar:payload};
};
const due=(row,force)=>force||!Number(row?.nextCheckAt)||Number(row.nextCheckAt)<=now;
const context=vm.createContext({Date:{now:()=>now},Map,
  URLS:{weaver:'https://weav3r.dev'},
  MARKET:{WEAVER_SUMMARY_REFRESH_MS:5000,weaverListings:body=>body.listings},
  WEAVER_SUMMARY_REFRESH_MS:5000,
  weaverTargets:()=>targets,marketWeaverTargets:()=>targets,due,marketDue:due,
  ensureWeaverSummary:summary,marketWeaverSummary:summary,
  weaverJson:request,marketWeaverJson:request,weaverListings:body=>body.listings,
  storeWeaverResult:(target,allowed,current,payload)=>store(target,current,payload),
  storeMarketWeaverResult:store
});
vm.runInContext(functionSource,context);
const poll=force=>context[pda?'pollMarketWeaverTargets':'pollWeaverTargets']({},watches,runtime,force);
await poll(false);
assert.equal(summaries,0,'Fresh unrelated watches must not refresh the summary');
assert.equal(details.length,0,'Fresh unrelated watches must not fetch detail');
runtime.results.b.bazaar={}; // Editing or adding this watch invalidates only its result.
await poll(false);
assert.equal(details.length,1);
assert.match(details[0],/\/marketplace\/2\?/);
assert.equal(runtime.results.a.bazaar.marker,'cached-a','Editing B must retain the cached A result');
await poll(true);
assert.equal(details.length,3,'An explicit forced refresh must still fetch both items');
targets=[{itemId:1,threshold:100,manual:[],pricelist:true}];
runtime.pricelistResults[1]={bazaar:{nextCheckAt:now+60000}};
const before=details.length;
await poll(false);
assert.equal(details.length,before,'Pricelist retry delays must be respected');
runtime.pricelistResults[1].bazaar.nextCheckAt=now;
await poll(false);
assert.equal(details.length,before+1,'Due pricelist items must still be checked');
targets=[{itemId:1,threshold:100,manual:[watches[0]],pricelist:true}];
runtime.results.a.bazaar.nextCheckAt=now;
runtime.pricelistResults[1].bazaar.nextCheckAt=now;
await poll(false);
assert.equal(details.length,before+2,'One item shared by manual and pricelist watches needs one detail fetch');
console.log((pda?'PDA':'Extension')+' Weaver due-time, unrelated-watch preservation, forced refresh, retry and shared-item checks passed.');
