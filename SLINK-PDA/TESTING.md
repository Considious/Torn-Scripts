# SLINK PDA audit tester build — candidate 26

Testing branch only, not stable/main. Version **0.4.114**, dashboard build **0.4.114-audit-test26**.

Main-first emergency hotfix integrated: refused source connections can use the public mirror, matching immutable cached sources start immediately, and attack text no longer triggers Xanax-wide rescans. The immutable tester pin needs no background update polling. Native storage acknowledgements/lifecycle guards remain. Loader whitespace was formatted without compression or identifier renaming to stay below the existing size ceiling. Update in place, never clear data.

This batch fixes background/page-return observer and timer ownership, cancels stale delayed chat actions, and prevents hidden/zero-size viewport events resetting launcher position. See LIFECYCLE.md and the one cumulative tester changelog. Physical PDA acceptance is still required.

Native PDA storage is feature-detected and preferred; legacy data is kept and copied non-destructively, the write bridge returns acknowledgements/failures, and target/credential completion waits. Unknown/add-on settings are retained. Failed native changes keep their intent until a later successful save; stale unchanged snapshots merge against current settings/targets/protected fields. Access exposes Retry for failures. The complete test checklist and limitations are in the one running changelog linked below; the full audit is not complete.

Physical PDA acceptance remains mandatory. No native API means browser fallback only, not app-backed durability. Export a backup before tester installation, update in place and reload; never uninstall to test this. No automated cloud restoration or settings/key reset is introduced.
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
