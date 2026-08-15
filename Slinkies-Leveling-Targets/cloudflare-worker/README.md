# SLINK Leveling Service Cloudflare Worker

SLINK means **Shared Live Intelligence NetworK**. This directory contains the
versioned source for the SLINK Leveling Service API Worker. It contains no
deployment credentials or member API keys.

## Release identification

Every deployable source change updates `WORKER_VERSION` near the top of
`worker.js`. The root route, health route, and every response header expose that
version. Release 0.8.0 is identified as `0.8.0-versioned-terms-consent`.

## Cloudflare configuration

The Worker expects:

- `DB`: the existing D1 database;
- `CONSENT_DB`: the separate append-only SLINK terms acceptance database;
- `ADMIN_TOKEN`: the secret protecting `/api/admin/*`;
- `SESSION_SECRET`: the secret signing individual 12-hour member sessions.

Keep both secrets in Cloudflare and out of this repository.

## Required versioned consent

The full SLINK API & Data Terms are published in versioned folders under
[`../terms`](../terms/README.md). The August 14, 2026 release is consent version
`2026-08-14`. Its original Word document is preserved alongside an accessible
Markdown transcription.

Authentication fails closed unless the request explicitly accepts the current
version. The Worker performs this check before contacting Torn. After Torn
returns the member identity, the Worker writes one permanent acceptance row for
that Torn user, terms version, service, and disclosure version to `CONSENT_DB`;
only then does it issue the session. Re-authentication to the same versions uses
the existing row without overwriting its original timestamp. Future overall
terms or Leveling-disclosure versions create another row, and sessions carrying
older versions stop authenticating.

The ledger stores the Torn user and faction IDs, terms version, document URL and
SHA-256 fingerprint, service/disclosure identity and fingerprint, first
acceptance time, client identity/version, and the explicit-checkbox method. It
does not store the Torn API key, IP address, or browser user-agent. The Worker
has no update or deletion path for acceptance records, and database triggers
reject accidental updates or deletions.

## Data ownership

D1 stores shared service facts: targets, status observations, hospital events,
scheduling, activity exclusions, target leases, check claims, and per-user
collector leases.

Fair Fight is not a shared service fact. The userscript reads the member's own
battle stats from Torn once per day and stores only a local score and total in
Tampermonkey. It immediately estimates Fair Fight from that score and the
master target estimate. Exact member battle stats and Fair Fight values are not
uploaded or stored in D1.

The browser sends only a temporary minimum and maximum target-stat range with
the recommendation request. The Worker uses that range for assignment without
persisting it. FFScouter then refines displayed values in one background batch,
and those results remain in local browser storage for seven days.

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

Scheduled checks are shared by active Torn user, not by device. The Worker
counts all targets currently due, divides that total by the number of active
user collectors, and caps each plan by what that user's interval can safely
carry. PC and mobile sessions belonging to the same Torn user therefore consume
one share, with only the elected session doing the work. Unfinished claims
expire after the interval plus a two-minute grace period and return to the
shared pool.

Recommendation ranking is source-neutral. Baldr, Legacy, Extra, and every other
source label are metadata only and never boost or penalize a target. The
member's locally derived stat range removes obvious strength mismatches before
assignment. Inside that range, the Worker favors low competition, useful target
level, lower estimated target stats, and targets that are not already leased to
another member. This gives different members their own lists whenever the
available pool permits it.

## Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Worker identity check |
| `GET` | `/api/health` | Public | D1 connectivity and table counts |
| `GET` | `/api/terms` | Public | Current required terms, fingerprint, link, and Leveling disclosure |
| `POST` | `/api/auth` | Public | Record current consent, verify a Torn key once, and issue a version-bound session |
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

The client derives its interval capacity from Considious Torn Core Lib's shared
60-per-minute allowance. At the five-minute default it can accept up to 300
checks, but the Worker returns only that user's equal share of the work that is
actually due. The client spaces those checks across the interval and every Torn
request still passes through Core Lib, so other installed scripts remain part
of the same rate limit. Observation uploads use up to 200 rows per Worker
request to avoid unnecessary invocations.

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

The separate consent database uses
`consent-database/0001-terms-acceptances.sql`. Run that schema only against the
consent database, then bind it to the Worker as `CONSENT_DB`. It is intentionally
not numbered as a migration for the main target database.

## Test

Run `npm test` in this directory. The test suite uses Node's built-in test
runner and covers auth/session protection, coordination, scheduling, activity,
personal target-stat ranges, source-neutral ranking, unique target leasing,
local-only Fair Fight estimates, collector failover, fair check sharing,
interval pacing, fail-closed versioned consent, append-only acceptance records,
old-session invalidation, parsing, and CORS.
