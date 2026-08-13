import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import worker, { testing } from './worker.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});


describe('Slinky Leveling Worker', () => {
    it('preserves the root and health endpoints', async () => {
        const db = createDatabaseMock();

        const rootResponse = await worker.fetch(
            new Request('https://worker.example/'),
            { DB: db }
        );

        assert.equal(rootResponse.status, 200);
        assert.deepEqual(await rootResponse.json(), {
            ok: true,
            service: 'Slinky Leveling API',
            message: 'Worker is running.'
        });

        const healthResponse = await worker.fetch(
            new Request('https://worker.example/api/health'),
            { DB: db }
        );

        assert.equal(healthResponse.status, 200);
        assert.deepEqual(await healthResponse.json(), {
            ok: true,
            database: 'connected',
            tables: {
                targets: 725,
                target_status: 3,
                hospital_events: 4,
                scheduler_queue: 5
            }
        });
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

        const env = {
            SESSION_SECRET: 'test-session-secret'
        };

        const authResponse = await worker.fetch(
            new Request('https://worker.example/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api_key: 'test-torn-key'
                })
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
            new Request('https://worker.example/api/session', {
                headers: {
                    'Authorization': `Bearer ${authBody.session_token}`
                }
            }),
            env
        );

        const sessionBody = await sessionResponse.json();

        assert.equal(sessionResponse.status, 200);
        assert.equal(sessionBody.authenticated, true);
        assert.equal(sessionBody.user_id, 3853023);
        assert.equal(sessionBody.faction_id, 46978);
        assert.ok(sessionBody.session_id);
    });


    it('keeps admin endpoints protected', async () => {
        const env = {
            ADMIN_TOKEN: 'correct-admin-token',
            DB: createDatabaseMock()
        };

        const deniedResponse = await worker.fetch(
            new Request('https://worker.example/api/admin/targets'),
            env
        );

        assert.equal(deniedResponse.status, 401);

        const allowedResponse = await worker.fetch(
            new Request('https://worker.example/api/admin/targets', {
                headers: {
                    'X-Admin-Token': 'correct-admin-token'
                }
            }),
            env
        );

        assert.equal(allowedResponse.status, 200);
        assert.equal((await allowedResponse.json()).count, 2);
    });


    it('preserves the protected GitHub bootstrap and batched upserts', async () => {
        const csv = [
            'id,name,level,total,profile_url,sources',
            '1,First Target,10,1.25m,https://example.test/1,Source A',
            '1,Updated Target,11,2m,https://example.test/1,Source B',
            '2,Second Target,12,750k,https://example.test/2,Source C'
        ].join('\n');

        globalThis.fetch = async () => {
            return new Response(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv'
                }
            });
        };

        const recordedBatches = [];
        const db = createDatabaseMock({ recordedBatches });

        const response = await worker.fetch(
            new Request(
                'https://worker.example/api/admin/bootstrap-targets',
                {
                    method: 'POST',
                    headers: {
                        'X-Admin-Token': 'correct-admin-token'
                    }
                }
            ),
            {
                ADMIN_TOKEN: 'correct-admin-token',
                DB: db
            }
        );

        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.csv_rows, 3);
        assert.equal(body.valid_targets, 3);
        assert.equal(body.unique_targets, 2);
        assert.equal(body.processed, 2);
        assert.equal(recordedBatches.length, 1);
        assert.deepEqual(recordedBatches[0], [
            [1, 'Updated Target', 11, 2_000_000, 'Source B'],
            [2, 'Second Target', 12, 750_000, 'Source C']
        ]);
    });


    it('protects /api/targets behind a valid member session', async () => {
        const env = {
            SESSION_SECRET: 'test-session-secret',
            DB: createDatabaseMock()
        };

        const deniedResponse = await worker.fetch(
            new Request('https://worker.example/api/targets'),
            env
        );

        assert.equal(deniedResponse.status, 401);

        const now = Math.floor(Date.now() / 1000);
        const token = await testing.createSessionToken(
            {
                user_id: 3853023,
                faction_id: 46978,
                session_id: crypto.randomUUID(),
                iat: now,
                exp: now + 43200
            },
            env.SESSION_SECRET
        );

        const allowedResponse = await worker.fetch(
            new Request(
                'https://worker.example/api/targets?limit=500&offset=2.9',
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            ),
            env
        );

        const body = await allowedResponse.json();

        assert.equal(allowedResponse.status, 200);
        assert.equal(body.count, 2);
        assert.equal(body.limit, 200);
        assert.equal(body.offset, 2);
        assert.deepEqual(body.targets, sampleTargets());
    });


    it('rejects expired and tampered sessions', async () => {
        const now = Math.floor(Date.now() / 1000);
        const secret = 'test-session-secret';

        const expiredToken = await testing.createSessionToken(
            {
                user_id: 3853023,
                faction_id: 46978,
                session_id: crypto.randomUUID(),
                iat: now - 43201,
                exp: now - 1
            },
            secret
        );

        assert.equal(
            await testing.verifySessionToken(expiredToken, secret),
            null
        );

        const validToken = await testing.createSessionToken(
            {
                user_id: 3853023,
                faction_id: 46978,
                session_id: crypto.randomUUID(),
                iat: now,
                exp: now + 43200
            },
            secret
        );

        const tamperedToken = `${validToken.slice(0, -1)}x`;

        assert.equal(
            await testing.verifySessionToken(tamperedToken, secret),
            null
        );
    });


    it('preserves CSV parsing, stat conversion, and CORS preflight', async () => {
        const rows = testing.parseCsv(
            'id,name,level,total,sources\r\n' +
            '1,"Quoted, Name",10,1.25m,"One ""source"""\r\n'
        );

        assert.deepEqual(rows, [
            {
                id: '1',
                name: 'Quoted, Name',
                level: '10',
                total: '1.25m',
                sources: 'One "source"'
            }
        ]);

        assert.equal(testing.parseStatNumber('1.25m'), 1_250_000);
        assert.equal(testing.parseStatNumber('unknown'), null);

        const optionsResponse = await worker.fetch(
            new Request('https://worker.example/api/targets', {
                method: 'OPTIONS'
            }),
            {}
        );

        assert.equal(optionsResponse.status, 204);
        assert.equal(
            optionsResponse.headers.get('Access-Control-Allow-Headers'),
            'Content-Type, X-Admin-Token, Authorization'
        );
    });
});


