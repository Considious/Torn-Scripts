# Cloudflare deployment checklist

Use this order. Install userscript 0.9.0 only after the health check reports
Worker `0.6.0-personal-stat-fit`.

## 1. Confirm the existing migrations

Migrations 0001 and 0002 create the shared coordination tables. Migration 0003
removes the unused experimental `user_target_fair_fight` table. No new D1 table
or query is required for this release.

## 2. Deploy the Worker

Open the `slinkyleveling` Worker, choose **Edit code**, replace the source with
the complete repository `worker.js`, and deploy it. Keep the existing `DB`
binding, `ADMIN_TOKEN`, and `SESSION_SECRET` unchanged.

## 3. Check the version

Open:

```text
https://slinkyleveling.richard-johnson554.workers.dev/api/health?release=0.6.0
```

The JSON should include:

```json
{
  "ok": true,
  "version": "0.6.0-personal-stat-fit",
  "database": "connected"
}
```

## 4. Update Tampermonkey

Install or update userscript 0.9.0, reload Torn, and click **Refresh**. Targets
appear as soon as SLINK answers. On the first run of each day the client makes
one Core Lib-controlled Torn request for the member's battle stats.

The panel should progress through messages like:

```text
Reading your locally cached strength range...
Asking the SLINK Network for targets...
Refining 40 Fair Fight estimates in the background...
Running scheduled Torn checks...
```

Approximate values carry a tilde, such as `FF ~2.15`, and are usable
immediately. FFScouter refinement no longer blocks scheduled Torn work. The
browser reuses each refined Fair Fight result for seven days and never sends
those values to Cloudflare.

Source labels never affect assignment. The Worker selects inside the member's
temporary target-stat range using competition, target usefulness, estimated
stats, and global lease availability. Exact member battle stats stay in
Tampermonkey; the Worker receives only the derived range for the current
recommendation request and does not store it.

There is no separate collector heartbeat or redundant second target refresh.
Collector election is part of the normal recommendation load. The default
interval is 300 seconds, so a standby panel generally makes six Worker requests
per 30 minutes. The collector receives a larger scheduled-check batch after
Core Lib's shared allowance has had time to refill.

The collector lease covers two configured intervals. With the 300-second
default, a second device can take over after roughly ten minutes without data
from the active device. Existing users who previously saved a different
interval can leave it in place or change it to 300 in the panel settings.
