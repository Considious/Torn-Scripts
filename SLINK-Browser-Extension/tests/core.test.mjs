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
        consent_database: 'connected',
        permissions_database: 'connected'
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
  'src/core/war.js',
  'src/core/themes.js',
  'src/core/messaging.js',
  'src/core/modules.js',
  'src/core/http.js',
  'src/core/worker-client.js',
  'src/core/torn-api-limiter.js'
]) load(context, file);

const SLINK = context.SLINK_EXTENSION;
assert(SLINK.VERSION === '0.6.0', 'Unexpected runtime version.');
assert(SLINK.core.format.escapeHtml('<a>') === '&lt;a&gt;', 'HTML escaping failed.');
assert(SLINK.core.format.shortNumber(1_250_000) === '1.25M', 'Short-number formatting failed.');

const permissions = SLINK.core.permissions;
assert(Object.values(permissions.BROWSER_CAPABILITIES).every(capability => capability.optional === false), 'A core host was marked optional.');
assert(permissions.BROWSER_CAPABILITIES.contributionWorker, 'Contribution Worker capability is missing.');
assert(SLINK.core.themes.get().tokens['--slink-bg'], 'Theme token registry is missing.');
assert(permissions.hasScope({ scopes: ['slink.level'] }, 'slink.level'), 'Exact scope matching failed.');
assert(permissions.hasScope({ scopes: ['admin.*'] }, 'admin.users'), 'Wildcard scope matching failed.');
assert(!permissions.hasScope({ roles: ['admin'], scopes: ['slink.level'] }, 'admin.users'), 'Roles must not bypass signed scope checks.');
const combinedPermissions = permissions.combineSnapshots(
  { userId:3853023, roles:['admin'], scopes:['admin.*','slink.level'], expiresAt:Date.now() + 100_000 },
  { userId:3853023, roles:['admin'], scopes:['admin.*','slink.war'], expiresAt:Date.now() + 200_000 }
);
assert(combinedPermissions.scopes.join(',') === 'admin.*,slink.level,slink.war', 'Product scopes were not combined without duplication.');
assert(!permissions.combineSnapshots({ userId:1, scopes:['expired.product'], expiresAt:Date.now() - 1 }).scopes.length, 'Expired product scopes remained visible.');
assert(SLINK.core.war.makeWarId(46978, 46999, 1_777_000_000) === 'rw_46978_46999_1777000000', 'Second-based War identity was changed.');
assert(SLINK.core.war.makeWarId(46978, 46999, 1_777_000_000_000) === 'rw_46978_46999_1777000000', 'Millisecond-based War identity was not normalized.');
assert(SLINK.core.war.sortMembers([
  { id:2, name:'Hospital', activity:'Offline', statusState:'Hospital', statusUntil:Math.floor(Date.now() / 1000) + 60 },
  { id:1, name:'Ready', activity:'Online', statusState:'Okay' }
])[0].id === 1, 'Available War targets were not sorted before hospitalized targets.');

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

console.log('Core storage, required hosts, scopes, modules, HTTP guard, limiter, and messaging checks passed.');
