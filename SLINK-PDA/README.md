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
- **Combat / War:** assigned/active ranked-war detection and a live, read-only
  Worker snapshot. Officer capability is derived from `slink.war.officer`.
- **Combat / Stats:** private direct-Torn-API daily player statistics.
- **Efficiency / Alerts:** direct-Torn-API reminders, including the shared
  100-city-item daily cap, local 5-minute/1-hour snoozes, launcher count, and
  notifications for newly active alerts. The city reminder can also be hidden
  until the next Torn daily reset.
- **Efficiency / Merits:** one next incomplete medal or honor per milestone
  family, with later thresholds summarized on that tile, filters, pagination,
  and up to three local pins.

## Safety and usage boundaries

- no `@require` dependency or runtime GitHub download;
- no Torn navigation, reload, or automatic page interaction;
- one Shadow DOM host so Torn styles cannot garble the dashboard;
- starts minimized after every new page load.
- Leveling and War do not contribute API checks or send heartbeat loops;
- alerts check every five minutes while Torn PDA keeps the Torn page/WebView
  alive, even when the SLINK panel is minimized; mobile operating systems can
  suspend or terminate the WebView after PDA is closed, so a userscript cannot
  guarantee fully closed-app polling;
- Torn API requests pass through one shared 60-per-minute local ledger;
- API keys and session tokens stay in the userscript's local storage.

Access accepts separate Torn and FFScouter keys. Each can independently use the
key injected by Torn PDA, with the saved value serving as the fallback. Theme
permissions accept their normal `slink.theme.*` scopes or an `admin.*` grant.
The raw scope list is collapsed by default; it is diagnostic metadata rather
than an authorization secret.

Open **Access** first, load and accept the current terms, then authenticate. The
Contribution Worker remains the canonical feature-permission source; Leveling
and War establish their own product sessions only after the required scope has
been granted.
