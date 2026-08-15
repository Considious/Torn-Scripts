/**
 * SLINK Leveling API Worker
 *
 * Release: 0.7.0-balanced-check-sharing
 *
 * Update WORKER_VERSION for every Worker code change that may be deployed.
 * It is returned by the root and health routes and included in every response
 * as X-Slinky-Worker-Version, making the active source easy to identify.
 */

const WORKER_VERSION = '0.7.0-balanced-check-sharing';

const MASTER_CSV_URL =
    'https://raw.githubusercontent.com/Considious/Torn-Scripts/main/' +
    'Slinkies-Leveling-Targets/Master-Leveling-Targets.csv';

const IMPORT_BATCH_SIZE = 50;
const DEFAULT_TARGET_LIMIT = 50;
const MAX_TARGET_LIMIT = 200;
const DEFAULT_RECOMMENDATION_LIMIT = 40;
const MAX_RECOMMENDATION_LIMIT = 40;
const MAX_TARGET_STATS_FILTER = Number.MAX_SAFE_INTEGER;
// This is payload-abuse protection, not a Torn polling allowance. The client
// supplies its live request capacity from Considious Torn Core Lib.
const MAX_MEMBER_BATCH_ROWS = 200;
const MAX_CHECK_PLAN_ROWS = 300;
const MAX_ACTIVITY_TARGETS_PER_REQUEST = 1_000;
const MAX_JSON_BODY_BYTES = 256 * 1024;

const ALLOWED_FACTION_ID = 46978;
const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;
const DEFAULT_CLIENT_POLL_SECONDS = 300;
const MIN_CLIENT_POLL_SECONDS = 60;
const MAX_CLIENT_POLL_SECONDS = 300;
// The normal recommendation/check exchange is the heartbeat. Another session
// may take over after the active collector misses two configured exchanges.
const COLLECTOR_MISSED_INTERVALS = 2;
const MIN_CHECK_CLAIM_LIFETIME_MS = 3 * 60 * 1000;
const CHECK_CLAIM_GRACE_MS = 2 * 60 * 1000;
const TARGET_LEASE_LIFETIME_MS = 10 * 60 * 1000;
const ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const HOSPITAL_24H_MS = 24 * 60 * 60 * 1000;
const HOSPITAL_7D_MS = 7 * 24 * 60 * 60 * 1000;
const NON_OKAY_RECHECK_MS = 10 * 60 * 1000;
const HOSPITAL_RECHECK_GRACE_MS = 60 * 1000;
const RAPID_REHOSP_WINDOW_MS = 60 * 60 * 1000;
const OKAY_RECHECK_PRIME_MS = 15 * 60 * 1000;
const OKAY_RECHECK_WARM_MS = 30 * 60 * 1000;
const OKAY_RECHECK_CROWDED_MS = 60 * 60 * 1000;
const OKAY_RECHECK_FARMED_MS = 6 * 60 * 60 * 1000;
const DEFERRED_CHECK_AT_MS = 8_640_000_000_000_000;

const textEncoder = new TextEncoder();


// ================================================================
// Worker
// ================================================================

const worker = {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders()
            });
        }

        if (url.pathname === '/') {
            return jsonResponse({
                ok: true,
                service: 'SLINK Leveling API',
                version: WORKER_VERSION,
                message: 'Worker is running.'
            });
        }

        if (
            url.pathname === '/api/health' &&
            request.method === 'GET'
        ) {
            return handleHealth(env);
        }

        if (
            url.pathname === '/api/auth' &&
            request.method === 'POST'
        ) {
            return handleAuthentication(request, env);
        }

        if (
            url.pathname === '/api/session' &&
            request.method === 'GET'
        ) {
            return handleSessionCheck(request, env);
        }

        if (
            url.pathname === '/api/targets' &&
            request.method === 'GET'
        ) {
            const session = await getAuthenticatedSession(request, env);

            if (!session) {
                return memberAuthenticationRequired();
            }

            return handleListTargets(url, env);
        }

        if (
            url.pathname === '/api/recommendations' &&
            request.method === 'GET'
        ) {
            const session = await getAuthenticatedSession(request, env);

            if (!session) {
                return memberAuthenticationRequired();
            }

            return handleRecommendations(url, env, session);
        }

        if (
            url.pathname === '/api/collector/heartbeat' &&
            request.method === 'POST'
        ) {
            const session = await getAuthenticatedSession(request, env);

            if (!session) {
                return memberAuthenticationRequired();
            }

            return handleCollectorHeartbeat(env, session);
        }

        if (
            url.pathname === '/api/checks/claim' &&
            request.method === 'POST'
        ) {
            const session = await getAuthenticatedSession(request, env);

            if (!session) {
                return memberAuthenticationRequired();
            }

            return handleClaimChecks(request, env, session);
        }

        if (
            url.pathname === '/api/observations' &&
            request.method === 'POST'
        ) {
            const session = await getAuthenticatedSession(request, env);

            if (!session) {
                return memberAuthenticationRequired();
            }

            return handleObservations(request, env, session);
        }

        if (
            url.pathname === '/api/activity' &&
            request.method === 'POST'
        ) {
            const session = await getAuthenticatedSession(request, env);

            if (!session) {
                return memberAuthenticationRequired();
            }

            return handleActivityReport(request, env, session);
        }

        if (
            url.pathname === '/api/fair-fight' &&
            request.method === 'POST'
        ) {
            const session = await getAuthenticatedSession(request, env);

            if (!session) {
                return memberAuthenticationRequired();
            }

            return handleDeprecatedFairFightReport();
        }

        if (
            url.pathname === '/api/admin/bootstrap-targets' &&
            request.method === 'POST'
        ) {
            if (!await isAdminRequest(request, env)) {
                return unauthorizedAdminResponse();
            }

            return handleBootstrapTargets(env);
        }

        if (
            url.pathname === '/api/admin/targets' &&
            request.method === 'GET'
        ) {
            if (!await isAdminRequest(request, env)) {
                return unauthorizedAdminResponse();
            }

            return handleListTargets(url, env);
        }

        return jsonResponse(
            {
                ok: false,
                error: 'Not found'
            },
            404
        );
    }
};

export default worker;


// ================================================================
// Health
// ================================================================

async function handleHealth(env) {
    try {
        const targetCount = await env.DB
            .prepare('SELECT COUNT(*) AS count FROM targets')
            .first();

        const statusCount = await env.DB
            .prepare('SELECT COUNT(*) AS count FROM target_status')
            .first();

        const hospitalCount = await env.DB
            .prepare('SELECT COUNT(*) AS count FROM hospital_events')
            .first();

        const queueCount = await env.DB
            .prepare('SELECT COUNT(*) AS count FROM scheduler_queue')
            .first();

        return jsonResponse({
            ok: true,
            version: WORKER_VERSION,
            database: 'connected',
            tables: {
                targets: targetCount?.count ?? 0,
                target_status: statusCount?.count ?? 0,
                hospital_events: hospitalCount?.count ?? 0,
                scheduler_queue: queueCount?.count ?? 0
            }
        });
    } catch (error) {
        return jsonResponse(
            {
                ok: false,
                database: 'error',
                error: errorMessage(error)
            },
            500
        );
    }
}


