# KAL audit and implementation

Audited 2026-11-19 against SLINK Browser Extension main `0fd17f82d39e1ee103db27ba121b6bfffcfc8cb9` and Torn-Scripts main `e1dddd893b74899ce4a56dec0197a3abbad611e6`.

The PDA product is `Considious/Torn-Scripts/SLINK-PDA`, not the older extension copy in Torn-Scripts. Its loader uses a content-hashed direct-source manifest with runtime fragments and startup add-ons. Its existing native storage bridge and backups remain separate from KAL. Extension FFScouter configuration is in the dashboard’s shared access form; requests use the existing HTTP and FF backup modules, with player-intelligence/FF caches and existing War/Leveling rendering. Those pipelines are unchanged; both settings pages gain attribution. Existing attack mugging listeners remain untouched.

KAL 1.3.3 collects disclosed `attackData` fetch responses, not equipment DOM cards. Its helpers recognize real disclosures including partial combat equipment, compact combat slots, preserve raw details, derive ammo/log context, and calculate a capture ID. Source permission was confirmed by the owner during this session; see `vendor/kal/UPSTREAM.md` for the permission basis, hash and import details.

Public reads follow https://kalends.dev/api-docs: `/check-key`, player loadout, opaque `pagination.next_cursor`, unknown metadata retained. Registered-key validation does not register a key or accept policies. KAL’s own error codes enforce account/policy restrictions. Copies are generated from the selected structured JSON snapshot so a changing latest observation cannot replace the copied selection. Read caching lasts ten minutes without sliding extension; requests coalesce, cursors are player/account scoped, and 429 backoff survives restarts. There is no bulk history or faction harvest.

## Operation

KAL settings are immediately below FFScouter. Connect a registered key, explicitly enable integration, and independently select SLINK contribution collection. Collection defaults off. Use that collection choice when using SLINK **instead of** the official KAL collector. When the official collector is installed, leave SLINK collection off. Display choices include an explicit official-display preference and a closed manual SLINK panel. No script, native KAL element, or other collector is disabled or removed. SLINK has no premium or server-scope gate for KAL.

There is no supported upstream collector-coordination API identified in the audited source/docs. `kal:loadout-saved` is a notification after success, not an ownership lock. Capture IDs contain a capture timestamp and cannot be assumed to deduplicate two independent scripts. The explicit collection choice avoids promising automatic cross-script deduplication. An **upstream-approved** coexistence strategy is still outstanding. The interface makes no inference from another userscript’s private globals or unreliable DOM detection.

Extension observation runs in the page realm at document start, then passes equipment-only JSON to the isolated extension; credentials remain in the background service. The sender’s Torn attack URL and opponent are checked before queuing. The PDA uses the same generated capture helpers, observation adapter, contribution queue, public client, formatter and UI. Its launcher retains the native storage/HTTP references and acknowledges writes only after completion; the page adapter never emulates Chrome APIs.

## Storage

Extension settings/credentials use distinct `chrome.storage.local` keys. KAL credentials are excluded from both export and restore. IndexedDB separately stores bounded read cache and pending contributions. The single background service serializes mutations; retry alarms resume persisted retryable work after suspension. Secrets never enter pending payloads, caches, diagnostics, or SLINK’s donated-key worker.

PDA settings, credentials, rate backoff and pending contributions use separate `slink-pda-kal:*:v1` records through the documented `PDA_storage` API. No existing KAL storage is read, migrated, deleted, or overwritten. The checked GM fallback verifies writes and reports failures. No native-error fallback claims success. Cached reads use bounded IndexedDB, and cache failures do not hide otherwise valid responses. Queue records are capped at 256 KiB to avoid recreating the oversized whole-runtime native record. PDA contribution operations require Web Locks to serialize independent WebViews; unsupported WebViews disable collection with an explanation. Physical-device behavior remains to be verified.

Submissions preserve KAL’s original destination, body authentication, capture timestamp and capture ID. `queued` is not `accepted`. Acknowledgements clear pending payloads; 408/429/5xx retries are bounded, respect Retry-After, and survive permitted restarts. Interrupted `sending` state becomes uncertain and is never replayed automatically. Disconnect stops further work; records associated with another local connection scope are never submitted under a newly connected key.

Official TornPDA contracts inspected:

- https://github.com/Manuito83/torn-pda/blob/master/userscripts/TornPDA_Storage.md
- https://github.com/Manuito83/torn-pda/blob/master/userscripts/TornPDA_API.js

## Verification and release boundary

Run `npm run test:kal` and `npm run test:kal:browser` in the extension checkout. In SLINK-PDA run `npm run test:kal` and `node build.mjs`. Browser tests use local synthetic Torn observations and mocked KAL submission responses; they do not contribute to the live service. Core queue tests cover the same platform-independent submission implementation used by both products.

Passed: capture/serialization/rare bonuses/partial equipment/unknown metadata, duplication and simultaneous events, correct upload destination/body, acceptance vs queued, rejection, ambiguous network interruption, bounded retry/restart, auth/consent/account errors, cache expiry/corruption/quota behavior, cursor/player/account isolation, credential removal and backup exclusion, native/GM acknowledgements and failures, PDA capture-to-native-upload, browser latest/history/copy, mobile bounds, light/dark tokens, preservation of an existing fetch wrapper, opted-out collection, and rerender duplication. Existing extension background, core and settings-queue regressions also pass. PDA source build and shared-module parity are checked.

Not verified: a genuine accepted contribution at KAL, a physical PDA background/resume/abrupt-termination test, actual official KAL + FFScouter installed together, Firefox execution, or a Kalends-approved simultaneous-collector strategy. The full unrelated repository test suite has not been claimed. Keep this change in draft until those release checks are completed. No live contribution was attempted because the specification requires separate authorization.

Questions for Kalends (not sent): confirm the preferred simultaneous-script collection strategy, confirm whether the existing capture identity is server-idempotent after an ambiguous upload, and agree on a documented SLINK client identifier/header/version mechanism. No unsupported metadata has been added while these are unresolved.
