#!/usr/bin/env python3
from pathlib import Path
import re

PATH = Path(__file__).resolve().parents[1] / "Slinky_Leveling_Target_Prototype.user.js"
text = PATH.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f"Could not find {label}")
    text = text.replace(old, new, 1)


def replace_regex(pattern, replacement, label):
    global text
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Could not replace {label}; matches={count}")
    text = new_text


replace_once("// @version      0.4.4", "// @version      0.5.0", "version")
replace_once(
    "// @description  Leveling target prototype using daily activity snapshots, prioritized Torn status checks, FFScouter estimates, and local hospitalization history.",
    "// @description  Leveling target scheduler using daily activity snapshots, scheduled status checks, FFScouter estimates, and competition-aware hospitalization history.",
    "description",
)

replace_once(
    "    const OKAY_CACHE_MS = 5 * 60 * 1000;\n    const NON_OKAY_RECHECK_MS = 5 * 60 * 1000;",
    "    const OKAY_CACHE_MS = 5 * 60 * 1000;\n"
    "    const NON_OKAY_RECHECK_MS = 10 * 60 * 1000;\n"
    "    const HOSPITAL_RECHECK_GRACE_MS = 60 * 1000;\n"
    "    const RAPID_REHOSP_WINDOW_MS = 60 * 60 * 1000;\n"
    "    const OKAY_RECHECK_PRIME_MS = 15 * 60 * 1000;\n"
    "    const OKAY_RECHECK_WARM_MS = 30 * 60 * 1000;\n"
    "    const OKAY_RECHECK_CROWDED_MS = 60 * 60 * 1000;\n"
    "    const OKAY_RECHECK_FARMED_MS = 6 * 60 * 60 * 1000;",
    "scheduler constants",
)
replace_once(
    "    const MAX_OBSERVATION_LOG = 20_000;",
    "    const MAX_OBSERVATION_LOG = 20_000;\n    const MAX_SCHEDULER_LOG = 5_000;",
    "scheduler log constant",
)
replace_once(
    "        observationLog: 'slinkyLeveling.observationLog.v1'",
    "        observationLog: 'slinkyLeveling.observationLog.v1',\n        schedulerLog: 'slinkyLeveling.schedulerLog.v1'",
    "scheduler log key",
)
replace_once(
    "        observationLog: loadJson(KEYS.observationLog, []),",
    "        observationLog: loadJson(KEYS.observationLog, []),\n        schedulerLog: loadJson(KEYS.schedulerLog, []),",
    "scheduler log state",
)
replace_once(
    "        const storedObservations = loadJson(KEYS.observationLog, []);",
    "        const storedObservations = loadJson(KEYS.observationLog, []);\n        const storedSchedulerLog = loadJson(KEYS.schedulerLog, []);",
    "scheduler log storage read",
)
replace_once(
    "        if (Array.isArray(storedObservations) && storedObservations.length > state.observationLog.length) {\n            state.observationLog = storedObservations;\n        }",
    "        if (Array.isArray(storedObservations) && storedObservations.length > state.observationLog.length) {\n"
    "            state.observationLog = storedObservations;\n"
    "        }\n"
    "        if (Array.isArray(storedSchedulerLog) && storedSchedulerLog.length > state.schedulerLog.length) {\n"
    "            state.schedulerLog = storedSchedulerLog;\n"
    "        }",
    "scheduler log storage merge",
)

# Wake Hiding Out targets when the free daily activity snapshot proves they returned.
replace_once(
    "        state.activityCache = {\n            refreshedAt: Date.now(),\n            activeTargets,\n            snapshots\n        };\n        saveJson(KEYS.activityCache, state.activityCache);",
    "        state.activityCache = {\n"
    "            refreshedAt: Date.now(),\n"
    "            activeTargets,\n"
    "            snapshots\n"
    "        };\n\n"
    "        for (const id of Object.keys(activeTargets)) {\n"
    "            const cachedStatus = state.statusCache[id];\n"
    "            if (!cachedStatus?.dormantHiding) continue;\n\n"
    "            state.statusCache[id] = {\n"
    "                ...cachedStatus,\n"
    "                state: 'Unknown',\n"
    "                description: 'Activity snapshot detected a return after Hiding Out.',\n"
    "                dormantHiding: false,\n"
    "                nextEligibleAt: 0,\n"
    "                scheduleReason: 'activity_snapshot_wake'\n"
    "            };\n"
    "            logSchedulerEvent('hiding_out_wake', id, {\n"
    "                state: 'Unknown',\n"
    "                reason: 'Activity snapshot detected target again'\n"
    "            });\n"
    "        }\n\n"
    "        saveJson(KEYS.statusCache, state.statusCache);\n"
    "        saveJson(KEYS.activityCache, state.activityCache);",
    "activity wake logic",
)

