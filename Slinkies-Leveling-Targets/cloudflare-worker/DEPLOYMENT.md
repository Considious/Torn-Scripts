# Cloudflare deployment checklist

Use this order. Install userscript 0.11.0 only after the health check reports
Worker `0.8.0-versioned-terms-consent` and a connected consent database.

## 1. Create the separate consent database

In Cloudflare, open **Storage & Databases**, choose **D1 SQL database**, and
create a database named `slink-consent-ledger`.

Open that new database's console. Copy and execute the complete contents of
`consent-database/0001-terms-acceptances.sql`. This creates only the permanent
`terms_acceptances` ledger, its indexes, and append-only protection triggers.
Do not run it against the existing target database.

The existing target-database migrations remain unchanged.

## 2. Add the Worker binding

Open the `slinkyleveling` Worker's settings and add a D1 database binding:

```text
Variable name: CONSENT_DB
Database: slink-consent-ledger
```

Keep the existing `DB`, `ADMIN_TOKEN`, and `SESSION_SECRET` configuration.

## 3. Deploy the Worker

Open the `slinkyleveling` Worker, choose **Edit code**, replace the source with
the complete repository `worker.js`, and deploy it. Keep all four existing
bindings and secrets unchanged.

## 4. Check the version and consent database

Open:

```text
https://slinkyleveling.richard-johnson554.workers.dev/api/health?release=0.8.0
```

The JSON should include:

```json
{
  "ok": true,
  "version": "0.8.0-versioned-terms-consent",
  "database": "connected",
  "consent_database": "connected",
  "terms": {
    "version": "2026-08-14",
    "effective_at": "2026-08-14"
  }
}
```

Also open:

```text
https://slinkyleveling.richard-johnson554.workers.dev/api/terms
```

It should return version `2026-08-14`, the terms link, document fingerprint,
and the Leveling-specific summary.

## 5. Update Tampermonkey

Install or update userscript 0.11.0 and reload Torn. Existing sessions from
earlier releases intentionally stop working. The panel opens Settings and will
not contact the authentication endpoint until the member checks the agreement
box for terms version `2026-08-14`.

The panel displays a concise Leveling-specific disclosure and links to the full
versioned terms in GitHub. After the member agrees and saves, the Worker records
the acceptance, verifies membership, and issues the normal 12-hour session.
Targets then appear as usual. On the first run of each day the client makes one
Core Lib-controlled Torn request for the member's battle stats.

The panel should progress through messages like:

```text
Reading your locally cached strength range...
Asking the SLINK Network for targets...
Refining 40 Fair Fight estimates in the background...
Running 120 scheduled Torn checks across 5 minutes...
```

Approximate values carry a tilde, such as `FF ~2.15`, and are usable
immediately. FFScouter refinement does not block scheduled Torn work. The
browser reuses each refined Fair Fight result for seven days and never sends
those values to Cloudflare.

Source labels never affect assignment. The Worker selects inside the member's
temporary target-stat range using competition, target usefulness, estimated
stats, and global lease availability. Exact member battle stats stay in
Tampermonkey; the Worker receives only the derived range for the current
recommendation request and does not store it.

There is no separate collector heartbeat or redundant second target refresh.
The default interval is 300 seconds. The Worker divides every currently due
check by the number of active Torn user collectors. Multiple devices for one
Torn account count once, and checks are paced across the interval through Core
Lib. Reports are uploaded in batches of up to 200.

The collector lease covers two configured intervals. With the 300-second
default, a second device can take over after roughly ten minutes without data
from the active device. Unfinished check claims expire after seven minutes.

## 6. Confirm an acceptance

After accepting once, open the `slink-consent-ledger` D1 console and run:

```sql
SELECT
    id,
    user_id,
    faction_id,
    terms_version,
    document_sha256,
    service_id,
    disclosure_version,
    disclosure_sha256,
    datetime(accepted_at / 1000, 'unixepoch') AS accepted_utc,
    client_name,
    client_version,
    acceptance_method
FROM terms_acceptances
ORDER BY accepted_at DESC;
```

The member should have one row for terms version `2026-08-14` and Leveling
disclosure version `2026-08-14`. Re-authenticating does not overwrite or
duplicate it. When the overall terms or the tool-specific disclosure changes,
publish and bump the appropriate version; the member's later acceptance will
be a new row while this one remains intact.
