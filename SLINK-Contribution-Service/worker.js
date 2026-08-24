/**
 * SLINK Contribution Service
 *
 * Release: 0.1.0-encrypted-key-vault
 *
 * Stores only authenticated-encryption ciphertext in D1. Plaintext Torn API
 * keys exist only in request memory during donation validation or scheduled
 * execution and are never returned by an endpoint or written to logs.
 */

const WORKER_VERSION = '0.1.0-encrypted-key-vault';
const TERMS_VERSION = '2026-08-23';
const TERMS_EFFECTIVE_AT = '2026-08-23';
const TERMS_URL =
    'https://github.com/Considious/Torn-Scripts/blob/main/' +
    'SLINK-Contribution-Service/terms/2026-08-23/' +
    'SLINK_API_Key_Donation_Terms.md';
const TERMS_DOCUMENT_SHA256 =
    'd5e9592ef86159037574bf51df86edb4896bb86e57e22f85a9288d0cecaed5e5';
const DISCLOSURE_VERSION = '2026-08-23';
const DISCLOSURE_SHA256 =
    '62003b1c06ca2f9843e34bf72e44fe102f3856289a4f421fe9d8284c2c67b35a';
const TERMS_SUMMARY =
    'Donating a Public Only Torn API key stores it remotely with authenticated ' +
    'encryption so the SLINK Contribution Service can use it for allowlisted ' +
    'public Torn requests while your devices are offline. The key remains ' +
    'active until revoked or replaced. Product modules never receive the ' +
    'plaintext key. SLINK retains your Torn user ID, encrypted key material, ' +
    'consent record, validation and usage timestamps, and bounded contribution ' +
    'job records.';

const ENCRYPTION_VERSION = 1;
const MAX_JSON_BODY_BYTES = 32 * 1024;
const MAX_JOB_RESULT_BYTES = 128 * 1024;
const MAX_SCHEDULED_JOBS = 10;
const MAX_JOB_ATTEMPTS = 5;
const JOB_RETRY_MS = 5 * 60 * 1000;
const textEncoder = new TextEncoder();


const worker = {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders() });
        }

        const url = new URL(request.url);

        if (url.pathname === '/' && request.method === 'GET') {
            return jsonResponse({
                ok: true,
                service: 'SLINK Contribution Service',
                version: WORKER_VERSION
            });
        }

        if (url.pathname === '/api/health' && request.method === 'GET') {
            return handleHealth(env);
        }

        if (url.pathname === '/api/terms' && request.method === 'GET') {
            return handleTerms();
        }

        if (url.pathname === '/api/donations' && request.method === 'POST') {
            return handleDonation(request, env);
        }

        if (url.pathname === '/api/donations' && request.method === 'GET') {
            return handleDonationStatus(request, env);
        }

        if (url.pathname === '/api/donations' && request.method === 'DELETE') {
            return handleDonationRevocation(request, env);
        }

        if (url.pathname === '/api/internal/jobs' && request.method === 'POST') {
            return handleCreateJob(request, env);
        }

        if (
            url.pathname.startsWith('/api/internal/jobs/') &&
            request.method === 'GET'
        ) {
            return handleGetJob(request, env, url.pathname.slice(19));
        }

        return jsonResponse({ ok: false, error: 'Not found' }, 404);
    },

    async scheduled(controller, env) {
        const result = await runScheduledJobs(env, controller.scheduledTime);
        console.log(JSON.stringify({
            event: 'slink_contribution_schedule',
            version: WORKER_VERSION,
            scheduled_at: controller.scheduledTime,
            ...result
        }));
    }
};

export default worker;


