# Android oversized settings record

`DatabaseException(Row too big to fit into CursorWindow ...)` when reading
`slink-pda-dashboard:data:v1` means Android cannot return that individual row.
It is not the phone's free-space or notification permission, and is distinct
from SLINK's total native-storage quota and the earlier Null/String bridge error.
Do not assume a universal numeric Android row-size limit.

## Affected users

If 0.4.185 showed an instruction to install “0.4.155 or later”, that was a
runtime compatibility-check bug: reset capability 2 was incorrectly rejected
by a leftover capability-1-only condition. The corrected live runtime accepts
capability 2. Reload Torn to fetch it; do not downgrade. The updated installer
is 0.4.186. Regression coverage now exercises the complete runtime-to-native
delete/rebuild/save path, not just the adapter in isolation.

1. Update the installed SLINK PDA userscript to **0.4.185 or later**. The storage
   adapter is in the installed launcher, not just the downloaded runtime.
2. Keep Torn open. In SLINK, review the settings currently available on this page.
3. Open **Access → Storage troubleshooting → Delete unreadable records and rebuild**.
   If necessary, use **Copy storage report** once to reveal the eligible action.
4. Read and accept the deletion confirmation. Wait for successful save/readback,
   then reload once and confirm settings persist.

The repair deletes confirmed unreadable SLINK settings roots, their associated
   segments and pointers, verifies removal, then writes a clean segmented snapshot.
Readable records, separate saved-target records, other scripts and Torn's browser
storage are not cleared. Settings absent from the current page/mirror cannot be
recovered from a row Android cannot read. Deletion is irreversible. If replacement
fails after deletion, keep the page open: its current settings remain in memory.

## Prevention and safeguards

Normal saves now migrate readable legacy settings into the same small-record,
verified A/B-bank format used by recovery. The new active header is acknowledged
only after every changed segment is read back. Later saves reuse the banks.
Cross-page migration conflicts stop a stale writer and request a retry rather
than overwrite a newly selected record. The old Null/String repair remains.

An unreadable legacy row is never silently overwritten during a background save;
its removal is the explicitly confirmed action above. A failed deletion stops
the rebuild. Quota or unrelated database failures do not authorize deletion.
Segmented saving still needs enough total per-script space for its banks. A real
quota error is reported separately as `SLINK_STORAGE_FULL`.

Run `node test-native-cursor-window.mjs`, `node test-native-manual-recovery.mjs`,
`node test-native-storage-compat.mjs` and `node test-storage-ack.mjs`.
The synthetic reader bound in the regression test is not a claimed Android limit.
Physical-device confirmation is still needed. Startup-speed work is separate.
