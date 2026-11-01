# PDA performance review — 1 November 2026

## Fixed

- Custom chat buttons searched inserted gameplay subtrees even when nothing in chat changed. Once Torn's chat exists, discovery now watches its ancestor chain, and chat controls observe chat itself. Newsletter discovery is retained only on the newsletter page.
- Fair Fight duplicate detection compared new senders against previously tracked senders. A fixed sender-container slot now provides direct lookup. Copied/replaced chat markup cannot retain an old SLINK badge and acquire another one.
- Fair Fight's chat-root discovery no longer observes all descendants of the document. Repeated synchronization while already attached is a no-op.
- Inline media walked ordinary URL-free messages and retained their original text despite never modifying it. URL-free messages skip that walk; only modified media text is retained for opt-out restoration. The supplied URL conversion/embedding functions remain in use.
- Highlight discovery now stays inside chat, batches changed message containers, and disconnects around its own rendering. It does not repeatedly walk all messages because it inserted highlights. Current Torn message-container classes are included.
- PDA's market/attack/profile observer ignores chat and SLINK's own controls. Those updates must not schedule unrelated gameplay scraping, particularly while attacking with chat open.

## Verification

`qa/chat-lag-regression.mjs` loads the actual PDA chat addon plus the actual FF/media engines in headless Chrome with 200 sender/message rows. This is a browser regression fixture, not a physical PDA benchmark.

- Before: 40 unrelated attack updates caused 80 chat queries. After: zero chat queries, text walks or sender layout reads.
- Initial text walks fell from 400 to 200: highlights still process 200 messages; media no longer walks the same URL-free messages again.
- Replacing a chat root containing existing SLINK badges reproduced 400 badges for 200 senders before; after, exactly 200 remain.
- GIF embedding, highlights, fixed badge placement, chat buttons, inactive-page gating and resume/replacement pass. No API credentials are used.
- `test-gameplay-mutation-gate.mjs` rejects 10,000 chat/UI mutations while retaining real gameplay additions, removals and text changes.
- The existing native-storage compatibility, full-browser-storage, ordered saves, acknowledged readback, settings isolation, lifecycle, QOL, market, events, racing, mugging and runtime-readiness tests pass.

## Full-sweep findings retained unchanged

- Native storage/launcher acknowledgement protocol, keys, record names and read/write ordering are not rewritten. The recent storage fix stays intact. Only the normal installer version changes for update notification.
- PDA activity is based on visibility/page lifecycle, not unreliable desktop focus. Hidden-page DOM work remains paused; rendered GIFs/badges are retained rather than removed and recreated.
- FF lookups remain batched and bounded, with the existing primary/intelligence/backup policy and account/stat-context fences. No extra polling or API calls are introduced.
- GIPHY/sticker search remains user-triggered and cached; no speculative background media searches are added.
- The Halloween basket observer is already limited to Items. Xanax safety already filters relevant changes and has a 10,000-unrelated-mutation regression. Racing uses relevance checks, idempotent highlighting and active-page gating. These were reviewed, not rewritten without a reproduced fault.
- Background API contribution and bounded periodic service checks are separate from DOM scraping. Theme image/blur/GIF decoding costs vary by device and image. Those may still need profiling on a slow physical device; this review does not claim a universal measured frame-rate improvement.

## User checks

Attack and use Crimes with faction chat open; send/receive messages and GIFs; minimize/reopen chat; switch away and return. Check one FF badge per sender and immediate GIF-picker interaction. Change chat/theme/alert preferences, reload and confirm they remain saved. Do not clear storage or reinstall PDA as a test step.