// ================================================================
// Member authentication and sessions
// ================================================================

async function handleAuthentication(request, env) {
    try {
        if (!env.SESSION_SECRET) {
            return jsonResponse(
                {
                    ok: false,
                    error: 'Session authentication is not configured.'
                },
                500
            );
        }

        let body;

        try {
            body = await readJsonBody(request);
        } catch (error) {
            return jsonResponse(
                {
                    ok: false,
                    error: errorMessage(error)
                },
                400
            );
        }

        /*
         * The Torn API key is used only by this request to verify identity.
         * It is never written to D1, placed in a session token, or logged.
         */
        const apiKey = String(body?.api_key || '').trim();

        if (!apiKey) {
            return jsonResponse(
                {
                    ok: false,
                    error: 'Torn API key is required.'
                },
                400
            );
        }

        const tornResponse = await fetch(
            'https://api.torn.com/v2/key/info',
            {
                method: 'GET',
                headers: {
                    'Authorization': `ApiKey ${apiKey}`,
                    'Accept': 'application/json',
                    'User-Agent': 'Slinky-Leveling-Service'
                }
            }
        );

        let tornData;

        try {
            tornData = await tornResponse.json();
        } catch {
            return jsonResponse(
                {
                    ok: false,
                    error: 'Torn returned an unreadable authentication response.'
                },
                502
            );
        }

        if (!tornResponse.ok || tornData?.error) {
            return jsonResponse(
                {
                    ok: false,
                    error: 'Torn API key could not be validated.'
                },
                401
            );
        }

        const userId = Number(tornData?.info?.user?.id);
        const factionId = Number(tornData?.info?.user?.faction_id);

        if (!Number.isInteger(userId) || userId <= 0) {
            return jsonResponse(
                {
                    ok: false,
                    error: 'Torn did not return a valid user ID.'
                },
                401
            );
        }

        if (factionId !== ALLOWED_FACTION_ID) {
            return jsonResponse(
                {
                    ok: false,
                    error: 'This service is restricted to Slinky faction members.'
                },
                403
            );
        }

        const issuedAt = Math.floor(Date.now() / 1000);
        const expiresAt = issuedAt + SESSION_LIFETIME_SECONDS;

        const sessionPayload = {
            user_id: userId,
            faction_id: factionId,
            session_id: crypto.randomUUID(),
            iat: issuedAt,
            exp: expiresAt
        };

        const sessionToken = await createSessionToken(
            sessionPayload,
            env.SESSION_SECRET
        );

        return jsonResponse({
            ok: true,
            authenticated: true,
            user_id: userId,
            faction_id: factionId,
            expires_at: new Date(expiresAt * 1000).toISOString(),
            expires_in: SESSION_LIFETIME_SECONDS,
            session_token: sessionToken
        });
    } catch (error) {
        return jsonResponse(
            {
                ok: false,
                error: 'Authentication failed.',
                detail: errorMessage(error)
            },
            500
        );
    }
}


async function handleSessionCheck(request, env) {
    const session = await getAuthenticatedSession(request, env);

    if (!session) {
        return memberAuthenticationRequired();
    }

    return jsonResponse({
        ok: true,
        authenticated: true,
        user_id: session.user_id,
        faction_id: session.faction_id,
        session_id: session.session_id,
        issued_at: new Date(session.iat * 1000).toISOString(),
        expires_at: new Date(session.exp * 1000).toISOString()
    });
}


async function getAuthenticatedSession(request, env) {
    if (!env.SESSION_SECRET) {
        return null;
    }

    const authorization = request.headers.get('Authorization') || '';

    if (!authorization.startsWith('Bearer ')) {
        return null;
    }

    const token = authorization.slice(7).trim();

    if (!token) {
        return null;
    }

    return verifySessionToken(token, env.SESSION_SECRET);
}


async function createSessionToken(payload, secret) {
    const encodedPayload = base64UrlEncode(
        textEncoder.encode(JSON.stringify(payload))
    );

    const key = await importSessionKey(secret, ['sign']);
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        textEncoder.encode(encodedPayload)
    );

    return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}


async function verifySessionToken(token, secret) {
    const parts = token.split('.');

    if (parts.length !== 2) {
        return null;
    }

    const [encodedPayload, encodedSignature] = parts;

    try {
        const key = await importSessionKey(secret, ['verify']);
        const signature = base64UrlDecode(encodedSignature);
        const validSignature = await crypto.subtle.verify(
            'HMAC',
            key,
            signature,
            textEncoder.encode(encodedPayload)
        );

        if (!validSignature) {
            return null;
        }

        const payload = JSON.parse(
            new TextDecoder().decode(base64UrlDecode(encodedPayload))
        );

        const now = Math.floor(Date.now() / 1000);

        if (
            !Number.isInteger(payload.user_id) ||
            payload.user_id <= 0 ||
            payload.faction_id !== ALLOWED_FACTION_ID ||
            typeof payload.session_id !== 'string' ||
            !payload.session_id ||
            !Number.isInteger(payload.iat) ||
            !Number.isInteger(payload.exp) ||
            payload.exp <= now ||
            payload.iat > now ||
            payload.exp - payload.iat !== SESSION_LIFETIME_SECONDS
        ) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}


function importSessionKey(secret, keyUsages) {
    return crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        {
            name: 'HMAC',
            hash: 'SHA-256'
        },
        false,
        keyUsages
    );
}


// ================================================================
// Master target bootstrap
// ================================================================

async function handleBootstrapTargets(env) {
    try {
        const response = await fetch(MASTER_CSV_URL, {
            headers: {
                'User-Agent': 'Slinky-Leveling-Worker'
            }
        });

        if (!response.ok) {
            throw new Error(
                `GitHub master list request failed: HTTP ${response.status}`
            );
        }

        // The repository-owned master list is intentionally small and bounded.
        const csvText = await response.text();
        const rows = parseCsv(csvText);

        const targets = rows
            .map(normalizeMasterTarget)
            .filter(target => {
                return (
                    Number.isInteger(target.id) &&
                    target.id > 0 &&
                    target.name
                );
            });

        if (!targets.length) {
            throw new Error('Master CSV produced zero valid targets.');
        }

        const uniqueTargets = deduplicateTargets(targets);

        const upsertStatement = env.DB.prepare(`
            INSERT INTO targets (
                id,
                name,
                level,
                total_stats,
                sources,
                updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)

            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                level = excluded.level,
                total_stats = excluded.total_stats,
                sources = excluded.sources,
                updated_at = CURRENT_TIMESTAMP
        `);

        let processed = 0;

        for (
            let index = 0;
            index < uniqueTargets.length;
            index += IMPORT_BATCH_SIZE
        ) {
            const chunk = uniqueTargets.slice(
                index,
                index + IMPORT_BATCH_SIZE
            );

            const statements = chunk.map(target => {
                return upsertStatement.bind(
                    target.id,
                    target.name,
                    target.level,
                    target.totalStats,
                    target.sources
                );
            });

            await env.DB.batch(statements);
            processed += chunk.length;
        }

        const databaseCount = await env.DB
            .prepare('SELECT COUNT(*) AS count FROM targets')
            .first();

        return jsonResponse({
            ok: true,
            source: MASTER_CSV_URL,
            csv_rows: rows.length,
            valid_targets: targets.length,
            unique_targets: uniqueTargets.length,
            processed,
            targets_in_database: databaseCount?.count ?? 0
        });
    } catch (error) {
        return jsonResponse(
            {
                ok: false,
                error: errorMessage(error)
            },
            500
        );
    }
}


