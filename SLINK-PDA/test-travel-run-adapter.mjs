import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {test} from 'node:test';
const source=fs.readFileSync(new URL('./src/90-shell-bootstrap.part',import.meta.url),'utf8');
test('Travel Run reads only shared cached Abroad Stocks planning data and respects its module switch',()=>{
 const begin=source.indexOf('travelRunPlanning:()=>{'),end=source.indexOf('inlineStatus:',begin);assert(begin>0&&end>begin);
 let enabled=true;const country={code:'can',name:'Canada'},catalog={items:[{id:1,marketPrice:1000}],pricesAt:123};
 const ctx=vm.createContext({moduleMonitoringEnabled:module=>{assert.equal(module,'travel-run');return enabled;},ABROAD_STOCKS:{COUNTRIES:[country]},PDA_ABROAD:{status:()=>({rows:[{countryCode:'can',itemName:'Xanax'}],fetchedAt:456,settings:{travelMethod:'airstrip'}})},dataState:{apiKey:'never-return-key',ffKey:'never-return-ff-key',sessions:{token:'never-return-session'},settings:{abroadStocks:{travelMethod:'airstrip',tornIntelKey:'never-return-provider-key'}},caches:{abroadStocks:{rows:[{countryCode:'can',itemName:'Xanax'}],fetchedAt:456},sharedProviders:{catalog}}},requestJson:()=>{throw Error('No requests may be made');}});
 vm.runInContext('globalThis.adapter={'+source.slice(begin,end)+'};',ctx);const result=ctx.adapter.travelRunPlanning();assert.equal(result.rows.length,1);assert.equal(result.countries[0].code,'can');assert.equal(result.catalog,catalog);assert.equal(result.settings.travelMethod,'airstrip');assert(!JSON.stringify(result).includes('never-return'));
 enabled=false;assert.throws(()=>ctx.adapter.travelRunPlanning(),/paused in Access/);
});