hospital_and_status = r'''    // ─────────────────────────────────────────────────────────────
    // Hospitalization history
    // ─────────────────────────────────────────────────────────────

    function cleanHospitalHistory() {
        const cutoff = Date.now() - HOSPITAL_7D_MS;

        for (const [id, record] of Object.entries(state.hospitalHistory)) {
            record.events = Array.isArray(record.events)
                ? record.events.map(Number).filter(timestamp => timestamp >= cutoff)
                : [];
            record.rapidEvents = Array.isArray(record.rapidEvents)
                ? record.rapidEvents
                    .map(event => ({
                        at: Number(event?.at) || 0,
                        gapMs: Number(event?.gapMs) || 0
                    }))
                    .filter(event => event.at >= cutoff)
                : [];

            if (!record.events.length && !record.lastHospitalizedAt && !record.lastState) {
                delete state.hospitalHistory[id];
            }
        }

        saveJson(KEYS.hospitalHistory, state.hospitalHistory);
    }

    function getHospitalRecord(id) {
        const record = state.hospitalHistory[id] || {
            events: [],
            rapidEvents: [],
            lastHospitalizedAt: 0,
            lastHospitalUntil: 0,
            lastState: ''
        };

        const cutoff = Date.now() - HOSPITAL_7D_MS;
        record.events = Array.isArray(record.events)
            ? record.events.map(Number).filter(timestamp => timestamp >= cutoff)
            : [];
        record.rapidEvents = Array.isArray(record.rapidEvents)
            ? record.rapidEvents
                .map(event => ({
                    at: Number(event?.at) || 0,
                    gapMs: Number(event?.gapMs) || 0
                }))
                .filter(event => event.at >= cutoff)
            : [];

        return record;
    }

    function noteStatusObservation(id, statusState, statusUntil = 0) {
        const now = Date.now();
        const normalized = normalizeStatus(statusState);
        const record = getHospitalRecord(id);
        const wasHospital = isHospitalState(record.lastState);
        const isHospital = isHospitalState(normalized);
        const hospitalUntil = Number(statusUntil) || 0;
        const previousHospitalUntil = Number(record.lastHospitalUntil) || 0;

        const newHospitalStay = isHospital && (
            (hospitalUntil > 0 && hospitalUntil !== previousHospitalUntil) ||
            (hospitalUntil <= 0 && !wasHospital)
        );

        if (newHospitalStay) {
            record.events.push(now);
            record.lastHospitalizedAt = now;

            if (previousHospitalUntil > 0) {
                const previousReleaseMs = previousHospitalUntil * 1000;
                const gapMs = Math.max(0, now - previousReleaseMs);
                if (gapMs <= RAPID_REHOSP_WINDOW_MS) {
                    record.rapidEvents.push({ at: now, gapMs });
                    logSchedulerEvent('rapid_rehospitalization', id, {
                        state: 'Hospital',
                        reason: `Rehospitalized ${Math.round(gapMs / 60000)}m after expected release`
                    });
                }
            }

            logSchedulerEvent('hospitalization_observed', id, {
                state: 'Hospital',
                reason: hospitalUntil > 0 ? 'New hospital-until timestamp' : 'Transitioned into Hospital'
            });
        }

        if (isHospital && hospitalUntil > 0) {
            record.lastHospitalUntil = hospitalUntil;
        }

        record.lastState = normalized;
        state.hospitalHistory[id] = record;
    }

    function hospitalCount24h(id) {
        const cutoff = Date.now() - HOSPITAL_24H_MS;
        return getHospitalRecord(id).events.filter(timestamp => timestamp >= cutoff).length;
    }

    function hospitalCount7d(id) {
        return getHospitalRecord(id).events.length;
    }

    function lastHospitalizedAt(id) {
        return Number(getHospitalRecord(id).lastHospitalizedAt) || 0;
    }

    function rapidHospitalEvents24h(id) {
        const cutoff = Date.now() - HOSPITAL_24H_MS;
        return getHospitalRecord(id).rapidEvents.filter(event => event.at >= cutoff);
    }

    function fastestRapidHospitalGap24h(id) {
        const events = rapidHospitalEvents24h(id);
        if (!events.length) return 0;
        return Math.min(...events.map(event => Number(event.gapMs) || 0));
    }

    function rapidPenalty(gapMs) {
        if (!Number.isFinite(gapMs) || gapMs < 0 || gapMs > RAPID_REHOSP_WINDOW_MS) return 0;
        if (gapMs <= 5 * 60 * 1000) return 40;
        if (gapMs <= 15 * 60 * 1000) return 25;
        if (gapMs <= 30 * 60 * 1000) return 15;
        return 8;
    }

    function competitionScore(id) {
        const rapid = rapidHospitalEvents24h(id)
            .reduce((sum, event) => sum + rapidPenalty(Number(event.gapMs)), 0);
        return (hospitalCount24h(id) * 10) + (hospitalCount7d(id) * 2) + rapid;
    }

    function competitionTier(id) {
        const score = competitionScore(id);
        if (score >= 80) return 'Farmed';
        if (score >= 40) return 'Crowded';
        if (score >= 20) return 'Warm';
        return 'Prime';
    }

    function heavilyContested(id) {
        const fastestGap = fastestRapidHospitalGap24h(id);
        return hospitalCount24h(id) >= 8 || (fastestGap > 0 && fastestGap <= 5 * 60 * 1000) || competitionScore(id) >= 80;
    }

    function okayRecheckInterval(id) {
        const tier = competitionTier(id);
        if (tier === 'Farmed') return OKAY_RECHECK_FARMED_MS;
        if (tier === 'Crowded') return OKAY_RECHECK_CROWDED_MS;
        if (tier === 'Warm') return OKAY_RECHECK_WARM_MS;
        return OKAY_RECHECK_PRIME_MS;
    }

    function isHospitalState(value) {
        return String(value || '').toLowerCase().includes('hospital');
    }

    function logSchedulerEvent(event, targetOrId, details = {}) {
        const id = typeof targetOrId === 'object'
            ? String(targetOrId?.id || '')
            : String(targetOrId || '');
        const target = typeof targetOrId === 'object'
            ? targetOrId
            : state.master.find(item => item.id === id);

        const row = {
            at: Date.now(),
            event: String(event || 'event'),
            id,
            name: target?.name || '',
            state: String(details.state || state.statusCache[id]?.state || ''),
            reason: String(details.reason || ''),
            nextEligibleAt: Number(details.nextEligibleAt ?? state.statusCache[id]?.nextEligibleAt) || 0,
            competitionScore: id ? competitionScore(id) : 0,
            competitionTier: id ? competitionTier(id) : '',
            source: String(details.source || 'API')
        };

        state.schedulerLog.push(row);
        if (state.schedulerLog.length > MAX_SCHEDULER_LOG) {
            state.schedulerLog.splice(0, state.schedulerLog.length - MAX_SCHEDULER_LOG);
        }
        saveJson(KEYS.schedulerLog, state.schedulerLog);
    }

    // ─────────────────────────────────────────────────────────────
    // Torn API status polling
    // ─────────────────────────────────────────────────────────────

    async function getUserStatus(apiKey, target, priority = 'normal') {
        const url = `https://api.torn.com/v2/user/${encodeURIComponent(target.id)}/basic`;
        const data = await TornLib.tornRequest(url, apiKey, {
            tornScript: SCRIPT_NAME,
            tornPriority: priority,
            tornLimit: TornLib.TORN_API_DEFAULT_LIMIT,
            tornWait: true,
            tornMaxWaitMs: 65_000
        });

        const source = data?.profile ?? data?.basic ?? data?.user ?? data;
        const status = source?.status ?? data?.status ?? {};
        const stateValue =
            status?.state ??
            status?.description ??
            status?.details ??
            source?.state ??
            'Unknown';

        return {
            state: normalizeStatus(stateValue),
            description: String(status?.description ?? status?.details ?? stateValue ?? 'Unknown'),
            until: Number(status?.until) || 0
        };
    }

    function normalizeStatus(value) {
        const text = String(value || 'Unknown').trim();
        const lower = text.toLowerCase();

        if (lower.includes('federal')) return 'Federal';
        if (lower.includes('hiding out') || lower.includes('hiding')) return 'Hiding Out';
        if (lower === 'okay' || lower.includes('okay')) return 'Okay';
        if (lower.includes('hospital')) return 'Hospital';
        if (lower.includes('travel') || lower.includes('flying')) return 'Traveling';
        if (lower.includes('abroad')) return 'Abroad';
        if (lower.includes('jail')) return 'Jail';
        return text || 'Unknown';
    }

    function statusIsOkay(status) {
        return normalizeStatus(status) === 'Okay';
    }

    function updateStatusCache(target, status, source = 'API') {
        const now = Date.now();
        const normalized = normalizeStatus(status.state);
        const untilSeconds = Number(status.until) || 0;
        const untilMs = untilSeconds > 0 ? untilSeconds * 1000 : 0;

        noteStatusObservation(target.id, normalized, untilSeconds);

        let nextEligibleAt = now + NON_OKAY_RECHECK_MS;
        let scheduleReason = 'stale_status';
        let dormantHiding = false;
        let permanentExcluded = false;

        if (normalized === 'Hospital') {
            nextEligibleAt = untilMs > now
                ? untilMs + HOSPITAL_RECHECK_GRACE_MS
                : now + NON_OKAY_RECHECK_MS;
            scheduleReason = untilMs > now ? 'hospital_release_plus_1m' : 'hospital_without_release_time';
        } else if (normalized === 'Federal') {
            const description = String(status.description || '').toLowerCase();
            const explicitlyPermanent = description.includes('permanent');
            permanentExcluded = explicitlyPermanent || untilMs <= now;

            if (permanentExcluded) {
                nextEligibleAt = Number.MAX_SAFE_INTEGER;
                scheduleReason = 'permanent_federal_jail';
            } else {
                nextEligibleAt = untilMs + HOSPITAL_RECHECK_GRACE_MS;
                scheduleReason = 'temporary_federal_release_plus_1m';
            }
        } else if (normalized === 'Hiding Out') {
            dormantHiding = true;
            nextEligibleAt = Number.MAX_SAFE_INTEGER;
            scheduleReason = 'hiding_out_until_activity_snapshot';
        } else if (normalized === 'Okay') {
            nextEligibleAt = now + okayRecheckInterval(target.id);
            scheduleReason = `okay_${competitionTier(target.id).toLowerCase()}_recheck`;
        } else if (normalized === 'Unknown') {
            nextEligibleAt = now + NON_OKAY_RECHECK_MS;
            scheduleReason = 'unknown_recheck';
        }

        state.statusCache[target.id] = {
            state: normalized,
            description: status.description,
            until: untilSeconds,
            checkedAt: now,
            nextEligibleAt,
            scheduleReason,
            dormantHiding,
            permanentExcluded,
            source
        };

        logSchedulerEvent('status_observed', target, {
            state: normalized,
            reason: scheduleReason,
            nextEligibleAt,
            source
        });

        saveJson(KEYS.statusCache, state.statusCache);
        saveJson(KEYS.hospitalHistory, state.hospitalHistory);
    }

    function parseVisibleRemainingMs(text) {
        const lower = String(text || '').toLowerCase();
        let total = 0;
        const days = lower.match(/(\d+)\s*d(?:ay)?s?/);
        const hours = lower.match(/(\d+)\s*h(?:our)?s?/);
        const mins = lower.match(/(\d+)\s*m(?:in(?:ute)?)?s?/);
        const secs = lower.match(/(\d+)\s*s(?:ec(?:ond)?)?s?/);
        if (days) total += Number(days[1]) * 24 * 60 * 60 * 1000;
        if (hours) total += Number(hours[1]) * 60 * 60 * 1000;
        if (mins) total += Number(mins[1]) * 60 * 1000;
        if (secs) total += Number(secs[1]) * 1000;
        return total;
    }

    function detectAttackPageStatusText(text) {
        const lower = String(text || '').toLowerCase();
        if (lower.includes('federal jail')) return 'Federal';
        if (lower.includes('hiding out')) return 'Hiding Out';
        if (lower.includes('in hospital') || lower.includes('hospitalized')) return 'Hospital';
        if (lower.includes('traveling') || lower.includes('flying')) return 'Traveling';
        if (lower.includes('abroad')) return 'Abroad';
        return '';
    }

    function scrapeAttackPageStatus() {
        try {
            const page = new URL(window.location.href);
            if (page.searchParams.get('sid') !== 'attack') return false;

            const id = String(page.searchParams.get('user2ID') || '').trim();
            if (!id || !TornLib.isPageActive({ requireFocus: true })) return false;

            const target = state.master.find(item => item.id === id);
            if (!target) return false;

            const candidates = [
                ...document.querySelectorAll('[class*="status"], [class*="profile"], [class*="info"], [data-testid*="status"]')
            ].map(node => node.innerText || node.textContent || '').filter(Boolean);
            candidates.push(document.body?.innerText || '');

            for (const visibleText of candidates) {
                const detected = detectAttackPageStatusText(visibleText);
                if (!detected) continue;

                const remainingMs = parseVisibleRemainingMs(visibleText);
                const until = remainingMs > 0
                    ? Math.floor((Date.now() + remainingMs) / 1000)
                    : 0;

                updateStatusCache(target, {
                    state: detected,
                    description: visibleText.trim().slice(0, 500),
                    until
                }, 'Attack Page');
                render();
                return true;
            }
        } catch (error) {
            console.warn('[Slinky Leveling] Attack-page scrape failed:', error);
        }
        return false;
    }

    function scheduleAttackPageScrape() {
        const page = new URL(window.location.href);
        if (page.searchParams.get('sid') !== 'attack' || !page.searchParams.get('user2ID')) return;

        let attempts = 0;
        const tryScrape = () => {
            attempts += 1;
            if (scrapeAttackPageStatus() || attempts >= 6) return;
            setTimeout(tryScrape, 1000);
        };
        setTimeout(tryScrape, 700);
    }

    // ─────────────────────────────────────────────────────────────
    // FFScouter
    // ─────────────────────────────────────────────────────────────
'''
replace_regex(
    r"    // ─+\n    // Hospitalization history\n    // ─+.*?    // ─+\n    // FFScouter\n    // ─+\n",
    hospital_and_status,
    "hospital/status section",
)

