# Cloudflare deployment checklist

Use this order. Do not merge or install userscript `0.6.1` before all three
checks at the bottom succeed.

## 1. Add the D1 coordination tables

Open the existing Slinky D1 database in Cloudflare, select **Console**, and run
the complete contents of:

```text
migrations/0001-client-coordination.sql
```

The script is safe to run again if Cloudflare or the browser interrupts the
first attempt.

Verify the new tables with:

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name IN (
    'client_check_claims',
    'client_target_leases',
    'target_activity',
    'target_fair_fight'
  )
ORDER BY name;
```

Cloudflare should return four rows.

## 2. Deploy the Worker source

Open the `slinkyleveling` Worker, choose **Edit code**, replace the Worker source
with the complete repository `worker.js`, and deploy it. Keep the existing `DB`
binding, `ADMIN_TOKEN`, and `SESSION_SECRET` unchanged.

The new release is:

```text
0.3.1-core-lib-limiter
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
  "version": "0.3.1-core-lib-limiter",
  "database": "connected"
}
```

Authenticate through `POST /api/auth` exactly as before. Then use the returned
session token for these two tests.

```text
POST /api/checks/claim
Authorization: Bearer YOUR_SESSION_TOKEN
Content-Type: application/json

{"capacity":1}
```

```text
GET /api/recommendations?limit=5&min_ff=1&max_ff=3
Authorization: Bearer YOUR_SESSION_TOKEN
```

Both responses should contain `"ok": true`. The check response may contain one
assigned check; the recommendation response should contain up to five targets.

Once those requests work, userscript `0.6.1` can be installed for a live test.