// ================================================================
// Target listing (admin and authenticated members)
// ================================================================

async function handleListTargets(url, env) {
    try {
        const limit = boundedIntegerQueryParameter(
            url.searchParams.get('limit'),
            DEFAULT_TARGET_LIMIT,
            1,
            MAX_TARGET_LIMIT
        );

        const offset = boundedIntegerQueryParameter(
            url.searchParams.get('offset'),
            0,
            0,
            Number.MAX_SAFE_INTEGER
        );

        const result = await env.DB
            .prepare(`
                SELECT
                    id,
                    name,
                    level,
                    total_stats,
                    sources,
                    created_at,
                    updated_at
                FROM targets
                ORDER BY
                    level DESC,
                    total_stats ASC,
                    id ASC
                LIMIT ?1
                OFFSET ?2
            `)
            .bind(limit, offset)
            .all();

        return jsonResponse({
            ok: true,
            count: result.results?.length ?? 0,
            limit,
            offset,
            targets: result.results ?? []
        });
    } catch (error) {
        return jsonResponse(
            {
                ok: false,
                error: errorMessage(error)
            },
            500
        );
    }
}


// ================================================================
// Thin-client recommendations and distributed checks
// ================================================================

async function handleCollectorHeartbeat(env, session) {
    try {
        const lease = await claimUserCollector(
            env,
            session,
            Date.now(),
            DEFAULT_CLIENT_POLL_SECONDS
        );
        return collectorLeaseResponse(lease);
    } catch (error) {
        return workerErrorResponse('Could not renew the collector lease.', error);
    }
}


async function claimUserCollector(env, session, now, pollSeconds) {
    const boundedPollSeconds = boundedInteger(
        pollSeconds,
        DEFAULT_CLIENT_POLL_SECONDS,
        MIN_CLIENT_POLL_SECONDS,
        MAX_CLIENT_POLL_SECONDS
    );
    const expiresAt = now + (
        boundedPollSeconds * COLLECTOR_MISSED_INTERVALS * 1000
    );

    await env.DB
        .prepare(`
            INSERT INTO client_user_collectors (
                user_id,
                session_id,
                claimed_at,
                last_seen_at,
                expires_at
            )
            VALUES (?1, ?2, ?3, ?3, ?4)
            ON CONFLICT(user_id) DO UPDATE SET
                session_id = excluded.session_id,
                claimed_at = CASE
                    WHEN client_user_collectors.session_id = excluded.session_id
                        THEN client_user_collectors.claimed_at
                    ELSE excluded.claimed_at
                END,
                last_seen_at = excluded.last_seen_at,
                expires_at = excluded.expires_at
            WHERE client_user_collectors.session_id = excluded.session_id
               OR client_user_collectors.expires_at <= excluded.last_seen_at
        `)
        .bind(
            session.user_id,
            session.session_id,
            now,
            expiresAt
        )
        .run();

    const current = await env.DB
        .prepare(`
            SELECT session_id, claimed_at, last_seen_at, expires_at
            FROM client_user_collectors
            WHERE user_id = ?1
        `)
        .bind(session.user_id)
        .first();

    return {
        collector: current?.session_id === session.session_id,
        claimedAt: Number(current?.claimed_at) || 0,
        lastSeenAt: Number(current?.last_seen_at) || 0,
        expiresAt: Number(current?.expires_at) || 0,
        lifetimeMs: Math.max(
            0,
            (Number(current?.expires_at) || 0) -
                (Number(current?.last_seen_at) || 0)
        )
    };
}


function collectorLeaseResponse(lease, extra = {}) {
    return jsonResponse({
        ok: true,
        collector: lease.collector,
        collector_lease_seconds: Math.floor(lease.lifetimeMs / 1000),
        collector_claimed_at: lease.collector ? lease.claimedAt : 0,
        collector_expires_at: lease.expiresAt,
        ...extra
    });
}


