# SLINK PDA audit tester build — candidate 10

This is an early testing build. This audit batch does not change stable or main; the separately approved Mugging hotfix is already on main. The full audit plan is not implemented yet.

- Version: **0.4.110**, dashboard build **0.4.110-audit-test18**.

Candidate 18 adds the Racing visible-row/visibility-change highlight fix. It does not port the extension's new Racing autosave/background mutation owner to native PDA storage. See the single running tester changelog for checks and remaining limits.
- Branch: `audit/test-foundation`.
- [Install the PDA tester script](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js).
- [One running tester changelog for extension and PDA](https://github.com/Considious/SLINK-Browser-Extension/blob/audit/test-foundation/TESTER-CHANGELOG.md).
- [Pre-audit full-history backup](https://github.com/Considious/Torn-Scripts/tree/backup/pre-audit-2026-10-24).

## Before installing

Save a local settings backup using SLINK's existing backup/export controls where available. Keep the stable script installed but **disabled** while testing this one. Do not clear Torn/PDA application data. Test with harmless records rather than important targets.

Install the linked userscript in Torn PDA as **SLINK PDA Dashboard [AUDIT TEST]**. Check that the dashboard identifies the audit-test build above. Because PDA may keep native settings separately for separately named scripts, authentication/settings may need to be supplied or manually restored for this test installation. This does not mean the stable script's settings were deleted. Do not run both copies together.

The tester launcher fetches a pinned candidate source revision and has a separate runtime-download cache. Its update URL stays on the testing branch. It does not replace the stable download or silently fall back to a stable runtime. Live application storage retains current behavior; a storage migration is not included in candidate 1.

## What to test

Candidate 1 changes the Racing helper's repeated scanning/highlighting and normal Raceway route detection. It does not change the guide's recommended builds or select a car for you. Follow the shared changelog for detailed instructions.

After testing, disable the audit script and re-enable the stable script. Avoid deleting either script's data. An actual Android PDA session is required to confirm native installation and foreground behavior; desktop userscript/VM results alone do not provide that confirmation.

For developer checks, run `npm run test:audit`. Existing baseline failures outside the focused checks remain documented in the shared test notes.
