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
console.log('PDA Events tests passed.');
