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

