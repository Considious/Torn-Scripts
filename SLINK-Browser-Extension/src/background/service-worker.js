importScripts(
  '../core/runtime.js',
  '../core/format.js',
  '../core/storage.js',
  '../core/permissions.js',
  '../core/messaging.js',
  '../core/http.js',
  '../core/war.js',
  '../core/worker-client.js',
  '../core/torn-api-limiter.js',
  'leveling-service.js',
  'war-service.js',
  'contribution-service.js'
);

const SLINK = globalThis.SLINK_EXTENSION;
const CONNECTION_ALARM = 'slink.worker.connection';
const CONNECTION_ALARM_MINUTES = 15;
const WAR_CYCLE_ALARM = 'slink.war.cycle';
const WAR_CYCLE_ALARM_MINUTES = 0.5;

function bootstrapPermissions() {
  return {
    userId: null,
    roles: ['foundation'],
    scopes: [],
    source: 'local-bootstrap',
    issuedAt: Date.now(),
    expiresAt: 0
  };
}

async function getPermissionSnapshot() {
  const [leveling, war, stored] = await Promise.all([
    SLINK.core.storage.get('permissions.leveling', null),
    SLINK.core.storage.get('permissions.war', null),
    SLINK.core.storage.get('permissions.snapshot', null)
  ]);
  if (!leveling && !war) return SLINK.core.permissions.normalizeSnapshot(stored || bootstrapPermissions());
  const combined = SLINK.core.permissions.combineSnapshots(leveling, war, bootstrapPermissions());
  await SLINK.core.storage.set('permissions.snapshot', combined);
  return combined;
}

async function ensureDefaultState() {
  const [storedCombined, storedLeveling, storedWar, levelingSession, warSession] = await Promise.all([
    SLINK.core.storage.get('permissions.snapshot', null),
    SLINK.core.storage.get('permissions.leveling', null),
    SLINK.core.storage.get('permissions.war', null),
    SLINK.core.storage.get('leveling.session.v1', null),
    SLINK.core.storage.get('war.session.v1', null)
  ]);
  const legacy = SLINK.core.permissions.normalizeSnapshot(storedCombined || bootstrapPermissions());
  const leveling = storedLeveling || (
    levelingSession?.token && Number(levelingSession.expiresAt) > Date.now()
      ? {
          userId:levelingSession.userId,
          roles:levelingSession.roles,
          scopes:levelingSession.scopes,
          source:'migrated-leveling-session',
          issuedAt:Date.now(),
          expiresAt:levelingSession.expiresAt
        }
      : legacy.scopes.some(scope => SLINK.core.permissions.scopeMatches(scope, 'slink.level'))
        ? { ...legacy, source:'migrated-leveling-snapshot' }
        : null
  );
  const war = storedWar || (
    warSession?.token && Number(warSession.expiresAt) > Date.now()
      ? {
          userId:warSession.userId,
          roles:warSession.roles,
          scopes:warSession.scopes,
          source:'migrated-war-session',
          issuedAt:Date.now(),
          expiresAt:warSession.expiresAt
        }
      : null
  );
  if (leveling && !storedLeveling) await SLINK.core.storage.set('permissions.leveling', leveling);
  if (war && !storedWar) await SLINK.core.storage.set('permissions.war', war);
  await SLINK.core.storage.set(
    'permissions.snapshot',
    SLINK.core.permissions.combineSnapshots(leveling, war, bootstrapPermissions())
  );
  if (await SLINK.core.storage.get('ui.pagePanelHidden', undefined) === undefined) {
    await SLINK.core.storage.set('ui.pagePanelHidden', false);
  }
}

async function ensureConnectionAlarm() {
  if (!await chrome.alarms.get(CONNECTION_ALARM)) {
    await chrome.alarms.create(CONNECTION_ALARM, {
      delayInMinutes: CONNECTION_ALARM_MINUTES,
      periodInMinutes: CONNECTION_ALARM_MINUTES
    });
  }
  if (!await chrome.alarms.get(WAR_CYCLE_ALARM)) {
    await chrome.alarms.create(WAR_CYCLE_ALARM, {
      delayInMinutes: WAR_CYCLE_ALARM_MINUTES,
      periodInMinutes: WAR_CYCLE_ALARM_MINUTES
    });
  }
}

async function connectionStatus() {
  const status = await SLINK.core.workerClient.probe();
  await SLINK.core.storage.set('worker.lastStatus', status);
  return status;
}

async function capabilityStatus() {
  const entries = await Promise.all(
    Object.entries(SLINK.core.permissions.BROWSER_CAPABILITIES).map(async ([id, capability]) => {
      const granted = await chrome.permissions.contains({ origins: [...capability.origins] });
      return [id, {
        label: capability.label,
        optional: capability.optional,
        origins: [...capability.origins],
        granted
      }];
    })
  );
  return Object.fromEntries(entries);
}

