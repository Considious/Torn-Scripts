# SLINK PDA Dashboard

This is the mobile-first, self-contained SLINK dashboard for Torn PDA. It uses
the existing SLINK Cloudflare permission gateway and product sessions while
sharing one locally coordinated Torn API budget across its modules.

## Try it in Torn PDA

1. Open Torn PDA's custom userscript manager.
2. Add the complete contents of
   `SLINK_PDA_Dashboard.user.js` as a new script.
3. Use document-end injection.
4. Open any Torn page and tap the movable SLINK bubble.

The launcher bubble is shown only while the dashboard is minimized. Minimize
using the top-bar button, Escape, `Alt+Shift+S`, or a downward swipe on the
header. The bubble position is saved locally and clamped onscreen after rotation
or resizing. Reset Layout is available under Access.

## Modules

The Armory Recaller uses the retrieval and pagination flow from Considious
Armory Recaller 1.2.6 within SLINK's existing interface. Each tap retrieves one
eligible item, checks Torn's confirmation every 50 ms for up to one second,
and immediately releases the button afterward. Concurrent taps are ignored.
Whitelist exclusions, ranked-item modes, and known member levels are checked
before retrieval. Next Page includes the original script's hash-route fallback.
Roster lookups continue to use SLINK's existing cache and shared API budget.

The Armory also includes a small TCT (UTC) date/time converter. Enter the date
and time from Torn, check the preview in your device's local timezone, and tap
**Copy relative timestamp** to get Discord's `<t:UNIX:R>` format (“in X hours”
or “X hours ago”). The starting value is the current TCT time. All conversion
happens locally, including daylight-saving adjustments.

Version 0.4.4 adds **Start 24h timer** and **Enable Stack mode** under
Efficiency / Alerts. The separate countdown survives page reloads and can be
restarted or cancelled; completion stays visible until dismissed. Stack mode
pauses both full-energy and energy-refill notifications until a fresh API
reading is below 150E, then automatically restores normal reminder checks.
It has no 24-hour expiry. Existing five-minute API checks detect the energy
drop; the countdown uses the local clock without additional API calls.
PDA must keep the WebView alive to deliver a notification on time; a timer
that expires while suspended is recognized when the script runs again.

Version 0.4.5 changes **$1 Bazaars** to one row per seller. Each row uses
Weaver's complete bazaar market value and links to the seller's bazaar.

Version 0.4.14 adds the shared player-intelligence foundation used by
Bounties and future Target List / Mugging features. Status observations now merge
into one persistent cache, known Hospital/Jail/Travel timers suppress redundant
API checks until near expiry, and concurrent requests for the same player share
one in-flight Torn API call. Bounty DOM status collection remains restricted to
profile pages deliberately opened from the Bounty module.

Version 0.4.15 adds the reusable **Combat / Targets** list. Players are
saved only by an explicit user action and deduplicated by Torn ID. Each saved
target supports multiple tags, local notes, source metadata, cached status and
timer display, Last Seen Mugged and bounty summaries when known, Profile/Attack
links, editing, removal confirmation, and smart manual refresh through the
shared player-intelligence cache.

Version 0.4.16 adds explicit **Save Target** actions to Leveling,
Bounties, ranked-war targets, and Outside Targets. Source saves merge into the
same Torn-ID-deduplicated Target List, retain source context and tags, and reuse
already-visible status and estimate data without making a new API call. Nothing
is imported automatically.

Rollback baseline: the completed PDA Target List release before source
integrations is commit `0d8547e8432e2731bde904dd71b7bd9c0f2632f7`, preserved
on `backup/pre-target-list-integrations-phase3-2026-10-05`.

Version 0.4.17 adds shared DOM-first player intelligence. When a
Bounty or Target List profile link deliberately opens a visible, focused Torn
profile, reliable status and Hospital/Jail/Travel timer information is merged
into the shared cache. Target List refresh checks the matching active profile
before using Torn's API, and known timers continue to suppress redundant calls.
DOM and API observations now have separate timestamps. Attack-result pages and
hidden/background pages are never used for this status collection.

Rollback baseline: the completed PDA source-integration release before
DOM-first collection is commit `862c101d6e2ec10f427eeff9cca4472d0d3d5560`,
preserved on `backup/pre-dom-status-phase4-2026-10-05`.

Version 0.4.18 adds configurable rolling Target List polling. Users can
enable or disable automatic checks, select a 1–1440 minute cycle, and optionally
limit automatic checks to targets tagged **Mug**. Checks are distributed across
the interval rather than fired in one burst. Every scheduled check reuses fresh
DOM/cache information, known timers, in-flight requests, and the shared Torn API
limiter before considering a new API call. PDA polling operates only while Torn
PDA keeps the userscript WebView alive; manual refresh remains available for all
saved targets.

Rollback baseline: the completed PDA DOM-first release before rolling polling
is commit `a8140c3c97ff0906b2d1b77abd8166190cf3ef3d`, preserved on
`backup/pre-target-polling-phase5-2026-10-05`.

Version 0.4.19 adds Phase 6 Stakeout monitoring and alert integration. Any
saved Target List entry can be placed on Stakeout with a configurable 10–3600
second evaluation interval. Stakeouts sort to the top and are visually
distinguished. They reuse live DOM observations, cached status, in-flight
lookups, and known Hospital/Jail/Travel timers before consuming a Torn API
request. Meaningful status changes and new bounties feed the existing Alerts
screen and PDA notification path, with Profile/Attack links and the normal
snooze controls. Stakeout is evaluated only while Torn PDA keeps this userscript
WebView alive, and the UI displays the estimated maximum evaluation rate.

