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
  100-city-item daily cap and local 5-minute/1-hour snoozes.
- **Efficiency / Merits:** current award catalog with the next locked tier per
  award family and up to three local pins.

## Safety and usage boundaries

- no `@require` dependency or runtime GitHub download;
- no Torn navigation, reload, or automatic page interaction;
- one Shadow DOM host so Torn styles cannot garble the dashboard;
- starts minimized after every new page load.
- Leveling and War do not contribute API checks or send heartbeat loops;
- module refreshes run only while the dashboard is open and visible;
- Torn API requests pass through one shared 60-per-minute local ledger;
- API keys and session tokens stay in the userscript's local storage.

Open **Access** first, load and accept the current terms, then authenticate. The
Contribution Worker remains the canonical feature-permission source; Leveling
and War establish their own product sessions only after the required scope has
been granted.
