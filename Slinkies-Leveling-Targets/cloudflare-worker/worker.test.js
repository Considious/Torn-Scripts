import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, it } from 'node:test';

import worker, { testing } from './worker.js';

const originalFetch = globalThis.fetch;
const WORKER_VERSION = '0.9.1-configurable-leveling-filters';
const TERMS_VERSION = '2026-08-14';
const TERMS_DOCUMENT_SHA256 =
    '398d720e740d2d22fc4c594c2ae7b787aa8a8e267c93a4e7c7c354eb1888f2f4';
const LEVELING_DISCLOSURE_VERSION = '2026-08-14';
const LEVELING_DISCLOSURE_SHA256 =
    '336b08215844da186a78031b0a01fbb2090d0ca32c86bb243b8e36f098bcb18d';
const SESSION_SECRET = 'test-session-secret';
const originalDateNow = Date.now;

afterEach(() => {
    globalThis.fetch = originalFetch;
    Date.now = originalDateNow;
});


describe('SLINK Leveling Worker', () => {
    it('preserves root, health, admin, and CORS behavior', async () => {
        const db = createDatabase();
        const env = {
            DB: db,
            CONSENT_DB: createConsentDatabase(),
            ADMIN_TOKEN: 'correct-admin-token'
        };

        const rootResponse = await worker.fetch(
            new Request('https://worker.example/'),
            env
        );

        assert.equal(rootResponse.status, 200);
        assert.deepEqual(await rootResponse.json(), {
            ok: true,
                service: 'SLINK Leveling API',
            version: WORKER_VERSION,
            message: 'Worker is running.'
        });
        assert.equal(
            rootResponse.headers.get('X-Slinky-Worker-Version'),
            WORKER_VERSION
        );

        const healthResponse = await worker.fetch(
            new Request('https://worker.example/api/health'),
            env
        );

        assert.equal(healthResponse.status, 200);
        assert.deepEqual(await healthResponse.json(), {
            ok: true,
            version: WORKER_VERSION,
            database: 'connected',
            consent_database: 'connected',
            ffscouter_collector: 'not_configured',
            ffscouter_filters: {
                minimum_level: 30,
                maximum_level: 100,
                maximum_battle_stats: 2000,
                inactive_only: true
            },
            terms: {
                version: TERMS_VERSION,
                effective_at: TERMS_VERSION
            },
            tables: {
                targets: 6,
                target_status: 0,
                hospital_events: 0,
                scheduler_queue: 0,
                ffscouter_targets: 0
            }
        });

        const deniedAdmin = await worker.fetch(
            new Request('https://worker.example/api/admin/targets'),
            env
        );
        assert.equal(deniedAdmin.status, 401);

        const allowedAdmin = await worker.fetch(
            new Request('https://worker.example/api/admin/targets?limit=2', {
                headers: { 'X-Admin-Token': 'correct-admin-token' }
            }),
            env
        );
        assert.equal(allowedAdmin.status, 200);
        assert.equal((await allowedAdmin.json()).count, 2);

        const optionsResponse = await worker.fetch(
            new Request('https://worker.example/api/recommendations', {
                method: 'OPTIONS'
            }),
            env
        );
        assert.equal(optionsResponse.status, 204);
        assert.equal(
            optionsResponse.headers.get('X-Slinky-Worker-Version'),
            WORKER_VERSION
        );

        const termsResponse = await worker.fetch(
            new Request('https://worker.example/api/terms'),
            env
        );
        const terms = await termsResponse.json();
        assert.equal(termsResponse.status, 200);
        assert.equal(terms.acceptance_required, true);
        assert.equal(terms.version, TERMS_VERSION);
        assert.equal(terms.document_sha256, TERMS_DOCUMENT_SHA256);
        assert.equal(terms.disclosure_version, LEVELING_DISCLOSURE_VERSION);
        assert.equal(terms.disclosure_sha256, LEVELING_DISCLOSURE_SHA256);
        assert.match(terms.document_url, /SLINK_API_Data_Terms_of_Service\.md$/);
        const publishedTerms = readFileSync(
            new URL(
                '../terms/2026-08-14/SLINK_API_Data_Terms_of_Service.md',
                import.meta.url
            )
        );
        assert.equal(
            createHash('sha256').update(publishedTerms).digest('hex'),
            TERMS_DOCUMENT_SHA256
        );
        const originalTerms = readFileSync(
            new URL(
                '../terms/2026-08-14/SLINK_API_Data_Terms_of_Service.docx',
                import.meta.url
            )
        );
        assert.equal(
            createHash('sha256').update(originalTerms).digest('hex'),
            '5303acaf9a596a5799f15731faa7b55e4862172048a8474b5d18c372b6e8d99d'
        );
        assert.equal(
            createHash('sha256')
                .update(terms.leveling_service_summary, 'utf8')
                .digest('hex'),
            LEVELING_DISCLOSURE_SHA256
        );
    });


    it('authenticates from Torn info.user and verifies the issued session', async () => {
        let tornRequests = 0;
        globalThis.fetch = async () => {
            tornRequests++;
            return Response.json({
                info: {
                    user: {
                        id: 3853023,
                        faction_id: 46978
                    }
                }
            });
        };

        const consentDb = createConsentDatabase();
        const env = { SESSION_SECRET, CONSENT_DB: consentDb };
        const unconfiguredResponse = await worker.fetch(
            jsonRequest('https://worker.example/api/auth', {
                api_key: 'test-torn-key',
                terms_accepted: true,
                terms_version: TERMS_VERSION,
                disclosure_version: LEVELING_DISCLOSURE_VERSION
            }),
            { SESSION_SECRET }
        );
        assert.equal(unconfiguredResponse.status, 500);
        assert.equal(tornRequests, 0, 'missing consent storage must fail closed');

        const refusedResponse = await worker.fetch(
            jsonRequest('https://worker.example/api/auth', {
                api_key: 'test-torn-key'
            }),
            env
        );
        assert.equal(refusedResponse.status, 428);
        assert.equal(tornRequests, 0, 'Torn must not be contacted before consent');

        const authResponse = await worker.fetch(
            jsonRequest('https://worker.example/api/auth', {
                api_key: 'test-torn-key',
                terms_accepted: true,
                terms_version: TERMS_VERSION,
                terms_sha256: TERMS_DOCUMENT_SHA256,
                disclosure_version: LEVELING_DISCLOSURE_VERSION,
                disclosure_sha256: LEVELING_DISCLOSURE_SHA256,
                client_name: 'SLINK Leveling Service',
                client_version: '0.11.0'
            }),
            env
        );
        const authBody = await authResponse.json();

        assert.equal(authResponse.status, 200);
        assert.equal(authBody.authenticated, true);
        assert.equal(authBody.user_id, 3853023);
        assert.equal(authBody.faction_id, 46978);
        assert.equal(authBody.terms_version, TERMS_VERSION);
        assert.equal(
            authBody.disclosure_version,
            LEVELING_DISCLOSURE_VERSION
        );
        assert.equal(authBody.expires_in, 43200);
        assert.ok(authBody.session_token);
        assert.equal(tornRequests, 1);

        const acceptance = consentDb.sqlite
            .prepare('SELECT * FROM terms_acceptances')
            .get();
        assert.equal(acceptance.user_id, 3853023);
        assert.equal(acceptance.faction_id, 46978);
        assert.equal(acceptance.terms_version, TERMS_VERSION);
        assert.equal(acceptance.document_sha256, TERMS_DOCUMENT_SHA256);
        assert.equal(acceptance.service_id, 'slink-leveling-service');
        assert.equal(
            acceptance.disclosure_version,
            LEVELING_DISCLOSURE_VERSION
        );
        assert.equal(
            acceptance.disclosure_sha256,
            LEVELING_DISCLOSURE_SHA256
        );
        assert.equal(acceptance.acceptance_method, 'explicit_checkbox');

        const repeatedResponse = await worker.fetch(
            jsonRequest('https://worker.example/api/auth', {
                api_key: 'test-torn-key',
                terms_accepted: true,
                terms_version: TERMS_VERSION,
                terms_sha256: TERMS_DOCUMENT_SHA256,
                disclosure_version: LEVELING_DISCLOSURE_VERSION,
                disclosure_sha256: LEVELING_DISCLOSURE_SHA256,
                client_name: 'SLINK Leveling Service',
                client_version: '0.11.0'
            }),
            env
        );
        assert.equal(repeatedResponse.status, 200);
        assert.equal(
            consentDb.sqlite
                .prepare('SELECT COUNT(*) AS count FROM terms_acceptances')
                .get().count,
            1,
            're-authentication must not overwrite or duplicate this version'
        );
        assert.throws(() => {
            consentDb.sqlite
                .prepare('UPDATE terms_acceptances SET client_version = ?')
                .run('changed');
        }, /append-only/);
        assert.throws(() => {
            consentDb.sqlite
                .prepare('DELETE FROM terms_acceptances')
                .run();
        }, /append-only/);

        const sessionResponse = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/session',
                authBody.session_token
            ),
            env
        );
        assert.equal(sessionResponse.status, 200);
        const sessionBody = await sessionResponse.json();
        assert.equal(sessionBody.authenticated, true);
        assert.equal(sessionBody.terms_version, TERMS_VERSION);
        assert.equal(
            sessionBody.disclosure_version,
            LEVELING_DISCLOSURE_VERSION
        );
    });


    it('protects every thin-client route behind a member session', async () => {
        const env = { DB: createDatabase(), SESSION_SECRET };
        const requests = [
            new Request('https://worker.example/api/recommendations'),
            jsonRequest('https://worker.example/api/collector/heartbeat', {}),
            jsonRequest('https://worker.example/api/checks/claim', { capacity: 2 }),
            jsonRequest('https://worker.example/api/observations', {
                observations: [{ target_id: 1, state: 'Okay' }]
            }),
            jsonRequest('https://worker.example/api/activity', {
                active_targets: { 1: Math.floor(Date.now() / 1000) }
            }),
            jsonRequest('https://worker.example/api/fair-fight', {
                targets: [{ target_id: 1, fair_fight: 2 }]
            })
        ];

        for (const request of requests) {
            const response = await worker.fetch(request, env);
            assert.equal(response.status, 401);
        }
    });


    it('deduplicates hospital observations and owns scheduling/scoring', async () => {
        const db = createDatabase();
        const env = { DB: db, SESSION_SECRET };
        const token = await sessionToken(3853023);
        const until = Math.floor(Date.now() / 1000) + 900;

        const firstResponse = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/observations',
                token,
                {
                    observations: [{
                        target_id: 1,
                        state: 'Okay',
                        description: `In hospital until ${until}`,
                        until,
                        source: 'torn_api'
                    }]
                }
            ),
            env
        );
        const firstBody = await firstResponse.json();

        assert.equal(firstResponse.status, 200);
        assert.equal(firstBody.accepted[0].status, 'Hospital');
        assert.equal(firstBody.accepted[0].hospital_event_inserted, true);
        assert.equal(firstBody.accepted[0].schedule_reason, 'hospital_release_plus_1m');
        assert.equal(firstBody.accepted[0].competition_score, 12);

        const secondResponse = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/observations',
                token,
                {
                    observations: [{
                        target_id: 1,
                        state: 'Hospital',
                        description: 'Still in hospital',
                        until,
                        source: 'attack_page'
                    }]
                }
            ),
            env
        );
        const secondBody = await secondResponse.json();

        assert.equal(secondBody.accepted[0].hospital_event_inserted, false);
        assert.equal(
            db.sqlite.prepare('SELECT COUNT(*) AS count FROM hospital_events').get().count,
            1
        );

        const status = db.sqlite
            .prepare('SELECT * FROM target_status WHERE target_id = 1')
            .get();
        assert.equal(status.status, 'Hospital');
        assert.equal(Number(status.status_until), until);
        assert.equal(status.competition_tier, 'Prime');
    });


    it('coordinates check claims between active member sessions', async () => {
        const db = createDatabase();
        const env = { DB: db, SESSION_SECRET };
        const firstToken = await sessionToken(1001);
        const secondToken = await sessionToken(1002);
        const assignedToken = await sessionToken(9001);

        const assignedResponse = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/recommendations?limit=2',
                assignedToken
            ),
            env
        );
        const assignedIds = (await assignedResponse.json())
            .targets
            .map(row => row.id);

        const firstResponse = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/checks/claim',
                firstToken,
                { capacity: 2 }
            ),
            env
        );
        const secondResponse = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/checks/claim',
                secondToken,
                { capacity: 2 }
            ),
            env
        );
        const firstIds = (await firstResponse.json()).checks.map(row => row.id);
        const secondIds = (await secondResponse.json()).checks.map(row => row.id);

        assert.equal(firstIds.length, 2);
        assert.equal(secondIds.length, 2);
        assert.deepEqual(
            firstIds.filter(id => assignedIds.includes(id)),
            [],
            'currently assigned targets should be scheduled after unassigned targets'
        );
        assert.deepEqual(
            secondIds.filter(id => assignedIds.includes(id)),
            [],
            'assigned targets should remain last while unassigned work exists'
        );
        assert.deepEqual(
            firstIds.filter(id => secondIds.includes(id)),
            []
        );

        const observationResponse = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/observations',
                firstToken,
                {
                    observations: [{
                        target_id: firstIds[0],
                        state: 'Okay',
                        description: 'Okay',
                        until: 0,
                        source: 'torn_api'
                    }]
                }
            ),
            env
        );
        assert.equal(observationResponse.status, 200);
        assert.equal(
            db.sqlite
                .prepare('SELECT COUNT(*) AS count FROM client_check_claims WHERE target_id = ?')
                .get(firstIds[0]).count,
            0
        );
    });


    it('discovers only changed high-level low-stat FFScouter targets', async () => {
        const db = createDatabase();
        const env = {
            DB: db,
            FFSCOUTER_API_KEY: 'abc123def456ghij'
        };
        let requests = 0;

        globalThis.fetch = async request => {
            requests++;
            const url = new URL(
                request instanceof Request ? request.url : request
            );
            assert.equal(url.origin, 'https://ffscouter.com');
            assert.equal(url.pathname, '/api/v1/get-targets');
            assert.equal(url.searchParams.get('key'), env.FFSCOUTER_API_KEY);
            assert.equal(url.searchParams.get('limit'), '50');
            assert.equal(url.searchParams.has('minlevel'), false);
            assert.equal(url.searchParams.has('maxff'), false);
            return Response.json({
                targets: [
                    {
                        player_id: 1,
                        name: 'Updated Target 1',
                        level: 60,
                        bs_estimate: 250
                    },
                    {
                        player_id: 7001,
                        name: 'Rare Outlier',
                        level: 95,
                        bs_estimate: 1999
                    },
                    {
                        player_id: 7002,
                        name: 'Too Strong',
                        level: 100,
                        bs_estimate: 2001
                    },
                    {
                        player_id: 7003,
                        name: 'Too Low Level',
                        level: 29,
                        bs_estimate: 100
                    }
                ]
            });
        };

        const first = await testing.discoverLevelingTargets(env);
        assert.deepEqual(first, {
            returned: 4,
            qualified: 2,
            inserted_or_updated: 2,
            unchanged: 0,
            filters: {
                minimum_level: 30,
                maximum_level: 100,
                maximum_battle_stats: 2000,
                inactive_only: true
            }
        });

        const existing = db.sqlite
            .prepare('SELECT * FROM targets WHERE id = 1')
            .get();
        assert.equal(existing.name, 'Updated Target 1');
        assert.equal(existing.level, 60);
        assert.equal(existing.total_stats, 250);
        assert.equal(existing.sources, 'Source 1 | FFScouter discovery');

        const discovered = db.sqlite
            .prepare('SELECT * FROM targets WHERE id = 7001')
            .get();
        assert.equal(discovered.name, 'Rare Outlier');
        assert.equal(discovered.level, 95);
        assert.equal(discovered.total_stats, 1999);
        assert.equal(discovered.sources, 'FFScouter discovery');

        const second = await testing.discoverLevelingTargets(env);
        assert.equal(second.inserted_or_updated, 0);
        assert.equal(second.unchanged, 2);
        assert.equal(requests, 2);

        const adminResponse = await worker.fetch(
            new Request(
                'https://worker.example/api/admin/discover-targets',
                {
                    method: 'POST',
                    headers: { 'X-Admin-Token': 'correct-admin-token' }
                }
            ),
            { ...env, ADMIN_TOKEN: 'correct-admin-token' }
        );
        assert.equal(adminResponse.status, 200);
        assert.equal((await adminResponse.json()).inserted_or_updated, 0);

        let retrySuppressed = false;
        await worker.scheduled(
            {
                scheduledTime: 1_800_000_000_000,
                noRetry() {
                    retrySuppressed = true;
                }
            },
            env
        );
        assert.equal(retrySuppressed, false);
        assert.equal(requests, 4);

        const expanded = await testing.discoverLevelingTargets({
            ...env,
            FFSCOUTER_LEVELING_MIN_LEVEL: '20',
            FFSCOUTER_LEVELING_MAX_LEVEL: '100',
            FFSCOUTER_LEVELING_MAX_STATS: '5000'
        });
        assert.equal(expanded.qualified, 4);
        assert.equal(expanded.inserted_or_updated, 2);
        assert.deepEqual(expanded.filters, {
            minimum_level: 20,
            maximum_level: 100,
            maximum_battle_stats: 5000,
            inactive_only: true
        });
        assert.equal(requests, 5);
    });


    it('elects one collector per user and fails over between devices', async () => {
        let now = 1_800_000_000_000;
        Date.now = () => now;

        const db = createDatabase();
        const env = { DB: db, SESSION_SECRET };
        const pcToken = await sessionToken(3001, 'pc-session');
        const mobileToken = await sessionToken(3001, 'mobile-session');

        const pcRecommendations = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/recommendations?limit=2&poll_seconds=90',
                pcToken
            ),
            env
        );
        const pcLease = await pcRecommendations.json();
        assert.equal(pcLease.collector, true);
        assert.equal(pcLease.poll_seconds, 90);
        assert.equal(pcLease.collector_lease_seconds, 180);

        const mobileRecommendations = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/recommendations?limit=2',
                mobileToken
            ),
            env
        );
        const mobileLease = await mobileRecommendations.json();
        assert.equal(mobileLease.collector, false);
        assert.deepEqual(
            pcLease.targets.map(row => row.id),
            mobileLease.targets.map(row => row.id)
        );

        const pcChecks = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/checks/claim',
                pcToken,
                { capacity: 2, poll_seconds: 90 }
            ),
            env
        );
        assert.equal((await pcChecks.json()).count, 2);

        const mobileChecks = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/checks/claim',
                mobileToken,
                { capacity: 2, poll_seconds: 90 }
            ),
            env
        );
        const mobileStandby = await mobileChecks.json();
        assert.equal(mobileStandby.collector, false);
        assert.equal(mobileStandby.count, 0);

        now += (pcLease.collector_lease_seconds * 1000) + 1;

        const mobileTakeover = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/recommendations?limit=2',
                mobileToken
            ),
            env
        );
        assert.equal((await mobileTakeover.json()).collector, true);

        const pcAfterTakeover = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/recommendations?limit=2',
                pcToken
            ),
            env
        );
        assert.equal((await pcAfterTakeover.json()).collector, false);
    });


    it('divides all due checks between active Torn users', async () => {
        let now = 1_800_000_000_000;
        Date.now = () => now;

        const db = createDatabase();
        const env = { DB: db, SESSION_SECRET };
        const tokens = await Promise.all([
            sessionToken(4001, 'collector-one'),
            sessionToken(4002, 'collector-two'),
            sessionToken(4003, 'collector-three')
        ]);

        for (const token of tokens) {
            const response = await worker.fetch(
                authenticatedRequest(
                    'https://worker.example/api/recommendations?limit=2&poll_seconds=300',
                    token
                ),
                env
            );
            assert.equal((await response.json()).collector, true);
        }

        const plans = [];
        for (const token of tokens) {
            const response = await worker.fetch(
                authenticatedJsonRequest(
                    'https://worker.example/api/checks/claim',
                    token,
                    { interval_capacity: 300, poll_seconds: 300 }
                ),
                env
            );
            plans.push(await response.json());
        }

        const claimedIds = plans.flatMap(plan => plan.checks.map(row => row.id));
        for (const plan of plans) {
            assert.equal(plan.due_count, 6);
            assert.equal(plan.active_collectors, 3);
            assert.equal(plan.fair_share, 2);
            assert.equal(plan.capacity, 2);
            assert.equal(plan.interval_capacity, 300);
            assert.equal(plan.claim_seconds, 420);
            assert.equal(plan.count, 2);
        }
        assert.equal(new Set(claimedIds).size, 6);

        now += 420_001;
        const reclaimed = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/checks/claim',
                tokens[0],
                { interval_capacity: 300, poll_seconds: 300 }
            ),
            env
        );
        assert.equal(reclaimed.status, 200);
        assert.equal((await reclaimed.json()).count, 2);
    });


    it('leases different recommendations and applies shared activity filters', async () => {
        const db = createDatabase();
        const env = { DB: db, SESSION_SECRET };
        const firstToken = await sessionToken(2001);
        const secondToken = await sessionToken(2002);
        const nowSeconds = Math.floor(Date.now() / 1000);

        const activityResponse = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/activity',
                firstToken,
                { active_targets: { 1: nowSeconds } }
            ),
            env
        );
        assert.equal(activityResponse.status, 200);

        const firstResponse = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/recommendations?limit=2&min_ff=1&max_ff=3',
                firstToken
            ),
            env
        );
        const secondResponse = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/recommendations?limit=2&min_ff=1&max_ff=3',
                secondToken
            ),
            env
        );
        const firstBody = await firstResponse.json();
        const secondBody = await secondResponse.json();
        const firstIds = firstBody.targets.map(row => row.id);
        const secondIds = secondBody.targets.map(row => row.id);

        assert.equal(firstResponse.status, 200);
        assert.equal(secondResponse.status, 200);
        assert.ok(!firstIds.includes(1), 'recently active target must be excluded');
        assert.ok(firstBody.targets.every(row => row.fair_fight === null));
        assert.ok(secondBody.targets.every(row => row.fair_fight === null));
        assert.deepEqual(firstIds.filter(id => secondIds.includes(id)), []);
    });


    it('ignores source labels and honors the local strength range', async () => {
        const db = createDatabase();
        const env = { DB: db, SESSION_SECRET };
        const token = await sessionToken(2050);

        db.sqlite.prepare(`
            UPDATE targets
            SET sources = ?
            WHERE id = 2
        `).run("Baldr's Extra List 1");

        const response = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/recommendations' +
                    '?limit=3&min_target_stats=1500&max_target_stats=4500',
                token
            ),
            env
        );
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(body.targets.map(row => row.id), [2, 3, 4]);
        assert.equal(body.targets[0].sources, "Baldr's Extra List 1");
        assert.equal(body.min_target_stats, 1500);
        assert.equal(body.max_target_stats, 4500);
    });


    it('keeps the legacy Fair Fight route as an authenticated no-op', async () => {
        const db = createDatabase();
        const env = { DB: db, SESSION_SECRET };
        const token = await sessionToken(4201);
        const response = await worker.fetch(
            authenticatedJsonRequest(
                'https://worker.example/api/fair-fight',
                token,
                {
                    targets: [{
                        target_id: 1,
                        fair_fight: 4.5,
                        bs_estimate: 5000
                    }]
                }
            ),
            env
        );
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.accepted_count, 0);
        assert.equal(body.cache_scope, 'client');
        assert.equal(body.deprecated, true);
        assert.equal(
            db.sqlite.prepare(`
                SELECT COUNT(*) AS count
                FROM sqlite_master
                WHERE type = 'table'
                  AND name = 'user_target_fair_fight'
            `).get().count,
            0
        );
    });


    it('rejects expired/tampered sessions and preserves parsing helpers', async () => {
        const now = Math.floor(Date.now() / 1000);
        const expiredToken = await testing.createSessionToken(
            {
                user_id: 3853023,
                faction_id: 46978,
                session_id: crypto.randomUUID(),
                terms_version: TERMS_VERSION,
                disclosure_version: LEVELING_DISCLOSURE_VERSION,
                iat: now - 43201,
                exp: now - 1
            },
            SESSION_SECRET
        );
        assert.equal(
            await testing.verifySessionToken(expiredToken, SESSION_SECRET),
            null
        );

        const preConsentToken = await testing.createSessionToken(
            {
                user_id: 3853023,
                faction_id: 46978,
                session_id: crypto.randomUUID(),
                iat: now,
                exp: now + 43200
            },
            SESSION_SECRET
        );
        assert.equal(
            await testing.verifySessionToken(preConsentToken, SESSION_SECRET),
            null,
            'sessions issued before required consent must stop working'
        );

        const validToken = await sessionToken(3853023);
        const [payload, signature] = validToken.split('.');
        const tamperedSignature =
            `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
        assert.equal(
            await testing.verifySessionToken(
                `${payload}.${tamperedSignature}`,
                SESSION_SECRET
            ),
            null
        );

        assert.equal(testing.normalizeStatus('Okay but in hospital'), 'Hospital');
        assert.equal(testing.competitionTier(80), 'Farmed');
        assert.equal(testing.rapidPenalty(4 * 60 * 1000), 40);
        assert.equal(testing.parseStatNumber('1.25m'), 1_250_000);
        assert.deepEqual(
            testing.parseCsv('id,name\r\n1,"Quoted, Name"\r\n'),
            [{ id: '1', name: 'Quoted, Name' }]
        );
    });
});


function createDatabase() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(BASE_SCHEMA);
    sqlite.exec(
        readFileSync(
            new URL('./migrations/0001-client-coordination.sql', import.meta.url),
            'utf8'
        )
    );
    sqlite.exec(
        readFileSync(
            new URL('./migrations/0002-user-collector-leases.sql', import.meta.url),
            'utf8'
        )
    );
    sqlite.exec(
        readFileSync(
            new URL('./migrations/0003-remove-unused-user-fair-fight-cache.sql', import.meta.url),
            'utf8'
        )
    );

    const insert = sqlite.prepare(`
        INSERT INTO targets (id, name, level, total_stats, sources)
        VALUES (?, ?, ?, ?, ?)
    `);

    for (let id = 1; id <= 6; id++) {
        insert.run(
            id,
            `Target ${id}`,
            50 - id,
            id * 1000,
            `Source ${id}`
        );
    }

    return new D1DatabaseAdapter(sqlite);
}


function createConsentDatabase() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(
        readFileSync(
            new URL(
                './consent-database/0001-terms-acceptances.sql',
                import.meta.url
            ),
            'utf8'
        )
    );
    return new D1DatabaseAdapter(sqlite);
}


class D1DatabaseAdapter {
    constructor(sqlite) {
        this.sqlite = sqlite;
    }

    prepare(sql) {
        return new D1StatementAdapter(this.sqlite, sql, []);
    }

    async batch(statements) {
        this.sqlite.exec('BEGIN');

        try {
            const results = [];

            for (const statement of statements) {
                results.push(await statement.run());
            }

            this.sqlite.exec('COMMIT');
            return results;
        } catch (error) {
            this.sqlite.exec('ROLLBACK');
            throw error;
        }
    }
}


class D1StatementAdapter {
    constructor(sqlite, sql, bindings) {
        this.sqlite = sqlite;
        this.sql = sql;
        this.bindings = bindings;
    }

    bind(...values) {
        return new D1StatementAdapter(this.sqlite, this.sql, values);
    }

    async first(columnName) {
        const row = this.sqlite.prepare(this.sql).get(...this.bindings) ?? null;
        return columnName && row ? row[columnName] ?? null : row;
    }

    async all() {
        return {
            success: true,
            results: this.sqlite.prepare(this.sql).all(...this.bindings)
        };
    }

    async run() {
        const result = this.sqlite.prepare(this.sql).run(...this.bindings);
        return {
            success: true,
            results: [],
            meta: {
                changes: Number(result.changes || 0),
                last_row_id: Number(result.lastInsertRowid || 0)
            }
        };
    }
}


async function sessionToken(userId, sessionId = crypto.randomUUID()) {
    const now = Math.floor(Date.now() / 1000);
    return testing.createSessionToken(
        {
            user_id: userId,
            faction_id: 46978,
            session_id: sessionId,
            terms_version: TERMS_VERSION,
            disclosure_version: LEVELING_DISCLOSURE_VERSION,
            iat: now,
            exp: now + 43200
        },
        SESSION_SECRET
    );
}


function jsonRequest(url, body) {
    return new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}


function authenticatedRequest(url, token) {
    return new Request(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
}


function authenticatedJsonRequest(url, token, body) {
    return new Request(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
}


const BASE_SCHEMA = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE targets (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        level INTEGER,
        total_stats INTEGER,
        sources TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE target_status (
        target_id INTEGER PRIMARY KEY,
        status TEXT,
        status_until TEXT,
        last_checked_at TEXT,
        next_check_at TEXT,
        competition_score INTEGER DEFAULT 0,
        competition_tier TEXT DEFAULT 'Prime',
        hiding_out INTEGER DEFAULT 0,
        permanent_federal INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_id) REFERENCES targets(id)
    );

    CREATE TABLE hospital_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_id INTEGER NOT NULL,
        hospitalized_at TEXT NOT NULL,
        hospital_until TEXT NOT NULL,
        reported_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(target_id, hospital_until),
        FOREIGN KEY (target_id) REFERENCES targets(id)
    );

    CREATE INDEX idx_hospital_events_target_time
        ON hospital_events(target_id, hospitalized_at);

    CREATE TABLE scheduler_queue (
        target_id INTEGER PRIMARY KEY,
        next_check_at TEXT,
        reason TEXT,
        priority INTEGER DEFAULT 0,
        claimed_by INTEGER,
        claim_expires_at TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_id) REFERENCES targets(id)
    );
`;