priority_section = r'''    // ─────────────────────────────────────────────────────────────
    // Priority and candidate selection
    // ─────────────────────────────────────────────────────────────

    function schedulerCategory(target, now = Date.now()) {
        const status = state.statusCache[target.id];
        if (!status) return 1;

        const normalized = normalizeStatus(status.state);
        const due = !status.nextEligibleAt || status.nextEligibleAt <= now;

        if (due && (normalized === 'Hospital' || normalized === 'Federal')) return 0;
        if (normalized === 'Unknown') return 2;
        if (normalized === 'Okay') return heavilyContested(target.id) ? 4 : 3;
        return 2;
    }

    function schedulerReason(target) {
        const status = state.statusCache[target.id];
        if (!status) return 'never_checked';
        return status.scheduleReason || normalizeStatus(status.state).toLowerCase();
    }

    function priorityTuple(target) {
        const status = state.statusCache[target.id];
        return {
            category: schedulerCategory(target),
            score: competitionScore(target.id),
            lastCheckedAt: Number(status?.checkedAt) || 0,
            level: target.level,
            total: Number.isFinite(target.totalNumeric) ? target.totalNumeric : Number.MAX_SAFE_INTEGER
        };
    }

    function compareCandidates(a, b) {
        const A = priorityTuple(a);
        const B = priorityTuple(b);

        if (A.category !== B.category) return A.category - B.category;
        if (A.score !== B.score) return A.score - B.score;
        if (A.lastCheckedAt !== B.lastCheckedAt) return A.lastCheckedAt - B.lastCheckedAt;
        if (A.level !== B.level) return B.level - A.level;
        if (A.total !== B.total) return A.total - B.total;
        return a.name.localeCompare(b.name);
    }

    function candidateEligible(target, now = Date.now()) {
        if (activeWithinSevenDays(target.id)) return false;

        const cached = state.statusCache[target.id];
        if (cached?.permanentExcluded) return false;
        if (cached?.dormantHiding) return false;
        return !cached?.nextEligibleAt || cached.nextEligibleAt <= now;
    }

    function chooseCandidates(limit) {
        const now = Date.now();
        return [...state.master]
            .filter(target => candidateEligible(target, now))
            .sort(compareCandidates)
            .slice(0, limit);
    }

    function chooseBackgroundCandidates(limit, excludeIds = new Set()) {
        const now = Date.now();
        return [...state.master]
            .filter(target => !excludeIds.has(target.id) && candidateEligible(target, now))
            .sort(compareCandidates)
            .slice(0, limit);
    }

    function displayTargets(settings) {
        return state.master
            .filter(target => {
                if (activeWithinSevenDays(target.id)) return false;

                const status = state.statusCache[target.id];
                if (status?.permanentExcluded || status?.dormantHiding) return false;
                if (heavilyContested(target.id)) return false;

                if (status) {
                    const normalized = normalizeStatus(status.state);
                    if (normalized !== 'Okay' && normalized !== 'Hospital' && normalized !== 'Unknown') return false;
                }

                const ff = getFF(target.id).fairFight;
                if (Number.isFinite(ff) && (ff < settings.minFF || ff > settings.maxFF)) return false;
                return true;
            })
            .sort((a, b) => {
                const scoreA = competitionScore(a.id);
                const scoreB = competitionScore(b.id);
                if (scoreA !== scoreB) return scoreA - scoreB;

                if (a.level !== b.level) return b.level - a.level;

                const Aff = getFF(a.id).fairFight;
                const Bff = getFF(b.id).fairFight;
                if (Number.isFinite(Aff) && Number.isFinite(Bff) && Aff !== Bff) return Aff - Bff;
                if (Number.isFinite(Aff) !== Number.isFinite(Bff)) return Number.isFinite(Aff) ? -1 : 1;

                return a.name.localeCompare(b.name);
            })
            .slice(0, MAX_DISPLAY);
    }

    // ─────────────────────────────────────────────────────────────
    // Poll cycle
    // ─────────────────────────────────────────────────────────────
'''
replace_regex(
    r"    // ─+\n    // Priority and candidate selection\n    // ─+.*?    // ─+\n    // Poll cycle\n    // ─+\n",
    priority_section,
    "priority section",
)