async function handleHealth(env) {
    if (!env.PERMISSIONS_DB) {
        return jsonResponse({
            ok: false,
            version: WORKER_VERSION,
            database: 'not_configured',
            error: 'The PERMISSIONS_DB binding is required.'
        }, 500);
    }

    try {
        const [activeKeys, queuedJobs] = await Promise.all([
            env.PERMISSIONS_DB
                .prepare(`
                    SELECT COUNT(*) AS count
                    FROM donated_api_keys
                    WHERE status = 'active'
                `)
                .first(),
            env.PERMISSIONS_DB
                .prepare(`
                    SELECT COUNT(*) AS count
                    FROM contribution_jobs
                    WHERE status = 'queued'
                `)
                .first()
        ]);

        return jsonResponse({
            ok: true,
            version: WORKER_VERSION,
            database: 'connected',
            encryption_secret: env.API_KEY_ENCRYPTION_KEY
                ? 'configured'
                : 'not_configured',
            service_token: env.CONTRIBUTION_SERVICE_TOKEN
                ? 'configured'
                : 'not_configured',
            active_donations: Number(activeKeys?.count) || 0,
            queued_jobs: Number(queuedJobs?.count) || 0
        });
    } catch (error) {
        return jsonResponse({
            ok: false,
            version: WORKER_VERSION,
            database: 'error',
            error: errorMessage(error)
        }, 500);
    }
}


function handleTerms() {
    return jsonResponse({
        ok: true,
        acceptance_required: true,
        version: TERMS_VERSION,
        effective_at: TERMS_EFFECTIVE_AT,
        document_url: TERMS_URL,
        document_sha256: TERMS_DOCUMENT_SHA256,
        disclosure_version: DISCLOSURE_VERSION,
        disclosure_sha256: DISCLOSURE_SHA256,
        summary: TERMS_SUMMARY
    });
}


async function handleDonation(request, env) {
    try {
        requireDonationConfiguration(env);
        const body = await readJsonBody(request);

        if (
            body?.terms_accepted !== true ||
            body?.terms_version !== TERMS_VERSION ||
            body?.terms_sha256 !== TERMS_DOCUMENT_SHA256 ||
            body?.disclosure_version !== DISCLOSURE_VERSION ||
            body?.disclosure_sha256 !== DISCLOSURE_SHA256
        ) {
            return jsonResponse({
                ok: false,
                error: 'Accept the current SLINK API Key Donation Terms.',
                terms_required: true,
                terms_version: TERMS_VERSION,
                terms_url: TERMS_URL
            }, 428);
        }

        const apiKey = String(body?.api_key || '').trim();
        if (!apiKey || apiKey.length > 256) {
            return jsonResponse({
                ok: false,
                error: 'A valid Torn Public Only API key is required.'
            }, 400);
        }

        const identity = await validatePublicOnlyTornKey(apiKey);
        const acceptedAt = Date.now();
        const encrypted = await encryptApiKey(
            apiKey,
            identity.userId,
            env.API_KEY_ENCRYPTION_KEY
        );
        const managementToken = randomToken();
        const managementTokenHash = await sha256Hex(managementToken);

        await env.PERMISSIONS_DB
            .prepare(`
                INSERT INTO donated_api_keys (
                    user_id,
                    encrypted_key,
                    encryption_iv,
                    encryption_version,
                    management_token_sha256,
                    access_type,
                    status,
                    terms_version,
                    terms_sha256,
                    terms_accepted_at,
                    created_at,
                    updated_at,
                    last_validated_at,
                    last_used_at,
                    failure_count,
                    last_error
                )
                VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?8, ?9,
                    ?9, ?9, ?9, NULL, 0, NULL
                )
                ON CONFLICT(user_id) DO UPDATE SET
                    encrypted_key = excluded.encrypted_key,
                    encryption_iv = excluded.encryption_iv,
                    encryption_version = excluded.encryption_version,
                    management_token_sha256 = excluded.management_token_sha256,
                    access_type = excluded.access_type,
                    status = 'active',
                    terms_version = excluded.terms_version,
                    terms_sha256 = excluded.terms_sha256,
                    terms_accepted_at = excluded.terms_accepted_at,
                    updated_at = excluded.updated_at,
                    last_validated_at = excluded.last_validated_at,
                    failure_count = 0,
                    last_error = NULL
            `)
            .bind(
                identity.userId,
                encrypted.ciphertext,
                encrypted.iv,
                ENCRYPTION_VERSION,
                managementTokenHash,
                identity.accessType,
                TERMS_VERSION,
                TERMS_DOCUMENT_SHA256,
                acceptedAt
            )
            .run();

        return jsonResponse({
            ok: true,
            donated: true,
            user_id: identity.userId,
            access_type: identity.accessType,
            status: 'active',
            terms_version: TERMS_VERSION,
            donated_at: new Date(acceptedAt).toISOString(),
            management_token: managementToken
        });
    } catch (error) {
        return requestErrorResponse(error);
    }
}