async function handleRecommendations(url, env, session) {
    try {
        const now = Date.now();
        const limit = boundedIntegerQueryParameter(
            url.searchParams.get('limit'),
            DEFAULT_RECOMMENDATION_LIMIT,
            1,
            MAX_RECOMMENDATION_LIMIT
        );
        const pollSeconds = boundedIntegerQueryParameter(
            url.searchParams.get('poll_seconds'),
            DEFAULT_CLIENT_POLL_SECONDS,
            MIN_CLIENT_POLL_SECONDS,
            MAX_CLIENT_POLL_SECONDS
        );
        const collectorLease = await claimUserCollector(
            env,
            session,
            now,
            pollSeconds
        );
        const minFairFight = boundedNumberQueryParameter(
            url.searchParams.get('min_ff'),
            1,
            1,
            3
        );
        const maxFairFight = boundedNumberQueryParameter(
            url.searchParams.get('max_ff'),
            3,
            minFairFight,
            3
        );
        const minTargetStats = boundedIntegerQueryParameter(
            url.searchParams.get('min_target_stats'),
            0,
            0,
            MAX_TARGET_STATS_FILTER
        );
        const maxTargetStats = boundedIntegerQueryParameter(
            url.searchParams.get('max_target_stats'),
            MAX_TARGET_STATS_FILTER,
            minTargetStats,
            MAX_TARGET_STATS_FILTER
        );

        await cleanExpiredCoordinationRows(env, now);
        await env.DB
            .prepare(`
                DELETE FROM client_target_leases
                WHERE user_id = ?1
                  AND (
                    expires_at <= ?2
                    OR EXISTS (
                        SELECT 1
                        FROM target_status AS invalid_status
                        WHERE invalid_status.target_id = client_target_leases.target_id
                          AND (
                            COALESCE(invalid_status.hiding_out, 0) = 1
                            OR COALESCE(invalid_status.permanent_federal, 0) = 1
                            OR LOWER(COALESCE(invalid_status.status, 'unknown'))
                                NOT IN ('unknown', 'okay')
                          )
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM target_activity AS active_target
                        WHERE active_target.target_id = client_target_leases.target_id
                          AND active_target.last_seen_at >= ?3
                    )
                    OR (
                        ?4 > 0
                        AND EXISTS (
                            SELECT 1
                            FROM targets AS weak_target
                            WHERE weak_target.id = client_target_leases.target_id
                              AND (
                                weak_target.total_stats IS NULL
                                OR weak_target.total_stats < ?4
                              )
                        )
                    )
                    OR (
                        ?5 < ${MAX_TARGET_STATS_FILTER}
                        AND EXISTS (
                            SELECT 1
                            FROM targets AS strong_target
                            WHERE strong_target.id = client_target_leases.target_id
                              AND (
                                strong_target.total_stats IS NULL
                                OR strong_target.total_stats > ?5
                              )
                        )
                    )
                  )
            `)
            .bind(
                session.user_id,
                now,
                Math.floor((now - ACTIVITY_WINDOW_MS) / 1000),
                minTargetStats,
                maxTargetStats
            )
            .run();

        const existing = await env.DB
            .prepare(`
                SELECT COUNT(*) AS count
                FROM client_target_leases
                WHERE user_id = ?1
                  AND expires_at > ?2
            `)
            .bind(session.user_id, now)
            .first();

        const needed = Math.max(0, limit - Number(existing?.count || 0));

        if (needed > 0) {
            const candidates = await env.DB
                .prepare(`
                    SELECT t.id
                    FROM targets AS t
                    LEFT JOIN target_status AS ts
                        ON ts.target_id = t.id
                    LEFT JOIN target_activity AS activity
                        ON activity.target_id = t.id
                    LEFT JOIN client_target_leases AS lease
                        ON lease.target_id = t.id
                       AND lease.expires_at > ?1
                    WHERE lease.target_id IS NULL
                      AND (
                        activity.last_seen_at IS NULL
                        OR activity.last_seen_at < ?2
                      )
                      AND COALESCE(ts.hiding_out, 0) = 0
                      AND COALESCE(ts.permanent_federal, 0) = 0
                      AND (
                        ts.target_id IS NULL
                        OR LOWER(COALESCE(ts.status, 'unknown'))
                            IN ('unknown', 'okay')
                      )
                      AND (
                        ?3 = 0
                        OR (
                            t.total_stats IS NOT NULL
                            AND t.total_stats >= ?3
                        )
                      )
                      AND (
                        ?4 = ${MAX_TARGET_STATS_FILTER}
                        OR (
                            t.total_stats IS NOT NULL
                            AND t.total_stats <= ?4
                        )
                      )
                    ORDER BY
                        COALESCE(ts.competition_score, 0) ASC,
                        CASE
                            WHEN ts.target_id IS NULL THEN 0
                            WHEN LOWER(COALESCE(ts.status, 'unknown')) = 'unknown' THEN 1
                            ELSE 2
                        END ASC,
                        t.level DESC,
                        COALESCE(t.total_stats, 9223372036854775807) ASC,
                        t.id ASC
                    LIMIT ?5
                `)
                .bind(
                    now,
                    Math.floor((now - ACTIVITY_WINDOW_MS) / 1000),
                    minTargetStats,
                    maxTargetStats,
                    needed
                )
                .all();

            const leaseUntil = now + TARGET_LEASE_LIFETIME_MS;
            const statements = (candidates.results || []).map(candidate => {
                return env.DB
                    .prepare(`
                        INSERT INTO client_target_leases (
                            target_id,
                            user_id,
                            session_id,
                            leased_at,
                            expires_at
                        )
                        VALUES (?1, ?2, ?3, ?4, ?5)
                        ON CONFLICT(target_id) DO NOTHING
                    `)
                    .bind(
                        Number(candidate.id),
                        session.user_id,
                        session.session_id,
                        now,
                        leaseUntil
                    );
            });

            if (statements.length) {
                await env.DB.batch(statements);
            }
        }

        const result = await env.DB
            .prepare(`
                SELECT
                    t.id,
                    t.name,
                    t.level,
                    t.total_stats,
                    t.sources,
                    COALESCE(ts.status, 'Unknown') AS status,
                    CAST(COALESCE(ts.status_until, '0') AS INTEGER) AS status_until,
                    CAST(COALESCE(ts.last_checked_at, '0') AS INTEGER) AS last_checked_at,
                    CAST(COALESCE(ts.next_check_at, '0') AS INTEGER) AS next_check_at,
                    COALESCE(ts.competition_score, 0) AS competition_score,
                    COALESCE(ts.competition_tier, 'Prime') AS competition_tier,
                    NULL AS fair_fight,
                    NULL AS bs_estimate,
                    NULL AS fair_fight_source,
                    0 AS fair_fight_checked_at,
                    (
                        SELECT COUNT(*)
                        FROM hospital_events AS recent_hospital
                        WHERE recent_hospital.target_id = t.id
                          AND CAST(recent_hospital.hospitalized_at AS INTEGER) >= ?3
                    ) AS hospitalizations_24h,
                    (
                        SELECT COUNT(*)
                        FROM hospital_events AS weekly_hospital
                        WHERE weekly_hospital.target_id = t.id
                          AND CAST(weekly_hospital.hospitalized_at AS INTEGER) >= ?4
                    ) AS hospitalizations_7d,
                    (
                        SELECT MAX(CAST(last_hospital.hospitalized_at AS INTEGER))
                        FROM hospital_events AS last_hospital
                        WHERE last_hospital.target_id = t.id
                    ) AS last_hospitalized_at,
                    lease.expires_at AS lease_expires_at
                FROM client_target_leases AS lease
                JOIN targets AS t
                    ON t.id = lease.target_id
                LEFT JOIN target_status AS ts
                    ON ts.target_id = t.id
                WHERE lease.user_id = ?1
                  AND lease.expires_at > ?2
                  AND (
                    ?5 = 0
                    OR (
                        t.total_stats IS NOT NULL
                        AND t.total_stats >= ?5
                    )
                  )
                  AND (
                    ?6 = ${MAX_TARGET_STATS_FILTER}
                    OR (
                        t.total_stats IS NOT NULL
                        AND t.total_stats <= ?6
                    )
                  )
                ORDER BY
                    COALESCE(ts.competition_score, 0) ASC,
                    t.level DESC,
                    t.id ASC
                LIMIT ?7
            `)
            .bind(
                session.user_id,
                now,
                now - HOSPITAL_24H_MS,
                now - HOSPITAL_7D_MS,
                minTargetStats,
                maxTargetStats,
                limit
            )
            .all();

        return collectorLeaseResponse(collectorLease, {
            version: WORKER_VERSION,
            count: result.results?.length ?? 0,
            limit,
            poll_seconds: pollSeconds,
            min_fair_fight: minFairFight,
            max_fair_fight: maxFairFight,
            min_target_stats: minTargetStats || null,
            max_target_stats: maxTargetStats === MAX_TARGET_STATS_FILTER
                ? null
                : maxTargetStats,
            lease_seconds: Math.floor(TARGET_LEASE_LIFETIME_MS / 1000),
            targets: (result.results || []).map(normalizeRecommendationRow)
        });
    } catch (error) {
        return workerErrorResponse('Could not build recommendations.', error);
    }
}


