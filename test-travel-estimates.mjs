import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const pda=import.meta.url.endsWith('/test-travel-estimates.mjs');
let source=fs.readFileSync(new URL(pda?'./src/00-runtime-core.part':'../src/core/abroad-stocks.js',import.meta.url),'utf8');
if(pda){const start=source.indexOf('const ABROAD_STOCKS = (() => {'),end=source.indexOf('\n})();',start);assert(start>=0&&end>start);source=source.slice(start,end+6)+'\nthis.abroad=ABROAD_STOCKS;';}
const api={core:{},define(group,name,value){this[group][name]=value;}};
const context=vm.createContext({SLINK_EXTENSION:api,Intl,Date});
vm.runInContext(source,context);
const abroad=pda?context.abroad:api.core.abroadStocks;
// Official Torn Wiki without-book table, verified 2026-10-26. No arbitrary rounding formula.
const rows=[['mex',24,17,12,7],['cay',33,23,17,10],['can',39,27,19,12],['haw',127,89,63,38],['uni',151,106,75,45],['arg',158,111,79,47],['swi',166,116,83,50],['jap',213,149,107,64],['chi',229,160,114,69],['uae',257,180,128,77],['sou',282,197,141,85]];
for(const [code,...times]of rows)for(const [i,method]of ['standard','airstrip','private','business'].entries()){
 assert.equal(abroad.travelMinutes(code,method),times[i],`${code} ${method}`);
 assert.equal(abroad.travelMinutes(code,method,3),times[i]+3,'Arrival buffer is added once');
 const at=1800000000000;
 assert.equal(abroad.departureAt({countryCode:code,nextRestockAt:at},{travelMethod:method,arrivalBufferMinutes:3}),at-(times[i]+3)*60000);
}
assert.equal(abroad.travelMinutes('mex','unknown'),24);
assert.equal(abroad.travelMinutes('mex','standard',-3),24);
assert.equal(abroad.travelMinutes('unknown','standard'),null,'Unknown provider destinations must not get invented travel times');
console.log((pda?'PDA':'Extension')+' all 44 travel estimates, departure times, arrival buffers and unknown-destination handling passed.');
