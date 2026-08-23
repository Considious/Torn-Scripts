# SLINK Browser Extension

Chrome-first Manifest V3 foundation for Shared Live Intelligence NetworK systems.

This initial version intentionally contains no Leveling or Admin implementation. It proves the shared infrastructure those systems will use:

- Torn-only content injection
- a background service worker
- extension-scoped storage
- scheduled alarms
- background/content messaging
- browser capability declarations
- server-supplied role and scope handling
- a module registry
- a shared in-page panel and toolbar popup
- a harmless diagnostic module

The diagnostic module makes no external requests and sends no Torn data anywhere.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `SLINK-Browser-Extension` folder.
5. Open Torn and click the SLINK extension button.

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
SLINK Worker and optional services
```

`src/core` contains shared extension-safe replacements for the reusable parts of Core Lib. Page-specific DOM work stays in `src/content`; privileged network and scheduling work stays in `src/background`.

## Permission model

SLINK uses two separate permission layers:

1. **Browser capabilities** control which browser APIs and remote origins the installed extension may access. Optional origins are declared in `manifest.json` and requested by a user action in the popup.
2. **SLINK scopes** are supplied by the authenticated SLINK Worker and control which modules and server operations the Torn user may use.

The current bootstrap identity has only `diagnostics.read`. It is deliberately local and temporary. Future authentication will replace that snapshot with a signed or server-verified session response. Client-side scope checks are for routing and UI only; every protected Worker endpoint must enforce its own permissions.

Suggested future scopes include:

- `leveling.read`
- `leveling.contribute`
- `leveling.configure`
- `admin.*`

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

After this foundation is verified in Chrome, SLINK Leveling can be migrated as the first real module. Admin should remain a separate private build that shares the same core packages and relies on server-side `admin.*` authorization.