async function handleClaimChecks(request, env, session) {
    try {
        const body = await readJsonBody(request);
        const intervalCapacity = boundedInteger(
            body?.interval_capacity ?? body?.capacity,
            0,
            0,
            MAX_CHECK_PLAN_ROWS
        );
        const pollSeconds = boundedInteger(
            body?.poll_seconds,
            DEFAULT_CLIENT_POLL_SECONDS,
            MIN_CLIENT_POLL_SECONDS,
            MAX_CLIENT_POLL_SECONDS
        );
        const now = Date.now();
        const claimLifetimeMs = Math.max(
            MIN_CHECK_CLAIM_LIFETIME_MS,
            (pollSeconds * 1000) + CHECK_CLAIM_GRACE_MS
        );

        await cleanExpiredCoordinationRows(env, now);
        const collectorLease = await claimUserCollector(
            env,
            session,
            now,
            pollSeconds
        );

        if (!collectorLease.collector) {
            return collectorLeaseResponse(collectorLease, {
                count: 0,
                capacity: 0,
                interval_capacity: intervalCapacity,
                due_count: 0,
                active_collectors: 0,
                fair_share: 0,
                claim_seconds: Math.floor(claimLifetimeMs / 1000),
                checks: []
            });
        }

        const activeCollectorRow = await env.DB
            .prepare(`
                SELECT COUNT(*) AS count
                FROM client_user_collectors
                WHERE expires_at > ?1
            `)
            .bind(now)
            .first();
        const activeCollectors = Math.max(
            1,
            Number(activeCollectorRow?.count || 0)
        );

        const dueRow = await env.DB
            .prepare(`
                SELECT COUNT(*) AS count
                FROM targets AS t
                LEFT JOIN target_status AS ts
                    ON ts.target_id = t.id
                LEFT JOIN target_activity AS activity
                    ON activity.target_id = t.id
                WHERE (
                    activity.last_seen_at IS NULL
                    OR activity.last_seen_at < ?1
                )
                  AND COALESCE(ts.hiding_out, 0) = 0
                  AND COALESCE(ts.permanent_federal, 0) = 0
                  AND (
                    ts.target_id IS NULL
                    OR CAST(COALESCE(ts.next_check_at, '0') AS INTEGER) <= ?2
                  )
            `)
            .bind(
                Math.floor((now - ACTIVITY_WINDOW_MS) / 1000),
                now
            )
            .first();
        const dueCount = Number(dueRow?.count || 0);
        const fairShare = dueCount > 0
            ? Math.ceil(dueCount / activeCollectors)
            : 0;
        const capacity = Math.min(intervalCapacity, fairShare);

        const existing = await env.DB
            .prepare(`
                SELECT COUNT(*) AS count
                FROM client_check_claims
                WHERE session_id = ?1
                  AND expires_at > ?2
            `)
            .bind(session.session_id, now)
            .first();

        const needed = Math.max(0, capacity - Number(existing?.count || 0));

        if (needed > 0) {
            const candidates = await env.DB
                .prepare(`
                    SELECT t.id
                    FROM targets AS t
                    LEFT JOIN target_status AS ts
                        ON ts.target_id = t.id
                    LEFT JOIN target_activity AS activity
                        ON activity.target_id = t.id
                    LEFT JOIN client_check_claims AS claim
                        ON claim.target_id = t.id
                       AND claim.expires_at > ?1
                    LEFT JOIN client_target_leases AS assigned_target
                        ON assigned_target.target_id = t.id
                       AND assigned_target.expires_at > ?1
                    WHERE claim.target_id IS NULL
                      AND (
                        activity.last_seen_at IS NULL
                        OR activity.last_seen_at < ?2
                      )
                      AND COALESCE(ts.hiding_out, 0) = 0
                      AND COALESCE(ts.permanent_federal, 0) = 0
                      AND (
                        ts.target_id IS NULL
                        OR CAST(COALESCE(ts.next_check_at, '0') AS INTEGER) <= ?1
                      )
                    ORDER BY
                        CASE
                            WHEN assigned_target.target_id IS NULL THEN 0
                            ELSE 1
                        END ASC,
                        CASE
                            WHEN LOWER(COALESCE(ts.status, '')) IN ('hospital', 'federal')
                                THEN 0
                            WHEN ts.target_id IS NULL THEN 1
                            WHEN LOWER(COALESCE(ts.status, 'unknown')) = 'unknown'
                                THEN 2
                            WHEN LOWER(COALESCE(ts.status, '')) = 'okay'
                                THEN 3
                            ELSE 2
                        END ASC,
                        COALESCE(ts.competition_score, 0) ASC,
                        CAST(COALESCE(ts.last_checked_at, '0') AS INTEGER) ASC,
                        t.level DESC,
                        COALESCE(t.total_stats, 9223372036854775807) ASC,
                        t.id ASC
                    LIMIT ?3
                `)
                .bind(
                    now,
                    Math.floor((now - ACTIVITY_WINDOW_MS) / 1000),
                    needed
                )
                .all();

            const expiresAt = now + claimLifetimeMs;
            const statements = (candidates.results || []).map(candidate => {
                return env.DB
                    .prepare(`
                        INSERT INTO client_check_claims (
                            target_id,
                            user_id,
                            session_id,
                            claimed_at,
                            expires_at
                        )
                        VALUES (?1, ?2, ?3, ?4, ?5)
                        ON CONFLICT(target_id) DO UPDATE SET
                            user_id = excluded.user_id,
                            session_id = excluded.session_id,
                            claimed_at = excluded.claimed_at,
                            expires_at = excluded.expires_at
                        WHERE client_check_claims.expires_at <= excluded.claimed_at
                    `)
                    .bind(
                        Number(candidate.id),
                        session.user_id,
                        session.session_id,
                        now,
                        expiresAt
                    );
            });

            if (statements.length) {
                await env.DB.batch(statements);
            }
        }

        const claims = await env.DB
            .prepare(`
                SELECT
                    t.id,
                    t.name,
                    t.level,
                    t.total_stats,
                    t.sources,
                    COALESCE(ts.status, 'Unknown') AS previous_status,
                    CAST(COALESCE(ts.status_until, '0') AS INTEGER)
                        AS previous_status_until,
                    claim.expires_at AS claim_expires_at
                FROM client_check_claims AS claim
                JOIN targets AS t
                    ON t.id = claim.target_id
                LEFT JOIN target_status AS ts
                    ON ts.target_id = t.id
                WHERE claim.session_id = ?1
                  AND claim.expires_at > ?2
                ORDER BY claim.claimed_at ASC, t.id ASC
                LIMIT ?3
            `)
            .bind(session.session_id, now, capacity)
            .all();

        return collectorLeaseResponse(collectorLease, {
            count: claims.results?.length ?? 0,
            capacity,
            interval_capacity: intervalCapacity,
            due_count: dueCount,
            active_collectors: activeCollectors,
            fair_share: fairShare,
            claim_seconds: Math.floor(claimLifetimeMs / 1000),
            checks: claims.results ?? []
        });
    } catch (error) {
        return requestOrWorkerErrorResponse('Could not claim checks.', error);
    }
}


