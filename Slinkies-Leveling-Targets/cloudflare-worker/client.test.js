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
            '/api/collector/heartbeat',
            '/api/checks/claim',
            '/api/observations',
            '/api/activity',
            '/api/fair-fight'
        ]) {
            assert.ok(client.includes(endpoint), `missing ${endpoint}`);
        }
    });


    it('supports one active collector with automatic device failover', () => {
        assert.match(client, /COLLECTOR_HEARTBEAT_MS/);
        assert.match(client, /async function syncCollectorLease\(/);
        assert.match(client, /function scheduleCollectorHeartbeat\(/);
        assert.match(client, /response\?\.collector === true/);
        assert.match(client, /cycle_standby/);
    });


    it('uses Core Lib as the single Torn API polling limiter', () => {
        assert.match(client, /TornLib\.getTornApiUsage\(/);
        assert.match(client, /body:\s*\{\s*capacity\s*\}/);
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
        assert.match(client, /FF_CACHE_MS\s*=\s*12\s*\*\s*60\s*\*\s*60/);
        assert.match(client, /async function hydrateRecommendationFairFight\(/);
        assert.match(client, /function recommendationsNeedingFairFight\(/);
        assert.match(client, /recommendationsNeedingFairFight\(\s*state\.targets/);
        assert.match(client, /reported to SLINK/);
        assert.match(client, /Asking the SLINK Network for targets/);

        const cycle = client.slice(
            client.indexOf('async function runCycle('),
            client.indexOf('async function getUserStatus(')
        );
        const firstRecommendations = cycle.indexOf('await refreshRecommendations();');
        const firstFairFight = cycle.indexOf('await hydrateRecommendationFairFight(');
        const scheduledTornWork = cycle.indexOf('await syncActivitySnapshots(');

        assert.ok(firstRecommendations >= 0, 'recommendations should load');
        assert.ok(firstFairFight > firstRecommendations, 'FF should follow targets');
        assert.ok(scheduledTornWork > firstFairFight, 'Torn checks should follow FF');
        assert.doesNotMatch(
            client,
            /collectAndReportFairFight\(settings\.ffKey, successfulTargets\)/
        );
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