async function handleDonationStatus(request, env) {
    try {
        requireDatabase(env);
        const donation = await authenticatedDonation(request, env);
        if (!donation) return managementAuthenticationRequired();
        return jsonResponse({ ok: true, donation: publicDonation(donation) });
    } catch (error) {
        return requestErrorResponse(error);
    }
}


async function handleDonationRevocation(request, env) {
    try {
        requireDatabase(env);
        const donation = await authenticatedDonation(request, env);
        if (!donation) return managementAuthenticationRequired();
        const now = Date.now();

        await env.PERMISSIONS_DB
            .prepare(`
                UPDATE donated_api_keys
                SET encrypted_key = NULL,
                    encryption_iv = NULL,
                    status = 'revoked',
                    updated_at = ?2,
                    last_error = 'Revoked by donor'
                WHERE user_id = ?1
            `)
            .bind(donation.user_id, now)
            .run();

        return jsonResponse({
            ok: true,
            revoked: true,
            user_id: Number(donation.user_id),
            revoked_at: new Date(now).toISOString()
        });
    } catch (error) {
        return requestErrorResponse(error);
    }
}


async function handleCreateJob(request, env) {
    try {
        if (!await isServiceRequest(request, env)) {
            return serviceAuthenticationRequired();
        }
        requireDatabase(env);
        const body = await readJsonBody(request);
        const job = validateJob(body);
        const now = Date.now();
        const id = crypto.randomUUID();

        await env.PERMISSIONS_DB
            .prepare(`
                INSERT INTO contribution_jobs (
                    id, kind, payload_json, requested_by, status,
                    available_at, attempts, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, 'queued', ?5, 0, ?5, ?5)
            `)
            .bind(
                id,
                job.kind,
                JSON.stringify(job.payload),
                job.requestedBy,
                now
            )
            .run();

        return jsonResponse({ ok: true, accepted: true, job_id: id }, 202);
    } catch (error) {
        return requestErrorResponse(error);
    }
}


async function handleGetJob(request, env, jobId) {
    try {
        if (!await isServiceRequest(request, env)) {
            return serviceAuthenticationRequired();
        }
        requireDatabase(env);
        const id = String(jobId || '').trim();
        if (!id) throw new RequestValidationError('A contribution job ID is required.');
        const row = await env.PERMISSIONS_DB
            .prepare(`
                SELECT
                    id, kind, requested_by, status, available_at, claimed_at,
                    completed_at, attempts, donor_user_id, result_json, error,
                    created_at, updated_at
                FROM contribution_jobs
                WHERE id = ?1
            `)
            .bind(id)
            .first();
        if (!row) return jsonResponse({ ok: false, error: 'Job not found.' }, 404);
        return jsonResponse({
            ok: true,
            job: {
                ...row,
                result: safeJsonParse(row.result_json),
                result_json: undefined
            }
        });
    } catch (error) {
        return requestErrorResponse(error);
    }
}


async function runScheduledJobs(env, scheduledAt = Date.now()) {
    requireDonationConfiguration(env);
    const jobs = await env.PERMISSIONS_DB
        .prepare(`
            SELECT id, kind, payload_json, requested_by, attempts
            FROM contribution_jobs
            WHERE status = 'queued'
              AND available_at <= ?1
              AND attempts < ?2
            ORDER BY created_at ASC
            LIMIT ?3
        `)
        .bind(scheduledAt, MAX_JOB_ATTEMPTS, MAX_SCHEDULED_JOBS)
        .all();
    let completed = 0;
    let retried = 0;
    let failed = 0;
    let skipped = 0;

    for (const job of jobs.results || []) {
        const outcome = await executeContributionJob(env, job, scheduledAt);
        if (outcome === 'completed') completed++;
        else if (outcome === 'retried') retried++;
        else if (outcome === 'failed') failed++;
        else skipped++;
    }

    return {
        selected: jobs.results?.length || 0,
        completed,
        retried,
        failed,
        skipped
    };
}


