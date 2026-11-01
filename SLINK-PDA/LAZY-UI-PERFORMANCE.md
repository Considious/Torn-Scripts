# PDA deferred panels and cache saves — 1 November 2026

## Behavior

- Background checks update their model and the launcher/bar/chat-button alert indicator. Alerts does not replace its panel HTML while minimized or while another module is selected. Opening it paints current data.
- Other built-in panels and the Money, Events, Officers and Chat settings add-ons defer hidden rendering. Permission gates and background checks remain independent of that painting. Native chat GIFs/highlights/badges are not tied to the dashboard panel and remain active as configured.
- Startup/open no longer rebuild every module. Large saved-target lists render 50 entries at a time with Previous/Next controls. This is display pagination only: no saved targets, notes or intelligence records are removed and monitoring still considers all targets.
- Empty, disabled and not-due target passes no longer save timestamp-only state or rebuild panels. Schedule cleanup, due checks, active-alert expiry and notification changes remain meaningful work.
- Cache-only player observations coalesce for 500 ms and collection tasks hold them until their batch finishes. A single in-flight cache save is retained; failures pause automatic cache retries. Explicit Access/preferences saves still call the existing acknowledged writer immediately, and explicit flush includes pending cache updates. Page exit attempts to flush pending cache data.
- Legacy Bounties intelligence is merged by existing field freshness rules into the primary shared cache. Its live alias is non-enumerable, so it is no longer serialized twice. Known estimates, own battle stats, keys, notes and settings are retained.

## Storage safety boundary

The installed launcher's native storage implementation, record names, bridge protocol, merge/readback acknowledgements, paused native writer and retry mechanism are not rewritten. Only its installer version is updated. Cache batching calls that same writer; it does not replace it or report success before acknowledgement. No new quota assumptions, deletion or compression is introduced.

## Verification

- 41 distinct existing PDA regression commands pass, including native compatibility, full browser storage, acknowledgement/ordering, settings isolation, own-stat freshness, alert snoozes, runtime, lifecycle, market, racing, events and forms.
- `test-lazy-panels-cache.mjs`: live counts without hidden Alerts painting; reopening freshness; empty/not-due/disabled target passes; expired alerts and obsolete schedule cleanup; due checks; cache batching/single flight; failure pause; lossless legacy intelligence adoption/restart.
- `qa/lazy-panels.browser.mjs`: actual runtime/add-ons with 500 saved targets; empty hidden panels; Access-only construction; current counts while Alerts HTML remains untouched; fresh Alerts on reopening; target pagination and next-page clicks; unsaved editor retention; 40 observations flushed with native acknowledgements and no duplicate serialized intelligence.
- Actual launcher startup/CSP/sign-in and full-browser-storage native save fixtures pass. The latter fills synthetic browser storage to its real rejection point, then checks native authentication/save and final acknowledgements without clearing data.
- Existing chat rendering/activity/performance regression passes.
- The same synthetic minimized 1.5 MB cache workload used in the investigation now records zero queries, panel writes, browser mirror writes, native writes or long tasks in the idle sample. Previously it reproduced repeated full saves and long tasks. This is headless Chrome with CPU throttling, not a physical PDA frame-rate claim.

## Acceptance checks

Receive/snooze/expire alerts while minimized; verify counts and notifications without opening SLINK, then open Alerts and confirm current details. Open Access with a large saved-target list; only opening Targets should construct its cards. Navigate pages and edit notes. Exercise active/disabled/re-enabled polling and stakeouts. Change preferences, reload and verify acknowledged persistence. Test existing chat tools and actual phone/tablet responsiveness.
