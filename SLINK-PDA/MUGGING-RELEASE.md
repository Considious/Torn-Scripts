# PDA 0.4.104 — Mugging reliability hotfix

- Upload queued observations about every five minutes while the client runs, rather than every six hours.
- Retry temporary failures with a one-to-five-minute backoff without discarding pending reports.
- Preserve usable target estimates and their original observation times. Observer-specific Fair Fight scores are not uploaded as target facts.
- Show the worker's pool exclusion summary when available.
- Preserve existing settings keys, API keys, launcher identity, stable source URLs, and runtime cache.
- No audit refactors are included.

Test with `node build.mjs --check`, `node test-mugging-report-safety.mjs`, and `node test-mugging-shared-stats.mjs`.

With Mugging enabled, let observations accumulate and confirm successful uploads about five minutes apart. A temporary worker failure should retain pending observations and retry without a manual refresh. Reopen the page and confirm settings and your cached battle stats remain intact.
