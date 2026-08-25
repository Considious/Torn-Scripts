# SLINK War Service

Coordinates the SLINK War target, retaliation, and aggregate logging lanes.

## Cloudflare setup

1. Apply `../SLINK-Permissions/migrations/0004-war-service.sql` to the existing `slink-permissions` D1 database.
2. Create or connect a Worker named `slinkwarworker` to this directory.
3. Confirm the `PERMISSIONS_DB` binding points to `slink-permissions`.
4. Add a Worker secret named `SESSION_SECRET`. This can be a new random secret used only by the War Worker.
5. Deploy. Wrangler creates the SQLite-backed `WarCoordinator` Durable Object namespace from the included migration.

Suggested Git build command:

```text
npm test
```

Suggested Git deploy command:

```text
npx wrangler deploy
```

After deployment, open `/api/health`. A ready response reports the D1 database, coordinator binding, and session secret as configured.

## Data boundary

- API keys are used only during `/api/auth` and are never stored by this service.
- Public status contributors submit sanitized member snapshots without API keys.
- Live snapshots, collector leases, retals, and attack IDs stay in a per-war Durable Object.
- Only ten-minute loss, escape, and observed-online counters are persisted to D1.
- Clients refresh persisted log counters no more than once per ten minutes;
  ten-second live refreshes read only the Durable Object's pending counters.
