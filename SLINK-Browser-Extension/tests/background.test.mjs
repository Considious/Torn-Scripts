import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');
const workerDirectory = path.join(root, 'src', 'background');
const values = new Map();
const alarms = new Map();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function event() {
  const listeners = [];
  return {
    addListener(listener) { listeners.push(listener); },
    fire(...args) { return listeners.map(listener => listener(...args)); },
    listeners
  };
}

const onMessage = event();
const onInstalled = event();
const onStartup = event();
const onAlarm = event();

const chrome = {
  alarms: {
    async create(name, details) { alarms.set(name, { name, ...details }); },
    async get(name) { return alarms.get(name); },
    onAlarm
  },
  permissions: {
    async contains({ origins }) {
      return origins.every(origin => origin === 'https://api.torn.com/*');
    }
  },
  runtime: {
    getManifest() { return { version: '0.1.0' }; },
    onInstalled,
    onMessage,
    onStartup
  },
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return values.has(key) ? { [key]: values.get(key) } : {};
        return Object.fromEntries(values);
      },
      async remove(key) {
        for (const item of Array.isArray(key) ? key : [key]) values.delete(item);
      },
      async set(entries) {
        for (const [key, value] of Object.entries(entries)) values.set(key, value);
      }
    }
  }
};

let context;
context = vm.createContext({
  chrome,
  console,
  setTimeout,
  clearTimeout,
  URL,
  importScripts(...relativePaths) {
    for (const relativePath of relativePaths) {
      const filename = path.resolve(workerDirectory, relativePath);
      vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    }
  }
});
context.globalThis = context;

const workerPath = path.join(workerDirectory, 'service-worker.js');
vm.runInContext(fs.readFileSync(workerPath, 'utf8'), context, { filename: workerPath });
await new Promise(resolve => setTimeout(resolve, 0));

assert(onMessage.listeners.length === 1, 'Background message router was not registered.');
assert(onInstalled.listeners.length === 1, 'Install listener was not registered.');
assert(onStartup.listeners.length === 1, 'Startup listener was not registered.');
assert(onAlarm.listeners.length === 1, 'Alarm listener was not registered.');
assert(values.get('slink.ui.pagePanelHidden') === false, 'Default page-panel state was not created.');
assert(values.get('slink.permissions.snapshot')?.scopes?.[0] === 'diagnostics.read', 'Safe bootstrap scope was not created.');
assert(alarms.has('slink.diagnostics.heartbeat'), 'Diagnostic heartbeat alarm was not created.');

async function send(type, payload = {}) {
  return new Promise(resolve => {
    const keptOpen = onMessage.listeners[0](
      { channel: 'slink', requestId: 1, type, payload },
      { id: 'test' },
      resolve
    );
    assert(keptOpen === true, `Route ${type} did not keep the response channel open.`);
  });
}

const status = await send('system.status');
assert(status.ok, 'System status route failed.');
assert(status.data.permissions.scopes.includes('diagnostics.read'), 'System status omitted bootstrap scopes.');
assert(status.data.capabilities.tornApi.granted === true, 'Capability status did not report the granted mock host.');
assert(status.data.capabilities.ffscouter.granted === false, 'Capability status reported an ungranted host.');

const diagnostic = await send('diagnostics.run');
assert(diagnostic.ok && diagnostic.data.source === 'manual', 'Manual diagnostic route failed.');
assert(values.get('slink.diagnostics.lastRun')?.source === 'manual', 'Manual diagnostic result was not persisted.');

onAlarm.fire({ name: 'slink.diagnostics.heartbeat' });
await new Promise(resolve => setTimeout(resolve, 0));
assert(values.get('slink.diagnostics.lastRun')?.source === 'alarm', 'Alarm diagnostic result was not persisted.');

console.log('Background startup, alarm, capability, route, and diagnostic checks passed.');
