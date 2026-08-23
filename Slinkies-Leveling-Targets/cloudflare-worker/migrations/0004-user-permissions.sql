CREATE TABLE IF NOT EXISTS user_permissions (
    user_id INTEGER NOT NULL CHECK(user_id > 0),
    scope TEXT NOT NULL CHECK(LENGTH(scope) BETWEEN 1 AND 100),
    effect TEXT NOT NULL DEFAULT 'allow'
        CHECK(effect IN ('allow', 'deny')),
    granted_by INTEGER,
    note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_scope
    ON user_permissions(scope, effect, user_id);

-- Considious [3853023] is the sole SLINK administrator. Every authenticated
-- Slinky's member receives slink.level by default; this explicit grant adds
-- the private administrative namespace to the owner account.
INSERT INTO user_permissions (
    user_id,
    scope,
    effect,
    granted_by,
    note,
    created_at,
    updated_at
)
VALUES (
    3853023,
    'admin.*',
    'allow',
    3853023,
    'Initial sole SLINK administrator',
    unixepoch() * 1000,
    unixepoch() * 1000
)
ON CONFLICT(user_id, scope) DO NOTHING;
