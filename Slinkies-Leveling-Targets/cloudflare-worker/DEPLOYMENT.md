# Cloudflare deployment checklist

Use this order. Do not install userscript `0.8.0` until the health check in step
3 reports Worker `0.5.0-user-fair-fight`.

## 1. Add the D1 coordination tables

Open the existing Slinky D1 database in Cloudflare, select **Console**, and run
the complete contents of:

```text
migrations/0001-client-coordination.sql
```

The script is safe to run again if Cloudflare or the browser interrupts the
first attempt.

Next, run the complete contents of:

```text
migrations/0002-user-collector-leases.sql
```

Then run the complete contents of:

```text
migrations/0003-user-fair-fight-cache.sql
```

All three files are safe to run again. Migration 0003 adds the per-user Fair
Fight cache required by Worker 0.5.x. Run it before changing the Worker source.

Verify the new tables with:

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name IN (
    'client_check_claims',
    'client_target_leases',
    'client_user_collectors',
    'target_activity',
    'target_fair_fight',
    'user_target_fair_fight'
  )
ORDER BY name;
```

Cloudflare should return six rows.

## 2. Deploy the Worker source

Open the `slinkyleveling` Worker, choose **Edit code**, replace the Worker source
with the complete repository `worker.js`, and deploy it. Keep the existing `DB`
binding, `ADMIN_TOKEN`, and `SESSION_SECRET` unchanged.

The new release is:

```text
0.5.0-user-fair-fight
```

## 3. Smoke-test the protected API

First open:

```text
GET https://slinkyleveling.richard-johnson554.workers.dev/api/health
```

The JSON should contain:

```json
{
  "ok": true,
  "version": "0.5.0-user-fair-fight",
  "database": "connected"
}
```

No manual session-token tests are required. Install userscript `0.8.0`, reload
Torn, and click **Refresh**. The panel itself should show this progression:

```text
Asking the SLINK Network for targets…
Checking Fair Fight for 40 targets…
40 Fair Fight records reported to SLINK…
Running scheduled Torn checks…
```

The **FF ready** counter and the timestamp in **Data** confirm the values were
written to the authenticated user's D1 cache and read back by the panel.
