# Faction Rooms PDA preview

The isolated test node is now registered for faction 46978 with explicit Chat Leader 3853023. The feature client uses the separate test Central routes; do not treat this as a general-user release or switch production endpoints.

`SLINK_PDA_Faction_Node_Test.user.js` is a separate preview installer following `feature/faction-node-v1`, with its own runtime bundle cache. Disable the normal SLINK userscript before running the preview; do not run both at once. The normal installer still follows main. No existing settings are deleted or automatically recovered from the cloud.

The feature adds **Quality of Life → Faction Rooms** and an optional Rooms button in Torn's chat row. It starts off. Your faction needs its separate `slink.chat` license; explicit Chat Leaders manage room access, timed mutes/blocks and links. The node remains authoritative.

Native HTTP and authentication reuse the existing PDA runtime helpers. The room/client/UI source is mirrored from the extension, not independently rewritten. After source changes, use the extension's sync utility and run `node build.mjs --write --faction-node-test` here. `npm run test:faction-node` checks adapter/native transport boundaries, save failure behavior, small UI preferences and the preview installer routing/cache. Existing storage and lifecycle regression checks remain applicable.

The last room/management view and open/minimized state are remembered through the small existing UI-state record. Draft text stays within its current page, never in that preference or Central. Local browser/real-backend tests cover the shared client, but physical PDA loading, CSP/WebSocket behavior and actual Torn page navigation still require testing. No claimed byte limit or local source-size measurement is being used as proof of physical PDA compatibility.

Use the single user-facing `FACTION-NODE-TESTER-CHANGELOG.md` in the Cloudflare Services repository. The checkpoint/security/testing docs in its Faction Node package record the remaining release gates and the deferred Discord bridge request.

The current shared client includes retry-safe room creation and bounded reconnects across brief connection failures. Manual reconnect cancels the old scheduled attempt; a rate-limit rejection requires a one-minute cooldown. Local shared-client, browser, real-backend and PDA adapter/storage regression tests pass. This still does not substitute for physical PDA acceptance.

Test sign-in reuses the saved Torn key and exact current terms acceptance, but keeps its own short-lived session in memory. Normal SLINK authentication/settings are not overwritten, and the key is never sent to the faction-owned node. The test installer includes the required test-host @connect entries. The settings panel does not depend on a production Chat/admin grant; access is checked by test Central and the node. The helper initializes lazily after startup add-ons, avoiding a shell/add-on load-order dependency. Reload the page after changing the API key/account during testing.
