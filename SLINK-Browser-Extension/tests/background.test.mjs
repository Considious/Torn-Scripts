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
      return origins.every(origin => [
        'https://api.torn.com/*',
        'https://slinkyleveling.richard-johnson554.workers.dev/*'
      ].includes(origin));
    }
  },
  runtime: {
    getManifest() { return { version: '0.1.1' }; },
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
  fetch: async input => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      ok: true,
      service: 'SLINK Leveling API',
      version: 'test-worker',
      ...(String(input).endsWith('/api/health') ? {
        database: 'connected',
        consent_database: 'connected'
      } : {})
    })
  }),
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
assert(alarms.has('slink.worker.connection'), 'Worker connection alarm was not created.');
assert(values.get('slink.worker.lastStatus')?.connected === true, 'Automatic Worker connection was not persisted.');

async function send(type, payload = {}, sender = { id: 'test' }) {
  return new Promise(resolve => {
    const keptOpen = onMessage.listeners[0](
      { channel: 'slink', requestId: 1, type, payload },
      sender,
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
assert(status.data.capabilities.slinkWorker.granted === true, 'Required Worker capability was not granted.');
assert(status.data.worker.connected === true, 'System status did not report a real Worker connection.');

const injection = await send(
  'content.ready',
  { url: 'https://www.torn.com/index.php' },
  { id: 'test', tab: { id: 7, url: 'https://www.torn.com/index.php' } }
);
assert(injection.ok && injection.data.tabId === 7, 'Torn page injection was not recorded.');

const diagnostic = await send('diagnostics.run');
assert(diagnostic.ok && diagnostic.data.source === 'manual', 'Manual diagnostic route failed.');
assert(values.get('slink.diagnostics.lastRun')?.source === 'manual', 'Manual diagnostic result was not persisted.');
assert(diagnostic.data.worker.database === 'connected', 'Diagnostic did not include deep Worker health.');
assert(diagnostic.data.pageInjection.tabId === 7, 'Diagnostic did not include Torn injection state.');

values.delete('slink.worker.lastStatus');
onAlarm.fire({ name: 'slink.worker.connection' });
await new Promise(resolve => setTimeout(resolve, 0));
assert(values.get('slink.worker.lastStatus')?.connected === true, 'Alarm connection status was not persisted.');

console.log('Background startup, alarm, capability, route, and diagnostic checks passed.');