replace_once(
    "            const candidates = chooseCandidates(settings.primaryChecks);\n            state.lastCycleChecked = candidates.length;",
    "            const candidates = chooseCandidates(settings.primaryChecks);\n"
    "            state.lastCycleChecked = candidates.length;\n"
    "            for (const target of candidates) {\n"
    "                logSchedulerEvent('primary_selected', target, { reason: schedulerReason(target) });\n"
    "            }",
    "primary selection logging",
)
replace_once(
    "            const candidates = chooseBackgroundCandidates(settings.backgroundChecks, primaryIds);\n            state.lastBackgroundChecked = candidates.length;",
    "            const candidates = chooseBackgroundCandidates(settings.backgroundChecks, primaryIds);\n"
    "            state.lastBackgroundChecked = candidates.length;\n"
    "            for (const target of candidates) {\n"
    "                logSchedulerEvent('background_selected', target, { reason: schedulerReason(target) });\n"
    "            }",
    "background selection logging",
)

replace_once(
    "<div class=\"slp-stat\"><b>${targets.length}</b><span>Okay cached</span></div>",
    "<div class=\"slp-stat\"><b>${targets.length}</b><span>Targets shown</span></div>",
    "summary label",
)
replace_once(
    "7-day activity snapshots exclude recent players from polling. Hospital hits are local 24h observations.",
    "7-day activity snapshots exclude recent players. Hospital/Federal checks are scheduled after expected release; Hiding Out and permanent Federal targets stop consuming API calls.",
    "footer text",
)

