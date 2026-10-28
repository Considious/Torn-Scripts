# PDA storage contract — Candidate 24

Official contracts checked on 27 October 2026:

- [Native app-backed storage](https://github.com/Manuito83/torn-pda/blob/master/userscripts/TornPDA_Storage.md): asynchronous per-script SQLite-backed API; rejected writes include quota failures. Detect get/set rather than assuming every installed PDA release has it.
- [GM compatibility implementation](https://github.com/Manuito83/torn-pda/blob/master/userscripts/GMforPDA.user.js): GM storage uses browser localStorage, and the setter can swallow quota errors. Promise completion from a GM adapter alone is not proof of app-backed durability. The fallback setter is followed by a read-back comparison.

The authored small launcher retains the native API reference in its own context and bridges registered data, own-stat, UI and snooze keys. Each runtime request has a sequence ID and a captured JSON snapshot; native/GM writes remain FIFO within that bridge. The launcher acknowledges only after completion, with backend type or sanitized failure. Runtime callers receive a Promise, track pending/failed writes and may flush/retry. Ignored legacy promises have a rejection handler so failure is tracked without unhandled-rejection spam. Access shows failure/retry without rebuilding editors on every acknowledgement. Quota errors never silently switch from native storage to a browser fallback and claim durable success.

Existing primary/mirror recovery and storage keys remain. A nonempty legacy record migrates only when the corresponding native key is missing; old data is not deleted. Settings normalization now spreads unknown/add-on settings and unknown top-level fields before known defaults. UI/own-stat/snooze values are bootstrapped from native storage before source evaluation. A cached source bundle must declare storageProtocol 2; incompatible older cached code is retained but not executed under the new storage contract. A runtime-cache write failure does not mark a running UI as failed to load.

Primary read errors are not treated as an empty primary: mirror repair is disabled for that failed read, preventing an unread native record from being overwritten by an older mirror. The regression adapter explicitly injects that error and checks that the stored record remains untouched.

writeDataState still reconciles settings locally and now also reconciles target records and protected credential/session fields. Each native request includes a baseline; the launcher rereads current storage and merges unchanged fields from it. A native baseline advances only after acknowledgement, not merely after a local mirror write. Thus failure followed by retry or another save does not discard earlier failed intent. Deleted target keys use the baseline's absence/presence rather than blindly restoring a stale whole list. This is three-way record merging, not an app-wide transactional lock.

Target add/update APIs retain their synchronous model-return contract for existing callers. Explicit target UI actions flush before acknowledging or closing; only a current form ticket is released. Source save and deletion await flush; Access completion awaits persistence. Public dashboard storage.flush/status/retry supports real-device diagnostics. Plugin save returns the write Promise, but existing plugin callers that ignore it have not all been converted in this phase. Cloud restoration remains manual; portable backups still exclude keys/sessions.

## Acceptance boundary

test-storage-ack.mjs runs production loader/runtime functions against independent native, legacy and browser stores: migration, delayed acknowledgement, quota rejection/retry, browser-cache-clear recovery, unknown/add-on settings, stale protected values, target deletion and disjoint note/name edits, failed intent retained by a later save, and target form newer-draft/duplicate/failure behavior. Existing tests retain GM compatibility and source/version/permission checks.

No physical Torn PDA device was controlled. The documented native API exposes no compare-and-swap primitive; two independent WebViews can still race between read and write. Real-device background/resume, simultaneous-WebView and abrupt-termination acceptance remain open. Browser-only fallback can be evicted with browser storage. Do not claim every module has an awaited save UX, universal cross-WebView atomicity, or zero possible data loss.
