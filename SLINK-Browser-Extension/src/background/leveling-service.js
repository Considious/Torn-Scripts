(function installLevelingService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const CLIENT_NAME = 'SLINK Browser Extension';
  const CLIENT_VERSION = SLINK.VERSION;
  const DEFAULT_POLL_SECONDS = 300;
  const DEFAULT_API_CONTRIBUTION_LIMIT = 60;
  const MAX_DISPLAY = 40;
  const MAX_INTERVAL_CHECKS = 300;
  const PENDING_LIFETIME_MS = 24 * 60 * 60 * 1000;
  const ROUTINE_CHECK_BUCKET_MS = 5 * 60 * 1000;
  const ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const DAILY_FRESHNESS_START_UTC_MINUTE = (23 * 60) + 45;
  const DAILY_FRESHNESS_BUCKETS = 3;
  const FF_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
  const BATTLE_STATS_CACHE_MS = 24 * 60 * 60 * 1000;
  const USER_IDLE_MS = 20 * 60 * 1000;
  const DEMAND_REPORT_INTERVAL_MS = 5 * 60 * 1000;
  const NO_DEMAND_POLL_SECONDS = 20 * 60;
  const WORKER_BASE = SLINK.core.workerClient.BASE_URL;

  const KEYS = Object.freeze({
    settings: 'leveling.settings.v1',
    terms: 'leveling.terms.v1',
    acceptedTerms: 'leveling.acceptedTerms.v1',
    session: 'leveling.session.v1',
    contributorSession: 'leveling.contributorSession.v1',
    lastInteractionAt: 'leveling.lastInteractionAt.v1',
    lastDemandReportAt: 'leveling.lastDemandReportAt.v1',
    runtime: 'leveling.runtime.v1',
    pendingChecks: 'leveling.pendingChecks.v1',
    completedCheckBatches: 'leveling.completedCheckBatches.v1',
    fairFightCache: 'leveling.fairFightCache.v1',
    battleStats: 'leveling.battleStats.v1',
    lastActivitySyncAt: 'leveling.lastActivitySyncAt.v1'
  });

  let cyclePromise = null;
  let authenticatingPromise = null;
  let localLeader = { tabId: null, expiresAt: 0 };

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || minimum));
  }

  function finiteNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function defaultSettings() {
    return {
      tornKey: '',
      ffKey: '',
      pollSeconds: DEFAULT_POLL_SECONDS,
      apiContributionLimit: DEFAULT_API_CONTRIBUTION_LIMIT,
      contributorOnly: false,
      minFF: 1,
      maxFF: 3
    };
  }

  function defaultRuntime() {
    return {
      targets: [],
      polling: false,
      collector: false,
      collectorExpiresAt: 0,
      cycleStatus: 'Setup required',
      fairFightStatus: '',
      lastError: '',
      workerVersion: '',
      lastCycleAt: 0,
      lastCycleChecked: 0,
      lastCycleReported: 0,
      contributorOnly: false,
      idle: false,
      nextPollSeconds: DEFAULT_POLL_SECONDS
    };
  }

  async function settings() {
    return { ...defaultSettings(), ...(await SLINK.core.storage.get(KEYS.settings, {})) };
  }

  async function runtime() {
    return { ...defaultRuntime(), ...(await SLINK.core.storage.get(KEYS.runtime, {})) };
  }

  async function saveRuntime(updates) {
    const next = { ...(await runtime()), ...updates };
    await SLINK.core.storage.set(KEYS.runtime, next);
    return next;
  }

  async function fetchTerms(force = false) {
    const cached = await SLINK.core.storage.get(KEYS.terms, null);
    if (!force && cached?.fetchedAt && Date.now() - cached.fetchedAt < 60 * 60 * 1000) {
      return cached;
    }
    const response = await SLINK.core.http.requestJson('slinkWorker', `${WORKER_BASE}/api/terms`, {
      cache: 'no-store'
    });
    let documentUrl = '';
    try {
      const parsedDocumentUrl = new URL(String(response.document_url || ''));
      if (parsedDocumentUrl.protocol === 'https:') documentUrl = parsedDocumentUrl.href;
    } catch {}
    const terms = {
      version: String(response.version || ''),
      effectiveAt: String(response.effective_at || ''),
      documentUrl,
      documentSha256: String(response.document_sha256 || ''),
      disclosureVersion: String(response.disclosure_version || ''),
      disclosureSha256: String(response.disclosure_sha256 || ''),
      summary: String(response.leveling_service_summary || ''),
      fetchedAt: Date.now()
    };
    if (!terms.version || !terms.documentSha256 || !terms.disclosureVersion || !terms.disclosureSha256) {
      throw new Error('The SLINK Worker returned an incomplete terms contract.');
    }
    await SLINK.core.storage.set(KEYS.terms, terms);
    return terms;
  }

  async function acceptedCurrentTerms(terms = null) {
    const current = terms || await fetchTerms();
    const accepted = await SLINK.core.storage.get(KEYS.acceptedTerms, null);
    return Boolean(
      accepted &&
      accepted.version === current.version &&
      accepted.documentSha256 === current.documentSha256 &&
      accepted.disclosureVersion === current.disclosureVersion &&
      accepted.disclosureSha256 === current.disclosureSha256
    );
  }

  async function clearSession() {
    await SLINK.core.storage.remove(KEYS.session);
    await SLINK.core.storage.remove('permissions.leveling');
    const combined = SLINK.core.permissions.combineSnapshots(
      await SLINK.core.storage.get('permissions.war', null),
      { userId:null, roles:['foundation'], scopes:[], source:'local-bootstrap', issuedAt:Date.now(), expiresAt:0 }
    );
    await SLINK.core.storage.set('permissions.snapshot', combined);
  }

  async function clearContributorSession() {
    await SLINK.core.storage.remove(KEYS.contributorSession);
  }

  async function workerRequest(path, options = {}, retried = false) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    const contributor = options.sessionKind === 'contributor';
    if (options.auth !== false) {
      const session = await ensureSession(false, contributor);
      headers.Authorization = `Bearer ${session.token}`;
    }
    const requestOptions = { method: options.method || 'GET', headers, cache: 'no-store' };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(options.body);
    }
    try {
      return await SLINK.core.http.requestJson('slinkWorker', `${WORKER_BASE}${path}`, requestOptions);
    } catch (error) {
      if (error.status === 401 && options.auth !== false && !retried) {
        if (contributor) await clearContributorSession();
        else await clearSession();
        await ensureSession(true, contributor);
        return workerRequest(path, options, true);
      }
      throw error;
    }
  }

  async function ensureSession(force = false, contributorOnly = false) {
    if (authenticatingPromise) return authenticatingPromise;
    authenticatingPromise = (async () => {
      const terms = await fetchTerms();
      if (!await acceptedCurrentTerms(terms)) {
        const error = new Error('Review and accept the current SLINK API & Data Terms.');
        error.code = 'SLINK_TERMS_REQUIRED';
        throw error;
      }
      const sessionKey = contributorOnly ? KEYS.contributorSession : KEYS.session;
      const existing = await SLINK.core.storage.get(sessionKey, null);
      if (!force && existing?.token && Number(existing.expiresAt) > Date.now() + 60_000) return existing;

      const currentSettings = await settings();
      if (!currentSettings.tornKey) {
        const error = new Error('Add your Torn API key in SLINK Leveling settings.');
        error.code = 'SLINK_TORN_KEY_REQUIRED';
        throw error;
      }
      await SLINK.core.tornApiLimiter.reserve({ wait: true });
      const response = await workerRequest('/api/auth', {
        method: 'POST',
        auth: false,
        body: {
          api_key: currentSettings.tornKey,
          terms_accepted: true,
          terms_version: terms.version,
          terms_sha256: terms.documentSha256,
          disclosure_version: terms.disclosureVersion,
          disclosure_sha256: terms.disclosureSha256,
          client_name: CLIENT_NAME,
          client_version: CLIENT_VERSION,
          contributor_only: contributorOnly
        }
      });
      if (!response?.session_token) throw new Error('SLINK did not return a session token.');
      const session = {
        token: response.session_token,
        expiresAt: Date.parse(response.expires_at) || 0,
        userId: Number(response.user_id) || null,
        roles: Array.isArray(response.roles) ? response.roles : [],
        scopes: Array.isArray(response.scopes) ? response.scopes : []
      };
      const requiredScope = contributorOnly ? 'slink.contribute' : 'slink.level';
      if (!SLINK.core.permissions.hasScope(session, requiredScope)) {
        throw new Error(`Your SLINK account does not have ${requiredScope} permission.`);
      }
      await SLINK.core.storage.set(sessionKey, session);
      if (!contributorOnly) {
        const snapshot = {
          userId: session.userId,
          roles: session.roles,
          scopes: session.scopes,
          source: 'slink-worker-session',
          issuedAt: Date.now(),
          expiresAt: session.expiresAt
        };
        await SLINK.core.storage.set('permissions.leveling', snapshot);
        await SLINK.core.storage.set('permissions.snapshot', SLINK.core.permissions.combineSnapshots(
          snapshot,
          await SLINK.core.storage.get('permissions.war', null)
        ));
      }
      return session;
    })();
    try {
      return await authenticatingPromise;
    } finally {
      authenticatingPromise = null;
    }
  }

  async function syncUserDemand(force = false) {
    const currentSettings = await settings();
    if (currentSettings.contributorOnly) return { active: false, contributor_only: true };
    const lastInteractionAt = Number(await SLINK.core.storage.get(KEYS.lastInteractionAt, 0)) || 0;
    if (!lastInteractionAt || Date.now() - lastInteractionAt >= USER_IDLE_MS) {
      return { active: false, idle: true };
    }
    const lastReportAt = Number(await SLINK.core.storage.get(KEYS.lastDemandReportAt, 0)) || 0;
    if (!force && Date.now() - lastReportAt < DEMAND_REPORT_INTERVAL_MS) {
      return { active: true, cached: true };
    }
    const result = await workerRequest('/api/user/activity', {
      method: 'POST',
      body: { last_interaction_at: lastInteractionAt }
    });
    await SLINK.core.storage.set(KEYS.lastDemandReportAt, Date.now());
    return result;
  }

  async function touchActivity() {
    const currentSettings = await settings();
    if (currentSettings.contributorOnly) return publicStatus();
    await SLINK.core.storage.set(KEYS.lastInteractionAt, Date.now());
    await syncUserDemand(true);
    await saveRuntime({ idle: false, contributorOnly: false, nextPollSeconds: currentSettings.pollSeconds });
    return publicStatus();
  }

  async function tornJson(url) {
    const currentSettings = await settings();
    if (!currentSettings.tornKey) throw new Error('Torn API key is not configured.');
    await SLINK.core.tornApiLimiter.reserve({ wait: true });
    const data = await SLINK.core.http.requestJson('tornApi', url, {
      headers: { Authorization: `ApiKey ${currentSettings.tornKey}` },
      cache: 'no-store'
    });
    if (data?.error) throw new Error(data.error.message || data.error.error || 'Torn API request failed.');
    return data;
  }

  async function tornText(url) {
    const currentSettings = await settings();
    if (!currentSettings.tornKey) throw new Error('Torn API key is not configured.');
    await SLINK.core.tornApiLimiter.reserve({ wait: true });
    return SLINK.core.http.requestText('tornApi', url, {
      headers: { Authorization: `ApiKey ${currentSettings.tornKey}` },
      cache: 'no-store'
    });
  }

  async function ensureBattleStats(force = false) {
    const cached = await SLINK.core.storage.get(KEYS.battleStats, null);
    if (!force && cached?.score > 0 && Date.now() - Number(cached.checkedAt) < BATTLE_STATS_CACHE_MS) return cached;
    const data = await tornJson('https://api.torn.com/v2/user/battlestats');
    const stats = data?.battlestats ?? data;
    const values = ['strength', 'defense', 'speed', 'dexterity'].map(name => {
      const value = finiteNumberOrNull(stats?.[name]?.value ?? stats?.[name]);
      return value !== null && value >= 0 ? value : null;
    });
    if (values.some(value => value === null)) throw new Error('Torn returned incomplete battle stats.');
    const result = {
      score: values.reduce((sum, value) => sum + Math.sqrt(value), 0),
      total: finiteNumberOrNull(stats?.total) ?? values.reduce((sum, value) => sum + value, 0),
      checkedAt: Date.now()
    };
    await SLINK.core.storage.set(KEYS.battleStats, result);
    return result;
  }

  function fairFightToScoreRatio(fairFight) {
    return clamp(((clamp(fairFight, 1, 3) - 1) * 3) / 8, 0, 0.75);
  }

  function targetStatRange(battleStats, currentSettings) {
    if (!battleStats?.score) return null;
    const minimumRatio = fairFightToScoreRatio(Math.min(currentSettings.minFF, currentSettings.maxFF));
    const maximumRatio = fairFightToScoreRatio(Math.max(currentSettings.minFF, currentSettings.maxFF));
    const totalFromScore = score => Math.min(Number.MAX_SAFE_INTEGER, Math.pow(score / 2, 2));
    return {
      min: minimumRatio > 0 ? Math.max(1, Math.floor(totalFromScore(battleStats.score * minimumRatio))) : 0,
      max: Math.max(1, Math.ceil(totalFromScore(battleStats.score * maximumRatio)))
    };
  }

  function estimateFairFight(totalStats, battleStats) {
    const total = finiteNumberOrNull(totalStats);
    if (!battleStats?.score || total === null || total <= 0) return null;
    return clamp(1 + (8 / 3) * ((2 * Math.sqrt(total)) / battleStats.score), 1, 3);
  }

  function localDifficulty(totalStats, battleStats) {
    const total = finiteNumberOrNull(totalStats);
    if (!battleStats?.score || total === null || total <= 0) return null;
    const ratio = (2 * Math.sqrt(total)) / battleStats.score;
    if (ratio <= 0.35) return 'Easy';
    if (ratio <= 0.6) return 'Good';
    if (ratio <= 0.75) return 'Fair';
    return 'Risky';
  }

  async function enrichFairFight(targets, battleStats, currentSettings) {
    const cache = await SLINK.core.storage.get(KEYS.fairFightCache, {});
    const now = Date.now();
    const needed = targets.filter(target => now - Number(cache[String(target.id)]?.checkedAt || 0) >= FF_CACHE_MS);
    if (needed.length && currentSettings.ffKey) {
      const ids = [...new Set(needed.map(target => String(target.id)))];
      const url = 'https://ffscouter.com/api/v1/get-stats' +
        `?key=${encodeURIComponent(currentSettings.ffKey)}` +
        `&targets=${encodeURIComponent(ids.join(','))}`;
      const response = await SLINK.core.http.requestJson('ffscouter', url, { cache: 'no-store' });
      const rows = Array.isArray(response) ? response : (response?.results || response?.data || []);
      const returned = new Set();
      for (const row of rows) {
        const id = Number(row?.player_id ?? row?.id);
        if (!Number.isInteger(id) || id <= 0) continue;
        returned.add(String(id));
        cache[id] = {
          fairFight: finiteNumberOrNull(row?.fair_fight),
          bsEstimate: finiteNumberOrNull(row?.bs_estimate),
          source: String(row?.source || 'FFScouter').slice(0, 100),
          checkedAt: now
        };
      }
      for (const id of ids) {
        if (!returned.has(id)) cache[id] = { fairFight: null, bsEstimate: null, source: 'FFScouter', checkedAt: now };
      }
      await SLINK.core.storage.set(KEYS.fairFightCache, cache);
    }

    const minFF = Math.min(currentSettings.minFF, currentSettings.maxFF);
    const maxFF = Math.max(currentSettings.minFF, currentSettings.maxFF);
    return targets.map(target => {
      const cached = cache[String(target.id)] || {};
      const refined = finiteNumberOrNull(cached.fairFight);
      const estimated = estimateFairFight(target.total_stats, battleStats);
      const fairFight = refined ?? estimated;
      return {
        ...target,
        fair_fight: fairFight,
        fair_fight_estimated: refined === null && estimated !== null,
        fair_fight_source: refined !== null ? cached.source : (estimated !== null ? 'Local estimate' : ''),
        bs_estimate: finiteNumberOrNull(cached.bsEstimate) ?? finiteNumberOrNull(target.total_stats),
        local_difficulty: localDifficulty(target.total_stats, battleStats)
      };
    }).filter(target => target.fair_fight === null || target.fair_fight === undefined || (
      Number(target.fair_fight) >= minFF && Number(target.fair_fight) <= maxFF
    ));
  }

  async function pendingChecks() {
    const cutoff = Date.now() - PENDING_LIFETIME_MS;
    const stored = await SLINK.core.storage.get(KEYS.pendingChecks, []);
    return (Array.isArray(stored) ? stored : []).filter(check =>
      Number.isInteger(Number(check?.id)) && Number(check.id) > 0 && Number(check.queuedAt || 0) >= cutoff
    );
  }

  async function completedCheckBatches() {
    const cutoff = Date.now() - PENDING_LIFETIME_MS;
    const stored = await SLINK.core.storage.get(KEYS.completedCheckBatches, {});
    const active = {};
    for (const [batchId, batch] of Object.entries(stored || {})) {
      if (Number(batch?.finishedAt || 0) < cutoff) continue;
      active[batchId] = {
        finishedAt: Number(batch.finishedAt),
        targetIds: [...new Set((batch.targetIds || []).map(Number).filter(Number.isInteger))]
      };
    }
    if (Object.keys(active).length !== Object.keys(stored || {}).length) {
      await SLINK.core.storage.set(KEYS.completedCheckBatches, active);
    }
    return active;
  }

  async function rememberCompletedChecks(completions) {
    const batches = await completedCheckBatches();
    for (const completion of completions) {
      const batchId = String(completion?.check_batch_id || '').trim();
      const targetId = Number(completion?.target_id);
      if (!batchId || !Number.isInteger(targetId) || targetId <= 0) continue;
      const existing = batches[batchId] || { finishedAt: 0, targetIds: [] };
      batches[batchId] = {
        finishedAt: Date.now(),
        targetIds: [...new Set([...existing.targetIds, targetId])]
      };
    }
    await SLINK.core.storage.set(KEYS.completedCheckBatches, batches);
  }

  async function mergePending(claimed, contributorAuth = false) {
    const completed = await completedCheckBatches();
    const existing = (await pendingChecks()).filter(check => {
      return (check?.contributor_auth === true) === contributorAuth;
    });
    const merged = new Map(existing.map(check => [Number(check.id), check]));
    for (const check of claimed || []) {
      const targetId = Number(check?.id);
      const batchId = String(check?.check_batch_id || '').trim();
      if ((completed[batchId]?.targetIds || []).map(Number).includes(targetId)) continue;
      if (!merged.has(targetId)) merged.set(targetId, {
        ...check,
        contributor_auth: contributorAuth,
        queuedAt: Date.now()
      });
    }
    const result = [...merged.values()].slice(0, 600);
    await SLINK.core.storage.set(KEYS.pendingChecks, result);
    return result;
  }

  function normalizeSchedulingStatus(value) {
    const lower = String(value || 'Unknown').trim().toLowerCase();
    if (lower.includes('federal')) return 'Federal';
    if (lower.includes('hiding out') || lower.includes('hiding')) return 'Hiding Out';
    if (lower.includes('hospital')) return 'Hospital';
    if (lower.includes('travel') || lower.includes('flying')) return 'Traveling';
    if (lower.includes('abroad')) return 'Abroad';
    if (lower.includes('jail')) return 'Jail';
    if (lower.includes('okay')) return 'Okay';
    return 'Unknown';
  }

  function dailyFreshnessSlot(now = Date.now()) {
    const date = new Date(now);
    const utcMinute = (date.getUTCHours() * 60) + date.getUTCMinutes();
    if (utcMinute < DAILY_FRESHNESS_START_UTC_MINUTE) return -1;
    return Math.min(
      DAILY_FRESHNESS_BUCKETS - 1,
      Math.floor((utcMinute - DAILY_FRESHNESS_START_UTC_MINUTE) / (ROUTINE_CHECK_BUCKET_MS / 60_000))
    );
  }

  function dailyFreshnessWindowStart(now = Date.now()) {
    const date = new Date(now);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 45);
  }

  function okayCheckBucketCount(tier) {
    if (tier === 'Farmed') return 72;
    if (tier === 'Crowded') return 12;
    if (tier === 'Warm') return 6;
    return 3;
  }

  function stableSchedulingHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function collectorSchedulingKey(collector) {
    return `${Number(collector?.user_id) || 0}:${String(collector?.session_id || '')}`;
  }

  function assignedCollectorKey(targetId, scheduleBucket, collectors) {
    let winner = '';
    let winnerScore = -1;
    for (const collector of collectors) {
      const key = collectorSchedulingKey(collector);
      const score = stableSchedulingHash(`${scheduleBucket}:${targetId}:${key}`);
      if (score > winnerScore || (score === winnerScore && key < winner)) {
        winner = key;
        winnerScore = score;
      }
    }
    return winner;
  }

  function schedulingPriority(target) {
    const status = normalizeSchedulingStatus(target.previous_status);
    let statusPriority = 2;
    if (status === 'Hospital' || status === 'Federal') statusPriority = 0;
    else if (!Number(target.has_status)) statusPriority = 1;
    else if (status === 'Okay') statusPriority = 3;
    return [
      Number(target.recommendation_leased) ? 1 : 0,
      statusPriority,
      Number(target.competition_score) || 0,
      Number(target.previous_last_checked_at) || 0,
      -(Number(target.level) || 0),
      Number.isFinite(Number(target.total_stats)) ? Number(target.total_stats) : Number.MAX_SAFE_INTEGER,
      Number(target.id) || 0
    ];
  }

  function compareSchedulingTargets(left, right) {
    const leftPriority = schedulingPriority(left);
    const rightPriority = schedulingPriority(right);
    for (let index = 0; index < leftPriority.length; index++) {
      if (leftPriority[index] !== rightPriority[index]) return leftPriority[index] - rightPriority[index];
    }
    return 0;
  }

  function targetSchedulingState(target, scheduleBucket, now) {
    const targetId = Number(target.id);
    const status = normalizeSchedulingStatus(target.previous_status);
    const activityCutoff = Math.floor((now - ACTIVITY_WINDOW_MS) / 1000);
    const activityLastSeen = Number(target.activity_last_seen_at) || 0;
    if (!Number.isInteger(targetId) || targetId <= 0 || activityLastSeen >= activityCutoff) {
      return { due: false, freshnessCheckpointRequired: false };
    }
    if (Number(target.hiding_out) || Number(target.permanent_federal)) {
      return { due: false, freshnessCheckpointRequired: false };
    }
    if (!Number(target.has_status)) return { due: true, freshnessCheckpointRequired: false };
    if (status !== 'Okay') {
      return {
        due: (Number(target.next_check_at) || 0) <= now,
        freshnessCheckpointRequired: false
      };
    }
    const bucketCount = okayCheckBucketCount(target.competition_tier);
    const routineDue = scheduleBucket % bucketCount === Math.abs(targetId) % bucketCount;
    const freshnessSlot = dailyFreshnessSlot(now);
    const freshnessCheckpointRequired = (
      freshnessSlot >= 0 &&
      Math.abs(targetId) % DAILY_FRESHNESS_BUCKETS === freshnessSlot &&
      (Number(target.previous_last_checked_at) || 0) < dailyFreshnessWindowStart(now)
    );
    return { due: routineDue || freshnessCheckpointRequired, freshnessCheckpointRequired };
  }

  function buildClientCheckPlan(claim, intervalCapacity) {
    const collectors = Array.isArray(claim?.collector_roster) ? claim.collector_roster : [];
    const targets = Array.isArray(claim?.targets) ? claim.targets : [];
    const scheduleBucket = Number(claim?.schedule_bucket);
    const currentCollectorKey = `${Number(claim?.collector_user_id) || 0}:${String(claim?.collector_session_id || '')}`;
    if (!collectors.length || !Number.isInteger(scheduleBucket)) return [];
    const now = Date.now();
    return targets
      .flatMap(target => {
        const scheduling = targetSchedulingState(target, scheduleBucket, now);
        return scheduling.due ? [{
          ...target,
          freshness_checkpoint_required: scheduling.freshnessCheckpointRequired
        }] : [];
      })
      .sort(compareSchedulingTargets)
      .filter(target => assignedCollectorKey(Number(target.id), scheduleBucket, collectors) === currentCollectorKey)
      .slice(0, Math.max(0, Number(intervalCapacity) || 0))
      .map(target => ({ ...target, check_batch_id: String(claim?.batch_id || '') }));
  }

  function canCompleteOkayLocally(target, observation) {
    return (
      normalizeSchedulingStatus(`${observation?.state || ''} ${observation?.description || ''}`) === 'Okay' &&
      normalizeSchedulingStatus(target?.previous_status) === 'Okay' &&
      Number(target?.previous_status_until || 0) === Number(observation?.until || 0) &&
      target?.freshness_checkpoint_required !== true
    );
  }

  async function completePendingLocally(target, observation) {
    await rememberCompletedChecks([observation]);
    await SLINK.core.storage.set(
      KEYS.pendingChecks,
      (await pendingChecks()).filter(check => Number(check.id) !== Number(target.id))
    );
  }

  async function syncActivitySnapshots(force = false) {
    const lastSync = Number(await SLINK.core.storage.get(KEYS.lastActivitySyncAt, 0)) || 0;
    if (!force && lastSync && Date.now() - lastSync < 24 * 60 * 60 * 1000) return 0;
    const targetIds = new Set();
    let offset = 0;
    while (true) {
      const page = await workerRequest(`/api/targets?limit=200&offset=${offset}`);
      const targets = Array.isArray(page.targets) ? page.targets : [];
      for (const target of targets) targetIds.add(String(target.id));
      if (targets.length < 200) break;
      offset += targets.length;
    }
    const activeTargets = {};
    for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
      const date = new Date();
      date.setUTCHours(12, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - daysAgo);
      const timestamp = Math.floor(date.getTime() / 1000);
      const csv = await tornText(`https://api.torn.com/v2/user/snapshot?timestamp=${timestamp}`);
      const lines = String(csv).split(/\r?\n/);
      for (let index = 1; index < lines.length; index++) {
        const match = lines[index].match(/^\s*"?([0-9]+)"?\s*,/);
        if (!match || !targetIds.has(match[1])) continue;
        activeTargets[match[1]] = Math.max(Number(activeTargets[match[1]]) || 0, timestamp);
      }
    }
    if (Object.keys(activeTargets).length) {
      await workerRequest('/api/activity', { method: 'POST', body: { active_targets: activeTargets } });
    }
    await SLINK.core.storage.set(KEYS.lastActivitySyncAt, Date.now());
    await saveRuntime({ activeTargetsReported: Object.keys(activeTargets).length });
    return Object.keys(activeTargets).length;
  }

  async function publicStatus() {
    const [currentSettings, currentRuntime, terms, accepted, productSession, contributorSession, usage, pending, permissions] = await Promise.all([
      settings(), runtime(), fetchTerms(), acceptedCurrentTerms(),
      SLINK.core.storage.get(KEYS.session, null), SLINK.core.storage.get(KEYS.contributorSession, null),
      SLINK.core.tornApiLimiter.getUsage(), pendingChecks(),
      SLINK.core.storage.get('permissions.snapshot', null)
    ]);
    const session = currentSettings.contributorOnly ? contributorSession : productSession;
    return {
      configured: Boolean(currentSettings.tornKey && accepted),
      settings: {
        hasTornKey: Boolean(currentSettings.tornKey),
        hasFfKey: Boolean(currentSettings.ffKey),
        pollSeconds: currentSettings.pollSeconds,
        apiContributionLimit: currentSettings.apiContributionLimit,
        contributorOnly: currentSettings.contributorOnly,
        minFF: currentSettings.minFF,
        maxFF: currentSettings.maxFF
      },
      terms: { ...terms, accepted },
      session: {
        authenticated: Boolean(session?.token && Number(session.expiresAt) > Date.now()),
        userId: session?.userId || null,
        expiresAt: Number(session?.expiresAt) || 0,
        kind: currentSettings.contributorOnly ? 'contributor' : 'product'
      },
      runtime: { ...currentRuntime, pendingChecks: pending.length },
      permissions: SLINK.core.permissions.normalizeSnapshot(permissions || {}),
      tornApiUsage: usage
    };
  }

  async function saveSettings(input = {}) {
    const previous = await settings();
    const requestedContributionLimit = Object.prototype.hasOwnProperty.call(input, 'apiContributionLimit')
      ? (Number(input.apiContributionLimit) === 0 ? 0 : DEFAULT_API_CONTRIBUTION_LIMIT)
      : previous.apiContributionLimit;
    const next = {
      tornKey: input.clearTornKey ? '' : (String(input.tornKey || '').trim() || previous.tornKey),
      ffKey: input.clearFfKey ? '' : (String(input.ffKey || '').trim() || previous.ffKey),
      pollSeconds: clamp(input.pollSeconds || previous.pollSeconds, 60, 300),
      apiContributionLimit: previous.apiContributionLimit,
      contributorOnly: Object.prototype.hasOwnProperty.call(input, 'contributorOnly')
        ? input.contributorOnly === true
        : previous.contributorOnly,
      minFF: clamp(input.minFF || previous.minFF, 1, 3),
      maxFF: clamp(input.maxFF || previous.maxFF, 1, 3)
    };
    if (
      next.contributorOnly &&
      !previous.contributorOnly &&
      previous.tornKey &&
      await acceptedCurrentTerms()
    ) {
      try {
        await workerRequest('/api/user/activity', {
          method: 'POST',
          body: { active: false }
        });
      } catch {}
    }
    await SLINK.core.storage.set(KEYS.settings, next);
    if (input.acceptTerms === true) {
      const terms = await fetchTerms(true);
      await SLINK.core.storage.set(KEYS.acceptedTerms, {
        version: terms.version,
        documentSha256: terms.documentSha256,
        disclosureVersion: terms.disclosureVersion,
        disclosureSha256: terms.disclosureSha256,
        acceptedAt: Date.now()
      });
    }
    if (
      next.tornKey !== previous.tornKey ||
      next.contributorOnly !== previous.contributorOnly ||
      input.acceptTerms === true
    ) {
      await clearSession();
      await clearContributorSession();
    }
    if (next.tornKey && await acceptedCurrentTerms()) {
      if (next.contributorOnly) {
        next.apiContributionLimit = DEFAULT_API_CONTRIBUTION_LIMIT;
        await ensureSession(true, true);
      } else {
        await ensureSession(true);
        const permissions = await SLINK.core.storage.get('permissions.snapshot', null);
        if (
          requestedContributionLimit === 0 &&
          !SLINK.core.permissions.hasScope(permissions, 'admin.*')
        ) {
          const error = new Error('Only admin.* may set routine API contribution to zero.');
          error.code = 'SLINK_PERMISSION_DENIED';
          throw error;
        }
        next.apiContributionLimit = requestedContributionLimit;
        await SLINK.core.storage.set(KEYS.lastInteractionAt, Date.now());
        await syncUserDemand(true);
      }
      await SLINK.core.storage.set(KEYS.settings, next);
    }
    return publicStatus();
  }

  async function prepareCycle(options = {}) {
    if (cyclePromise) return cyclePromise;
    cyclePromise = (async () => {
      const currentSettings = await settings();
      if (!currentSettings.tornKey || !await acceptedCurrentTerms()) return { status: await publicStatus(), checks: [] };
      await saveRuntime({ polling: true, lastError: '', cycleStatus: 'Connecting to the SLINK Network...' });
      try {
        const lastInteractionAt = Number(await SLINK.core.storage.get(KEYS.lastInteractionAt, 0)) || 0;
        const contributorMode = currentSettings.contributorOnly || Date.now() - lastInteractionAt >= USER_IDLE_MS;
        if (contributorMode) {
          return await prepareContributorCycle(currentSettings);
        }
        await ensureSession();
        await syncUserDemand(false);
        let battleStats = null;
        try { battleStats = await ensureBattleStats(); } catch (error) {
          await saveRuntime({ lastError: `Local Fair Fight estimate: ${SLINK.core.format.errorMessage(error)}` });
        }
        const query = new URLSearchParams({
          limit: String(MAX_DISPLAY),
          poll_seconds: String(currentSettings.pollSeconds),
          min_ff: String(Math.min(currentSettings.minFF, currentSettings.maxFF)),
          max_ff: String(Math.max(currentSettings.minFF, currentSettings.maxFF))
        });
        const range = targetStatRange(battleStats, currentSettings);
        if (range) {
          query.set('min_target_stats', String(range.min));
          query.set('max_target_stats', String(range.max));
        }
        const recommendations = await workerRequest(`/api/recommendations?${query}`);
        const targets = await enrichFairFight(recommendations.targets || [], battleStats, currentSettings);
        let checks = await pendingChecks();
        if (recommendations.collector === true && options.contribute !== false) {
          const contributionLimit = Number(currentSettings.apiContributionLimit) === 0
            ? 0
            : DEFAULT_API_CONTRIBUTION_LIMIT;
          if (contributionLimit > 0) {
            try {
              await syncActivitySnapshots(false);
            } catch (error) {
              await saveRuntime({ lastError: `Activity sync: ${SLINK.core.format.errorMessage(error)}` });
            }
          }
          const capacity = contributionLimit === 0
            ? 0
            : clamp(
              Math.floor(contributionLimit * (currentSettings.pollSeconds / 60)),
              1,
              MAX_INTERVAL_CHECKS
            );
          const claim = await workerRequest('/api/checks/claim', {
            method: 'POST',
            body: {
              scheduling_mode: 'client_v1',
              interval_capacity: capacity,
              poll_seconds: currentSettings.pollSeconds
            }
          });
          checks = capacity === 0
            ? []
            : (await mergePending(buildClientCheckPlan(claim, capacity))).slice(0, capacity);
        }
        await saveRuntime({
          targets,
          polling: false,
          collector: recommendations.collector === true,
          collectorExpiresAt: Number(recommendations.collector_expires_at) || 0,
          workerVersion: String(recommendations.version || ''),
          fairFightStatus: currentSettings.ffKey ? 'FFScouter refinement active' : 'Local Fair Fight estimates active',
          cycleStatus: recommendations.collector
            ? (currentSettings.apiContributionLimit === 0
              ? 'Targets ready / admin contribution disabled'
              : 'Targets ready / collection assigned')
            : 'Targets ready / standby device',
          lastCycleAt: Date.now(),
          lastCycleChecked: checks.length,
          contributorOnly: false,
          idle: false,
          nextPollSeconds: currentSettings.pollSeconds
        });
        return { status: await publicStatus(), checks };
      } catch (error) {
        await saveRuntime({ polling: false, lastError: SLINK.core.format.errorMessage(error), cycleStatus: 'Leveling sync failed' });
        throw error;
      }
    })();
    try {
      return await cyclePromise;
    } finally {
      cyclePromise = null;
    }
  }

  async function prepareContributorCycle(currentSettings) {
    await ensureSession(false, true);
    const capacity = Number(currentSettings.apiContributionLimit) === 0
      ? 0
      : clamp(
        Math.floor(DEFAULT_API_CONTRIBUTION_LIMIT * (currentSettings.pollSeconds / 60)),
        1,
        MAX_INTERVAL_CHECKS
      );
    const claim = capacity > 0
      ? await workerRequest('/api/contributor/checks/claim', {
        method: 'POST',
        sessionKind: 'contributor',
        body: {
          scheduling_mode: 'client_v1',
          interval_capacity: capacity,
          poll_seconds: currentSettings.pollSeconds
        }
      })
      : { checks: [], demand_active: false, poll_seconds: NO_DEMAND_POLL_SECONDS };
    const checks = claim.demand_active === false || capacity === 0
      ? []
      : (await mergePending(buildClientCheckPlan(claim, capacity), true)).slice(0, capacity);
    const nextPollSeconds = claim.demand_active === false
      ? (Number(claim.poll_seconds) || NO_DEMAND_POLL_SECONDS)
      : currentSettings.pollSeconds;
    await saveRuntime({
      targets: [],
      polling: false,
      collector: claim.collector === true,
      collectorExpiresAt: Number(claim.collector_expires_at) || 0,
      workerVersion: String(claim.version || ''),
      fairFightStatus: '',
      cycleStatus: claim.demand_active === false
        ? 'Contributing only / waiting for an active user'
        : 'Contributing only / collection assigned',
      lastCycleAt: Date.now(),
      lastCycleChecked: checks.length,
      contributorOnly: currentSettings.contributorOnly,
      idle: !currentSettings.contributorOnly,
      nextPollSeconds
    });
    return {
      status: await publicStatus(),
      checks: checks.map(check => ({ ...check, contributor_auth: true }))
    };
  }

  async function checkTarget(input) {
    const targetId = Number(input?.id);
    const batchId = String(input?.check_batch_id || '');
    const pending = await pendingChecks();
    const target = pending.find(check => Number(check.id) === targetId && String(check.check_batch_id || '') === batchId);
    if (!target) throw new Error('This Torn check is not assigned to the extension.');
    const data = await tornJson(`https://api.torn.com/v2/user/${encodeURIComponent(targetId)}/basic`);
    const source = data?.profile ?? data?.basic ?? data?.user ?? data;
    const status = source?.status ?? data?.status ?? {};
    const state = status?.state ?? status?.description ?? status?.details ?? source?.state ?? 'Unknown';
    const observation = {
      target_id: targetId,
      state: String(state || 'Unknown'),
      description: String(status?.description ?? status?.details ?? state ?? 'Unknown'),
      until: Number(status?.until) || 0,
      check_batch_id: batchId || undefined,
      source: 'torn_api',
      contributor_auth: input?.contributor_auth === true || target.contributor_auth === true
    };
    if (canCompleteOkayLocally(target, observation)) {
      await completePendingLocally(target, observation);
      return { ...observation, completed_locally: true };
    }
    return observation;
  }

  async function submitObservations(input) {
    const observations = Array.isArray(input?.observations)
      ? input.observations.filter(row => row?.completed_locally !== true).slice(0, 300)
      : [];
    if (!observations.length) return publicStatus();
    const contributor = observations.some(row => row?.contributor_auth === true);
    const response = await workerRequest(
      contributor ? '/api/contributor/observations' : '/api/observations',
      {
        method: 'POST',
        sessionKind: contributor ? 'contributor' : 'product',
        body: { observations }
      }
    );
    const finished = new Set([
      ...(response.accepted || []).map(row => Number(row.target_id)),
      ...(response.rejected || []).map(row => Number(row.target_id))
    ]);
    await SLINK.core.storage.set(KEYS.pendingChecks, (await pendingChecks()).filter(check => !finished.has(Number(check.id))));
    await saveRuntime({ lastCycleReported: Number(response.accepted_count) || 0 });
    return publicStatus();
  }

  async function submitAttackObservation(input) {
    const targetId = Number(input?.targetId);
    if (!Number.isInteger(targetId) || targetId <= 0) throw new Error('Invalid attack target.');
    await workerRequest('/api/observations', {
      method: 'POST',
      body: { observations: [{
        target_id: targetId,
        state: String(input.state || 'Unknown').slice(0, 50),
        description: String(input.description || '').slice(0, 500),
        until: Number(input.until) || 0,
        source: 'attack_page'
      }] }
    });
    return { ok: true };
  }

  function claimLeader(_payload, sender) {
    const tabId = Number(sender?.tab?.id);
    if (!Number.isInteger(tabId)) return { leader: false, expiresAt: 0 };
    const now = Date.now();
    if (localLeader.expiresAt <= now || localLeader.tabId === tabId) {
      localLeader = { tabId, expiresAt: now + 15_000 };
      return { leader: true, expiresAt: localLeader.expiresAt };
    }
    return { leader: false, expiresAt: localLeader.expiresAt };
  }

  function releaseLeader(_payload, sender) {
    if (Number(sender?.tab?.id) === localLeader.tabId) localLeader = { tabId: null, expiresAt: 0 };
    return { released: true };
  }

  const api = Object.freeze({
    routes: Object.freeze({
      'leveling.status': publicStatus,
      'leveling.terms': () => fetchTerms(true),
      'leveling.settings.save': saveSettings,
      'leveling.activity.touch': touchActivity,
      'leveling.session.clear': async () => {
        await clearSession();
        await clearContributorSession();
        return publicStatus();
      },
      'leveling.cycle.prepare': prepareCycle,
      'leveling.check': checkTarget,
      'leveling.observations.submit': submitObservations,
      'leveling.attack.observe': submitAttackObservation,
      'leveling.leader.claim': claimLeader,
      'leveling.leader.release': releaseLeader
    }),
    publicStatus,
    prepareCycle
  });

  SLINK.define('services', 'leveling', api);
})(globalThis);
