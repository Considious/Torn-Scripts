# Cloudflare deployment checklist

Use this order. Do not merge or install userscript `0.7.2` before all three
checks at the bottom succeed.

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

This second file is also safe to run again. Run both migrations before changing
the Worker source.

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
    'target_fair_fight'
  )
ORDER BY name;
```

Cloudflare should return five rows.

## 2. Deploy the Worker source

Open the `slinkyleveling` Worker, choose **Edit code**, replace the Worker source
with the complete repository `worker.js`, and deploy it. Keep the existing `DB`
binding, `ADMIN_TOKEN`, and `SESSION_SECRET` unchanged.

The new release is:

```text
0.4.0-multi-device-collector
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
  "version": "0.4.0-multi-device-collector",
  "database": "connected"
}
```

Authenticate through `POST /api/auth` exactly as before. Then use the returned
session token for these three tests.

```text
POST /api/collector/heartbeat
Authorization: Bearer YOUR_SESSION_TOKEN
Content-Type: application/json

{}
```

The first active session for your Torn user should receive
`"collector": true`.

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

All three responses should contain `"ok": true`. The check response may contain
one assigned check; the recommendation response should contain up to five
targets.

If the same Torn user authenticates on another device, that session remains a
standby while the first device renews its collector lease. If the first device
stops, the standby can take over after about one minute and will continue using
the same D1-backed recommendations.

Once those requests work, userscript `0.7.2` can be installed for a live test.
