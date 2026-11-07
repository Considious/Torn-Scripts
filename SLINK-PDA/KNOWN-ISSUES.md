# SLINK known issues and confirmed workarounds

This document records recurring problems, the evidence we have, and recovery steps that have actually helped. A workaround is not proof that every similar error has the same cause. Do not clear all saved data as a general troubleshooting step.

## Automatic recovery of split native settings — 0.4.188

The installed launcher now records two small verified checkpoint headers for
the existing split settings banks. A confirmed oversized-row or native Null/String
failure can be repaired automatically when one of these checkpoints still has a
complete, checksum-verified native saved copy. Only the broken selected header
is replaced; data parts, targets, other saved records and browser storage remain.

If the latest bank is damaged, the previous verified version can be restored.
Access displays a repair notice asking the user to check recent changes. Quota,
network, timeout and unrelated failures do not authorize automatic deletion.

Already-unreadable legacy records without a checkpoint still need the manual
rebuild below once; ordinary browser mirrors and defaults are not proof of a
complete native backup. Install 0.4.188 and reload Torn to update this launcher
logic. Healthy split-record reads/saves establish checkpoint protection without
the user toggling anything. See [Automatic storage recovery](AUTOMATIC-STORAGE-RECOVERY.md).

## PDA cannot save settings: native Null/String read failure

Last updated: November 2, 2026.

**Status:** One affected user confirmed that **Delete unreadable records and rebuild** resolved their issue. A second affected user's result is pending. Keep this manual recovery option in the PDA build. It must not become an automatic reset for everyone.

### What users may see

The original error:

```text
SLINK storage write failed. PDA native storage loadAll read failed:
type 'Null' is not a subtype of type 'String' in type cast
```

Later versions report the same class of native read failure more explicitly:

```text
SLINK_STORAGE_PAUSED
SLINK_NATIVE_READ: record=settings; batch=Null/String; single=Null/String; all=Null/String
```

Other reported variants identify `record=requested records` or include:

```text
SLINK_NATIVE_RECOVERY: targeted retries=2; list=requested records listed
```

Related symptoms included:

- Changes appearing to save initially, then reverting after navigation or a reload.
- Repeated requests to accept terms or save and authenticate.
- The selected theme disappearing between pages.
- Repeated storage errors while opening modules or finding mugging targets.
- Storage bridge or queue timeouts while saves were blocked.

**A timeout or terms error alone does not establish this native-read problem.** Check the underlying error/report before choosing this recovery.

### Recovery that worked

The targeted delete-and-rebuild option was introduced in PDA script **0.4.155** and is retained in later builds.

1. Update the installed SLINK PDA script and reload Torn.
2. Open **SLINK → Access → Storage troubleshooting**.
3. Choose **Delete unreadable records and rebuild**, if offered. Read the confirmation before proceeding: deletion is permanent.
4. Keep the page open until SLINK confirms the rebuild and saved-copy verification have finished.
5. Reload, change pages, and use SLINK for several minutes. Check that the theme, accepted terms and changed preferences remain saved.

The recovery uses settings available on the current page. Settings that are absent from that session cannot be recovered from unreadable records by this operation.

This is different from **Recover saving from this page**, the earlier recovery option. The successful user report specifically concerns deleting the unreadable records and rebuilding, not merely retrying saves or authenticating again.

### Safety boundaries

- The delete-and-rebuild action is manual and offered only for the recognized native Null/String settings-read failure.
- It targets the confirmed-unreadable SLINK settings records and their associated pieces/pointers, not every native storage record.
- Readable/unrelated records, saved targets, Torn browser storage and other userscripts are not reset by this repair.
- Deletion is checked before replacement data is written; the rebuilt saved copy is verified. Do not treat an error or timeout as successful recovery.
- If the action is unavailable or fails, use **Copy storage report** and retain the full error. Do not repeatedly delete data or clear all PDA storage.

### What we know—and what we do not

One affected-device report showed that native `list` and `usage` worked and the settings key was listed, while both batch and single settings reads failed at `native-response` with `Null/String`. It reported 5,291,734 bytes used out of 10,485,760, so that report did not show a full native allowance.

PDA's storage screen can display empty/zero after a read fails. A screenshot showing 0 B does not, by itself, prove there are no stored records.

The failure occurs while reading native records, before SLINK can complete the usual settings save. A failed durable save explains why settings available on one page may be lost on the next. The exact reason those native records became unreadable is **not proven**. Do not claim that an ordinary JSON `null` setting, lack of phone space, or an OS permission caused it without additional evidence.

`QuotaExceededError` / `Failed to persist query cache (tchat_query_cache:...)` concerns browser storage and is not the same error. It can coexist with this issue; the native Null/String report must be investigated separately. Likewise, terms errors can also have service-side causes.

### If it returns

Record the installed SLINK script version, PDA version, device/OS, exact error, whether delete-and-rebuild completed successfully, and how long settings remained saved. Use **Copy storage report** rather than sharing API keys or raw saved records. Do not mark the issue fully resolved for all users until further affected-device results support that conclusion.

