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


describe('Slinky Leveling thin client', () => {
    it('keeps the pre-refactor 0.5.1 backup intact', () => {
        assert.match(backup, /@version\s+0\.5\.1/);
        assert.match(backup, /function chooseCandidates\(/);
        assert.match(backup, /function competitionScore\(/);
    });


    it('uses the protected Worker API for shared decisions and state', () => {
        assert.match(client, /@version\s+0\.7\.0/);
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
