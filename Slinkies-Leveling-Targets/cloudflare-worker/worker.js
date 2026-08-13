const MASTER_CSV_URL =
    'https://raw.githubusercontent.com/Considious/Torn-Scripts/main/' +
    'Slinkies-Leveling-Targets/Master-Leveling-Targets.csv';

const IMPORT_BATCH_SIZE = 50;
const DEFAULT_TARGET_LIMIT = 50;
const MAX_TARGET_LIMIT = 200;

const ALLOWED_FACTION_ID = 46978;
const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;

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
                service: 'Slinky Leveling API',
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
            body = await request.json();
        } catch {
            return jsonResponse(
                {
                    ok: false,
                    error: 'Request body must be valid JSON.'
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
            error: 'A valid Slinky Leveling session is required.'
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
            'GET, POST, OPTIONS'
    };
}


function jsonResponse(data, status = 200) {
    return Response.json(data, {
        status,
        headers: corsHeaders()
    });
}


function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}


export const testing = {
    createSessionToken,
    parseCsv,
    parseStatNumber,
    verifySessionToken
};
