# KAL profile integration

The final scope follows Kalends’ guidance relayed by the owner on 2026-11-19: **retrieve and display existing KAL observations on player profiles only. No equipment collection, uploads, or attack-loader equipment display.** This replaces the earlier native collector specification.

Both the extension and PDA use the public API at https://kalends.dev/api-docs, with `Authorization: ApiKey ...`, official registration/policy enforcement, on-demand JSON loadouts, opaque history cursors, and copying from the selected snapshot. Settings appear below FFScouter with both authors’ attribution. KAL remains available without a SLINK premium gate.

The integration never hooks fetch, observes Torn attackData, changes Torn’s native equipment state, queues equipment observations, or submits them. No upstream collector source is incorporated. Attack and attack-loader pages receive no SLINK KAL equipment panel and trigger no equipment read. Extension and PDA read transports additionally reject equipment requests outside the selected profile. The official KAL collector remains responsible for contributions, preventing either script from collecting equipment displayed by the other.

Extension credentials/settings use separate chrome.storage.local records; credentials are excluded from backup export and restore. Bounded IndexedDB stores read caches only. PDA credentials/settings/backoff use separate versioned records through its documented native storage bridge, with serialized writes and a checked GM fallback. Neither client touches another userscript’s private storage. No credentials go to SLINK’s donated-key worker.

Reads coalesce, latest snapshots expire after ten minutes, cursors are scoped to player and account, and rate-limit guidance is retained across restarts. Unknown metadata stays unknown. The profile panel uses SLINK theme tokens and offers an explicit official-display preference. There is no mugging-target discovery or attack integration.

Shared SLINK-authored API and UI modules are synchronized from the extension checkout using `node tools/sync-kal.mjs PATH_TO_TORN_SCRIPTS/SLINK-PDA`. Run `npm run test:kal`, `npm run test:kal:browser`, and the existing extension background/core/settings regressions. In PDA, run `npm run test:kal` and `node build.mjs`. No KAL key or live account is used by automated tests.

Audit sources: SLINK Browser Extension main `0fd17f82d39e1ee103db27ba121b6bfffcfc8cb9`; Torn-Scripts/SLINK-PDA main `e1dddd893b74899ce4a56dec0197a3abbad611e6`; KAL public API documentation; and the official TornPDA storage and HTTP contracts:

- https://github.com/Manuito83/torn-pda/blob/master/userscripts/TornPDA_Storage.md
- https://github.com/Manuito83/torn-pda/blob/master/userscripts/TornPDA_API.js

Release checks still needed: a registered-account read, physical PDA lifecycle behavior, and actual KAL/FFScouter coexistence. No live submission testing is needed or authorized: this integration contains no submission path. Existing draft-only pending observations from an earlier build are never read or replayed; no destructive migration is performed.
