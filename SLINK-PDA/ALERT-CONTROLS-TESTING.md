# Alert snooze and War retal controls

## Confirmed causes and changes

- Extension Alerts accepted only its built-in IDs and a few delegated sources. Company addiction and onboarding IDs were rejected. Supplemental IDs are now checked against actual active alerts, then saved in the existing snooze ledger. The combined alert list and sound claims both honor that ledger.
- PDA company snoozes already used durable colon-containing IDs. Regression coverage now confirms that behavior, the combined list applies a final common snooze filter, and the UI updates before waiting for acknowledgement. The acknowledged writer and native storage bridge are unchanged.
- PDA retal filtering converted an absent dismissal record to NaN, which could hide an otherwise valid retaliation. Missing records now mean zero. Extension per-player snoozes compare their actual expiry rather than treating every stored value as permanently dismissed.
- All existing 5-minute/1-hour general-alert and stakeout surfaces now also offer 12 hours. War offers individual 5-minute/1-hour/12-hour snoozes, plus separate personal enable/sound controls and an all-retal snooze of up to 168 hours with Resume.
- Extension retal sound is separated from chain, turtle and armory sound identities. A muted new retal cannot retrigger an existing non-retal sound. Existing global War sound settings still apply.
- PDA retal sound is local, opt-in and independent of the visual list. No unsupported native mute parameter or extra native notification is introduced. Ordinary alert phone notifications are unchanged.
- Retal controls are personal, accessible to members, and do not change faction configuration. The Armory-only view remains separate.

## Verification

- PDA main and feature: 45 distinct packaged regression commands passed each, including settings, native storage, snoozes, rendering and cache batching.
- Extension main: 51 distinct packaged regression commands passed. Feature: same 51 passed plus the faction-room browser test. The unrelated local faction-node server integration was blocked by a local socket permission error (EACCES); no server/chat-room code changed.
- Actual PDA runtime browser tests, main and feature: delegated 12-hour snooze, acknowledged saved deadline, reopen, personal retal enable, custom hours and Resume passed. The same fixture also checks minimized panel HTML stays unchanged, badges remain current, target paging and drafts survive, and cache flushes are acknowledged.
- Actual main launcher/runtime startup and authentication passed. The native-storage browser fixture also passed with browser localStorage filled to quota, with zero pending/failed saves.
- New service tests exercise the production company/onboarding snooze route, saved deadlines and expiry, suppression of sound while snoozed, rejecting invented IDs, independent chain sound and concurrent personal War settings writes.

Physical Android/iOS PDA testing remains necessary; browser fixtures do not claim to be a physical device run.
