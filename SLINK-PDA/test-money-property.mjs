import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

let plugin = null;
const storedSettings = {};
const context = {
  console,
  setInterval() { return 1; },
  SLINK_PDA_PLUGIN_API:{
    register(value) { plugin = value; },
    settings(id, defaults) {
      storedSettings[id] ||= { ...defaults, stockAlerts:{ ...(defaults.stockAlerts || {}) } };
      return storedSettings[id];
    },
    cache() { return {}; },
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
    properties:[{id:1,name:'Private Island',current:true,upkeep_owed:1500000,rental:{days_left:2},lease_extension:{status:'pending'}}],
    stocks:[{id:1,shares:50}],
    honors:[{name:'Something Else'}]
  },
  tornStocks:{stocks:[{id:1,name:'Test Stock',acronym:'TST',current_price:1000,benefits:[{shares_required:100,description:'$700,000 every 7 days'}]}]},
  itemCatalog:[]
}, now);
assert.equal(status.money.availableCash, 5000000);
assert.equal(status.bank.matured, true);
assert.equal(status.currentProperty.name, 'Private Island');
assert.equal(status.stocks[0].incrementalCost, 50000);
storedSettings.moneyProperty = { enabled:true, bankLeadHours:2, rentalLeadDays:3, cashierLeadHours:24, upkeepThreshold:1000000, loanReminder:true, soundEnabled:false, stockAlerts:{ [status.stocks[0].alertKey]:true } };
const alerts = plugin.test.buildAlerts(status, now);
assert.ok(alerts.some(alert => alert.id === 'money-property:bank-matured'));
assert.ok(alerts.some(alert => alert.id === 'money-property:upkeep'));
assert.ok(alerts.some(alert => alert.id.startsWith('money-property:stock:')));
console.log('PDA Money and Property tests passed.');
