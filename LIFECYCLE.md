# PDA page lifecycle ownership

Candidate 25 uses SLINK_PDA_PAGE_ACTIVITY for Torn DOM eligibility: present and not hidden, without requiring desktop document.hasFocus(). Effective transitions increment a generation; duplicate events do not reconnect observers or invalidate current work.

Deferred DOM callbacks use activity.defer/cancel. Hiding cancels registered timers; generation checks exclude already-dequeued callbacks after resume. Awaited send waits check their generation before querying/sending rather than leaving unresolved promises on cancelled timers. Cancelled sends require fresh explicit confirmation.

The shell owns market/guardian observers and target timers. Chat/Events also start disconnected when hidden and reconnect once. pagehide clears target intervals/kickoffs and nulls IDs; pageshow recreates them once. Visibility-hidden alone retains authorized background API policy. The scheduler skips pagehide-suspended work; already-started API requests may settle caches. No catch-up refresh burst is introduced.

Resume repairs retained host/launcher/scroll lock and page hooks, not every module. It does not reset settings, page, theme, target notes or draft controls. Hidden/zero-size viewport events cannot save a default launcher position. Same-build reuse returns before initializing activity hooks again. Updating an older loaded runtime still requires reload; arbitrary old versions are not retroactively torn down.

test-page-activity.mjs and test-page-resume.mjs execute production owners and async sends. Synthetic headless Edge checks use actual Chat/Events add-ons and real MutationObservers: initial-hidden startup, five resume cycles, retained Shadow DOM drafts, 360px/1000px, intercepted networking and no credentials. Physical PDA process suspension, forced termination, BFCache eligibility and independent WebViews still require acceptance. See STORAGE.md for persistence limits. Cloud recovery remains manual.