build_debug = r'''    function buildDebugData() {
        refreshCollectedDataFromStorage();

        const statusEntries = Object.entries(state.statusCache || {});
        const statusCounts = {};
        let dormantHiding = 0;
        let permanentFederal = 0;
        let scheduledReleaseDue = 0;
        let farmedHidden = 0;
        const now = Date.now();

        for (const [id, entry] of statusEntries) {
            const status = normalizeStatus(entry?.state || 'Unknown');
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            if (entry?.dormantHiding) dormantHiding += 1;
            if (entry?.permanentExcluded) permanentFederal += 1;
            if ((status === 'Hospital' || status === 'Federal') && Number(entry?.nextEligibleAt) <= now) {
                scheduledReleaseDue += 1;
            }
            if (heavilyContested(id)) farmedHidden += 1;
        }

        let hospitalizationEvents24h = 0;
        let rapidEvents24h = 0;
        for (const id of Object.keys(state.hospitalHistory || {})) {
            hospitalizationEvents24h += hospitalCount24h(id);
            rapidEvents24h += rapidHospitalEvents24h(id).length;
        }

        const recentChecks = statusEntries
            .map(([id, record]) => {
                const target = state.master.find(item => item.id === id);
                return {
                    id,
                    name: target?.name || 'Unknown',
                    state: normalizeStatus(record?.state || 'Unknown'),
                    checkedAt: Number(record?.checkedAt) || 0,
                    nextEligibleAt: Number(record?.nextEligibleAt) || 0,
                    reason: record?.scheduleReason || ''
                };
            })
            .sort((a, b) => b.checkedAt - a.checkedAt)
            .slice(0, 20);

        return {
            scriptVersion: '0.5.0',
            coreLibVersion: TornLib.VERSION,
            leaderTab: Boolean(state.leader?.isLeader()),
            primaryChecksConfigured: getSettings().primaryChecks,
            backgroundChecksConfigured: getSettings().backgroundChecks,
            pollSecondsConfigured: getSettings().pollSeconds,
            masterTargets: state.master.length,
            activeUnder7Days: activeExcludedCount(),
            neverChecked: state.master.filter(target => !state.statusCache[target.id]).length,
            statusRecords: statusEntries.length,
            statusCounts,
            dormantHiding,
            permanentFederal,
            scheduledReleaseDue,
            farmedHidden,
            hospitalizationEvents24h,
            rapidEvents24h,
            ffScouterRecords: Object.keys(state.ffCache || {}).length,
            hospitalizedTargets: Object.keys(state.hospitalHistory || {}).filter(id => hospitalCount7d(id) > 0).length,
            hospitalizationEvents7d: Object.keys(state.hospitalHistory || {}).reduce((sum, id) => sum + hospitalCount7d(id), 0),
            schedulerLogRows: state.schedulerLog.length,
            activitySnapshotRefreshedAt: Number(state.activityCache?.refreshedAt) || 0,
            activitySnapshotCount: Array.isArray(state.activityCache?.snapshots) ? state.activityCache.snapshots.length : 0,
            lastPrimaryPollAt: state.lastCycleAt,
            lastPrimaryChecked: state.lastCycleChecked,
            lastPrimaryOkay: state.lastCycleOkay,
            lastBackgroundPollAt: state.lastBackgroundAt,
            lastBackgroundChecked: state.lastBackgroundChecked,
            lastError: state.lastError || '',
            recentChecks
        };
    }
'''
replace_regex(r"    function buildDebugData\(\) \{.*?\n    \}\n\n    function debugText", build_debug + "\n    function debugText", "buildDebugData")

