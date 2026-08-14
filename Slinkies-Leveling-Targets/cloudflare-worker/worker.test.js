import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, it } from 'node:test';

import worker, { testing } from './worker.js';

const originalFetch = globalThis.fetch;
const WORKER_VERSION = '0.5.1-efficient-coordination';
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
            tables: {
                targets: 6,
                target_status: 0,
                hospital_events: 0,
                scheduler_queue: 0
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
    });


    it('authenticates from Torn info.user and verifies the issued session', async () => {
        globalThis.fetch = async () => {
            return Response.json({
                info: {
                    user: {
                        id: 3853023,
                        faction_id: 46978
                    }
                }
            });
        };

        const env = { SESSION_SECRET };
        const authResponse = await worker.fetch(
            jsonRequest('https://worker.example/api/auth', {
                api_key: 'test-torn-key'
            }),
            env
        );
        const authBody = await authResponse.json();

        assert.equal(authResponse.status, 200);
        assert.equal(authBody.authenticated, true);
        assert.equal(authBody.user_id, 3853023);
        assert.equal(authBody.faction_id, 46978);
        assert.equal(authBody.expires_in, 43200);
        assert.ok(authBody.session_token);

        const sessionResponse = await worker.fetch(
            authenticatedRequest(
                'https://worker.example/api/session',
                authBody.session_token
            ),
            env
        );
        assert.equal(sessionResponse.status, 200);
        assert.equal((await sessionResponse.json()).authenticated, true);
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
                iat: now - 43201,
                exp: now - 1
            },
            SESSION_SECRET
        );
        assert.equal(
            await testing.verifySessionToken(expiredToken, SESSION_SECRET),
            null
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
