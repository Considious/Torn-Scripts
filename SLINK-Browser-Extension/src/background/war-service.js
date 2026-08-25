(function installWarService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const WAR = SLINK.core.war;
  const KEYS = Object.freeze({
    settings: 'war.settings.v1',
    terms: 'war.terms.v1',
    acceptedTerms: 'war.acceptedTerms.v1',
    session: 'war.session.v1',
    activeWar: 'war.activeWar.v1',
    runtime: 'war.runtime.v1',
    permissions: 'permissions.war',
    lastStatusAt: 'war.lastStatusAt.v1',
    lastAttackAt: 'war.lastAttackAt.v1',
    lastAttackEnded: 'war.lastAttackEnded.v1',
    storedLogs: 'war.storedLogs.v1',
    lastStoredLogsAt: 'war.lastStoredLogsAt.v1'
  });
  const STATUS_INTERVAL_MS = 10_000;
  const ATTACK_INTERVAL_MS = 30_000;
  let authenticating = null;
  let cycling = null;

  function defaults() {
    return {
      tornKey: '',
      displayMode: 'hybrid',
      warMode: 'war',
      idleMinutes: 5
    };
  }

  function defaultRuntime() {
    return {
      status: 'Waiting for an active ranked war',
      lastError: '',
      snapshot: null,
      logs: [],
      collectStatus: false,
      collectAttacks: false,
      lastCycleAt: 0
    };
  }

  async function settings() {
    return { ...defaults(), ...(await SLINK.core.storage.get(KEYS.settings, {})) };
  }

  async function runtime() {
    return { ...defaultRuntime(), ...(await SLINK.core.storage.get(KEYS.runtime, {})) };
  }

  async function setRuntime(changes) {
    const next = { ...(await runtime()), ...changes };
    await SLINK.core.storage.set(KEYS.runtime, next);
    return next;
  }

  async function fetchTerms(force = false) {
    const cached = await SLINK.core.storage.get(KEYS.terms, null);
    if (!force && cached?.version && cached?.sha256) return cached;
    const response = await SLINK.core.http.requestJson('warWorker', `${WAR.WORKER_BASE}/api/terms`, { cache:'no-store' });
    const terms = {
      version:String(response?.terms?.version || WAR.TERMS_VERSION),
      sha256:String(response?.terms?.sha256 || WAR.TERMS_SHA256),
      documentUrl:String(response?.terms?.url || ''),
      summary:String(response?.terms?.summary || '')
    };
    await SLINK.core.storage.set(KEYS.terms, terms);
    return terms;
  }

  async function health() {
    const startedAt = Date.now();
    try {
      const response = await SLINK.core.http.requestJson('warWorker', `${WAR.WORKER_BASE}/api/health`, { cache:'no-store' });
      return {
        connected:Boolean(response?.ok),
        version:String(response?.version || 'unknown'),
        database:String(response?.database || 'unknown'),
        coordinator:String(response?.coordinator || 'unknown'),
        sessionSecret:String(response?.session_secret || 'unknown'),
        latencyMs:Date.now() - startedAt
      };
    } catch (error) {
      return { connected:false, version:'unknown', database:'unknown', coordinator:'unknown', sessionSecret:'unknown', latencyMs:Date.now() - startedAt, error:SLINK.core.format.errorMessage(error) };
    }
  }

  async function acceptedCurrentTerms(current = null) {
    const terms = current || await fetchTerms();
    const accepted = await SLINK.core.storage.get(KEYS.acceptedTerms, null);
    return Boolean(accepted?.version === terms.version && accepted?.sha256 === terms.sha256);
  }

  async function recomputePermissions() {
    const [leveling, war] = await Promise.all([
      SLINK.core.storage.get('permissions.leveling', null),
      SLINK.core.storage.get(KEYS.permissions, null)
    ]);
    const combined = SLINK.core.permissions.combineSnapshots(leveling, war, {
      userId:null, roles:['foundation'], scopes:[], source:'local-bootstrap', issuedAt:Date.now(), expiresAt:0
    });
    await SLINK.core.storage.set('permissions.snapshot', combined);
    return combined;
  }

  async function clearSession() {
    await SLINK.core.storage.remove(KEYS.session);
    await SLINK.core.storage.remove(KEYS.permissions);
    await recomputePermissions();
  }

  async function workerRequest(path, options = {}, retried = false) {
    const headers = { Accept:'application/json', ...(options.headers || {}) };
    if (options.auth !== false) {
      const session = await ensureSession(false);
      headers.Authorization = `Bearer ${session.token}`;
    }
    const requestOptions = { method:options.method || 'GET', headers, cache:'no-store' };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(options.body);
    }
    try {
      return await SLINK.core.http.requestJson('warWorker', `${WAR.WORKER_BASE}${path}`, requestOptions);
    } catch (error) {
      if (error.status === 401 && options.auth !== false && !retried) {
        await clearSession();
        await ensureSession(true);
        return workerRequest(path, options, true);
      }
      throw error;
    }
  }

  async function ensureSession(force = false) {
    if (authenticating) return authenticating;
    authenticating = (async () => {
      const currentTerms = await fetchTerms();
      if (!await acceptedCurrentTerms(currentTerms)) {
        const error = new Error('Review and accept the current SLINK API & Data Terms for War.');
        error.code = 'SLINK_WAR_TERMS_REQUIRED';
        throw error;
      }
      const existing = await SLINK.core.storage.get(KEYS.session, null);
      if (!force && existing?.token && Number(existing.expiresAt) > Date.now() + 60_000) return existing;
      const currentSettings = await settings();
      if (!currentSettings.tornKey) {
        const error = new Error('Add your Torn API key in SLINK War settings.');
        error.code = 'SLINK_WAR_TORN_KEY_REQUIRED';
        throw error;
      }
      await SLINK.core.tornApiLimiter.reserve({ wait:true });
      const response = await workerRequest('/api/auth', {
        method:'POST',
        auth:false,
        body:{
          api_key:currentSettings.tornKey,
          terms_accepted:true,
          terms_version:currentTerms.version,
          terms_sha256:currentTerms.sha256,
          client_name:'SLINK Browser Extension',
          client_version:SLINK.VERSION
        }
      });
      if (!response?.session_token) throw new Error('SLINK War did not return a session token.');
      const session = {
        token:String(response.session_token),
        expiresAt:Date.parse(response.expires_at) || 0,
        userId:Number(response.user_id) || null,
        factionId:Number(response.faction_id) || 0,
        roles:Array.isArray(response.roles) ? response.roles : [],
        scopes:Array.isArray(response.scopes) ? response.scopes : []
      };
      if (!SLINK.core.permissions.hasScope(session, 'slink.war')) throw new Error('Your SLINK account does not have slink.war permission.');
      await SLINK.core.storage.set(KEYS.session, session);
      await SLINK.core.storage.set(KEYS.permissions, {
        userId:session.userId,
        roles:session.roles,
        scopes:session.scopes,
        source:'slink-war-session',
        issuedAt:Date.now(),
        expiresAt:session.expiresAt
      });
      await recomputePermissions();
      return session;
    })();
    try {
      return await authenticating;
    } finally {
      authenticating = null;
    }
  }

  async function tornRequest(path, apiKey) {
    await SLINK.core.tornApiLimiter.reserve({ wait:true });
    return SLINK.core.http.requestJson('tornApi', `https://api.torn.com${path}`, {
      headers:{ Authorization:`ApiKey ${apiKey}` },
      cache:'no-store'
    });
  }

  async function registerActiveWar(input = {}) {
    const session = await ensureSession(false);
    const opponentFactionId = WAR.positiveInteger(input.opponentFactionId ?? input.opponent_faction_id);
    if (!opponentFactionId || opponentFactionId === session.factionId) throw new Error('SLINK War could not identify the opposing faction.');
    const previous = await SLINK.core.storage.get(KEYS.activeWar, null);
    const sameWar = Number(previous?.ownFactionId) === session.factionId && Number(previous?.opponentFactionId) === opponentFactionId;
    const startedAt = sameWar
      ? Number(previous.startedAt)
      : Math.max(1, Number(input.startedAt ?? input.started_at) || Date.now());
    const activeWar = {
      warId:WAR.makeWarId(session.factionId, opponentFactionId, startedAt),
      ownFactionId:session.factionId,
      opponentFactionId,
      opponentName:String(input.opponentName ?? input.opponent_name ?? previous?.opponentName ?? `Faction ${opponentFactionId}`),
      startedAt,
      detectedAt:Date.now()
    };
    await SLINK.core.storage.set(KEYS.activeWar, activeWar);
    return activeWar;
  }

  async function collectStatus(activeWar, currentSettings) {
    const response = await tornRequest(`/v2/faction/${encodeURIComponent(activeWar.opponentFactionId)}/members`, currentSettings.tornKey);
    const members = response?.members ?? response?.faction?.members ?? [];
    if (!Array.isArray(members) || !members.length) throw new Error('Torn returned no opposing faction members.');
    await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/status`, {
      method:'POST',
      body:{ opponent_faction_id:activeWar.opponentFactionId, observedAt:Date.now(), members }
    });
    await SLINK.core.storage.set(KEYS.lastStatusAt, Date.now());
    return members.length;
  }

  async function collectAttacks(activeWar, currentSettings) {
    const now = Math.floor(Date.now() / 1000);
    const previous = Number(await SLINK.core.storage.get(KEYS.lastAttackEnded, 0)) || 0;
    const from = Math.max(now - 10 * 60, previous ? previous - 60 : 0);
    const response = await tornRequest(`/v2/faction/attacks?from=${from}&to=${now}&limit=100&sort=desc`, currentSettings.tornKey);
    const attacks = Array.isArray(response?.attacks) ? response.attacks : [];
    await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/attacks`, {
      method:'POST',
      body:{ opponent_faction_id:activeWar.opponentFactionId, attacks }
    });
    const newest = attacks.reduce((maximum, attack) => Math.max(maximum, Number(attack?.ended ?? attack?.ended_at ?? 0) || 0), previous);
    await Promise.all([
      SLINK.core.storage.set(KEYS.lastAttackAt, Date.now()),
      SLINK.core.storage.set(KEYS.lastAttackEnded, newest)
    ]);
    return attacks.length;
  }

  async function fetchSnapshot(activeWar, currentSettings) {
    const query = new URLSearchParams({
      opponent_faction_id:String(activeWar.opponentFactionId),
      mode:currentSettings.warMode,
      idle_minutes:String(currentSettings.idleMinutes)
    });
    return workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/snapshot?${query}`);
  }

  async function fetchLogs(activeWar, forceStored = false, pendingLogs = []) {
    const [cached, lastRead] = await Promise.all([
      SLINK.core.storage.get(KEYS.storedLogs, null),
      SLINK.core.storage.get(KEYS.lastStoredLogsAt, null)
    ]);
    const includeStored = forceStored || cached?.warId !== activeWar.warId || lastRead?.warId !== activeWar.warId || Date.now() - Number(lastRead?.at) >= 10 * 60 * 1000;
    let stored = Array.isArray(cached?.rows) && cached?.warId === activeWar.warId ? cached.rows : [];
    if (includeStored) {
      const result = await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/logs?limit=200&include_stored=1`);
      stored = Array.isArray(result?.stored) ? result.stored : [];
      pendingLogs = Array.isArray(result?.pending) ? result.pending : pendingLogs;
      await Promise.all([
        SLINK.core.storage.set(KEYS.storedLogs, { warId:activeWar.warId, rows:stored }),
        SLINK.core.storage.set(KEYS.lastStoredLogsAt, { warId:activeWar.warId, at:Date.now() })
      ]);
    }
    return SLINK.core.war.summarizeLogs({ stored, pending:pendingLogs });
  }

  async function prepareCycle(payload = {}) {
    if (cycling) return cycling;
    cycling = (async () => {
      const currentSettings = await settings();
      let activeWar = await SLINK.core.storage.get(KEYS.activeWar, null);
      if (WAR.positiveInteger(payload.opponentFactionId ?? payload.opponent_faction_id)) activeWar = await registerActiveWar(payload);
      if (!activeWar?.warId) {
        await setRuntime({ status:'Open an active ranked war page so SLINK can identify the opponent.', lastError:'', lastCycleAt:Date.now() });
        return publicStatus();
      }
      const session = await ensureSession(false);
      const heartbeat = await workerRequest(`/api/wars/${encodeURIComponent(activeWar.warId)}/heartbeat`, {
        method:'POST', body:{ opponent_faction_id:activeWar.opponentFactionId }
      });
      const now = Date.now();
      const [lastStatusAt, lastAttackAt] = await Promise.all([
        SLINK.core.storage.get(KEYS.lastStatusAt, 0),
        SLINK.core.storage.get(KEYS.lastAttackAt, 0)
      ]);
      let statusChecks = 0;
      let attackChecks = 0;
      if (heartbeat.collectStatus && now - Number(lastStatusAt) >= STATUS_INTERVAL_MS) statusChecks = await collectStatus(activeWar, currentSettings);
      if (
        heartbeat.collectAttacks &&
        SLINK.core.permissions.hasScope(session, 'slink.war.faction') &&
        now - Number(lastAttackAt) >= ATTACK_INTERVAL_MS
      ) attackChecks = await collectAttacks(activeWar, currentSettings);
      const snapshot = await fetchSnapshot(activeWar, currentSettings);
      const logs = await fetchLogs(activeWar, false, snapshot?.pendingLogs || []);
      await setRuntime({
        status:`${snapshot.members?.length || 0} targets / ${snapshot.retals?.length || 0} active retals`,
        lastError:'',
        snapshot,
        logs,
        collectStatus:Boolean(heartbeat.collectStatus),
        collectAttacks:Boolean(heartbeat.collectAttacks),
        statusChecks,
        attackChecks,
        lastCycleAt:Date.now()
      });
      return publicStatus();
    })();
    try {
      return await cycling;
    } catch (error) {
      await setRuntime({ lastError:SLINK.core.format.errorMessage(error), status:'War update failed', lastCycleAt:Date.now() });
      throw error;
    } finally {
      cycling = null;
    }
  }

  async function saveSettings(input = {}) {
    const current = await settings();
    const displayMode = ['extension', 'torn', 'hybrid'].includes(input.displayMode) ? input.displayMode : current.displayMode;
    const next = {
      ...current,
      tornKey:String(input.tornKey || '').trim() || current.tornKey,
      displayMode,
      warMode:input.warMode === 'termed' ? 'termed' : (input.warMode === 'war' ? 'war' : current.warMode),
      idleMinutes:Math.max(0, Math.min(60, Number(input.idleMinutes ?? current.idleMinutes) || 0))
    };
    await SLINK.core.storage.set(KEYS.settings, next);
    await SLINK.core.storage.set('ui.modules.war.showInTorn', displayMode !== 'extension');
    if (input.acceptTerms === true) {
      const terms = await fetchTerms();
      await SLINK.core.storage.set(KEYS.acceptedTerms, { version:terms.version, sha256:terms.sha256, acceptedAt:Date.now() });
    }
    if (String(input.tornKey || '').trim() || input.acceptTerms === true) await ensureSession(true);
    return publicStatus();
  }

  async function publicStatus() {
    const [currentSettings, currentRuntime, terms, accepted, session, activeWar, permissions] = await Promise.all([
      settings(), runtime(), fetchTerms().catch(() => ({ version:WAR.TERMS_VERSION, sha256:WAR.TERMS_SHA256, documentUrl:'', summary:'' })),
      acceptedCurrentTerms().catch(() => false),
      SLINK.core.storage.get(KEYS.session, null),
      SLINK.core.storage.get(KEYS.activeWar, null),
      SLINK.core.storage.get(KEYS.permissions, null)
    ]);
    const authenticated = Boolean(session?.token && Number(session.expiresAt) > Date.now());
    return {
      configured:Boolean(currentSettings.tornKey && accepted),
      settings:{
        hasTornKey:Boolean(currentSettings.tornKey),
        displayMode:currentSettings.displayMode,
        warMode:currentSettings.warMode,
        idleMinutes:currentSettings.idleMinutes
      },
      terms:{ ...terms, accepted },
      session:{
        authenticated,
        userId:authenticated ? session.userId : null,
        factionId:authenticated ? session.factionId : 0,
        factionCapable:authenticated && SLINK.core.permissions.hasScope(session, 'slink.war.faction'),
        expiresAt:authenticated ? session.expiresAt : 0
      },
      permissions:SLINK.core.permissions.normalizeSnapshot(permissions || {}),
      activeWar,
      runtime:currentRuntime
    };
  }

  const api = Object.freeze({
    routes:Object.freeze({
      'war.status': publicStatus,
      'war.health': health,
      'war.terms': () => fetchTerms(true),
      'war.settings.save': saveSettings,
      'war.session.clear': async () => { await clearSession(); return publicStatus(); },
      'war.active.detect': async payload => { const activeWar = await registerActiveWar(payload); return { activeWar, status:await publicStatus() }; },
      'war.cycle.prepare': prepareCycle,
      'war.logs': async () => {
        const activeWar = await SLINK.core.storage.get(KEYS.activeWar, null);
        return activeWar?.warId ? fetchLogs(activeWar, true) : [];
      }
    }),
    prepareCycle,
    health,
    publicStatus
  });

  SLINK.define('services', 'war', api);
})(globalThis);