async function handleObservations(request, env, session) {
    try {
        const body = await readJsonBody(request);
        const observations = Array.isArray(body?.observations)
            ? body.observations
            : [];

        if (!observations.length) {
            throw new RequestValidationError(
                'At least one observation is required.'
            );
        }

        if (observations.length > MAX_MEMBER_BATCH_ROWS) {
            throw new RequestValidationError(
                `A maximum of ${MAX_MEMBER_BATCH_ROWS} rows is allowed per request.`
            );
        }

        const accepted = [];
        const rejected = [];

        for (let index = 0; index < observations.length; index++) {
            try {
                accepted.push(
                    await applyTargetObservation(
                        env,
                        session,
                        observations[index]
                    )
                );
            } catch (error) {
                rejected.push({
                    index,
                    target_id: positiveIntegerOrNull(
                        observations[index]?.target_id
                    ),
                    error: errorMessage(error)
                });
            }
        }

        return jsonResponse({
            ok: rejected.length === 0,
            accepted_count: accepted.length,
            rejected_count: rejected.length,
            accepted,
            rejected
        }, accepted.length ? 200 : 400);
    } catch (error) {
        return requestOrWorkerErrorResponse(
            'Could not process observations.',
            error
        );
    }
}


async function applyTargetObservation(env, session, observation) {
    const targetId = positiveIntegerOrNull(observation?.target_id);

    if (!targetId) {
        throw new RequestValidationError('target_id must be a positive integer.');
    }

    const target = await env.DB
        .prepare('SELECT id, name FROM targets WHERE id = ?1')
        .bind(targetId)
        .first();

    if (!target) {
        throw new RequestValidationError('The target is not in the master list.');
    }

    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);
    const stateText = `${observation?.state || ''} ${observation?.description || ''}`;
    const status = normalizeStatus(stateText);
    const description = String(observation?.description || '')
        .trim()
        .slice(0, 500);
    const until = boundedInteger(
        observation?.until,
        0,
        0,
        nowSeconds + (5 * 365 * 24 * 60 * 60)
    );
    const source = normalizeObservationSource(observation?.source);

    const previous = await env.DB
        .prepare(`
            SELECT status, status_until
            FROM target_status
            WHERE target_id = ?1
        `)
        .bind(targetId)
        .first();

    const previousStatus = normalizeStatus(previous?.status || 'Unknown');
    const previousUntil = Number(previous?.status_until) || 0;
    const newHospitalStay = status === 'Hospital' && (
        (until > 0 && until !== previousUntil) ||
        (until === 0 && previousStatus !== 'Hospital')
    );

    let hospitalEventInserted = false;

    if (newHospitalStay) {
        const deduplicationUntil = until > 0
            ? until
            : -Math.floor(now / 60_000);
        const insertResult = await env.DB
            .prepare(`
                INSERT OR IGNORE INTO hospital_events (
                    target_id,
                    hospitalized_at,
                    hospital_until,
                    reported_by
                )
                VALUES (?1, ?2, ?3, ?4)
            `)
            .bind(
                targetId,
                now,
                deduplicationUntil,
                session.user_id
            )
            .run();

        hospitalEventInserted = Number(insertResult.meta?.changes || 0) > 0;
    }

    const competition = await calculateCompetition(env, targetId, now);
    const schedule = calculateNextCheck({
        status,
        description,
        until,
        competitionTier: competition.tier,
        now
    });

    await env.DB.batch([
        env.DB
            .prepare(`
                INSERT INTO target_status (
                    target_id,
                    status,
                    status_until,
                    last_checked_at,
                    next_check_at,
                    competition_score,
                    competition_tier,
                    hiding_out,
                    permanent_federal,
                    updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP)
                ON CONFLICT(target_id) DO UPDATE SET
                    status = excluded.status,
                    status_until = excluded.status_until,
                    last_checked_at = excluded.last_checked_at,
                    next_check_at = excluded.next_check_at,
                    competition_score = excluded.competition_score,
                    competition_tier = excluded.competition_tier,
                    hiding_out = excluded.hiding_out,
                    permanent_federal = excluded.permanent_federal,
                    updated_at = CURRENT_TIMESTAMP
            `)
            .bind(
                targetId,
                status,
                until,
                now,
                schedule.nextCheckAt,
                competition.score,
                competition.tier,
                schedule.hidingOut ? 1 : 0,
                schedule.permanentFederal ? 1 : 0
            ),
        env.DB
            .prepare('DELETE FROM client_check_claims WHERE target_id = ?1')
            .bind(targetId),
        env.DB
            .prepare(`
                DELETE FROM client_target_leases
                WHERE target_id = ?1
                  AND ?2 NOT IN ('Okay', 'Unknown')
            `)
            .bind(targetId, status)
    ]);

    return {
        target_id: targetId,
        name: target.name,
        status,
        status_until: until,
        next_check_at: schedule.nextCheckAt,
        schedule_reason: schedule.reason,
        competition_score: competition.score,
        competition_tier: competition.tier,
        hospital_event_inserted: hospitalEventInserted,
        source
    };
}


async function handleActivityReport(request, env, session) {
    try {
        const body = await readJsonBody(request);
        const entries = Object.entries(body?.active_targets || {});

        if (!entries.length) {
            throw new RequestValidationError(
                'active_targets must contain at least one target.'
            );
        }

        if (entries.length > MAX_ACTIVITY_TARGETS_PER_REQUEST) {
            throw new RequestValidationError(
                `A maximum of ${MAX_ACTIVITY_TARGETS_PER_REQUEST} active targets is allowed.`
            );
        }

        const nowSeconds = Math.floor(Date.now() / 1000);
        const minimumSnapshot = nowSeconds - Math.floor(ACTIVITY_WINDOW_MS / 1000) - 86_400;
        const accepted = entries.map(([rawId, rawTimestamp]) => {
            const targetId = positiveIntegerOrNull(rawId);
            const snapshotAt = boundedInteger(
                rawTimestamp,
                0,
                minimumSnapshot,
                nowSeconds + 300
            );

            if (!targetId || !snapshotAt) {
                throw new RequestValidationError(
                    'Every active target must have a valid ID and recent snapshot timestamp.'
                );
            }

            return { targetId, snapshotAt };
        });

        for (let index = 0; index < accepted.length; index += IMPORT_BATCH_SIZE) {
            const chunk = accepted.slice(index, index + IMPORT_BATCH_SIZE);
            const statements = [];

            for (const entry of chunk) {
                statements.push(
                    env.DB
                        .prepare(`
                            INSERT INTO target_activity (
                                target_id,
                                last_seen_at,
                                observed_at,
                                reported_by
                            )
                            VALUES (?1, ?2, ?3, ?4)
                            ON CONFLICT(target_id) DO UPDATE SET
                                last_seen_at = MAX(
                                    target_activity.last_seen_at,
                                    excluded.last_seen_at
                                ),
                                observed_at = excluded.observed_at,
                                reported_by = excluded.reported_by
                        `)
                        .bind(
                            entry.targetId,
                            entry.snapshotAt,
                            nowSeconds,
                            session.user_id
                        )
                );
                statements.push(
                    env.DB
                        .prepare(`
                            UPDATE target_status
                            SET
                                status = CASE
                                    WHEN hiding_out = 1 THEN 'Unknown'
                                    ELSE status
                                END,
                                hiding_out = 0,
                                next_check_at = CASE
                                    WHEN hiding_out = 1 THEN '0'
                                    ELSE next_check_at
                                END,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE target_id = ?1
                        `)
                        .bind(entry.targetId)
                );
            }

            await env.DB.batch(statements);
        }

        return jsonResponse({
            ok: true,
            accepted_count: accepted.length
        });
    } catch (error) {
        return requestOrWorkerErrorResponse(
            'Could not process activity data.',
            error
        );
    }
}


