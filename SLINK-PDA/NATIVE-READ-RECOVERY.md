# PDA native read recovery — 0.4.144

## Confirmed problem

The reported diagnostic means getMany, get and loadAll all threw a native Null/String cast while reading the primary settings/cache record. It does not prove a JavaScript null was saved as a string, a key has insufficient permissions, storage is full, or the native store recovered when targets appeared.

SLINK immediately latched its native write circuit off after that read failure. Mugging then bypassed its cache-save coalescer at several points (Fair Fight observations, report acknowledgements/status, assignments). Those direct saves could repeatedly hit the paused circuit during a single Find Targets action.

## Changes

- Retain the existing same-store compatibility read, then allow two targeted read retries after 200ms and 800ms for this exact native cast only. Never repeat loadAll during recovery. A successful fresh native read is still required before merge/write; save acknowledgement still requires native readback.
- Quota errors and other failures do not get these retries. Genuine missing records remain valid null values.
- If all attempts fail, perform at most one read-only key listing to distinguish a readable namespace/list from a wider native failure. Log only classifications, never keys, tokens, namespace IDs or record values in the diagnostic. Preserve existing primary data and the failure state; never switch to browser storage or overwrite an unreadable primary from an in-memory snapshot.
- Route Mugging cache updates through the existing coalesced cache writer. A failed cache-save queue remains paused instead of being reopened for each target/report. Explicit preference/access saves and Retry retain their acknowledged behavior.

## Evidence and limits

- Main and feature each passed 46 distinct packaged regression commands.
- Added exact native-reader tests: all three initial methods fail, targeted read recovers, subsequent writes are verified, persistent failure stays failed, quota is not retried, and missing values are not fabricated.
- Actual launcher/runtime browser fixture, main and feature: browser localStorage filled to quota; native settings retained; inject the three reported native failures during Save and authenticate; recovery completes, zero failed/pending writes, authenticated key/session saved natively, fresh document restores authentication and existing alert choice. All accounts and replies are synthetic.
- Physical Android/tablet testing is still required. The initial trigger inside the affected device's PDA bridge/database has not been reproduced on physical hardware; this change repairs SLINK's premature permanent-pause behavior and repeated cache-save path, not a proven defect in PDA's app database.

The installed launcher owns the native adapter. Update the PDA userscript and reload the Torn page to receive it; a live runtime/theme refresh alone cannot replace the existing launcher's storage receiver.
