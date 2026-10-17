import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

let plugin = null;
const storedSettings = {};
const context = {
  console,
  document:{ body:null },
  setInterval() { return 1; },
  setTimeout(callback) { callback(); return 1; },
  addEventListener() {},
  SLINK_PDA_PLUGIN_API:{
    register(value) { plugin = value; },
    settings(id, defaults) { storedSettings[id] ||= { ...defaults }; return storedSettings[id]; },
    cache() { return {}; },
    save() {},
    hasScope() { return false; },
    root() { return null; },
    lockedModule() { return ''; },
    moduleMessage() { return ''; },
    actionLink() { return ''; },
    relativeTime() { return ''; },
    escapeHtml(value) { return String(value); },
    errorMessage(error) { return String(error?.message || error); },
    ensurePermission:async () => {},
    tornJson:async () => ({})
  }
};
context.globalThis = context;
vm.runInNewContext(await readFile(new URL('./src/addons/events.addon.js', import.meta.url), 'utf8'), context);
assert.equal(plugin.id, 'events');
assert.equal(plugin.scope, 'slink.qol.events');

const now = Date.UTC(2026, 9, 12, 12);
const calendar = plugin.test.mergeCalendars({
  calendar:[
    { id:'halloween', name:'Halloween', start:Math.floor((now + 86_400_000) / 1000), end:Math.floor((now + 5 * 86_400_000) / 1000) },
    { id:'christmas', name:'Christmas Town', start:Math.floor((now + 30 * 86_400_000) / 1000), end:Math.floor((now + 40 * 86_400_000) / 1000) }
  ]
}, {
  calendar:[{ id:'personal-halloween', name:'Halloween', start:Math.floor((now + 2 * 86_400_000) / 1000) }]
}, now);
assert.equal(calendar.events.length, 2);
assert.equal(calendar.next.name, 'Halloween');
assert.equal(calendar.next.personalized, true);
assert.equal(calendar.next.startAt, now + 2 * 86_400_000);
storedSettings.events = { selectedId:'christmas' };
assert.equal(plugin.test.selectedEvent(calendar).name, 'Christmas Town');

assert.equal(plugin.test.UPGRADE_ORDER.length, 20);
assert.deepEqual(Array.from(plugin.test.UPGRADE_ORDER.slice(0,8), entry => entry.name), [
  'I See Dead People', "Here's Johnny", 'Doubler', 'Tripler', 'Quadrupler', 'Cat in Hell', 'Quintupler', 'Shadow of Doubt'
]);
assert.equal(plugin.test.basketRank('Halloween Basket : Terrifying'), 'Terrifying');
const guide = plugin.test.recommendations([
  ...[1,2,3,4,5,13,6].map(upgradeId => ({ upgradeId, unlocked:true })),
  { upgradeId:23, unlocked:false, disabled:true, selected:true },
  { upgradeId:19, unlocked:false, disabled:true },
  { upgradeId:20, unlocked:false, disabled:true }
]);
assert.equal(guide.completedCount, 7);
assert.deepEqual(Array.from(guide.recommendations, entry => entry.name), ['Shadow of Doubt','Multipack','Deal with the Devil']);
assert.equal(guide.recommendations[0].disabled, true);
assert.equal(plugin.test.recommendations([{ upgradeId:13, selected:true, unlocked:false }],7).recommendations.some(entry => entry.name === 'Cat in Hell'), true);
const yearRound=plugin.test.mergeCalendars({calendar:[{id:'christmas',name:'Christmas Town',start:Math.floor((now+30*86400000)/1000)}]}, {}, now);
assert.equal(yearRound.next.name,'Christmas Town');
assert.equal(yearRound.events.some(event=>event.id==='guide:halloween'&&event.guideOnly),true);
console.log('PDA Events tests passed.');

