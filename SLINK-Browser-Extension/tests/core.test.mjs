import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');
const values = new Map();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function load(context, relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

const chrome = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return values.has(key) ? { [key]: values.get(key) } : {};
        return Object.fromEntries(values);
      },
      async set(entries) {
        for (const [key, value] of Object.entries(entries)) values.set(key, value);
      },
      async remove(key) {
        for (const item of Array.isArray(key) ? key : [key]) values.delete(item);
      }
    }
  },
  permissions: {
    async contains() { return true; }
  },
  runtime: {
    async sendMessage() { return { ok: true, data: { echoed: true } }; }
  }
};

const context = vm.createContext({
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
  URL
});
context.globalThis = context;

for (const file of [
  'src/core/runtime.js',
  'src/core/format.js',
  'src/core/storage.js',
  'src/core/permissions.js',
  'src/core/messaging.js',
  'src/core/modules.js',
  'src/core/http.js',
  'src/core/worker-client.js',
  'src/core/torn-api-limiter.js'
]) load(context, file);

const SLINK = context.SLINK_EXTENSION;
assert(SLINK.VERSION === '0.1.1', 'Unexpected runtime version.');
assert(SLINK.core.format.escapeHtml('<a>') === '&lt;a&gt;', 'HTML escaping failed.');
assert(SLINK.core.format.shortNumber(1_250_000) === '1.25M', 'Short-number formatting failed.');

const permissions = SLINK.core.permissions;
assert(permissions.hasScope({ scopes: ['leveling.read'] }, 'leveling.read'), 'Exact scope matching failed.');
assert(permissions.hasScope({ scopes: ['leveling.*'] }, 'leveling.configure'), 'Wildcard scope matching failed.');
assert(!permissions.hasScope({ scopes: ['leveling.read'] }, 'admin.users'), 'Unrelated scope was granted.');
assert(permissions.hasScope({ roles: ['admin'] }, 'anything.at.all'), 'Admin role should satisfy client-side scope routing.');

await SLINK.core.storage.set('test.value', { working: true });
assert((await SLINK.core.storage.get('test.value')).working, 'Extension storage adapter failed.');
assert(values.has('slink.test.value'), 'Storage key was not namespaced.');

SLINK.modules.register({
  id: 'test-module',
  requiredScopes: ['test.read'],
  matches: url => url.hostname === 'www.torn.com',
  async start() { return { started: true }; }
});

const denied = await SLINK.modules.startAll({
  url: new URL('https://www.torn.com/index.php'),
  permissions: { scopes: [] }
});
assert(denied.denied.length === 1, 'Module permission denial failed.');

const started = await SLINK.modules.startAll({
  url: new URL('https://www.torn.com/index.php'),
  permissions: { scopes: ['test.read'] }
});
assert(started.started.includes('test-module'), 'Permitted module did not start.');
await SLINK.modules.stopAll();

assert(
  SLINK.core.http.validateUrl('tornApi', 'https://api.torn.com/v2/user').hostname === 'api.torn.com',
  'Approved HTTP origin was rejected.'
);
let blocked = false;
try {
  SLINK.core.http.validateUrl('tornApi', 'https://example.com/steal');
} catch (error) {
  blocked = error.code === 'SLINK_ORIGIN_BLOCKED';
}
assert(blocked, 'Unapproved HTTP origin was not blocked.');

const workerProbe = await SLINK.core.workerClient.probe({ deep: true });
assert(workerProbe.connected, 'Required SLINK Worker probe did not connect.');
assert(workerProbe.database === 'connected', 'Deep SLINK Worker health was not normalized.');

await SLINK.core.tornApiLimiter.reserve({ limit: 1, wait: false });
let limited = false;
try {
  await SLINK.core.tornApiLimiter.reserve({ limit: 1, wait: false });
} catch (error) {
  limited = error.code === 'SLINK_TORN_API_LIMIT';
}
assert(limited, 'Torn API limiter did not enforce its ledger.');

const router = SLINK.core.messaging.createRouter({
  async echo(payload) { return payload; }
});
const routed = await new Promise(resolve => {
  const keptOpen = router(
    { channel: 'slink', requestId: 4, type: 'echo', payload: { value: 7 } },
    {},
    resolve
  );
  assert(keptOpen === true, 'Async message route did not keep the channel open.');
});
assert(routed.ok && routed.data.value === 7, 'Message router returned the wrong response.');

console.log('Core storage, scopes, modules, HTTP guard, limiter, and messaging checks passed.');
