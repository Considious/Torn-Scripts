# Faction room usability update — feature branch only

Extension 0.19.24; PDA feature installer 0.4.145. Main is unchanged.

## Implemented

- Room-list grid aligns rows at the start instead of stretching a single button through the full panel. Description text is displayed; the chat has an Info toggle.
- Messages get a slightly darkened background without changing or regenerating theme image assets.
- Enter sends; Shift+Enter keeps a newline. IME composition, disabled/read-only sending, duplicate in-flight sends and edit acknowledgements are respected.
- The supplied Torn chat window selector and size sliders drive dimensions. A separate CSS translate reserves a room-width slot beside native windows without replacing their own transforms or clicking Torn controls. Minimize, inactive-page cleanup and disposal remove that reservation. Viewport bounds still take precedence on small screens.
- Layout watches native panel/bar size and relevant structural changes only while active/open. Observers settle; hidden messages are not repainted by notifications. No recurring whole-page DOM polling was added.
- Existing Torn badge classes are used for the Rooms launcher. Accessible rooms are watched while the page is active, so unread events are not limited to the last selected room. No background polling is added; inactive clients disconnect. Connections consume normal per-room WebSocket capacity.
- Optional short local message sound, enabled by default when Rooms itself is enabled, is saved independently. Only a genuinely new incoming message can request it. Own messages, welcome/history replays, edits and duplicates do not. Browser/PDA autoplay policy may require one click/tap before sound can play.
- Permission authentication now uses the verified basic-profile name if key-info lacks it, reusing the profile request where already needed. Signed chat tickets return the name to clients. Names and IDs use text nodes; browser-supplied names cannot impersonate verified identities. Reconnect refreshes authentication.
- Historical generic names use verified names already available from the ticket, presence or roster. No per-message Torn lookups and no destructive history rewrite. If a historical name remains unknown, the UI says Member [ID], not an invented name.
- Sound preference failures keep failed-save reporting/rollback. The native-storage adapter and recent read recovery were not changed.

## Verification

- 19 client/service unit tests, including all-room watchers, duplicate socket/event protection, independent saved sound preference and inactive-page behavior.
- Existing room browser suite passed; new desktop/mobile suite passed for extension and the shared PDA UI. Covers compact descriptions, four native panels, no overlap, live size changes and size controls with no open native panel, Enter/newline/IME/read-only behavior, known-name resolution, unread badge, muted sound, hidden-HTML retention and idle layout stability.
- 53 chat backend tests passed, including actual local Workers/SQLite/WebSocket tests. 18 permission-worker/name tests passed; the existing contribution backup suite is also retained in the package test command.
- 54 extension regression commands and 46 PDA regression commands passed. Five PDA native-room tests passed, including failed preference rollback and keeping test/production authentication separate.

Physical Torn/PDA acceptance remains necessary. Synthetic browser tests do not prove today's remote Torn CSS or a particular device's sound policy. No agent Cloudflare login or deployment was performed; existing GitHub-linked builds deploy the backend branch normally.
