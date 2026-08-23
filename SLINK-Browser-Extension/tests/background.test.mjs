import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');
const workerDirectory = path.join(root, 'src', 'background');
const values = new Map();
const alarms = new Map();
const claimRequestBodies = [];
let observationRequests = 0;
let claimScheduleBucket = 300;
let tornStatusState = 'Okay';

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
        'https://ffscouter.com/*',
        'https://slinkyleveling.richard-johnson554.workers.dev/*'
      ].includes(origin));
    }
  },
  runtime: {
    getManifest() { return { version: '0.3.2' }; },
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
  fetch: async (input, options = {}) => {
    const url = new URL(String(input));
    let body = { ok: true };
    if (url.hostname === 'slinkyleveling.richard-johnson554.workers.dev') {
      if (url.pathname === '/') body = { ok: true, service: 'SLINK Leveling API', version: 'test-worker' };
      if (url.pathname === '/api/health') body = { ok: true, version: 'test-worker', database: 'connected', consent_database: 'connected', permissions_database: 'connected' };
      if (url.pathname === '/api/terms') body = {
        ok: true,
        version: 'test-terms',
        effective_at: '2026-08-14',
        document_url: 'https://example.test/terms',
        document_sha256: 'terms-hash',
        disclosure_version: 'test-disclosure',
        disclosure_sha256: 'disclosure-hash',
        leveling_service_summary: 'Test disclosure.'
      };
      if (url.pathname === '/api/auth') body = {
        ok: true,
        session_token: 'signed-test-session',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        user_id: 3853023,
        roles: ['admin'],
        scopes: ['admin.*', 'slink.level']
      };
      if (url.pathname === '/api/recommendations') body = {
        ok: true,
        version: 'test-worker',
        collector: true,
        collector_expires_at: Date.now() + 300_000,
        targets: [{ id: 123, name: 'Target', level: 50, status: 'Okay', total_stats: 1000 }]
      };
      if (url.pathname === '/api/checks/claim') {
        claimRequestBodies.push(JSON.parse(String(options.body || '{}')));
        body = {
        ok: true,
        collector: true,
        coordination: 'client_rendezvous_hash',
        schedule: 'client_deterministic_time_bucket',
        schedule_bucket: claimScheduleBucket,
        batch_id: `extension-session:${claimScheduleBucket}`,
        collector_user_id: 3853023,
        collector_session_id: 'extension-session',
        collector_roster: [{ user_id: 3853023, session_id: 'extension-session' }],
        targets: [{
          id: 123,
          name: 'Target',
          level: 50,
          total_stats: 1000,
          has_status: 1,
          previous_status: 'Okay',
          previous_status_until: 0,
          previous_last_checked_at: Date.now(),
          next_check_at: 0,
          competition_score: 0,
          competition_tier: 'Prime',
          hiding_out: 0,
          permanent_federal: 0,
          activity_last_seen_at: 0,
          recommendation_leased: 0
        }],
          checks: []
        };
      }
      if (url.pathname === '/api/targets') body = { ok: true, targets: [{ id: 123 }] };
      if (url.pathname === '/api/observations') {
        observationRequests++;
        body = {
          ok: true,
          accepted_count: 1,
          rejected_count: 0,
          accepted: [{ target_id: 123 }],
          rejected: []
        };
      }
    } else if (url.hostname === 'api.torn.com') {
      if (url.pathname.endsWith('/battlestats')) body = {
        battlestats: { strength: 100, defense: 100, speed: 100, dexterity: 100, total: 400 }
      };
      else if (url.pathname.endsWith('/snapshot')) body = 'id,name\n123,Target\n';
      else body = {
        profile: {
          status: {
            state: tornStatusState,
            description: tornStatusState,
            until: tornStatusState === 'Hospital' ? Math.floor(Date.now() / 1000) + 600 : 0
          }
        }
      };
    } else if (url.hostname === 'ffscouter.com') {
      body = [{ player_id: 123, fair_fight: 2, bs_estimate: 1000, source: 'FFScouter' }];
    }
    return {
      ok: true,
      status: 200,
      text: async () => typeof body === 'string' ? body : JSON.stringify(body),
      requestMethod: options.method || 'GET'
    };
  },
  setTimeout,
  clearTimeout,
  URL,
  URLSearchParams,
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
assert(values.get('slink.permissions.snapshot')?.scopes?.length === 0, 'Unauthenticated bootstrap must not invent server scopes.');
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
assert(status.data.permissions.scopes.length === 0, 'System status invented an unauthenticated scope.');
assert(status.data.capabilities.tornApi.granted === true, 'Capability status did not report the granted mock host.');
assert(status.data.capabilities.ffscouter.granted === true, 'Required FFScouter capability was not granted.');
assert(status.data.capabilities.slinkWorker.granted === true, 'Required Worker capability was not granted.');
assert(status.data.worker.connected === true, 'System status did not report a real Worker connection.');
assert(status.data.leveling.terms.accepted === false, 'Fresh Leveling terms should require acceptance.');

const injection = await send(
  'content.ready',
  { url: 'https://www.torn.com/index.php' },
  { id: 'test', tab: { id: 7, url: 'https://www.torn.com/index.php' } }
);
assert(injection.ok && injection.data.tabId === 7, 'Torn page injection was not recorded.');

const saved = await send('leveling.settings.save', {
  tornKey: 'torn-test-key',
  ffKey: 'ff-test-key',
  pollSeconds: 60,
  minFF: 1,
  maxFF: 3,
  apiContributionLimit: 60,
  acceptTerms: true
});
assert(saved.ok && saved.data.session.authenticated, 'Leveling settings did not authenticate.');
assert(saved.data.permissions.scopes.includes('admin.*'), 'Worker-issued admin scope was not persisted.');
assert(!JSON.stringify(saved.data).includes('torn-test-key'), 'Public Leveling state leaked the Torn API key.');
assert(!JSON.stringify(saved.data).includes('signed-test-session'), 'Public Leveling state leaked the Worker session token.');

const prepared = await send('leveling.cycle.prepare');
assert(prepared.ok && prepared.data.status.runtime.targets.length === 1, 'Leveling cycle did not load recommendations.');
assert(prepared.data.checks.length === 1, 'Leveling cycle did not preserve assigned checks.');
assert(prepared.data.status.runtime.targets[0].fair_fight === 2, 'FFScouter result was not applied locally.');
assert(claimRequestBodies[0]?.scheduling_mode === 'client_v1', 'Client scheduling protocol was not requested.');

const checked = await send('leveling.check', prepared.data.checks[0]);
assert(checked.ok && checked.data.target_id === 123, 'Assigned Torn check failed.');
assert(checked.data.completed_locally === true, 'Stable Okay result was not completed locally.');
const submitted = await send('leveling.observations.submit', { observations: [checked.data] });
assert(submitted.ok && submitted.data.runtime.pendingChecks === 0, 'Local completion did not clear pending work.');
assert(observationRequests === 0, 'Stable Okay completion contacted the Worker observation route.');

claimScheduleBucket = 303;
tornStatusState = 'Hospital';
const changedPrepared = await send('leveling.cycle.prepare');
assert(changedPrepared.ok && changedPrepared.data.checks.length === 1, 'Changed-status test was not scheduled.');
const changedCheck = await send('leveling.check', changedPrepared.data.checks[0]);
assert(changedCheck.ok && changedCheck.data.completed_locally !== true, 'Changed status was incorrectly completed locally.');
const changedSubmitted = await send('leveling.observations.submit', { observations: [changedCheck.data] });
assert(changedSubmitted.ok && observationRequests === 1, 'Changed status was not reported to the Worker.');

const zeroContribution = await send('leveling.settings.save', { apiContributionLimit: 0 });
assert(zeroContribution.ok, 'Admin zero-contribution setting failed.');
assert(zeroContribution.data.settings.apiContributionLimit === 0, 'Admin zero-contribution override was not saved.');
const zeroPrepared = await send('leveling.cycle.prepare');
assert(zeroPrepared.ok && zeroPrepared.data.checks.length === 0, 'Admin zero-contribution mode still scheduled Torn checks.');

const leader = await send('leveling.leader.claim', {}, { id: 'test', tab: { id: 7 } });
assert(leader.ok && leader.data.leader, 'Torn tab did not acquire the local Leveling leader lease.');

const diagnostic = await send('diagnostics.run');
assert(diagnostic.ok && diagnostic.data.source === 'manual', 'Manual diagnostic route failed.');
assert(values.get('slink.diagnostics.lastRun')?.source === 'manual', 'Manual diagnostic result was not persisted.');
assert(diagnostic.data.worker.database === 'connected', 'Diagnostic did not include deep Worker health.');
assert(diagnostic.data.pageInjection.tabId === 7, 'Diagnostic did not include Torn injection state.');
assert(diagnostic.data.leveling.configured === true, 'Diagnostic did not include Leveling configuration state.');

values.delete('slink.worker.lastStatus');
onAlarm.fire({ name: 'slink.worker.connection' });
await new Promise(resolve => setTimeout(resolve, 0));
assert(values.get('slink.worker.lastStatus')?.connected === true, 'Alarm connection status was not persisted.');

console.log('Background startup, required capabilities, Leveling auth/collection, routes, alarms, and diagnostics passed.');
