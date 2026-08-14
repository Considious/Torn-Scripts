# Slinky Leveling Cloudflare Worker

This directory versions the authoritative source for the Slinky Leveling API
Worker. It intentionally contains no deployment credentials or member API keys.

## Release identification

Every deployable source change must update `WORKER_VERSION` near the top of
`worker.js`. The version uses a readable `major.minor.patch-name` format, such
as `0.3.0-thin-client-api`.

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

## Deploying 0.3.0

The existing four-table database remains the source of target, status,
hospitalization, and scheduler data. Before deploying `worker.js`, run the
complete contents of:

```text
migrations/0001-client-coordination.sql
```

in the D1 Console. It adds the short-lived check claims, per-member target
leases, activity exclusions, and shared Fair Fight cache used by the thin
client. The migration uses `CREATE TABLE/INDEX IF NOT EXISTS`; rerunning the
whole file is safe.

Deploy the Worker only after the migration succeeds. Update the userscript
after the new endpoints respond successfully.

## Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Worker identity check |
| `GET` | `/api/health` | Public | D1 connectivity and table counts |
| `POST` | `/api/auth` | Public | Verify a Torn key once and issue a session |
| `GET` | `/api/session` | Member session | Inspect the current signed session |
| `GET` | `/api/targets` | Member session | Read paginated leveling targets |
| `GET` | `/api/recommendations` | Member session | Receive a leased, member-specific target list |
| `POST` | `/api/checks/claim` | Member session | Claim globally coordinated Torn status checks |
| `POST` | `/api/observations` | Member session | Submit a bounded batch of status observations |
| `POST` | `/api/activity` | Member session | Share recent activity-snapshot matches |
| `POST` | `/api/fair-fight` | Member session | Share bounded FFScouter results |
| `POST` | `/api/admin/bootstrap-targets` | Admin token | Refresh targets from the master CSV |
| `GET` | `/api/admin/targets` | Admin token | Inspect paginated leveling targets |

Member routes require `Authorization: Bearer <session token>`. Admin routes
require `X-Admin-Token: <admin token>`.

Both target-list routes accept `limit` (default `50`, maximum `200`) and
`offset` (default `0`) query parameters.

`/api/recommendations` accepts `limit` (maximum `40`), `min_ff`, and `max_ff`.
The Worker leases returned targets for ten minutes so simultaneously active
members normally receive different target sets. `/api/checks/claim` accepts a
JSON `limit` from `0` through `80`; a claim expires after three minutes if its
client does not report a result.

Ordinary member Torn and FFScouter keys are not stored in D1. The Torn key is
sent to `/api/auth` only for faction verification, then remains in userscript
storage for client-side Torn requests. Clients submit only derived observations
to the Worker.

## Test

With Node.js available, run:

```text
npm test
```

The test suite uses only Node's built-in test runner. It covers the existing
health/admin/auth/session behavior, the protected member target route, session
expiry and tampering, CSV parsing, pagination bounds, and CORS preflight.
