import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const clientUrl = new URL(
    '../Slinky_Leveling_Target_Prototype.user.js',
    import.meta.url
);
const backupUrl = new URL(
    '../../backups/2026-08-14-pre-cloudflare-client/' +
        'Slinkies-Leveling-Targets/Slinky_Leveling_Target_Prototype.user.js',
    import.meta.url
);

const client = readFileSync(clientUrl, 'utf8');
const backup = readFileSync(backupUrl, 'utf8');


describe('SLINK Leveling Service thin client', () => {
    it('keeps the pre-refactor 0.5.1 backup intact', () => {
        assert.match(backup, /@version\s+0\.5\.1/);
        assert.match(backup, /function chooseCandidates\(/);
        assert.match(backup, /function competitionScore\(/);
    });


    it('uses the protected Worker API for shared decisions and state', () => {
        assert.match(client, /@name\s+SLINK Leveling Service/);
        assert.match(client, /@version\s+0\.13\.2/);
        assert.match(client, /Shared Live Intelligence NetworK/);
        assert.match(
            client,
            /@connect\s+slinkyleveling\.richard-johnson554\.workers\.dev/
        );

        for (const endpoint of [
            '/api/auth',
            '/api/targets',
            '/api/recommendations',
            '/api/checks/claim',
            '/api/observations',
            '/api/activity'
        ]) {
            assert.ok(client.includes(endpoint), `missing ${endpoint}`);
        }
    });


    it('minimizes to a SLINK bubble without stopping background work', () => {
        assert.match(client, /id="slp-expand"/);
        assert.match(client, /Background API work remains active while minimized/);
        assert.match(client, /bubblePosition:/);
        assert.match(client, /function installBubbleEdgeBehavior\(/);
        assert.match(client, /window\.innerWidth - rect\.width - margin/);
        assert.match(client, /GM_setValue\(KEYS\.bubblePosition, position\)/);
        assert.match(client, /GM_setValue\(KEYS\.collapsed, false\)/);
        assert.match(client, /GM_setValue\(KEYS\.collapsed, true\)/);

        const collapsedRender = client.slice(
            client.indexOf('if (settings.collapsed) {'),
            client.indexOf('panel.innerHTML = `', client.indexOf('if (settings.collapsed) {') + 1)
        );
        assert.doesNotMatch(collapsedRender, /scheduleNextPoll|clearWorkerSession|stop/);
    });


    it('requires the current versioned terms before authentication', () => {
        assert.match(client, /TERMS_VERSION\s*=\s*'2026-08-23'/);
        assert.match(client, /LEVELING_DISCLOSURE_VERSION\s*=\s*'2026-08-23'/);
        assert.match(client, /acceptedConsentVersion:/);
        assert.match(client, /function hasAcceptedCurrentTerms\(/);
        assert.match(client, /id="slp-accept-terms"/);
        assert.match(client, /Read the complete SLINK API &amp; Data Terms/);
        assert.match(client, /terms_accepted:\s*true/);
        assert.match(client, /terms_version:\s*TERMS_VERSION/);
        assert.match(client, /terms_sha256:\s*TERMS_DOCUMENT_SHA256/);
        assert.match(client, /disclosure_version:\s*LEVELING_DISCLOSURE_VERSION/);
        assert.match(client, /disclosure_sha256:\s*LEVELING_DISCLOSURE_SHA256/);
        assert.match(client, /client_version:\s*SCRIPT_VERSION/);
        assert.match(client, /KEYS\.acceptedConsentVersion/);

        const cycle = client.slice(
            client.indexOf('async function runCycle('),
            client.indexOf('async function getUserStatus(')
        );
        assert.ok(
            cycle.indexOf('if (!hasAcceptedCurrentTerms())') <
                cycle.indexOf('await ensureWorkerSession(false);'),
            'the client must gate the entire cycle before authentication'
        );
    });


    it('supports one active collector with automatic device failover', () => {
        assert.match(client, /response\?\.collector === true/);
        assert.match(client, /cycle_standby/);
        assert.match(client, /DEFAULT_POLL_SECONDS\s*=\s*300/);
        assert.match(client, /poll_seconds:\s*settings\.pollSeconds/);
        assert.doesNotMatch(client, /COLLECTOR_HEARTBEAT_MS/);
        assert.doesNotMatch(client, /syncCollectorLease/);
        assert.doesNotMatch(client, /scheduleCollectorHeartbeat/);
        assert.doesNotMatch(client, /\/api\/collector\/heartbeat/);
    });


    it('uses Core Lib as the single Torn API polling limiter', () => {
        assert.match(client, /function checkPlanCapacity\(/);
        assert.match(client, /interval_capacity:\s*intervalCapacity/);
        assert.match(client, /function runPacedChecks\(/);
        assert.match(client, /spacingMs/);
        assert.match(client, /scheduleNextPoll\(cycleStartedAt\)/);
        assert.match(client, /OBSERVATION_BATCH_SIZE\s*=\s*200/);
        assert.match(client, /TornLib\.TORN_API_DEFAULT_LIMIT/);
        assert.match(client, /TornLib\.reserveTornApiSlot\(/);

        for (const testingOnlyControl of [
            'PRIMARY_MAX_CHECKS',
            'BACKGROUND_MAX_CHECKS',
            'slp-primary-checks',
            'slp-background-checks'
        ]) {
            assert.ok(
                !client.includes(testingOnlyControl),
                `${testingOnlyControl} should not control live polling`
            );
        }
    });


    it('only exposes zero routine contribution to signed administrators', () => {
        assert.match(client, /permissions:\s*'slinkyLeveling\.permissions\.v1'/);
        assert.match(client, /hasPermission\('admin\.\*'\)/);
        assert.match(client, /id="slp-zero-contribution"/);
        assert.match(client, /if \(checksPerMinute === 0\) return 0/);
        assert.match(client, /interval_capacity:\s*intervalCapacity/);
    });


    it('keeps unfinished checks locally and reports deterministic batch IDs', () => {
        assert.match(client, /pendingChecks:\s*'slinkyLeveling\.pendingChecks\.v1'/);
        assert.match(client, /completedCheckBatches:/);
        assert.match(client, /function mergePendingAndClaimedChecks\(/);
        assert.match(client, /function reconcilePendingChecks\(/);
        assert.match(client, /savePendingChecks\(queuedChecks\)/);
        assert.match(client, /check_batch_id:\s*String\(target\?\.check_batch_id/);
    });


    it('shows local Fair Fight estimates while FFScouter refines in the background', () => {
        assert.match(client, /FF_CACHE_MS\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60/);
        assert.match(client, /BATTLE_STATS_CACHE_MS\s*=\s*24\s*\*\s*60\s*\*\s*60/);
        assert.match(client, /ffCache:\s*'slinkyLeveling\.ffCache\.v1'/);
        assert.match(client, /battleStats:\s*'slinkyLeveling\.localBattleStats\.v1'/);
        assert.match(client, /https:\/\/api\.torn\.com\/v2\/user\/battlestats/);
        assert.match(client, /function estimateLocalFairFight\(/);
        assert.match(client, /function localTargetStatRange\(/);
        assert.match(client, /fair_fight_estimated:\s*useEstimate/);
        assert.match(client, /min_target_stats/);
        assert.match(client, /max_target_stats/);
        assert.match(client, /async function hydrateRecommendationFairFight\(/);
        assert.match(client, /async function collectAndCacheFairFight\(/);
        assert.match(client, /function recommendationsNeedingFairFight\(/);
        assert.match(client, /recommendationsNeedingFairFight\(\s*state\.recommendationTargets/);
        assert.match(client, /saveJson\(KEYS\.ffCache, state\.ffCache\)/);
        assert.match(client, /Cached locally for 7 days/);
        assert.match(client, /Asking the SLINK Network for targets/);
        assert.doesNotMatch(client, /workerRequest\('\/api\/fair-fight'/);
        assert.doesNotMatch(client, /reported to SLINK/);

        const cycle = client.slice(
            client.indexOf('async function runCycle('),
            client.indexOf('async function getUserStatus(')
        );
        const firstRecommendations = cycle.indexOf('await refreshRecommendations();');
        const firstFairFight = cycle.indexOf('fairFightTask = hydrateRecommendationFairFight(');
        const scheduledTornWork = cycle.indexOf('await syncActivitySnapshots(');
        const waitForFairFight = cycle.indexOf('await fairFightTask;', scheduledTornWork);
        const recommendationLoads = cycle.match(/await refreshRecommendations\(\);/g) || [];

        assert.ok(firstRecommendations >= 0, 'recommendations should load');
        assert.ok(firstFairFight > firstRecommendations, 'FF should follow targets');
        assert.ok(scheduledTornWork > firstFairFight, 'FF refinement should start after targets');
        assert.ok(
            waitForFairFight > scheduledTornWork,
            'scheduled Torn work should not wait for FFScouter refinement'
        );
        assert.equal(
            recommendationLoads.length,
            1,
            'each routine cycle should make only one recommendation request'
        );
        assert.doesNotMatch(client, /collectAndReportFairFight/);
    });


    it('reports attack-page hospital timing without another target refresh', () => {
        assert.match(client, /function parseVisibleRemainingMs\(/);
        assert.match(client, /async function scrapeAndReportAttackPage\(/);

        const attackAdapter = client.slice(
            client.indexOf('async function scrapeAndReportAttackPage('),
            client.indexOf('function scheduleAttackPageScrape(')
        );

        assert.match(attackAdapter, /source:\s*'attack_page'/);
        assert.match(attackAdapter, /await submitObservations\(/);
        assert.doesNotMatch(attackAdapter, /refreshRecommendations\(/);
    });


    it('does not retain the local scheduler, scoring, or shared caches', () => {
        for (const removedName of [
            'MASTER_URL',
            'hospitalHistory',
            'statusCache',
            'schedulerCategory',
            'chooseCandidates',
            'competitionScore',
            'updateStatusCache'
        ]) {
            assert.ok(
                !client.includes(removedName),
                `${removedName} should remain server-side`
            );
        }
    });
});
