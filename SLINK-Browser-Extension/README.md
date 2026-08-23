# SLINK Browser Extension

Chrome-first Manifest V3 client for Shared Live Intelligence NetworK systems.

Version 0.3 adds Worker-issued permissions and the first protected administrative control on top of the Leveling foundation:

- Torn-only content injection
- a background service worker
- extension-scoped storage
- scheduled alarms
- background/content messaging
- browser capability declarations
- D1-backed, Worker-issued role and scope handling
- `slink.level` access for the complete Leveling service
- a private `admin.*` namespace for Considious
- an admin-only zero routine API-contribution override
- a module registry
- a movable, position-persistent in-page panel and toolbar popup
- an automatic SLINK Worker connection check
- a readable, selectable diagnostic report
- a full-tab SLINK dashboard outside Torn
- live Worker terms and authenticated member sessions
- Leveling recommendations and local Fair Fight estimates
- FFScouter refinement cached locally
- coordinated, paced Torn status collection and durable retry state
- activity-snapshot and attack-page observation reporting

The Torn and FFScouter API keys and signed SLINK session stay in extension-local
background storage and are never returned to the Torn content script or dashboard.
The Torn key is sent to the SLINK Worker only during authentication, matching the
current Leveling terms and Worker contract.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `SLINK-Browser-Extension` folder.
5. Open Torn and click the SLINK extension button.
6. Choose **Open SLINK dashboard** for full-page setup and monitoring.

`Load unpacked` is the development installation flow. A published Chrome Web
Store build will use Chrome's normal one-click installation flow.

## Test it

The tests use Node.js only; there are no packages to install.

```text
npm test
```

## Architecture

```text
Torn page content script
    <-> runtime messages
Extension service worker
    <-> extension storage / alarms / approved remote APIs
SLINK Worker, Torn API, and FFScouter
```

`src/core` contains shared extension-safe replacements for the reusable parts of Core Lib. Page-specific DOM work stays in `src/content`; privileged network and scheduling work stays in `src/background`.

## Permission model

SLINK uses two separate permission layers:

1. **Browser capabilities** control which browser APIs and remote origins the installed extension may access. Torn, Torn API, FFScouter, and the SLINK Worker are core dependencies and are granted together at installation. There are no separate in-app permission buttons.
2. **SLINK scopes** are supplied by the authenticated SLINK Worker and control which modules and server operations the Torn user may use.

Before authentication, the extension has no SLINK server scopes; local diagnostics remain available because they are installation checks, not protected SLINK data. A successful Worker session receives `slink.level`. Considious also receives `admin.*` from D1. The Worker signs those scopes into the session and remains authoritative for every protected route.

`admin.*` exposes the zero routine API-contribution override in both the Torn panel and full dashboard. The Worker rejects a zero-capacity claim from any session without that scope. Authentication still performs one Torn key validation, and Leveling may refresh the administrator's own battle stats locally; the override applies to routine shared-service contribution checks.

## Interface rule

SLINK overlay panels must be movable with mouse and touch, persist their last
position, remain clamped inside the visible viewport, and provide a position
reset. New modules should use the shared UI shell instead of creating immovable
overlay windows.

## Adding a module

A module registers an ID, its required SLINK scopes, a URL matcher, and `start`/`stop` functions. Add its script before `src/content/content-script.js` in the manifest.

```javascript
SLINK_EXTENSION.modules.register({
  id: 'example',
  requiredScopes: ['example.read'],
  matches: url => url.hostname === 'www.torn.com',
  async start(context) {
    context.ui.setStatus('Example ready', 'ready');
  }
});
```

## Planned next milestone

Verify Leveling against live Torn use, harden upgrade and recovery behavior, then package a reviewable Chrome Web Store build. Admin remains a separate private module sharing the same core.
