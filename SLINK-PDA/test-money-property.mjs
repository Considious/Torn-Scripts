import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

let plugin = null;
const storedSettings = {};
const storedCache = {};
const context = {
  console,
  setInterval() { return 1; },
  SLINK_PDA_PLUGIN_API:{
    register(value) { plugin = value; },
    settings(id, defaults) {
      storedSettings[id] ||= { ...defaults, stockAlerts:{ ...(defaults.stockAlerts || {}) } };
      return storedSettings[id];
    },
    cache() { return storedCache; },
    save() {},
    hasScope() { return false; },
    root() { return null; },
    lockedModule() { return ''; },
    moduleMessage() { return ''; },
    actionLink() { return ''; },
    relativeTime() { return ''; },
    escapeHtml(value) { return String(value); },
    number(value) { return Number(value).toLocaleString(); },
    errorMessage(error) { return String(error?.message || error); },
    alertsChanged() {},
    ensurePermission:async () => {},
    tornJson:async () => ({}),
    catalogItems:() => []
  }
};
context.globalThis = context;
vm.runInNewContext(await readFile(new URL('./src/addons/money-property.addon.js', import.meta.url), 'utf8'), context);
assert.equal(plugin.id, 'moneyProperty');
assert.equal(plugin.scope, 'slink.qol.money-property');

const now = 1_800_000_000_000;
const status = plugin.test.buildStatus({
  user:{
    money:{cash:3000000,faction:{money:2000000},city_bank:{amount:500000,time_left:0},duke_loan:{amount:250000}},
    properties:[{id:2,name:'Ranch'}],
    currentProperty:{id:1,name:'Private Island',current:true,upkeep_owed:1500000,rental:{days_left:2},lease_extension:{status:'pending'}},
    stocks:[{id:1,shares:50},{id:2,shares:0}],
    honors:[{name:'Something Else'}]
  },
  tornStocks:{stocks:[
    {id:1,name:'Test Stock',acronym:'TST',current_price:1000,benefits:[{shares_required:100,description:'$700,000 every 7 days'}]},
    {id:2,name:'No Income',acronym:'NIX',current_price:1000,benefits:[{shares_required:100,description:'Free advertising every 7 days'}]}
  ]},
  itemCatalog:[]
}, now);
assert.equal(status.money.availableCash, 5000000);
assert.equal(status.bank.matured, true);
assert.equal(status.currentProperty.name, 'Private Island');
assert.equal(status.stocks.length, 1);
assert.equal(status.stocks[0].incrementalCost, 50000);
assert.equal(status.stocks[0].payoutValue, 700000);
assert.equal(status.stocks[0].cadenceLabel, 'Every week');
storedSettings.moneyProperty = { enabled:true, bankLeadHours:2, rentalLeadDays:3, cashierLeadHours:24, upkeepThreshold:1000000, loanReminder:true, soundEnabled:false, stockAlerts:{ [status.stocks[0].alertKey]:true } };
const alerts = plugin.test.buildAlerts(status, now);
assert.ok(alerts.some(alert => alert.id === 'money-property:bank-matured'));
assert.ok(alerts.some(alert => alert.id === 'money-property:upkeep'));
assert.ok(alerts.some(alert => alert.id.startsWith('money-property:stock:')));

const bankInput={
  rates:{bank:[{days:7,rate:35},{days:14,rate:39},{days:30,rate:48},{days:60,rate:24},{days:90,rate:47}]},
  userMerits:{merits:{upgrades:[{id:42,level:10}]}},
  meritCatalog:{merits:[{id:42,name:'Bank Interest',description:'Increases bank interest'}]},
  tornStocks:{stocks:[{id:9,acronym:'TCI',bonus:{requirement:1500000,description:'10% bank interest'}}]},
  userStocks:{stocks:[{id:9,shares:1500000,bonus:{available:true,progress:7,frequency:7}}]}
};
const comparison=plugin.test.bankComparison(bankInput,2000000000);
assert.equal(comparison.rows.length,5);
assert.equal(comparison.meritLevel,10);
assert.equal(comparison.stock.active,true);
assert.equal(comparison.best,30,'One month must beat two months when its own APR is higher.');
assert.equal(comparison.rows[2].profit,comparison.rows[3].profit,'Different term APRs can produce the same total profit.');
assert.ok(Math.abs(comparison.rows[0].effectiveApr-57.75)<1e-9,'Merit and bank stock bonuses must multiply.');
assert.ok(plugin.test.bankComparison(bankInput,2000000001).error,'Do not silently accept more than $2B.');
assert.ok(plugin.test.bankComparison({...bankInput,userMerits:null},1e9).error,'Unknown merits must not become zero merits.');
assert.equal(plugin.test.bankComparison({...bankInput,userStocks:{stocks:[]}},1e9).stock.active,false);
assert.equal(plugin.test.bankComparison({...bankInput,userStocks:{stocks:[{id:9,shares:1500000,bonus:{available:false}}]}},1e9).stock.active,false,'Unvested holdings must not get the bank bonus.');

// Exercise the complete financial refresh with the real market catalog parser,
// rather than mocking away the function that failed on the reported page.
const market=await readFile(new URL('./src/10-market-runtime.part',import.meta.url),'utf8');
const parserContext={};
vm.createContext(parserContext);
vm.runInContext(market.slice(market.indexOf('function catalogItems('),market.indexOf('function marketListings(')),parserContext);
context.SLINK_PDA_PLUGIN_API.catalogItems=parserContext.catalogItems;
context.SLINK_PDA_PLUGIN_API.hasScope=()=>true;
const calls=[];
context.SLINK_PDA_PLUGIN_API.tornJson=async path=>{
  calls.push(path);
  if(path==='/v2/torn/bank')return bankInput.rates;
  if(path==='/v2/torn/merits')return bankInput.meritCatalog;
  if(path==='/v2/user/merits')return bankInput.userMerits;
  if(path==='/v2/user/stocks')return bankInput.userStocks;
  if(path==='/v2/torn/stocks')return bankInput.tornStocks;
  if(path.startsWith('/v2/torn/items'))return {items:[{id:206,name:'Xanax',value:{market_price:800000}}]};
  if(path==='/v2/user/money')return {money:{wallet:12345}};
  return {};
};
context.crypto=(await import('node:crypto')).webcrypto;context.TextEncoder=TextEncoder;
vm.runInContext(await readFile(new URL('./src/00-shared-data.part',import.meta.url),'utf8'),context);
const providers=context.SLINK_SHARED_DATA.create({
read:()=>storedCache.sharedProviders||{},write:value=>{storedCache.sharedProviders=value;},
normalizeItems:parserContext.catalogItems,
request:()=>context.SLINK_PDA_PLUGIN_API.tornJson('/v2/torn/items?cat=All&sort=ASC')
});
context.SLINK_PDA_PLUGIN_API.sharedCatalog=options=>providers.catalog({key:'fixture',...options});
assert.equal((await plugin.refresh(true)).money.cashOnHand,12345);
assert.equal(storedCache.itemCatalog[0].marketPrice,800000);
assert.equal(plugin.test.bankComparison(storedCache.bankPlanner,2e9).rows.length,5);
calls.length=0;
storedCache.fetchedAt=0;
await plugin.refresh(false);
assert.ok(!calls.includes('/v2/torn/bank'),'Opening the page again must reuse bank rates within one hour.');
console.log('PDA Money and Property tests passed.');
