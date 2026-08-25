# SLINK Browser Extension

Chrome-first Manifest V3 client for Shared Live Intelligence NetworK systems.

Version 0.6.0 adds the first shared **SLINK War** module. The dashboard places
Leveling on the left and War on the right, with Targets, Retals, and Logs using
the same lower workspace. The Torn interface can run fully in Torn, extension
only, or in hybrid mode where it stays out of the way until a retal alert needs
attention. New elements use semantic module classes and central theme tokens
so future themes do not require rebuilding feature markup.

The War module uses `slink.war` for product access. It elects one active public
status collector, prioritizing clients without faction API access, and one
faction-capable attack collector. Live snapshots, retals, deduplication, and
collector leases remain in a per-war Durable Object. D1 receives only
ten-minute aggregate counters for losses, escapes, and observed-online war
hits. `slink.war.faction` is detected during authentication and is never a
purchased or manually assigned permission.

Version 0.5.0 added demand-aware API contribution to the multi-feature
interface foundation. Leveling can now run in **Contribute API only** mode:
it supplies assigned checks without showing targets or counting as an active
Leveling user. A normal Leveling session also stops creating demand after 20
minutes without interface activity and resumes as soon as the user interacts.

Version 0.4.1 added the multi-feature interface foundation and encrypted,
extension-wide Public Only API key donations:

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
- a permission-aware module registry with per-module Torn visibility
- a tabbed main Torn panel for enabled modules
- per-module pop-out/pop-back-in controls and persistent movable positions
- centralized theme tokens for future interface themes
- a dashboard-level API Donation area with its own optional Torn tab
- remote AES-GCM storage for donated Public Only keys through the separate
  SLINK Contribution Service
- revocation that erases remote encrypted key material
- an automatic SLINK Worker connection check
- a readable, selectable diagnostic report
- a full-tab SLINK dashboard outside Torn
- live Worker terms and authenticated member sessions
- Leveling recommendations and local Fair Fight estimates
- FFScouter refinement cached locally
- coordinated, paced Torn status collection and durable retry state
- deterministic client-side target ownership across active collectors
- local completion of unchanged `Okay` checks without a Worker or D1 request
- activity-snapshot and attack-page observation reporting

The Leveling Torn and FFScouter API keys and signed SLINK session stay in extension-local
background storage and are never returned to the Torn content script or dashboard.
The Torn key is sent to the SLINK Worker only during authentication, matching the
current Leveling terms and Worker contract.

A donated Public Only key follows a different, explicit consent flow. It is
validated and encrypted by the SLINK Contribution Service for allowlisted
public requests while the donor is offline. Feature modules cannot retrieve
the plaintext key. The extension retains only a random management token used
to view or revoke the donation.

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
SLINK Workers, Torn API, and FFScouter
```

`src/core` contains shared extension-safe replacements for the reusable parts of Core Lib. Page-specific DOM work stays in `src/content`; privileged network and scheduling work stays in `src/background`.

## Permission model

SLINK uses two separate permission layers:

1. **Browser capabilities** control which browser APIs and remote origins the installed extension may access. Torn, Torn API, FFScouter, and the SLINK Worker are core dependencies and are granted together at installation. There are no separate in-app permission buttons.
2. **SLINK scopes** are supplied by the authenticated SLINK Worker and control which modules and server operations the Torn user may use.

Before authentication, the extension has no SLINK server scopes; local diagnostics remain available because they are installation checks, not protected SLINK data. Torn authentication establishes identity, while the standalone `slink-permissions` D1 database supplies product access. Current Slinky's members receive `slink.level` and `slink.war` automatically; users outside the faction may receive either product scope through an active purchased or manual grant. A successful faction-attack capability probe adds the temporary `slink.war.faction` scope for that War session. Considious also receives `admin.*`. Each Worker signs its product scopes into its own session, and the extension combines them only for module visibility.

`admin.*` exposes the zero routine API-contribution override in both the Torn panel and full dashboard. The Worker rejects a zero-capacity claim from any session without that scope. Authentication still performs one Torn key validation, and Leveling may refresh the administrator's own battle stats locally; the override applies to routine shared-service contribution checks.

## Interface rule

SLINK overlay panels must be movable with mouse and touch, persist their last
position, remain clamped inside the visible viewport, and provide a position
reset. Every feature uses the shared tabbed shell. A feature can be popped into
its own movable window and returned to the main panel without losing state.
Tabs are created only when the user's scope permits the module and its **Show
GUI in Torn** preference is enabled.

## Adding a module

A module registers an ID, its required SLINK scopes, a URL matcher, and `start`/`stop` functions. Add its script before `src/content/content-script.js` in the manifest.

```javascript
SLINK_EXTENSION.modules.register({
  id: 'example',
  title: 'Example',
  defaultShowInTorn: false,
  requiredScopes: ['example.read'],
  matches: url => url.hostname === 'www.torn.com',
  async start(context) {
    context.ui.setStatus('Example ready', 'ready');
  }
});
```

## Planned next milestone

Verify Leveling and War against live Torn use, then add the next feature module to the same shared shell. Admin remains a separate private module sharing the same core.
