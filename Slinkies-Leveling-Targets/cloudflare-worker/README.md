# Slinky Leveling Cloudflare Worker

This directory versions the authoritative source for the Slinky Leveling API
Worker. It intentionally contains no deployment credentials or member API keys.

## Release identification

Every deployable source change must update `WORKER_VERSION` near the top of
`worker.js`. The version uses a readable `major.minor.patch-name` format, such
as `0.2.0-member-targets`.

The active version appears in three places:

- the comment and `WORKER_VERSION` constant at the top of `worker.js`;
- the JSON returned by `/` and `/api/health`;
- the `X-Slinky-Worker-Version` header on every Worker response.

This makes it possible to identify the code serving a request without comparing
Cloudflare's deployment IDs. Increment the patch number for fixes, the minor
number for compatible features, and the major number for breaking API changes.

## Cloudflare configuration

The Worker expects these Cloudflare resources:

- `DB`: D1 binding containing `targets`, `target_status`, `hospital_events`, and
  `scheduler_queue` tables.
- `ADMIN_TOKEN`: secret used by the two `/api/admin/*` endpoints.
- `SESSION_SECRET`: secret used to sign individual 12-hour member sessions.

Keep both secret values in Cloudflare. Do not add them to this repository.

## Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Worker identity check |
| `GET` | `/api/health` | Public | D1 connectivity and table counts |
| `POST` | `/api/auth` | Public | Verify a Torn key once and issue a session |
| `GET` | `/api/session` | Member session | Inspect the current signed session |
| `GET` | `/api/targets` | Member session | Read paginated leveling targets |
| `POST` | `/api/admin/bootstrap-targets` | Admin token | Refresh targets from the master CSV |
| `GET` | `/api/admin/targets` | Admin token | Inspect paginated leveling targets |

Member routes require `Authorization: Bearer <session token>`. Admin routes
require `X-Admin-Token: <admin token>`.

Both target-list routes accept `limit` (default `50`, maximum `200`) and
`offset` (default `0`) query parameters.

## Test

With Node.js available, run:

```text
npm test
```

The test suite uses only Node's built-in test runner. It covers the existing
health/admin/auth/session behavior, the protected member target route, session
expiry and tampering, CSV parsing, pagination bounds, and CORS preflight.