replace_once(
    "        const knownStatuses = ['Okay', 'Hospital', 'Traveling', 'Abroad', 'Jail', 'Federal'];",
    "        const knownStatuses = ['Okay', 'Hospital', 'Traveling', 'Abroad', 'Jail', 'Federal', 'Hiding Out', 'Unknown'];",
    "known statuses",
)
replace_once(
    "            `  Federal: ${data.statusCounts.Federal || 0}`,\n            `  Unknown/Other: ${Math.max(0, data.statusRecords - knownCount)}`,",
    "            `  Federal: ${data.statusCounts.Federal || 0}`,\n"
    "            `  Hiding Out: ${data.statusCounts['Hiding Out'] || 0}`,\n"
    "            `  Unknown: ${data.statusCounts.Unknown || 0}`,\n"
    "            `  Unknown/Other: ${Math.max(0, data.statusRecords - knownCount)}`,\n"
    "            `Never checked: ${data.neverChecked}`,\n"
    "            `Dormant Hiding Out: ${data.dormantHiding}`,\n"
    "            `Permanent Federal excluded: ${data.permanentFederal}`,\n"
    "            `Scheduled releases due now: ${data.scheduledReleaseDue}`,\n"
    "            `Farmed/contested hidden: ${data.farmedHidden}`,",
    "debug status lines",
)
replace_once(
    "            `Hospitalization events observed in 24h: ${data.hospitalizationEvents24h}`,",
    "            `Hospitalization events observed in 24h: ${data.hospitalizationEvents24h}`,\n"
    "            `Rapid rehospitalizations observed in 24h: ${data.rapidEvents24h}`,\n"
    "            `Scheduler log rows: ${data.schedulerLogRows}`,",
    "debug scheduler lines",
)
replace_once(
    "            lines.push(`${row.checkedAt ? new Date(row.checkedAt).toLocaleString() : 'Never'} | ${row.name} [${row.id}] | ${row.state}`);",
    "            lines.push(`${row.checkedAt ? new Date(row.checkedAt).toLocaleString() : 'Never'} | ${row.name} [${row.id}] | ${row.state} | ${row.reason || 'no schedule reason'} | next ${row.nextEligibleAt && row.nextEligibleAt < Number.MAX_SAFE_INTEGER ? new Date(row.nextEligibleAt).toLocaleString() : 'deferred indefinitely'}`);",
    "recent debug line",
)

