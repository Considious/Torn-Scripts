from pathlib import Path

p = Path(__file__).resolve().parents[1] / 'Slinky_Leveling_Target_Prototype.user.js'
s = p.read_text(encoding='utf-8')

def rep(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'Missing {label}')
    s = s.replace(old, new, 1)

rep('// @version      0.5.0', '// @version      0.5.1', 'version')
rep("    const MAX_SCHEDULER_LOG = 5_000;", "    const MAX_SCHEDULER_LOG = 5_000;\n    const SHARED_POLL_LOCK_MS = 3 * 60 * 1000;", 'lock constant')
rep("        schedulerLog: 'slinkyLeveling.schedulerLog.v1'", "        schedulerLog: 'slinkyLeveling.schedulerLog.v1',\n        pollLock: 'slinkyLeveling.pollLock.v1'", 'lock key')
rep("    const persistedRuntime = loadJson(KEYS.runtimeState, {});", "    const INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;\n    const persistedRuntime = loadJson(KEYS.runtimeState, {});", 'instance id')
rep("""        return value;
    }

    function saveRuntimeState() {""", """        return value;
    }

    function acquireSharedPollLock(kind) {
        const now = Date.now();
        const existing = GM_getValue(KEYS.pollLock, null);

        if (existing?.owner && existing.owner !== INSTANCE_ID && Number(existing.expiresAt) > now) {
            return false;
        }

        const claim = {
            owner: INSTANCE_ID,
            kind: String(kind || 'poll'),
            claimedAt: now,
            expiresAt: now + SHARED_POLL_LOCK_MS
        };

        GM_setValue(KEYS.pollLock, claim);
        const confirmed = GM_getValue(KEYS.pollLock, null);
        return confirmed?.owner === INSTANCE_ID;
    }

    function releaseSharedPollLock() {
        const existing = GM_getValue(KEYS.pollLock, null);
        if (existing?.owner === INSTANCE_ID) {
            GM_setValue(KEYS.pollLock, null);
        }
    }

    function saveRuntimeState() {""", 'lock helpers')
rep("state.statusCache = { ...storedStatus, ...state.statusCache };", "state.statusCache = { ...state.statusCache, ...storedStatus };", 'status merge')
rep("state.hospitalHistory = { ...storedHospital, ...state.hospitalHistory };", "state.hospitalHistory = { ...state.hospitalHistory, ...storedHospital };", 'hospital merge')
rep("state.ffCache = { ...storedFF, ...state.ffCache };", "state.ffCache = { ...state.ffCache, ...storedFF };", 'ff merge')
rep("""        const settings = getSettings();
        if (!settings.tornKey) {
            state.lastError = 'Add a Torn API key in Settings.';
            state.settingsOpen = true; render();
            return;
        }

        state.polling = true;""", """        const settings = getSettings();
        if (!settings.tornKey) {
            state.lastError = 'Add a Torn API key in Settings.';
            state.settingsOpen = true; render();
            return;
        }

        if (!acquireSharedPollLock('primary')) {
            scheduleNextPoll();
            render();
            return;
        }

        state.polling = true;""", 'primary acquire')
rep("""        try {
            cleanHospitalHistory();
            if (!state.master.length || force) await loadMaster(force);""", """        try {
            refreshCollectedDataFromStorage();
            cleanHospitalHistory();
            if (!state.master.length || force) await loadMaster(force);""", 'primary refresh')
rep("""        } finally {
            state.polling = false;
            scheduleNextPoll();
            render();
        }
    }

    async function backgroundPoll() {""", """        } finally {
            state.polling = false;
            releaseSharedPollLock();
            scheduleNextPoll();
            render();
        }
    }

    async function backgroundPoll() {""", 'primary release')
rep("""        const settings = getSettings();
        if (!settings.tornKey) {
            scheduleBackgroundPoll();
            return;
        }

        state.backgroundPolling = true;""", """        const settings = getSettings();
        if (!settings.tornKey) {
            scheduleBackgroundPoll();
            return;
        }

        if (!acquireSharedPollLock('background')) {
            scheduleBackgroundPoll();
            return;
        }

        state.backgroundPolling = true;""", 'background acquire')
rep("""        try {
            if (!state.master.length) await loadMaster(false);
            await ensureActivitySnapshots(settings.tornKey, false);""", """        try {
            refreshCollectedDataFromStorage();
            if (!state.master.length) await loadMaster(false);
            await ensureActivitySnapshots(settings.tornKey, false);""", 'background refresh')
rep("""        } finally {
            state.backgroundPolling = false;
            scheduleBackgroundPoll();
            render();
        }
    }""", """        } finally {
            state.backgroundPolling = false;
            releaseSharedPollLock();
            scheduleBackgroundPoll();
            render();
        }
    }""", 'background release')
rep("scriptVersion: '0.5.0'", "scriptVersion: '0.5.1'", 'debug version')
p.write_text(s, encoding='utf-8')
