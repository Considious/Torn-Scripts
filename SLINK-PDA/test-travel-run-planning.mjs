import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {test} from 'node:test';import fs from 'node:fs';import vm from 'node:vm';
const context=vm.createContext({module:{exports:{}}});vm.runInContext(fs.readFileSync(new URL('./src/addons/travel-run.js',import.meta.url),'utf8'),context);const raw=context.module.exports;const T={...raw,feedbackOutcome(...args){const result=raw.feedbackOutcome(...args);return result===null?null:JSON.parse(JSON.stringify(result));}};
const runtime=fs.readFileSync(new URL('./src/00-runtime-core.part',import.meta.url),'utf8');let snippet='';for(const line of runtime.slice(runtime.indexOf('const ABROAD_STOCKS = (() => {')).split('\n')){snippet+=line+'\n';try{new vm.Script(snippet);break;}catch{}}const core=vm.createContext({});vm.runInContext(snippet+'globalThis.abroad=ABROAD_STOCKS;',core);
const now=Date.UTC(2026,10,22,12),countries=core.abroad.COUNTRIES;
const row=(country,item,id,quantity,cost,at=now)=>({countryCode:country,itemName:item,itemId:id,sources:{yata:{quantity,cost,updatedAt:at}}});
const snapshot={countries,settings:{travelMethod:'airstrip'},rows:[row('mex','Flower',1,30,100),row('can','Xanax',2,12,500),row('can','Flower',1,30,200)],catalog:{pricesAt:now,items:[{id:1,marketPrice:600},{id:2,marketPrice:1000}]}};
test('planning uses the established Abroad Stocks travel times and shopping priorities',()=>{
 const report=T.travelPlanning(T.plan({buys:['Xanax','Flower'],capacity:10,cash:3500,shoppingMinutes:15}),snapshot,now);
 assert.equal(report.recommendations[0].country.code,'can');const chosen=report.recommendations[0];assert.equal(chosen.minutes,27);assert.equal(chosen.arrivalAt,now+27*60000);assert.equal(chosen.returnAt,now+69*60000);
 assert.equal(chosen.items[0].quantity,7);assert.equal(chosen.items[1].quantity,0);assert.equal(chosen.totalCost,3500);assert.equal(chosen.totalProfit,3500);assert.equal(chosen.remainingCapacity,3);
});
test('no quantities or totals are invented when carrying space or pricing is unknown',()=>{
 const report=T.travelPlanning(T.plan({buys:['Xanax'],destination:'Canada'}),{...snapshot,catalog:null},now).selected;
 assert.equal(report.items[0].quantity,null);assert.equal(report.items[0].unitProfit,null);assert.equal(report.totalProfit,null);assert.equal(report.minutes,27);
});
test('stale reports do not count as available recommendations',()=>{
 const report=T.travelPlanning(T.plan({buys:['Xanax']}),{...snapshot,rows:[row('can','Xanax',2,20,500,now-16*60000)]},now);
 assert.equal(report.recommendations.length,0);const selected=T.travelPlanning(T.plan({buys:['Xanax'],destination:'Canada'}),{...snapshot,rows:[row('can','Xanax',2,20,500,now-16*60000)]},now).selected;
 assert.equal(selected.items[0].fresh,false);assert.equal(selected.items[0].quantity,null);assert.equal(selected.items[0].unitProfit,null);
});
test('future provider timestamps and stale market values cannot generate reliable profit',()=>{
 let report=T.travelPlanning(T.plan({buys:['Xanax'],destination:'Canada',capacity:10}),{...snapshot,catalog:{...snapshot.catalog,pricesAt:now-2*86400000}},now).selected;
 assert.equal(report.items[0].unitProfit,null);
 report=T.travelPlanning(T.plan({buys:['Xanax'],destination:'Canada'}),{...snapshot,rows:[row('can','Xanax',2,20,500,now+10*60000)]},now).selected;assert.equal(report.items[0].provider,undefined);
});
test('restock forecasts use existing provider estimates without inventing quantities',()=>{
 const stock={...row('can','Xanax',2,0,500),nextRestockAt:now+60*60000,predictionSource:'SLINK observed history'};
 const report=T.travelPlanning(T.plan({buys:['Xanax'],capacity:10}),{...snapshot,rows:[stock]},now).recommendations[0];
 assert.equal(report.available,0);assert.equal(report.restockOptions,1);assert.equal(report.items[0].quantity,0);assert.equal(report.items[0].nextRestockAt,stock.nextRestockAt);
});
test('reported stock is not combined across conflicting providers',()=>{
 const stock={...row('can','Xanax',2,20,500,now-60000),sources:{yata:{quantity:20,cost:500,updatedAt:now-60000},prometheus:{quantity:0,cost:600,updatedAt:now}}};
 const selected=T.travelPlanning(T.plan({buys:['Xanax'],destination:'Canada',capacity:10}),{...snapshot,rows:[stock]},now).selected;
 assert.equal(selected.items[0].provider,'prometheus');assert.equal(selected.items[0].stock,0);assert.equal(selected.items[0].quantity,0);
});
test('cash, stock, carrying limits, and native quantity max all constrain preparation',()=>{
 const row={stock:20,cost:500,quantity:{max:'12'}};
 assert.equal(T.purchaseLimit(row,{capacity:10,cash:2000}),4);assert.equal(T.purchaseLimit(row,{capacity:0,cash:2000}),0);assert.equal(T.purchaseLimit({stock:null,cost:null},{capacity:null,cash:null}),null);
});
test('recommendations do not offer purchases that cannot fit known cash or capacity',()=>{
 for(const constraints of [{capacity:0,cash:10000},{capacity:10,cash:1},{capacity:null,cash:1}]){
  const report=T.travelPlanning(T.plan({buys:['Xanax'],...constraints}),snapshot,now);assert.equal(report.recommendations.length,0);assert.equal(report.constraintsBlocked,true);
 }
});
test('observed feedback requires a matching successful action and item',()=>{
 const node=text=>({textContent:text,getAttribute:()=>null});
 assert.deepEqual(T.feedbackOutcome(node('You purchased 3 x Xanax for $1,500.'),{type:'buy',item:'Xanax'}),{result:'done',quantity:3});
 assert.deepEqual(T.feedbackOutcome(node('You sold 2 Opium for $500.'),{type:'sell',item:'Opium'}),{result:'done',quantity:2});
 for(const text of ['Buy Xanax?','Success','You bought Teddy Bear.','You bought 0 Bear.','You bought Flower.'])assert.equal(T.feedbackOutcome(node(text),{type:'buy',item:'Bear'}),null);
 assert.deepEqual(T.feedbackOutcome(node('Xanax purchase failed: insufficient cash'),{type:'buy',item:'Xanax'}),{result:'failed'});
 assert.deepEqual(T.feedbackOutcome(node('Xanax is sold out'),{type:'buy',item:'Xanax'}),{result:'failed'});
});
test('plans remain compatible, bounded, and independent from gameplay requests',()=>{
 assert.equal(T.plan({buys:['Xanax',' xanax '],capacity:0,cash:0}).buys.length,1);assert.equal(T.plan({capacity:0}).capacity,0);assert.equal(T.plan({cash:''}).cash,null);
 assert.equal(T.plan({nextTrips:['Mexico','Canada','Japan','China']}).nextTrips.length,3);assert.doesNotMatch(fs.readFileSync(new URL('./src/addons/travel-run.js',import.meta.url),'utf8'),/fetch\(|XMLHttpRequest|requestJson|\.submit\(|requestSubmit\(/);
});
