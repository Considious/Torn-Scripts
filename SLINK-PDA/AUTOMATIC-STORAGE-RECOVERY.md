# Automatic native storage recovery — PDA 0.4.188

SLINK keeps two small checkpoint headers beside the existing split settings
records. They reference already-saved data; they do not duplicate the whole
settings cache or store theme images. Unchanged saves do not rotate banks.

If a selected settings record cannot be read, SLINK checks only that record,
confirms the failure, and verifies the saved checkpoint's complete data and
checksum under the existing cross-page storage lock. It then removes only the
confirmed broken header, restores the verified header, and reads back the
settings. The checkpoint and data parts remain intact throughout the repair.
An interrupted repair can resume on a new page. No polling or API calls are added.

If the latest bank is damaged, the previous verified saved version can be used.
Access displays a notice asking the user to check their latest changes. Storage
reports include the automatic-repair result and checkpoint availability without
including keys, settings contents, or session tokens.

No automatic deletion occurs for quota errors, network/timeouts, unrelated keys,
unsupported coordination, or missing/invalid checkpoints. Browser mirrors and
default settings are not accepted as verified native checkpoints.

An old, already-unreadable record created before checkpoint support may still
need Access → Storage troubleshooting → Delete unreadable records and rebuild
once. That manual action remains available with its existing confirmation.
After a healthy split-record read or save, checkpoint protection is established
automatically. Install the updated PDA userscript and reload Torn; refreshing
only the remote runtime cannot update the installed storage bridge.

The regression suite covers actual-launcher bootstrap, repair, save acknowledgements
and fresh-document reload, damaged headers/parts, previous-version restoration,
interrupted writes, concurrent pages, quota failures, absent/untrusted backups,
no-op saves, and preservation of unrelated records and manual recovery.
