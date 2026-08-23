importScripts(
  '../core/runtime.js',
  '../core/format.js',
  '../core/storage.js',
  '../core/permissions.js',
  '../core/messaging.js',
  '../core/http.js',
  '../core/torn-api-limiter.js'
);

const SLINK = globalThis.SLINK_EXTENSION;
const DIAGNOSTIC_ALARM = 'slink.diagnostics.heartbeat';
const DIAGNOSTIC_ALARM_MINUTES = 5;

function bootstrapPermissions() {
  return {
    userId: null,
    roles: ['foundation'],
    scopes: ['diagnostics.read'],
    source: 'local-bootstrap',
    issuedAt: Date.now(),
    expiresAt: 0
  };
}

async function getPermissionSnapshot() {
  const stored = await SLINK.core.storage.get('permissions.snapshot', null);
  return SLINK.core.permissions.normalizeSnapshot(stored || bootstrapPermissions());
}

async function ensureDefaultState() {
  if (!await SLINK.core.storage.get('permissions.snapshot', null)) {
    await SLINK.core.storage.set('permissions.snapshot', bootstrapPermissions());
  }
  if (await SLINK.core.storage.get('ui.pagePanelHidden', undefined) === undefined) {
    await SLINK.core.storage.set('ui.pagePanelHidden', false);
  }
}

async function ensureDiagnosticAlarm() {
  if (!await chrome.alarms.get(DIAGNOSTIC_ALARM)) {
    await chrome.alarms.create(DIAGNOSTIC_ALARM, {
      delayInMinutes: DIAGNOSTIC_ALARM_MINUTES,
      periodInMinutes: DIAGNOSTIC_ALARM_MINUTES
    });
  }
}

async function recordDiagnostic(source) {
  const result = {
    at: Date.now(),
    source: String(source || 'manual'),
    extensionVersion: chrome.runtime.getManifest().version
  };
  await SLINK.core.storage.set('diagnostics.lastRun', result);
  return result;
}

async function capabilityStatus() {
  const entries = await Promise.all(
    Object.entries(SLINK.core.permissions.BROWSER_CAPABILITIES).map(async ([id, capability]) => {
      const granted = await chrome.permissions.contains({ origins: [...capability.origins] });
      return [id, { label: capability.label, origins: [...capability.origins], granted }];
    })
  );
  return Object.fromEntries(entries);
}

const routes = {
  async 'system.ping'() {
    return {
      ok: true,
      now: Date.now(),
      extensionVersion: chrome.runtime.getManifest().version,
      coreVersion: SLINK.VERSION
    };
  },

  async 'system.status'() {
    return {
      permissions: await getPermissionSnapshot(),
      capabilities: await capabilityStatus(),
      lastDiagnostic: await SLINK.core.storage.get('diagnostics.lastRun', null),
      tornApiUsage: await SLINK.core.tornApiLimiter.getUsage()
    };
  },

  async 'permissions.get'() {
    return getPermissionSnapshot();
  },

  async 'capabilities.get'() {
    return capabilityStatus();
  },

  async 'diagnostics.run'() {
    const permissions = await getPermissionSnapshot();
    SLINK.core.permissions.requireScopes(permissions, ['diagnostics.read']);
    return recordDiagnostic('manual');
  },

  async 'diagnostics.status'() {
    const permissions = await getPermissionSnapshot();
    SLINK.core.permissions.requireScopes(permissions, ['diagnostics.read']);
    return {
      lastRun: await SLINK.core.storage.get('diagnostics.lastRun', null),
      alarm: await chrome.alarms.get(DIAGNOSTIC_ALARM)
    };
  }
};

chrome.runtime.onMessage.addListener(SLINK.core.messaging.createRouter(routes));

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultState();
  void ensureDiagnosticAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureDefaultState();
  void ensureDiagnosticAlarm();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === DIAGNOSTIC_ALARM) void recordDiagnostic('alarm');
});

void ensureDefaultState().catch(error => console.error('[SLINK] Default state:', error));
void ensureDiagnosticAlarm().catch(error => console.error('[SLINK] Diagnostic alarm:', error));
