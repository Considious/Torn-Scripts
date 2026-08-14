CREATE TABLE IF NOT EXISTS user_target_fair_fight (
    user_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    fair_fight REAL,
    bs_estimate INTEGER,
    source TEXT,
    checked_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, target_id),
    FOREIGN KEY (target_id) REFERENCES targets(id)
);

CREATE INDEX IF NOT EXISTS idx_user_target_fair_fight_checked
    ON user_target_fair_fight(user_id, checked_at);

CREATE INDEX IF NOT EXISTS idx_user_target_fair_fight_target
    ON user_target_fair_fight(target_id);