function handleDeprecatedFairFightReport() {
    return jsonResponse({
        ok: true,
        accepted_count: 0,
        cache_scope: 'client',
        deprecated: true,
        message: 'Fair Fight data is stored only in the member browser.'
    });
}


async function cleanExpiredCoordinationRows(env, now) {
    await env.DB.batch([
        env.DB
            .prepare('DELETE FROM client_check_claims WHERE expires_at <= ?1')
            .bind(now),
        env.DB
            .prepare('DELETE FROM client_target_leases WHERE expires_at <= ?1')
            .bind(now),
        env.DB
            .prepare('DELETE FROM client_user_collectors WHERE expires_at <= ?1')
            .bind(now)
    ]);
}


async function calculateCompetition(env, targetId, now = Date.now()) {
    const result = await env.DB
        .prepare(`
            SELECT hospitalized_at, hospital_until
            FROM hospital_events
            WHERE target_id = ?1
              AND CAST(hospitalized_at AS INTEGER) >= ?2
            ORDER BY CAST(hospitalized_at AS INTEGER) ASC
        `)
        .bind(targetId, now - HOSPITAL_7D_MS)
        .all();

    const events = (result.results || [])
        .map(row => ({
            at: Number(row.hospitalized_at) || 0,
            until: Number(row.hospital_until) || 0
        }))
        .filter(event => event.at > 0)
        .sort((left, right) => left.at - right.at);
    const cutoff24h = now - HOSPITAL_24H_MS;
    const count24h = events.filter(event => event.at >= cutoff24h).length;
    let rapidPenaltyTotal = 0;
    let rapidCount24h = 0;

    for (let index = 1; index < events.length; index++) {
        const current = events[index];
        const previous = events[index - 1];

        if (previous.until <= 0) {
            continue;
        }

        const gapMs = current.at - (previous.until * 1000);

        if (
            gapMs < 0 ||
            gapMs > RAPID_REHOSP_WINDOW_MS ||
            current.at < cutoff24h
        ) {
            continue;
        }

        rapidCount24h++;
        rapidPenaltyTotal += rapidPenalty(gapMs);
    }

    const score = (count24h * 10) + (events.length * 2) + rapidPenaltyTotal;

    return {
        score,
        tier: competitionTier(score),
        hospitalizations24h: count24h,
        hospitalizations7d: events.length,
        rapidRehospitalizations24h: rapidCount24h
    };
}


function calculateNextCheck({
    status,
    description,
    until,
    competitionTier: tier,
    now = Date.now()
}) {
    const untilMs = until > 0 ? until * 1000 : 0;
    let nextCheckAt = now + NON_OKAY_RECHECK_MS;
    let reason = 'stale_status';
    let hidingOut = false;
    let permanentFederal = false;

    if (status === 'Hospital') {
        nextCheckAt = untilMs > now
            ? untilMs + HOSPITAL_RECHECK_GRACE_MS
            : now + NON_OKAY_RECHECK_MS;
        reason = untilMs > now
            ? 'hospital_release_plus_1m'
            : 'hospital_without_release_time';
    } else if (status === 'Federal') {
        permanentFederal = (
            String(description || '').toLowerCase().includes('permanent') ||
            untilMs <= now
        );

        if (permanentFederal) {
            nextCheckAt = DEFERRED_CHECK_AT_MS;
            reason = 'permanent_federal_jail';
        } else {
            nextCheckAt = untilMs + HOSPITAL_RECHECK_GRACE_MS;
            reason = 'temporary_federal_release_plus_1m';
        }
    } else if (status === 'Hiding Out') {
        hidingOut = true;
        nextCheckAt = DEFERRED_CHECK_AT_MS;
        reason = 'hiding_out_until_activity_snapshot';
    } else if (status === 'Okay') {
        nextCheckAt = now + okayRecheckInterval(tier);
        reason = `okay_${String(tier || 'Prime').toLowerCase()}_recheck`;
    } else if (status === 'Unknown') {
        nextCheckAt = now + NON_OKAY_RECHECK_MS;
        reason = 'unknown_recheck';
    }

    return {
        nextCheckAt,
        reason,
        hidingOut,
        permanentFederal
    };
}


function normalizeStatus(value) {
    const text = String(value || 'Unknown').trim();
    const lower = text.toLowerCase();

    if (lower.includes('federal')) return 'Federal';
    if (lower.includes('hiding out') || lower.includes('hiding')) {
        return 'Hiding Out';
    }
    if (lower.includes('hospital')) return 'Hospital';
    if (lower.includes('travel') || lower.includes('flying')) {
        return 'Traveling';
    }
    if (lower.includes('abroad')) return 'Abroad';
    if (lower.includes('jail')) return 'Jail';
    if (lower === 'okay' || lower.includes('okay')) return 'Okay';
    return 'Unknown';
}


function rapidPenalty(gapMs) {
    if (
        !Number.isFinite(gapMs) ||
        gapMs < 0 ||
        gapMs > RAPID_REHOSP_WINDOW_MS
    ) {
        return 0;
    }

    if (gapMs <= 5 * 60 * 1000) return 40;
    if (gapMs <= 15 * 60 * 1000) return 25;
    if (gapMs <= 30 * 60 * 1000) return 15;
    return 8;
}


function competitionTier(score) {
    if (score >= 80) return 'Farmed';
    if (score >= 40) return 'Crowded';
    if (score >= 20) return 'Warm';
    return 'Prime';
}


function okayRecheckInterval(tier) {
    if (tier === 'Farmed') return OKAY_RECHECK_FARMED_MS;
    if (tier === 'Crowded') return OKAY_RECHECK_CROWDED_MS;
    if (tier === 'Warm') return OKAY_RECHECK_WARM_MS;
    return OKAY_RECHECK_PRIME_MS;
}


function normalizeRecommendationRow(row) {
    return {
        ...row,
        id: Number(row.id),
        level: nullableNumber(row.level),
        total_stats: nullableNumber(row.total_stats),
        status_until: Number(row.status_until) || 0,
        last_checked_at: Number(row.last_checked_at) || 0,
        next_check_at: Number(row.next_check_at) || 0,
        competition_score: Number(row.competition_score) || 0,
        fair_fight: nullableNumber(row.fair_fight),
        bs_estimate: nullableNumber(row.bs_estimate),
        fair_fight_checked_at: Number(row.fair_fight_checked_at) || 0,
        hospitalizations_24h: Number(row.hospitalizations_24h) || 0,
        hospitalizations_7d: Number(row.hospitalizations_7d) || 0,
        last_hospitalized_at: Number(row.last_hospitalized_at) || 0,
        lease_expires_at: Number(row.lease_expires_at) || 0
    };
}