function createDatabaseMock({ recordedBatches = [] } = {}) {
    return {
        prepare(sql) {
            return createStatementMock(sql);
        },
        async batch(statements) {
            recordedBatches.push(
                statements.map(statement => statement.bindings)
            );

            return statements.map(() => ({
                success: true,
                results: []
            }));
        }
    };
}


function createStatementMock(sql, bindings = []) {
    return {
        bindings,
        bind(...values) {
            return createStatementMock(sql, values);
        },
        async first() {
            if (sql.includes('FROM targets')) {
                return { count: 725 };
            }

            if (sql.includes('FROM target_status')) {
                return { count: 3 };
            }

            if (sql.includes('FROM hospital_events')) {
                return { count: 4 };
            }

            if (sql.includes('FROM scheduler_queue')) {
                return { count: 5 };
            }

            return null;
        },
        async all() {
            assert.equal(bindings.length, 2);

            return {
                success: true,
                results: sampleTargets()
            };
        }
    };
}


function sampleTargets() {
    return [
        {
            id: 1695815,
            name: 'Linked-',
            level: 78,
            total_stats: 51130000,
            sources: 'Legacy List 11',
            created_at: '2026-08-13 00:00:00',
            updated_at: '2026-08-13 00:00:00'
        },
        {
            id: 1627252,
            name: 'eladgrin',
            level: 73,
            total_stats: 61140000,
            sources: 'Legacy List 10',
            created_at: '2026-08-13 00:00:00',
            updated_at: '2026-08-13 00:00:00'
        }
    ];
}