async function executeContributionJob(env, job, now) {
    const claim = await env.PERMISSIONS_DB
        .prepare(`
            UPDATE contribution_jobs
            SET status = 'running',
                claimed_at = ?2,
                attempts = attempts + 1,
                updated_at = ?2
            WHERE id = ?1
              AND status = 'queued'
        `)
        .bind(job.id, now)
        .run();
    if (!Number(claim.meta?.changes)) return 'skipped';

    const donor = await env.PERMISSIONS_DB
        .prepare(`
            SELECT *
            FROM donated_api_keys
            WHERE status = 'active'
              AND encrypted_key IS NOT NULL
              AND encryption_iv IS NOT NULL
            ORDER BY COALESCE(last_used_at, 0) ASC, failure_count ASC, user_id ASC
            LIMIT 1
        `)
        .first();

    if (!donor) {
        const attempts = Number(job.attempts) + 1;
        await retryOrFailJob(env, job.id, attempts, now, 'No active donated API key is available.');
        return attempts >= MAX_JOB_ATTEMPTS ? 'failed' : 'retried';
    }

    try {
        const apiKey = await decryptApiKey(
            donor.encrypted_key,
            donor.encryption_iv,
            donor.user_id,
            env.API_KEY_ENCRYPTION_KEY
        );
        const result = await performAllowlistedJob(job, apiKey);
        const encodedResult = JSON.stringify(result);
        if (textEncoder.encode(encodedResult).byteLength > MAX_JOB_RESULT_BYTES) {
            throw new Error('The contribution job result exceeded the storage limit.');
        }

        await env.PERMISSIONS_DB.batch([
            env.PERMISSIONS_DB
                .prepare(`
                    UPDATE contribution_jobs
                    SET status = 'completed',
                        completed_at = ?2,
                        donor_user_id = ?3,
                        result_json = ?4,
                        error = NULL,
                        updated_at = ?2
                    WHERE id = ?1
                `)
                .bind(job.id, now, donor.user_id, encodedResult),
            env.PERMISSIONS_DB
                .prepare(`
                    UPDATE donated_api_keys
                    SET last_used_at = ?2,
                        last_validated_at = ?2,
                        failure_count = 0,
                        last_error = NULL,
                        updated_at = ?2
                    WHERE user_id = ?1
                `)
                .bind(donor.user_id, now)
        ]);
        return 'completed';
    } catch (error) {
        const message = errorMessage(error).slice(0, 300);
        const authenticationFailure = error?.code === 'TORN_KEY_INVALID';

        await env.PERMISSIONS_DB
            .prepare(`
                UPDATE donated_api_keys
                SET status = CASE WHEN ?3 = 1 THEN 'invalid' ELSE status END,
                    encrypted_key = CASE WHEN ?3 = 1 THEN NULL ELSE encrypted_key END,
                    encryption_iv = CASE WHEN ?3 = 1 THEN NULL ELSE encryption_iv END,
                    failure_count = failure_count + 1,
                    last_error = ?2,
                    updated_at = ?4
                WHERE user_id = ?1
            `)
            .bind(donor.user_id, message, authenticationFailure ? 1 : 0, now)
            .run();
        const attempts = Number(job.attempts) + 1;
        await retryOrFailJob(env, job.id, attempts, now, message);
        return attempts >= MAX_JOB_ATTEMPTS ? 'failed' : 'retried';
    }
}


async function retryOrFailJob(env, jobId, attempts, now, message) {
    const terminal = attempts >= MAX_JOB_ATTEMPTS;
    await env.PERMISSIONS_DB
        .prepare(`
            UPDATE contribution_jobs
            SET status = ?2,
                available_at = ?3,
                completed_at = CASE WHEN ?2 = 'failed' THEN ?4 ELSE NULL END,
                error = ?5,
                updated_at = ?4
            WHERE id = ?1
        `)
        .bind(
            jobId,
            terminal ? 'failed' : 'queued',
            now + JOB_RETRY_MS,
            now,
            message
        )
        .run();
}


