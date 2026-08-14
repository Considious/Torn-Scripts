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
        assert.match(client, /@version\s+0\.8\.0/);
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
        assert.match(client, /TornLib\.getTornApiUsage\(/);
        assert.match(client, /capacity,\s*poll_seconds:\s*settings\.pollSeconds/);
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


    it('hydrates recommendation Fair Fight data before scheduled Torn work', () => {
        assert.match(client, /FF_CACHE_MS\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60/);
        assert.match(client, /ffCache:\s*'slinkyLeveling\.ffCache\.v1'/);
        assert.match(client, /async function hydrateRecommendationFairFight\(/);
        assert.match(client, /async function collectAndCacheFairFight\(/);
        assert.match(client, /function recommendationsNeedingFairFight\(/);
        assert.match(client, /recommendationsNeedingFairFight\(\s*state\.recommendationTargets/);
        assert.match(client, /saveJson\(KEYS\.ffCache, state\.ffCache\)/);
        assert.match(client, /saved locally/);
        assert.match(client, /Asking the SLINK Network for targets/);
        assert.doesNotMatch(client, /workerRequest\('\/api\/fair-fight'/);
        assert.doesNotMatch(client, /reported to SLINK/);

        const cycle = client.slice(
            client.indexOf('async function runCycle('),
            client.indexOf('async function getUserStatus(')
        );
        const firstRecommendations = cycle.indexOf('await refreshRecommendations();');
        const firstFairFight = cycle.indexOf('await hydrateRecommendationFairFight(');
        const scheduledTornWork = cycle.indexOf('await syncActivitySnapshots(');
        const recommendationLoads = cycle.match(/await refreshRecommendations\(\);/g) || [];

        assert.ok(firstRecommendations >= 0, 'recommendations should load');
        assert.ok(firstFairFight > firstRecommendations, 'FF should follow targets');
        assert.ok(scheduledTornWork > firstFairFight, 'Torn checks should follow FF');
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
