# Market Watch timing and budget checks

Release: extension 0.19.57; PDA 0.4.180.

## Expected behaviour
- Torn item checks follow `cache_timestamp + cache_delay + 1 second`. An overdue unchanged cache advances to the next 30-second global cycle, not a 2–5 second retry loop.
- Missing cache metadata uses a 30-second fallback. A null delay is missing, not zero.
- Weaver's full-market response is reused for ten seconds, including an empty response. Item detail is fetched only when the lowest advertised price meets the watch threshold. Service backoff and quota safeguards remain enabled.
- General alerts have first access to the shared budget. Market Watch is next. Other consumers cannot consume the forecast watch allocation; contributions also preserve the existing ten-call interactive reserve and 40/minute contribution ceiling.
- Forecast demand applies only to enabled Torn/points watches with current permissions and recent Market activity. Weaver-only watches do not reserve Torn calls. Actual market and alert reservations reduce the remaining forecast allocation.
- A waiting normal/contribution request releases the limiter queue before sleeping, allowing higher-priority requests to pass.
- If PDA browser storage cannot persist the API ledger, its in-page ledger continues counting. Native settings storage/recovery is unchanged.
- Existing requests already sent to Torn cannot be preempted. Other devices/services using the account are not wholly visible to this local limiter.

## Automated verification
Focused cache timing, shared-budget ordering, waiting-queue, empty-Weaver-cache, threshold screening, permissions, and catalogue regression tests pass.
PDA storage acknowledgement, native roundtrip and manual record recovery tests pass. Launcher/manifest content checks pass.
Five simulated watches with an unchanged source cache make 20 requested checks over two minutes, instead of the previous rapid retry demand.

Broader suites were also run; these unrelated fixtures are not green and were not changed:
- Extension `adhd-refresh-stability.test.mjs`: expects Search reminder in the currently selected crime subtab.
- PDA `test-page-resume.mjs`: isolated context lacks pdaArsonHelper.
- PDA `test-form-state.mjs`: expects the old alert-settings panel identity.
The remaining standard-suite commands were run after these failures. No additional failures were found.

## Manual checks
1. Keep five item watches active, including a matching deal. Leave general alerts and mugging contributions enabled.
2. Confirm price checks align to returned cache expiry plus one second; unchanged prices must not produce a rapid retry burst.
3. Verify a qualifying Weaver deal is fetched and alerts; above-target items must not request seller details.
4. Remove/expire the Market permission or idle the Market module for five minutes. Its foreground budget reservation should end and old saved watches must not produce alerts.
5. In PDA confirm normal settings still persist through navigation and the existing manual corrupted-record recovery remains available.

No production user key or account traffic was used in automated tests.
