# SLINK Leveling Service Cloudflare Worker

SLINK means **Shared Live Intelligence NetworK**. This directory contains the
versioned source for the SLINK Leveling Service API Worker. It contains no
deployment credentials or member API keys.

## Release identification

Every deployable source change updates `WORKER_VERSION` near the top of
`worker.js`. The root route, health route, and every response header expose that
version. Release 0.5.2 is identified as `0.5.2-assigned-targets-last`.

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
standby. The normal client interval defaults to 300 seconds and remains
configurable from 60 to 300 seconds.

The collector lease is twice the calling client's configured interval. At the
300-second default, another device can take over after roughly two missed loads,
or ten minutes. At a 90-second interval, failover takes roughly three minutes.
Expired rows are replaced or cleaned up by the next request. They do not run
background work while every device is offline.

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

The client gets its live Torn API capacity from Considious Torn Core Lib. A
five-minute interval lets that shared allowance refill, so the collector can
receive a larger batch of scheduled checks in each exchange. The Worker's batch
ceilings protect request payloads; they are not polling limits.

Targets currently assigned in a member recommendation list sort behind
unassigned targets when the Worker creates scheduled Torn API check batches.
Opening an assigned target through the panel starts the userscript in that attack
tab; visible status and hospital time are submitted as an attack-page observation
and enter the same server-side scheduling routine. Assigned targets remain a
fallback for API checks if no unassigned due work is available.

## Migrations

Migrations 0001 and 0002 create the shared coordination tables. Migration 0003
only removes the unused experimental `user_target_fair_fight` table if it was
manually created while 0.5.0 was being developed. It is safe when the table does
not exist.

## Test

Run `npm test` in this directory. The test suite uses Node's built-in test
runner and covers auth/session protection, coordination, scheduling, activity,
local-only Fair Fight boundaries, collector failover, parsing, and CORS.
