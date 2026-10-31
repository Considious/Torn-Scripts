# SLINK audit tester build — candidate 40

Current extension **0.19.14.2**, PDA **0.4.126**. Clearer errors across the shared UI, request paths, chat and startup; no settings reset or main promotion. Follow Candidate40 in the single TESTER-CHANGELOG.md. Backend changes need a separate testing deployment and are not live from this commit.

# SLINK PDA audit tester build — candidate 39

Current PDA **0.4.125**, extension **0.19.14.1** carries the complete main Mugging recovery repair while retaining all audit/chat/media/theme/storage improvements. Update in place, not by clearing data. Test Find targets → pending FF checks → acknowledged upload → refreshed estimated targets. Use Candidate39 in the single extension tester changelog. Physical PDA and live authenticated catch-up remain acceptance work.

PDA **0.4.123**, extension **0.19.13.11**. Enable **QOL → Chat → Fair Fight in chat** (initially off). Saved FFScouter key, shared public backup and observer-bound intelligence provide values; † identifies fallback. No automatic profiles/messages or extra Torn requests. Existing settings/keys are preserved. Use Candidate 38 in the one extension tester changelog; physical PDA/live Torn remains acceptance work. No main/live backend changes.

Current PDA **0.4.122**, extension **0.19.13.10**. Passive public BSS backup uses a separate IndexedDB cache with the shared client engine, preserving all settings/keys. Backend source/migration/snapshot code is testing-only, disabled until a deliberate setup; no live backend deployment or production schema change occurred. No new FF chat badges yet. Update the existing tester script in place and use Candidate 37 in the single extension tester changelog.

Current PDA **0.4.121**, extension **0.19.13.9**. In Torn chat, click **✦** beside the minimize control for **Custom buttons / GIFs / Stickers**. No need to open QOL → Chat first. Media is copied/pasted and sent manually; existing custom presets retain their load/confirm-send steps. Update the existing audit script in place, never uninstall/clear data. See Candidate 36 in the single extension tester changelog. Main/stable remains untouched.

Current PDA **0.4.120**, extension **0.19.13.8**. Quality of Life → Chat's optional media picker adds Stickers using GIPHY and ChatSticker in separate sections. Existing settings, keys and manual copy/paste/send remain unchanged. Use Candidate 35 in the single extension TESTER-CHANGELOG.md. Update the existing audit script in place, not by uninstalling. Older version notes below are historical; main/stable remains untouched.

Current PDA installer: **0.4.119**. This includes optional Torn-page theming following the existing selected theme; enable “Apply my SLINK theme to Torn” in the Themes/recovery controls. Extension counterpart is 0.19.13.7. See Candidate 34 in the single extension TESTER-CHANGELOG.md for the combined checklist. Update the existing audit script in place; do not uninstall or clear data. Main/stable is unchanged. Earlier entries below are historical.

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