# Replace target-cache export and add scheduler-log export immediately after it.
export_cache = r'''    function exportTargetCacheCsv() {
        refreshCollectedDataFromStorage();
        const headers = [
            'id', 'name', 'level', 'total', 'sources', 'profile_url',
            'active_within_7_days', 'last_seen_active_snapshot',
            'current_status', 'status_description', 'status_checked_at',
            'next_check_at', 'schedule_reason', 'dormant_hiding', 'permanent_excluded',
            'competition_score', 'competition_tier', 'rapid_rehospitalizations_24h',
            'hospitalizations_observed_24h', 'hospitalizations_observed_7d', 'last_hospitalized_at',
            'fair_fight', 'ff_bs_estimate', 'ff_source', 'ff_checked_at'
        ];
        const rows = state.master.map(target => {
            const status = state.statusCache[target.id] || {};
            const ff = state.ffCache[target.id] || {};
            const lastActive = lastSeenActiveSnapshot(target.id);
            const lastHosp = lastHospitalizedAt(target.id);
            const nextEligibleAt = Number(status.nextEligibleAt) || 0;
            return {
                id: target.id,
                name: target.name,
                level: target.level,
                total: target.total,
                sources: target.sources,
                profile_url: target.profileUrl,
                active_within_7_days: activeWithinSevenDays(target.id) ? 'Yes' : 'No',
                last_seen_active_snapshot: lastActive ? new Date(lastActive * 1000).toISOString() : '',
                current_status: status.state || '',
                status_description: status.description || '',
                status_checked_at: status.checkedAt ? new Date(status.checkedAt).toISOString() : '',
                next_check_at: nextEligibleAt && nextEligibleAt < Number.MAX_SAFE_INTEGER ? new Date(nextEligibleAt).toISOString() : '',
                schedule_reason: status.scheduleReason || '',
                dormant_hiding: status.dormantHiding ? 'Yes' : 'No',
                permanent_excluded: status.permanentExcluded ? 'Yes' : 'No',
                competition_score: competitionScore(target.id),
                competition_tier: competitionTier(target.id),
                rapid_rehospitalizations_24h: rapidHospitalEvents24h(target.id).length,
                hospitalizations_observed_24h: hospitalCount24h(target.id),
                hospitalizations_observed_7d: hospitalCount7d(target.id),
                last_hospitalized_at: lastHosp ? new Date(lastHosp).toISOString() : '',
                fair_fight: Number.isFinite(Number(ff.fairFight)) ? ff.fairFight : '',
                ff_bs_estimate: ff.bsEstimate ?? '',
                ff_source: ff.source || '',
                ff_checked_at: ff.checkedAt ? new Date(ff.checkedAt).toISOString() : ''
            };
        });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCsv(`Slinky-Leveling-Target-Cache-${stamp}.csv`, headers, rows);
    }

    function exportSchedulerLogCsv() {
        refreshCollectedDataFromStorage();
        const headers = [
            'timestamp', 'event', 'id', 'name', 'state', 'reason',
            'next_check_at', 'competition_score', 'competition_tier', 'source'
        ];
        const rows = state.schedulerLog.map(row => ({
            timestamp: row.at ? new Date(row.at).toISOString() : '',
            event: row.event || '',
            id: row.id || '',
            name: row.name || '',
            state: row.state || '',
            reason: row.reason || '',
            next_check_at: row.nextEligibleAt && row.nextEligibleAt < Number.MAX_SAFE_INTEGER
                ? new Date(row.nextEligibleAt).toISOString()
                : '',
            competition_score: row.competitionScore ?? '',
            competition_tier: row.competitionTier || '',
            source: row.source || ''
        }));
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCsv(`Slinky-Leveling-Scheduler-Debug-${stamp}.csv`, headers, rows);
    }
'''
replace_regex(r"    function exportTargetCacheCsv\(\) \{.*?\n    \}\n\n    function debugHtml", export_cache + "\n    function debugHtml", "cache export")

replace_once(
    "                    <div class=\"slp-debug-line\"><span>Hosp events 24h</span><b>${data.hospitalizationEvents24h}</b></div>\n                    <div class=\"slp-debug-line\"><span>Snapshots</span><b>${data.activitySnapshotCount}</b></div>",
    "                    <div class=\"slp-debug-line\"><span>Hosp events 24h</span><b>${data.hospitalizationEvents24h}</b></div>\n"
    "                    <div class=\"slp-debug-line\"><span>Rapid rehosp 24h</span><b>${data.rapidEvents24h}</b></div>\n"
    "                    <div class=\"slp-debug-line\"><span>Never checked</span><b>${data.neverChecked}</b></div>\n"
    "                    <div class=\"slp-debug-line\"><span>Hiding Out dormant</span><b>${data.dormantHiding}</b></div>\n"
    "                    <div class=\"slp-debug-line\"><span>Permanent Federal</span><b>${data.permanentFederal}</b></div>\n"
    "                    <div class=\"slp-debug-line\"><span>Farmed hidden</span><b>${data.farmedHidden}</b></div>\n"
    "                    <div class=\"slp-debug-line\"><span>Scheduler log</span><b>${data.schedulerLogRows}</b></div>\n"
    "                    <div class=\"slp-debug-line\"><span>Snapshots</span><b>${data.activitySnapshotCount}</b></div>",
    "debug grid",
)
replace_once(
    "                    <button class=\"slp-btn\" id=\"slp-export-target-cache\">Export Target Cache CSV</button>",
    "                    <button class=\"slp-btn\" id=\"slp-export-target-cache\">Export Target Cache CSV</button>\n"
    "                    <button class=\"slp-btn\" id=\"slp-export-scheduler\">Export Scheduler Debug CSV</button>",
    "scheduler export button",
)