async function performAllowlistedJob(job, apiKey) {
    const payload = safeJsonParse(job.payload_json) || {};
    if (job.kind !== 'torn.user.basic') {
        throw new RequestValidationError(`Unsupported contribution job: ${job.kind}`);
    }
    const targetId = positiveInteger(payload.target_id);
    if (!targetId) throw new RequestValidationError('A valid target_id is required.');

    const response = await fetch(
        `https://api.torn.com/v2/user/${encodeURIComponent(targetId)}/basic`,
        {
            method: 'GET',
            headers: {
                'Authorization': `ApiKey ${apiKey}`,
                'Accept': 'application/json',
                'User-Agent': 'SLINK-Contribution-Service'
            }
        }
    );
    const data = await response.json();

    if (!response.ok || data?.error) {
        const error = new Error('Torn rejected the donated API key or request.');
        if (response.status === 401 || response.status === 403 || data?.error?.code === 2) {
            error.code = 'TORN_KEY_INVALID';
        }
        throw error;
    }
    return data;
}


async function validatePublicOnlyTornKey(apiKey) {
    const response = await fetch('https://api.torn.com/v2/key/info', {
        method: 'GET',
        headers: {
            'Authorization': `ApiKey ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'SLINK-Contribution-Service'
        }
    });
    const data = await response.json();
    if (!response.ok || data?.error) {
        const error = new RequestValidationError('Torn could not validate this API key.');
        error.status = 401;
        throw error;
    }

    const userId = Number(data?.info?.user?.id);
    const accessType = String(data?.info?.access?.type || '').trim();
    const accessLevel = Number(data?.info?.access?.level);
    const publicOnly = accessType.toLowerCase() === 'public only' || accessLevel === 1;

    if (!Number.isInteger(userId) || userId <= 0) {
        throw new RequestValidationError('Torn did not return a valid user identity.');
    }
    if (!publicOnly) {
        throw new RequestValidationError(
            'Only Torn API keys with Public Only access may be donated.'
        );
    }
    return { userId, accessType: accessType || 'Public Only' };
}


async function authenticatedDonation(request, env) {
    const token = bearerToken(request);
    if (!token) return null;
    const tokenHash = await sha256Hex(token);
    return env.PERMISSIONS_DB
        .prepare(`
            SELECT
                user_id, access_type, status, terms_version,
                terms_accepted_at, created_at, updated_at,
                last_validated_at, last_used_at, failure_count, last_error
            FROM donated_api_keys
            WHERE management_token_sha256 = ?1
        `)
        .bind(tokenHash)
        .first();
}


function publicDonation(row) {
    return {
        user_id: Number(row.user_id),
        access_type: row.access_type,
        status: row.status,
        active: row.status === 'active',
        terms_version: row.terms_version,
        terms_accepted_at: Number(row.terms_accepted_at) || 0,
        created_at: Number(row.created_at) || 0,
        updated_at: Number(row.updated_at) || 0,
        last_validated_at: Number(row.last_validated_at) || 0,
        last_used_at: Number(row.last_used_at) || 0,
        failure_count: Number(row.failure_count) || 0,
        last_error: row.last_error || ''
    };
}


function validateJob(body) {
    const kind = String(body?.kind || '').trim();
    if (kind !== 'torn.user.basic') {
        throw new RequestValidationError('Unsupported contribution job kind.');
    }
    const targetId = positiveInteger(body?.payload?.target_id);
    if (!targetId) throw new RequestValidationError('A valid target_id is required.');
    const requestedBy = String(body?.requested_by || '').trim().slice(0, 100);
    if (!requestedBy) throw new RequestValidationError('requested_by is required.');
    return { kind, payload: { target_id: targetId }, requestedBy };
}


async function encryptApiKey(apiKey, userId, secret) {
    const key = await importEncryptionKey(secret, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv,
            additionalData: encryptionContext(userId)
        },
        key,
        textEncoder.encode(apiKey)
    );
    return {
        ciphertext: base64UrlEncode(new Uint8Array(ciphertext)),
        iv: base64UrlEncode(iv)
    };
}


async function decryptApiKey(ciphertext, iv, userId, secret) {
    const key = await importEncryptionKey(secret, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: base64UrlDecode(iv),
            additionalData: encryptionContext(userId)
        },
        key,
        base64UrlDecode(ciphertext)
    );
    return new TextDecoder().decode(plaintext);
}


function encryptionContext(userId) {
    return textEncoder.encode(`slink-donated-key:v${ENCRYPTION_VERSION}:${userId}`);
}


function importEncryptionKey(secret, usages) {
    const bytes = base64UrlDecode(String(secret || '').trim());
    if (bytes.byteLength !== 32) {
        throw new Error('API_KEY_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    }
    return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, usages);
}


function randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}


async function isServiceRequest(request, env) {
    const supplied = request.headers.get('X-SLINK-Service-Token');
    if (!supplied || !env.CONTRIBUTION_SERVICE_TOKEN) return false;
    const [left, right] = await Promise.all([
        crypto.subtle.digest('SHA-256', textEncoder.encode(supplied)),
        crypto.subtle.digest('SHA-256', textEncoder.encode(env.CONTRIBUTION_SERVICE_TOKEN))
    ]);
    return timingSafeEqual(new Uint8Array(left), new Uint8Array(right));
}


function timingSafeEqual(left, right) {
    if (typeof crypto.subtle.timingSafeEqual === 'function') {
        return crypto.subtle.timingSafeEqual(left, right);
    }
    if (left.byteLength !== right.byteLength) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index++) {
        difference |= left[index] ^ right[index];
    }
    return difference === 0;
}


async function sha256Hex(value) {
    const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}


function bearerToken(request) {
    const authorization = request.headers.get('Authorization') || '';
    return authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : '';
}


async function readJsonBody(request) {
    const length = Number(request.headers.get('Content-Length'));
    if (Number.isFinite(length) && length > MAX_JSON_BODY_BYTES) {
        throw new RequestValidationError('Request body is too large.');
    }
    const text = await request.text();
    if (textEncoder.encode(text).byteLength > MAX_JSON_BODY_BYTES) {
        throw new RequestValidationError('Request body is too large.');
    }
    try {
        return JSON.parse(text || '{}');
    } catch {
        throw new RequestValidationError('Request body must be valid JSON.');
    }
}


function requireDatabase(env) {
    if (!env.PERMISSIONS_DB) throw new Error('Permission storage is not configured.');
}


function requireDonationConfiguration(env) {
    requireDatabase(env);
    if (!env.API_KEY_ENCRYPTION_KEY) {
        throw new Error('API key encryption is not configured.');
    }
}


function positiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}


function safeJsonParse(value) {
    if (!value) return null;
    try { return JSON.parse(value); } catch { return null; }
}


function base64UrlEncode(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}


function base64UrlDecode(value) {
    const normalized = String(value || '')
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '='
    );
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}


function managementAuthenticationRequired() {
    return jsonResponse({
        ok: false,
        error: 'A valid donation management token is required.'
    }, 401);
}


function serviceAuthenticationRequired() {
    return jsonResponse({ ok: false, error: 'Unauthorized service request.' }, 401);
}


function requestErrorResponse(error) {
    const status = Number(error?.status) ||
        (error instanceof RequestValidationError ? 400 : 500);
    if (status >= 500) {
        console.error(JSON.stringify({
            event: 'slink_contribution_error',
            error: errorMessage(error)
        }));
    }
    return jsonResponse({ ok: false, error: errorMessage(error) }, status);
}


function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-SLINK-Service-Token',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Expose-Headers': 'X-SLINK-Contribution-Version',
        'X-SLINK-Contribution-Version': WORKER_VERSION
    };
}


function jsonResponse(data, status = 200) {
    return Response.json(data, { status, headers: corsHeaders() });
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
    decryptApiKey,
    encryptApiKey,
    runScheduledJobs,
    sha256Hex,
    validatePublicOnlyTornKey
};
