# Faction room usability update — main release

Extension 0.19.25; PDA installer 0.4.146. The feature work is promoted to main; future updates target main.

## Implemented

- Room-list grid aligns rows at the start instead of stretching a single button through the full panel. Description text is displayed; the chat has an Info toggle.
- Messages get a slightly darkened background without changing or regenerating theme image assets.
- Enter sends; Shift+Enter keeps a newline. IME composition, disabled/read-only sending, duplicate in-flight sends and edit acknowledgements are respected.
- The supplied Torn chat window selector and size sliders drive dimensions. A separate CSS translate reserves a room-width slot beside native windows without replacing their own transforms or clicking Torn controls. Minimize and disposal remove that reservation; losing focus retains it. Viewport bounds still take precedence on small screens.
- Layout watches native panel/bar size and relevant structural changes only while active/open. Observers settle; hidden messages are not repainted by notifications. No recurring whole-page DOM polling was added.
- Existing Torn badge classes are used for the Rooms launcher. A separate third-party activity owner keeps room sockets connected when that Torn page is unfocused or hidden, while Torn DOM activity remains gated. Focusing a different Torn tab transfers ownership over a metadata-only BroadcastChannel; pagehide/disposal releases it. No background polling is added. Connections consume normal per-room WebSocket capacity.
- Optional short local message sound, enabled by default when Rooms itself is enabled, is saved independently. Only a genuinely new incoming message can request it. Own messages, welcome/history replays, edits and duplicates do not. Browser/PDA autoplay policy may require one click/tap before sound can play.
- Permission authentication now uses the verified basic-profile name if key-info lacks it, reusing the profile request where already needed. Signed chat tickets return the name to clients. Names and IDs use text nodes; browser-supplied names cannot impersonate verified identities. Reconnect refreshes authentication.
- Historical generic names use verified names already available from the ticket, presence or roster. No per-message Torn lookups and no destructive history rewrite. If a historical name remains unknown, the UI says Member [ID], not an invented name.
- Sound preference failures keep failed-save reporting/rollback. The native-storage adapter and recent read recovery were not changed.

## Verification

- 19 client/service unit tests, including all-room watchers, duplicate socket/event protection, independent saved sound preference and inactive-page behavior.
- Existing room browser suite passed; new desktop/mobile suite passed for extension and the shared PDA UI. Covers compact descriptions, four native panels, no overlap, live size changes and size controls with no open native panel, Enter/newline/IME/read-only behavior, known-name resolution, unread badge, muted sound, hidden-HTML retention and idle layout stability.
- 53 chat backend tests passed, including actual local Workers/SQLite/WebSocket tests. 18 permission-worker/name tests passed; the existing contribution backup suite is also retained in the package test command.
- 54 extension regression commands in the previous batch, plus the release room-activity regression suite and 46 PDA regression commands passed. Five PDA native-room tests passed, including failed preference rollback and keeping test/production authentication separate.

Physical Torn/PDA acceptance remains necessary. Synthetic browser tests do not prove today's remote Torn CSS or a particular device's sound policy. No agent Cloudflare login or deployment was performed; existing GitHub-linked builds deploy the backend branch normally.

## Main promotion and focus/alignment follow-up

- Main-only source changes were compared with the feature snapshot before promotion. Main's recent storage recovery, alert snoozes and performance fixes are retained; remaining source differences are room integration, release metadata and line endings.
- Extension 0.19.25 / normal PDA installer 0.4.146. Future work is on main; the old dedicated feature installer is no longer the recommended download.
- Third-party Rooms owns a separate lifecycle: it retains the last focused connection owner when leaving Torn, transfers ownership when another Torn tab focuses, and releases on pagehide/disposal. The coordination channel contains no credentials or messages.
- Torn DOM reads/observers remain tied to the original collector gate. Blur stops layout observation, not the reserved slot or incoming room messages. Unfocused Rooms do not mark arriving messages as read.
- The room bottom edge is measured from the native chat panel, not the differently sized bar/button. The gap is measured from adjacent native chats. This avoids a fixed pixel height/gap guess.
- 23 client/service/activity unit tests, 55 extension regression commands and 46 PDA regression commands passed. Layout browser checks use a native panel with a different bottom inset and a 7px gap; they verify unfocused incoming messages retain spacing with zero native layout reads. Shared PDA UI passed the same checks.
- Independent Chromium pages also passed the real BroadcastChannel handoff test using explicit focus signals. Headless Chrome does not reliably expose operating-system focus, so this is not a claim of physical browser/PDA acceptance.
- Both existing Cloudflare chat Workers must watch main instead of feature/faction-node-v1 for future automatic builds. Their build roots, commands, secrets, bindings and registered identity stay unchanged.
