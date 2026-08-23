# SLINK Permissions

This folder owns the cross-product SLINK permission authority. The D1 database
is named `slink-permissions` and is deliberately separate from every product's
operational database.

Torn authentication establishes a user ID and current faction ID. Product
access is then resolved from this database:

- a current Slinky's [46978] member receives `slink.level` automatically from
  `faction_scope_grants`;
- a user outside Slinky's can receive `slink.level` through an active direct
  grant in `user_scope_grants`;
- Considious [3853023] receives `admin.*` through a permanent direct grant.

Each product Worker binds this same database as `PERMISSIONS_DB` and enforces
its own required scope. Browser clients never connect to D1 directly.

## Initial setup

1. Create a D1 database named `slink-permissions`.
2. Run [`migrations/0001-permissions.sql`](migrations/0001-permissions.sql) in
   that database's SQL console.
3. Add a `PERMISSIONS_DB` D1 binding to each product Worker that needs SLINK
   authorization. For the Leveling Worker, keep `DB` bound to
   `slinkies-leveling-data` and `CONSENT_DB` bound to the consent ledger.

The initial migration is additive and rerunnable. It seeds the Slinky's faction
grant and the sole owner administration grant.

## Grant paid or manual Leveling access

All timestamps use Unix milliseconds. Replace the example user, expiration,
source, and reference values before running this query:

```sql
INSERT INTO user_scope_grants (
    user_id,
    scope,
    source,
    status,
    starts_at,
    expires_at,
    granted_by,
    external_reference,
    note,
    created_at,
    updated_at
)
VALUES (
    1234567,
    'slink.level',
    'purchase',
    'active',
    unixepoch() * 1000,
    (unixepoch() + 30 * 24 * 60 * 60) * 1000,
    3853023,
    'ORDER-REFERENCE',
    '30-day Leveling access',
    unixepoch() * 1000,
    unixepoch() * 1000
)
ON CONFLICT(user_id, scope) DO UPDATE SET
    source = excluded.source,
    status = 'active',
    starts_at = excluded.starts_at,
    expires_at = excluded.expires_at,
    granted_by = excluded.granted_by,
    external_reference = excluded.external_reference,
    note = excluded.note,
    updated_at = excluded.updated_at;
```

Use `NULL` for `expires_at` when access should be permanent.

## Revoke a direct grant

Revocation affects only the direct grant. A current Slinky's member still has
the automatic faction entitlement.

```sql
UPDATE user_scope_grants
SET status = 'revoked',
    updated_at = unixepoch() * 1000,
    note = 'Revoked by operator'
WHERE user_id = 1234567
  AND scope = 'slink.level';
```

Existing signed product sessions may remain valid until their short session
expiration. New authentication attempts use the current database state.
