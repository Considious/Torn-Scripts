# SLINK PDA audit tester build — candidate 31

Testing branch only, not stable/main. Installer version **0.4.117**. The running dashboard reports a short prefix of its source-content digest, not a separately maintained runtime version.

PDA checks the live testing-branch manifest at startup; there is no historical commit pin or per-fragment version. `node build.mjs --write` derives one SHA-256 content revision from the runtime and startup add-ons, and `--check` verifies it. A matching last-known-good runtime starts after a bounded manifest check; changed content downloads and runs as a complete revision. A slow/failed check falls back to the prior working cache. The 2.5-second bound is only a network fallback, not a size limit. The old 18,000-byte project gate is gone. Current launcher: **17,554 bytes**. Runtime: **665,039 bytes**; startup add-ons: **131,396 bytes**; fetched separately at runtime. These are measurements, not PDA limits. PDA publishes no source-size maximum in the documentation reviewed. Physical device acceptance remains necessary. See the single tester changelog.

The launcher keeps its separate audit-test runtime cache, supports PDA's HTTP handler and a public CDN mirror, and uses the cached source if a live source attempt fails. The runtime/API identity is derived from the content revision supplied by that manifest; it is not a manually synchronized version literal. Update in place; never clear data.

Native PDA storage is feature-detected and preferred; legacy data is kept and copied non-destructively. Target add/edit/delete and authenticated shared-stat updates now await their durable writes; the settings/snooze snapshot waits for both acknowledgements. Failed native changes keep their intent until a later successful save; stale unchanged snapshots merge against current settings/targets/protected fields. Access exposes Retry for failures. The complete test checklist and limitations are in the one running changelog linked below; the full audit is not complete.

Physical PDA acceptance remains mandatory. No native API means browser fallback only, not app-backed durability. Export a backup before tester installation, update in place and reload; never uninstall to test this. No automated cloud restoration or settings/key reset is introduced.
- Branch: `audit/test-foundation`.
- [Install the PDA tester script](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js).
- [One running tester changelog for extension and PDA](https://github.com/Considious/SLINK-Browser-Extension/blob/audit/test-foundation/TESTER-CHANGELOG.md).
- [Pre-audit full-history backup](https://github.com/Considious/Torn-Scripts/tree/backup/pre-audit-2026-10-24).

## Before installing

Save a local settings backup using SLINK's existing backup/export controls where available. Keep the stable script installed but **disabled** while testing this one. Do not clear Torn/PDA application data. Test with harmless records rather than important targets.

Install the linked userscript in Torn PDA as **SLINK PDA Dashboard [AUDIT TEST]**. Check that the dashboard identifies the audit-test build above. Because PDA may keep native settings separately for separately named scripts, authentication/settings may need to be supplied or manually restored for this test installation. This does not mean the stable script's settings were deleted. Do not run both copies together.

The tester launcher checks the current manifest on the testing branch at each startup. With a matching cached revision, it evaluates the cache after that bounded manifest check. If the branch revision changed, it fetches the new fragments and add-ons before evaluation. On a slow/unavailable manifest check, it uses the last-known-good cached runtime; without a valid cache, it shows the retry control if both source hosts fail. It never falls back to the stable branch. This checks PDA's HTTP transport, injected-JavaScript path, shared-host readiness, current-branch update detection and offline cache behavior in automated tests. Physical PDA testing is still needed to confirm app/device-specific behavior.

## What to test

Candidate 1 changes the Racing helper's repeated scanning/highlighting and normal Raceway route detection. It does not change the guide's recommended builds or select a car for you. Follow the shared changelog for detailed instructions.

After testing, disable the audit script and re-enable the stable script. Avoid deleting either script's data. An actual Android PDA session is required to confirm native installation and foreground behavior; desktop userscript/VM results alone do not provide that confirmation.

For developer checks, run `npm run test:audit`. Existing baseline failures outside the focused checks remain documented in the shared test notes.