async function recordDiagnostic(source) {
  const [worker, contributionWorker, warWorker, capabilities, tornApiUsage, alarm, pageInjection, leveling, war] = await Promise.all([
    SLINK.core.workerClient.probe({ deep: true }),
    SLINK.services.contribution.health(),
    SLINK.services.war.health(),
    capabilityStatus(),
    SLINK.core.tornApiLimiter.getUsage(),
    chrome.alarms.get(CONNECTION_ALARM),
    SLINK.core.storage.get('diagnostics.pageInjection', null),
    SLINK.services.leveling.publicStatus(),
    SLINK.services.war.publicStatus()
  ]);
  await SLINK.core.storage.set('worker.lastStatus', worker);

  const result = {
    at: Date.now(),
    source: String(source || 'manual'),
    overall: worker.connected && Boolean(alarm) && (!war.configured || warWorker.connected) ? 'ready' : 'attention',
    extensionVersion: chrome.runtime.getManifest().version,
    coreVersion: SLINK.VERSION,
    background: { ok: true },
    storage: { ok: true },
    alarm: {
      ok: Boolean(alarm),
      periodMinutes: Number(alarm?.periodInMinutes) || null
    },
    worker,
    contributionWorker,
    pageInjection,
    leveling: {
      configured: leveling.configured,
      authenticated: leveling.session.authenticated,
      targets: leveling.runtime.targets.length,
      pendingChecks: leveling.runtime.pendingChecks,
      collector: leveling.runtime.collector
    },
    war: {
      configured: war.configured,
      authenticated: war.session.authenticated,
      activeWar: war.activeWar,
      factionCapable: war.session.factionCapable,
      status: war.runtime.status,
      worker: warWorker
    },
    capabilities,
    tornApiUsage
  };
  await SLINK.core.storage.set('diagnostics.lastRun', result);
  return result;
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
    const [permissions, capabilities, lastDiagnostic, tornApiUsage, worker] = await Promise.all([
      getPermissionSnapshot(),
      capabilityStatus(),
      SLINK.core.storage.get('diagnostics.lastRun', null),
      SLINK.core.tornApiLimiter.getUsage(),
      connectionStatus()
    ]);
    return {
      permissions,
      capabilities,
      lastDiagnostic,
      tornApiUsage,
      worker,
      leveling: await SLINK.services.leveling.publicStatus(),
      war: await SLINK.services.war.publicStatus(),
      contribution: await SLINK.services.contribution.status().catch(() => ({ configured:false, donation:null }))
    };
  },

  async 'permissions.get'() {
    return getPermissionSnapshot();
  },

  async 'capabilities.get'() {
    return capabilityStatus();
  },

  async 'content.ready'(payload, sender) {
    const pageUrl = new URL(String(sender?.tab?.url || payload?.url || ''));
    if (pageUrl.hostname !== 'www.torn.com') {
      const error = new Error('SLINK content registration is restricted to Torn.');
      error.code = 'SLINK_CONTENT_ORIGIN_DENIED';
      throw error;
    }
    const injection = {
      at: Date.now(),
      tabId: Number.isInteger(sender?.tab?.id) ? sender.tab.id : null,
      page: `${pageUrl.origin}${pageUrl.pathname}`
    };
    await SLINK.core.storage.set('diagnostics.pageInjection', injection);
    return injection;
  },

  async 'diagnostics.run'() {
    return recordDiagnostic('manual');
  },

  async 'diagnostics.status'() {
    return {
      lastRun: await SLINK.core.storage.get('diagnostics.lastRun', null),
      alarm: await chrome.alarms.get(CONNECTION_ALARM),
      worker: await connectionStatus()
    };
  },

  ...SLINK.services.leveling.routes,
  ...SLINK.services.war.routes,
  ...SLINK.services.contributionRoutes
};

chrome.runtime.onMessage.addListener(SLINK.core.messaging.createRouter(routes));

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultState();
  void ensureConnectionAlarm();
  void connectionStatus();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureDefaultState();
  void ensureConnectionAlarm();
  void connectionStatus();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === CONNECTION_ALARM) void connectionStatus();
  if (alarm.name === WAR_CYCLE_ALARM) {
    void SLINK.services.war.publicStatus()
      .then(status => status.configured && status.activeWar ? SLINK.services.war.prepareCycle() : null)
      .catch(error => console.error('[SLINK] War cycle:', error));
  }
});

void ensureDefaultState().catch(error => console.error('[SLINK] Default state:', error));
void ensureConnectionAlarm().catch(error => console.error('[SLINK] Connection alarm:', error));
void connectionStatus().catch(error => console.error('[SLINK] Worker connection:', error));