Rollback baseline: the completed rolling Target List release before Stakeout is
commit `9394b793bdb90d2bd31d4a4668f00ca91c1a723d`, preserved on
`backup/pre-stakeout-phase6-2026-10-05`.

Version 0.4.20 adds the permission-gated **Combat / Mugging** interface. The
tab and panel are completely hidden unless the current authenticated backend
session contains `slink.mugging`. This phase adds a local enable switch, a
cache-preserving result shell, profile/attack actions, and the existing explicit
Save Target handoff. It intentionally makes no Mugging API or FFScouter calls;
rough Fair Fight assignment and active/inactive contributor scheduling remain
Phases 8 and 9.

Rollback baseline: the completed PDA Stakeout release before Mugging UI is
commit `4c52c14651115b8e9509cd602787a73d2554c713`, preserved on
`backup/pre-mugging-ui-phase7-2026-10-05`.


- **Combat / Mugging:** shown only with the backend-managed `slink.mugging`
  scope. Phase 7 provides the local enable/cache interface without starting
  target assignment or contributor API work.
- **Combat / Leveling:** live, read-only SLINK recommendations. This combined
  dashboard does not claim contributor checks.
- **Combat / War:** the complete ranked-war workspace with separate opponent,
  outside-target, and med-out-claim views; live retals; item requests; local mug
  reporting; target filters and faction-chat sharing. PDA participates in the
  shared Worker collector election while the WebView is alive. Armory, logs,
  and faction-wide settings are visible only to `slink.war.officer` or
  `admin.*` users.
- **Combat / Stats:** private direct-Torn-API daily player statistics.
- **Efficiency / Alerts:** direct-Torn-API reminders, including the shared
  100-city-item daily cap, local 5-minute/1-hour snoozes, launcher count, and
  notifications for newly active alerts. The city reminder can also be hidden
  until the next Torn daily reset. The local Google Play Points reminder opens
  the Play Store app directly on Android, gives the Google Play Games claim path
  on Windows, and explains the unsupported iOS case. It returns seven days after
  the weekly prize is marked claimed.
- **Efficiency / Market:** the extension's API-only Torn Item Market, Weaver
  Bazaar, and Points Market watches. Permission tiers allow 5–40 watches. The
  searchable item list loads automatically and includes item IDs and city-shop
  sell prices. High/normal/low priority budgets, Torn cache-delay scheduling,
  deal dismissal, copy/faction sharing, page highlights, and the native-control
  SLINK Buy overlay match the extension behavior.
- **Efficiency / Merits:** one next incomplete medal or honor per milestone
  family, with later thresholds summarized on that tile, filters, pagination,
  and up to three local pins.
- **Efficiency / $1 Bazaars:** Weaver's public JSON feed, sorted by highest
  total market value, with direct seller-bazaar links. PDA stores the last
  successful top-100 snapshot locally, refreshes it at most once per hour, and
  also provides a manual refresh button. This feed uses neither Torn API quota
  nor Market Watch slots.

## Safety and usage boundaries

- no `@require` dependency or runtime GitHub download;
- no Torn navigation or reload; the optional SLINK Buy button only acts after a
  trusted user tap and forwards that tap to Torn's own highlighted buy/cart
  control;
- one Shadow DOM host so Torn styles cannot garble the dashboard;
- starts minimized after every new page load.
- Leveling remains read-only. War sends the same shared Worker heartbeat as the
  extension and contributes opponent-status or faction-attack checks only when
  that session is elected as the appropriate collector;
- alerts check every five minutes and Market Watch follows each API source's
  cache/rate schedule while Torn PDA keeps the Torn page/WebView
  alive, even when the SLINK panel is minimized; mobile operating systems can
  suspend or terminate the WebView after PDA is closed, so a userscript cannot
  guarantee fully closed-app polling;
- Torn API requests pass through one shared 60-per-minute local ledger. Market
  high uses available capacity, normal reserves 10 calls/minute, and low
  reserves 20 calls/minute for other modules;
- Weaver prices come only from the public `weav3r.dev/api/marketplace`,
  `/api/pricelist/{userId}`, and `/api/dollar-bazaars/bazaars` JSON endpoints.
  One all-item marketplace summary screens both saved SLINK watches and the
  optional Weaver price list locally; seller details are fetched only for
  qualifying item IDs. The $1 Bazaar feed performs one API request per hourly
  refresh. The DOM observer never scrapes market or bazaar prices for watch
  decisions;
- API keys and session tokens stay in the userscript's local storage.

Access accepts separate Torn and FFScouter keys. Each can independently use the
key injected by Torn PDA, with the saved value serving as the fallback. Theme
choices are loaded from the same validated Worker catalog used by the extension,
so Dragon's Breath and future themes arrive without updating this script. Theme
permissions accept their normal `slink.theme.*` scopes or an `admin.*` grant.
The raw scope list is collapsed by default; it is diagnostic metadata rather
than an authorization secret.

Open **Access** first, load and accept the current terms, then authenticate. The
Contribution Worker remains the canonical feature-permission source; Leveling
and War establish their own product sessions only after the required scope has
been granted.


## Rollback baseline

The last pre-foundation PDA release is **0.4.13** at commit
`e921cec301c0f8acf24c39c02d5d480139e30ecb`. GitHub branch
`backup/pre-mugging-foundation-2026-10-04` preserves that exact version.

### Phase 2 rollback point

The completed PDA shared-intelligence foundation before Target List is preserved
at commit `7fa6f29ba94476140b30c81cf2486f5d512ad64f` on branch
`backup/pre-target-list-phase2-2026-10-05`.
