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
  until the next Torn daily reset. A local Google Play Points reminder opens the
  same Play Points URL on desktop or Android and returns seven days after the
  weekly prize is marked claimed.
- **Efficiency / Market:** the extension's API-only Torn Item Market, Weaver
  Bazaar, and Points Market watches. Permission tiers allow 5–40 watches. The
  searchable item list loads automatically and includes item IDs and city-shop
  sell prices. High/normal/low priority budgets, Torn cache-delay scheduling,
  deal dismissal, copy/faction sharing, page highlights, and the native-control
  SLINK Buy overlay match the extension behavior.
- **Efficiency / Merits:** one next incomplete medal or honor per milestone
  family, with later thresholds summarized on that tile, filters, pagination,
  and up to three local pins.

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
- Weaver prices come only from the public `weav3r.dev/api/marketplace` and
  `/api/pricelist/{userId}` JSON endpoints. One all-item marketplace summary
  screens both saved SLINK watches and the optional Weaver price list locally;
  seller details are fetched only for qualifying item IDs. The DOM observer
  never scrapes market or bazaar prices for watch decisions;
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
