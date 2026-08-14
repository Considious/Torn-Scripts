# SLINK Leveling Service Cloudflare Worker

SLINK means **Shared Live Intelligence NetworK**. This directory contains the
versioned source for the SLINK Leveling Service API Worker. It contains no
deployment credentials or member API keys.

## Release identification

Every deployable source change updates `WORKER_VERSION` near the top of
`worker.js`. The root route, health route, and every response header expose that
version. Release 0.5.0 is identified as `0.5.0-efficient-coordination`.

## Cloudflare configuration

The Worker expects:

- `DB`: the existing D1 database;
- `ADMIN_TOKEN`: the secret protecting `/api/admin/*`;
- `SESSION_SECRET`: the secret signing individual 12-hour member sessions.

Keep both secrets in Cloudflare and out of this repository.

## Data ownership

D1 stores shared service facts: targets, status observations, hospital events,
scheduling, activity exclusions, target leases, check claims, and per-user
collector leases.

Fair Fight is not a shared service fact. The userscript requests it directly
from FFScouter and stores it in Tampermonkey/browser storage for seven days.
Fair Fight values are not uploaded to the Worker and are not used by D1 target
selection. The panel applies each member's minimum and maximum Fair Fight
settings locally.

The old authenticated `POST /api/fair-fight` route remains temporarily as a
no-op for compatibility with an older client. It does not write anything.

## Multi-device coordination

`GET /api/recommendations` elects or renews the active collector while returning
the target list. This avoids a separate heartbeat request. One signed session
per Torn user receives routine Torn API work, while other sessions remain
standby. The collector lease lasts six minutes, which covers the maximum
five-minute client polling interval with failover slack.

Recommendation leases are keyed by Torn user ID, so a user's PC and mobile
sessions see the same target set. Collector ownership is keyed by signed session
ID, allowing another device to take over after the lease expires.

## Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Worker identity check |
| `GET` | `/api/health` | Public | D1 connectivity and table counts |
| `POST` | `/api/auth` | Public | Verify a Torn key once and issue a session |
| `GET` | `/api/session` | Member session | Inspect the signed session |
| `GET` | `/api/targets` | Member session | Read paginated leveling targets |
| `GET` | `/api/recommendations` | Member session | Return targets and renew collector coordination |
| `POST` | `/api/collector/heartbeat` | Member session | Backward-compatible manual collector renewal |
| `POST` | `/api/checks/claim` | Member session | Claim coordinated Torn status checks |
| `POST` | `/api/observations` | Member session | Submit status observations |
| `POST` | `/api/activity` | Member session | Share activity-snapshot matches |
| `POST` | `/api/fair-fight` | Member session | Deprecated no-op; Fair Fight stays local |
| `POST` | `/api/admin/bootstrap-targets` | Admin token | Refresh targets from the master CSV |
| `GET` | `/api/admin/targets` | Admin token | Inspect paginated targets |

Member routes use `Authorization: Bearer <session token>`. Admin routes use
`X-Admin-Token: <admin token>`.

The client gets its live Torn API capacity from Considious Torn Core Lib. The
Worker's batch ceilings protect request payloads; they are not polling limits.

## Migrations

Migrations 0001 and 0002 create the shared coordination tables. Migration 0003
only removes the unused experimental `user_target_fair_fight` table if it was
manually created while 0.5.0 was being developed. It is safe when the table does
not exist.

## Test

Run `npm test` in this directory. The test suite uses Node's built-in test
runner and covers auth/session protection, coordination, scheduling, activity,
local-only Fair Fight boundaries, collector failover, parsing, and CORS.