function normalizeObservationSource(value) {
    const source = String(value || '').trim().toLowerCase();

    if (source === 'attack_page') return 'attack_page';
    if (source === 'torn_api') return 'torn_api';
    return 'client';
}


// ================================================================
// Admin authentication
// ================================================================

async function isAdminRequest(request, env) {
    const suppliedToken = request.headers.get('X-Admin-Token');

    if (!suppliedToken || !env.ADMIN_TOKEN) {
        return false;
    }

    const [suppliedDigest, expectedDigest] = await Promise.all([
        crypto.subtle.digest('SHA-256', textEncoder.encode(suppliedToken)),
        crypto.subtle.digest('SHA-256', textEncoder.encode(env.ADMIN_TOKEN))
    ]);

    return timingSafeEqual(
        new Uint8Array(suppliedDigest),
        new Uint8Array(expectedDigest)
    );
}


function timingSafeEqual(left, right) {
    if (typeof crypto.subtle.timingSafeEqual === 'function') {
        return crypto.subtle.timingSafeEqual(left, right);
    }

    // Node's Web Crypto does not expose Cloudflare's timingSafeEqual extension.
    // Both inputs are fixed-size SHA-256 digests, so this fallback does not leak
    // the original secret length.
    let difference = 0;

    for (let index = 0; index < left.length; index++) {
        difference |= left[index] ^ right[index];
    }

    return difference === 0;
}


// ================================================================
// CSV handling
// ================================================================

function parseCsv(text) {
    const rawRows = [];

    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (quoted) {
            if (
                character === '"' &&
                text[index + 1] === '"'
            ) {
                cell += '"';
                index++;
                continue;
            }

            if (character === '"') {
                quoted = false;
                continue;
            }

            cell += character;
            continue;
        }

        if (character === '"') {
            quoted = true;
            continue;
        }

        if (character === ',') {
            row.push(cell);
            cell = '';
            continue;
        }

        if (character === '\n') {
            row.push(cell);
            rawRows.push(row);

            row = [];
            cell = '';
            continue;
        }

        if (character !== '\r') {
            cell += character;
        }
    }

    if (cell.length || row.length) {
        row.push(cell);
        rawRows.push(row);
    }

    if (!rawRows.length) {
        return [];
    }

    const headers = rawRows
        .shift()
        .map(header => String(header || '').trim());

    return rawRows
        .filter(values => {
            return values.some(value => String(value || '').trim());
        })
        .map(values => {
            const object = {};

            for (
                let index = 0;
                index < headers.length;
                index++
            ) {
                object[headers[index]] = values[index] ?? '';
            }

            return object;
        });
}


function normalizeMasterTarget(row) {
    const id = Number(row.id);
    const level = Number(row.level);

    return {
        id: Number.isInteger(id) ? id : 0,
        name: String(row.name || '').trim(),
        level: Number.isFinite(level) ? level : null,
        totalStats: parseStatNumber(row.total),
        sources: String(row.sources || '').trim()
    };
}


function parseStatNumber(value) {
    const text = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/,/g, '');

    if (
        !text ||
        text === 'unknown' ||
        text === 'null' ||
        text === '—'
    ) {
        return null;
    }

    let multiplier = 1;
    let numberText = text;

    if (text.endsWith('k')) {
        multiplier = 1_000;
        numberText = text.slice(0, -1);
    } else if (text.endsWith('m')) {
        multiplier = 1_000_000;
        numberText = text.slice(0, -1);
    } else if (text.endsWith('b')) {
        multiplier = 1_000_000_000;
        numberText = text.slice(0, -1);
    }

    const numeric = Number(numberText);

    if (!Number.isFinite(numeric)) {
        return null;
    }

    return Math.round(numeric * multiplier);
}


function deduplicateTargets(targets) {
    const byId = new Map();

    for (const target of targets) {
        byId.set(target.id, target);
    }

    return [...byId.values()];
}


// ================================================================
// Shared request/response helpers
// ================================================================

function boundedIntegerQueryParameter(value, fallback, minimum, maximum) {
    if (value === null || value.trim() === '') {
        return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(
        Math.max(Math.trunc(parsed), minimum),
        maximum
    );
}


function boundedNumberQueryParameter(value, fallback, minimum, maximum) {
    if (value === null || value.trim() === '') {
        return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(Math.max(parsed, minimum), maximum);
}


function boundedInteger(value, fallback, minimum, maximum) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(
        Math.max(Math.trunc(parsed), minimum),
        maximum
    );
}


function positiveIntegerOrNull(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}


function nullableNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}


async function readJsonBody(request) {
    const declaredLength = Number(request.headers.get('Content-Length'));

    if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_JSON_BODY_BYTES
    ) {
        throw new RequestValidationError('Request body is too large.');
    }

    if (!request.body) {
        throw new RequestValidationError('A JSON request body is required.');
    }

    const reader = request.body.getReader();
    const chunks = [];
    let totalLength = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            totalLength += value.byteLength;

            if (totalLength > MAX_JSON_BODY_BYTES) {
                await reader.cancel('Request body is too large.');
                throw new RequestValidationError('Request body is too large.');
            }

            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const bytes = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    try {
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        throw new RequestValidationError('Request body must be valid JSON.');
    }
}


function base64UrlEncode(bytes) {
    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}


function base64UrlDecode(value) {
    let base64 = value
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    while (base64.length % 4) {
        base64 += '=';
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}


function unauthorizedAdminResponse() {
    return jsonResponse(
        {
            ok: false,
            error: 'Unauthorized'
        },
        401
    );
}


function memberAuthenticationRequired() {
    return jsonResponse(
        {
            ok: false,
            authenticated: false,
            error: 'A valid SLINK Leveling session is required.'
        },
        401
    );
}


function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
            'Content-Type, X-Admin-Token, Authorization',
        'Access-Control-Allow-Methods':
            'GET, POST, OPTIONS',
        'Access-Control-Expose-Headers':
            'X-Slinky-Worker-Version',
        'X-Slinky-Worker-Version': WORKER_VERSION
    };
}


function jsonResponse(data, status = 200) {
    return Response.json(data, {
        status,
        headers: corsHeaders()
    });
}


function workerErrorResponse(message, error) {
    console.error(JSON.stringify({
        message,
        error: errorMessage(error)
    }));

    return jsonResponse(
        {
            ok: false,
            error: message
        },
        500
    );
}


function requestOrWorkerErrorResponse(message, error) {
    if (error instanceof RequestValidationError) {
        return jsonResponse(
            {
                ok: false,
                error: error.message
            },
            400
        );
    }

    return workerErrorResponse(message, error);
}


function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}


class RequestValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RequestValidationError';
    }
}


export const testing = {
    calculateNextCheck,
    competitionTier,
    createSessionToken,
    normalizeStatus,
    parseCsv,
    parseStatNumber,
    rapidPenalty,
    verifySessionToken
};
