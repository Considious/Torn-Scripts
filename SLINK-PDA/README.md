# SLINK PDA Dashboard Prototype

This is the first mobile interaction prototype for a unified SLINK PDA script.
It intentionally makes no Torn API or SLINK Worker requests. Its purpose is to
validate the full-screen dashboard, mobile navigation, and recovery behavior
before the live extension services are adapted to PDA.

## Try it in Torn PDA

1. Open Torn PDA's custom userscript manager.
2. Add the complete contents of
   `SLINK_PDA_Dashboard.user.js` as a new script.
3. Use document-end injection.
4. Open any Torn page and tap the movable SLINK bubble.

The dashboard minimizes using the fixed header button, the launcher bubble,
Escape, `Alt+Shift+S`, or a downward swipe on the header. The bubble position is
saved locally and clamped onscreen after rotation or resizing. Reset Layout is
available under Access if a device reports unusual viewport measurements.

## Prototype safety boundaries

- no `@require` dependency or runtime GitHub download;
- no API key access;
- no network requests, polling, Workers, or D1;
- no Torn navigation, reload, or automatic page interaction;
- one Shadow DOM host so Torn styles cannot garble the dashboard;
- starts minimized after every new page load.

The next phase will add a PDA platform adapter and connect one module at a time,
starting with local session and API-limit coordination.
