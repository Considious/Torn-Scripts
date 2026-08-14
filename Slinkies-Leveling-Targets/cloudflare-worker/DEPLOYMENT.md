# Cloudflare deployment checklist

Use this order. Install userscript 0.8.0 only after the health check reports
Worker `0.5.2-assigned-targets-last`.

## 1. Remove the unused experimental Fair Fight table

You already created the experimental per-user Fair Fight table. Open the D1
database **Console** and run the one-line contents of:

```text
migrations/0003-remove-unused-user-fair-fight-cache.sql
```

That statement only removes `user_target_fair_fight`. It does not touch targets,
status, hospital history, scheduler data, or the coordination tables. It is also
safe to run if the experimental table does not exist.

No new D1 table is required for this release. Migrations 0001 and 0002 should
already be present.

## 2. Deploy the Worker

Open the `slinkyleveling` Worker, choose **Edit code**, replace the source with
the complete repository `worker.js`, and deploy it. Keep the existing `DB`
binding, `ADMIN_TOKEN`, and `SESSION_SECRET` unchanged.

## 3. Check the version

Open:

```text
https://slinkyleveling.richard-johnson554.workers.dev/api/health?release=0.5.2
```

The JSON should include:

```json
{
  "ok": true,
  "version": "0.5.2-assigned-targets-last",
  "database": "connected"
}
```

## 4. Update Tampermonkey

Install or update userscript 0.8.0, reload Torn, and click **Refresh**. The panel
should progress through:

```text
Asking the SLINK Network for targets…
Checking Fair Fight for 40 targets…
40 Fair Fight records saved locally
Running scheduled Torn checks…
```

The browser reuses each Fair Fight result for seven days. It does not send Fair
Fight values to Cloudflare.

There is no separate 20-second collector heartbeat or redundant second target
refresh. Collector election is part of the normal recommendation load. The
default interval is 300 seconds, so a standby panel generally makes six Worker
requests per 30 minutes. The collector receives a larger scheduled-check batch
after Core Lib's shared allowance has had time to refill.

The collector lease covers two configured intervals. With the 300-second
default, a second device can take over after roughly ten minutes without data
from the active device. Existing users who previously saved a different interval
can leave it in place or change it to 300 in the panel settings.