# Replace target cards so unknown rows are visible and scheduling/competition can be inspected.
targets_html = r'''    function targetsHtml(targets) {
        if (!targets.length) {
            return `<div class="slp-empty">${state.polling ? 'Collecting target status…' : 'No targets in the configured FF range after activity/competition exclusions.'}</div>`;
        }

        return targets.map(target => {
            const ff = getFF(target.id);
            const status = state.statusCache[target.id] || {};
            const normalized = status.state ? normalizeStatus(status.state) : 'Unknown';
            const hospCount = hospitalCount24h(target.id);
            const lastHosp = lastHospitalizedAt(target.id);
            const rapidCount = rapidHospitalEvents24h(target.id).length;
            const score = competitionScore(target.id);
            const tier = competitionTier(target.id);
            const attackUrl = TornLib.attackLink(target.id);
            const ffText = Number.isFinite(ff.fairFight) ? ff.fairFight.toFixed(2) : '?';
            const statText = ff.bsEstimate ? TornLib.shortNumber(ff.bsEstimate) : shortNumber(target.total);
            const nextCheck = Number(status.nextEligibleAt) > 0 && Number(status.nextEligibleAt) < Number.MAX_SAFE_INTEGER
                ? humanAgoFuture(Number(status.nextEligibleAt))
                : (status.dormantHiding || status.permanentExcluded ? 'Deferred' : 'Unscheduled');

            return `
                <article class="slp-row">
                    <div class="slp-row-top">
                        <a class="slp-name" href="${escapeHtml(target.profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(target.name)} [${escapeHtml(target.id)}]</a>
                        <span class="slp-level">Lv ${target.level}</span>
                    </div>
                    <div class="slp-meta">
                        <span class="slp-badge">${escapeHtml(normalized)}</span>
                        <span class="slp-badge">FF ${escapeHtml(ffText)}</span>
                        <span class="slp-badge">BS ${escapeHtml(statText)}</span>
                        <span class="slp-badge ${hospCount ? 'slp-hosp-hot' : ''}">Hosp 24h: ${hospCount}</span>
                        <span class="slp-badge ${rapidCount ? 'slp-hosp-hot' : ''}">Rapid: ${rapidCount}</span>
                        <span class="slp-badge">${tier} ${score}</span>
                    </div>
                    <div class="slp-meta">
                        <span>Last hosp: ${escapeHtml(lastHosp ? humanAgo(lastHosp) : 'Never seen')}</span>
                        <span>Next check: ${escapeHtml(nextCheck)}</span>
                    </div>
                    <div class="slp-meta"><span title="${escapeHtml(target.sources)}">Source: ${escapeHtml(target.sources || 'Unknown')}</span></div>
                    <div class="slp-actions">
                        <a class="slp-btn" href="${escapeHtml(attackUrl)}" target="_blank" rel="noopener noreferrer">Attack</a>
                        <a class="slp-btn" href="${escapeHtml(target.profileUrl)}" target="_blank" rel="noopener noreferrer">Profile</a>
                    </div>
                </article>
            `;
        }).join('');
    }
'''
replace_regex(r"    function targetsHtml\(targets\) \{.*?\n    \}\n\n    function bindEvents", targets_html + "\n    function bindEvents", "targetsHtml")

# Add a future-time helper after humanAgo.
replace_once(
    "    function humanAgo(timestamp) {\n        if (!timestamp) return 'Never';\n        const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));\n        return `${TornLib.formatHumanDuration(seconds)} ago`;\n    }",
    "    function humanAgo(timestamp) {\n"
    "        if (!timestamp) return 'Never';\n"
    "        const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));\n"
    "        return `${TornLib.formatHumanDuration(seconds)} ago`;\n"
    "    }\n\n"
    "    function humanAgoFuture(timestamp) {\n"
    "        if (!timestamp) return 'Unscheduled';\n"
    "        const delta = timestamp - Date.now();\n"
    "        if (delta <= 0) return 'Due now';\n"
    "        return `in ${TornLib.formatHumanDuration(Math.ceil(delta / 1000))}`;\n"
    "    }",
    "future helper",
)

replace_once(
    "        panel.querySelector('#slp-export-target-cache')?.addEventListener('click', () => exportTargetCacheCsv());",
    "        panel.querySelector('#slp-export-target-cache')?.addEventListener('click', () => exportTargetCacheCsv());\n"
    "        panel.querySelector('#slp-export-scheduler')?.addEventListener('click', () => exportSchedulerLogCsv());",
    "scheduler export binding",
)
replace_once(
    "            state.observationLog = [];",
    "            state.observationLog = [];\n            state.schedulerLog = [];",
    "clear scheduler state",
)
replace_once(
    "            saveJson(KEYS.observationLog, []);",
    "            saveJson(KEYS.observationLog, []);\n            saveJson(KEYS.schedulerLog, []);",
    "clear scheduler storage",
)

replace_once(
    "        if (!getSettings().tornKey) state.settingsOpen = true;\n        render();",
    "        scheduleAttackPageScrape();\n\n        if (!getSettings().tornKey) state.settingsOpen = true;\n        render();",
    "attack-page startup scrape",
)

PATH.write_text(text, encoding="utf-8")
print("Patched Slinky leveling target prototype to v0.5.0 smart scheduler")
