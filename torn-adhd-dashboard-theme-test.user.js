// ==UserScript==
// @name         Considious Torn ADHD Dashboard - THEME TEST
// @namespace    Considious [3853023]
// @version      0.3.0
// @description  Visual-only SLINK skin overlay for the real ADHD Dashboard. Preserves layout and functionality.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/shared/Considious_Torn_Theme_Test.js?v=0.3.0
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/torn-adhd-dashboard-theme-test.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/torn-adhd-dashboard-theme-test.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const Theme = globalThis.ConsidiousThemeTest;
  if (!Theme) throw new Error('Considious theme test library failed to load.');

  let dashboardRoot = null;
  let observer = null;
  let applying = false;
  const STYLE_ID = 'sl-theme-overlay-style';

  // Capture the ADHD Dashboard's closed ShadowRoot without changing the production dashboard.
  const nativeAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function patchedAttachShadow(init) {
    const root = nativeAttachShadow.call(this, init);
    if (this.id === 'tdd-host') {
      dashboardRoot = root;
      queueMicrotask(startWatchingDashboard);
    }
    return root;
  };

  const svgData = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  const LIGHTNING_RED = svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 80" preserveAspectRatio="none"><defs><filter id="g"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M0 43 L42 42 L58 37 L72 46 L89 21 L102 58 L122 40 L162 42 L176 36 L190 49 L207 13 L221 62 L240 40 L286 42 L300 36 L314 48 L329 23 L342 56 L362 41 L405 43 L421 35 L435 49 L451 17 L465 59 L487 40 L531 42 L545 36 L560 47 L576 28 L588 51 L600 43" fill="none" stroke="#ff3440" stroke-width="2.2" opacity=".82" filter="url(#g)"/></svg>`);
  const LIGHTNING_PURPLE = svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 90" preserveAspectRatio="none"><defs><filter id="g"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M0 48 L36 46 L52 38 L66 53 L82 18 L95 66 L116 44 L151 46 L169 36 L186 55 L202 12 L218 69 L239 45 L279 47 L296 37 L312 56 L329 16 L345 67 L367 44 L405 46 L421 34 L440 58 L458 10 L475 70 L497 43 L535 46 L551 38 L566 54 L582 23 L593 57 L600 48" fill="none" stroke="#ae3fff" stroke-width="2.4" opacity=".86" filter="url(#g)"/></svg>`);
  const CIRCUIT = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="70" viewBox="0 0 120 70"><g fill="none" stroke="#42d4ff" stroke-width="1" opacity=".22"><path d="M0 18h28l8 8h24l8-8h52M0 51h19l8-8h27l8 8h58M31 0v18M88 0v18M54 43v27"/><circle cx="31" cy="18" r="2"/><circle cx="88" cy="18" r="2"/><circle cx="54" cy="43" r="2"/></g></svg>`);
  const HEX = (color, opacity='.13') => svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="52" height="60" viewBox="0 0 52 60"><g fill="none" stroke="${color}" stroke-width="1" opacity="${opacity}"><path d="M13 1h26l12 14v30L39 59H13L1 45V15z"/><path d="M13 1L1 15m38-14 12 14M1 45l12 14m38-14L39 59"/></g></svg>`);
  const BRUSHED = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="28" viewBox="0 0 160 28"><g stroke="#c7cbd0" opacity=".055"><path d="M0 3h160M0 7h160M0 13h160M0 18h160M0 25h160"/><path d="M12 5h52M84 10h61M28 21h89" stroke-width="2"/></g></svg>`);
  const CRACKS = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="90" viewBox="0 0 180 90"><g fill="none" stroke="#bfc4c8" stroke-width=".8" opacity=".08"><path d="M12 17l22 10 9 17 24-8 19 14 28-6 17 12 35-8M48 44l-8 19 13 13M86 50l4 20 17 8M131 56l-6 18 16 8"/></g></svg>`);

  function textureFor(id) {
    switch (id) {
      case 'core': return `${CIRCUIT}, linear-gradient(180deg,rgba(66,212,255,.08),transparent 45%)`;
      case 'tactical': return `${BRUSHED}, ${HEX('#7f868b','.10')}, linear-gradient(135deg,rgba(255,255,255,.035),transparent 35%)`;
      case 'redline': return `${LIGHTNING_RED}, ${CRACKS}, linear-gradient(180deg,rgba(255,52,64,.09),transparent 58%)`;
      case 'shadow': return `${CRACKS}, ${BRUSHED}, linear-gradient(160deg,rgba(255,255,255,.025),transparent 42%)`;
      case 'omega': return `${LIGHTNING_PURPLE}, ${HEX('#ae3fff','.16')}, radial-gradient(circle at 70% 35%,rgba(174,63,255,.14),transparent 42%)`;
      default: return 'none';
    }
  }

  function buildDashboardCss(theme) {
    const v = theme.vars;
    const isTactical = theme.id === 'tactical';
    const isShadow = theme.id === 'shadow';
    const hardMetal = isTactical || isShadow;
    const alertBorder = hardMetal ? v.borderStrong : v.border;
    const bodyTexture = textureFor(theme.id);
    const energyAnimation = theme.id === 'redline' || theme.id === 'omega';

    return `
:host {
  ${Theme.cssVariables(theme.id)}
  color-scheme: dark !important;
}
.panel {
  color: var(--sl-text) !important;
  background-color: var(--sl-bg) !important;
  background-image: ${bodyTexture} !important;
  background-size: ${theme.id === 'core' ? '120px 70px,100% 100%' : theme.id === 'tactical' ? '160px 28px,52px 60px,100% 100%' : theme.id === 'shadow' ? '180px 90px,160px 28px,100% 100%' : '100% 80px,180px 90px,100% 100%'} !important;
  background-repeat: ${theme.id === 'redline' || theme.id === 'omega' ? 'repeat-y,repeat,repeat' : 'repeat,repeat,repeat'} !important;
  border-color: var(--sl-border-strong) !important;
  box-shadow: inset 0 0 28px rgba(0,0,0,.58), 0 12px 35px rgba(0,0,0,.48), 0 0 ${energyAnimation ? '14px' : '7px'} var(--sl-accent-soft) !important;
}
.header {
  color: var(--sl-text) !important;
  background-color: var(--sl-header-to) !important;
  background-image: ${bodyTexture}, linear-gradient(180deg,var(--sl-header-from),var(--sl-header-to)) !important;
  background-size: ${theme.id === 'redline' || theme.id === 'omega' ? '100% 72px,auto,100% 100%' : 'auto,auto,100% 100%'} !important;
  background-position: center,center,center !important;
  border-bottom-color: var(--sl-border-strong) !important;
  box-shadow: inset 0 -1px rgba(0,0,0,.72) !important;
}
.title, .empty strong, strong { color: var(--sl-text) !important; }
.count, a, .header-alerts a { color: var(--sl-accent-strong) !important; }
.status, .empty, .alert-detail, .privacy, .daily-api-status, small { color: var(--sl-muted) !important; }
.body, .toolbar, .status, .settings, .awards, .dollar-bazaars, .networth-view { background-color: rgba(0,0,0,.08) !important; }
.status, .toolbar { border-bottom-color: var(--sl-border) !important; }
button, input, textarea, select {
  color: var(--sl-text) !important;
  background-color: var(--sl-button) !important;
  border-color: var(--sl-border) !important;
  box-shadow: inset 0 1px rgba(255,255,255,.035) !important;
  color-scheme: dark !important;
}
select option, select optgroup {
  color: var(--sl-text) !important;
  background: var(--sl-surface-raised) !important;
}
button:hover, select:hover, input:hover { border-color: var(--sl-border-strong) !important; }
.view-button.active, button.active {
  color: var(--sl-accent-strong) !important;
  border-color: var(--sl-border-strong) !important;
  background: var(--sl-accent-soft) !important;
}
.alert {
  position: relative !important;
  background-color: rgba(0,0,0,.16) !important;
  background-image: ${bodyTexture} !important;
  background-size: ${theme.id === 'redline' || theme.id === 'omega' ? '100% 72px,180px 90px,100% 100%' : theme.id === 'tactical' ? '160px 28px,52px 60px,100% 100%' : theme.id === 'shadow' ? '180px 90px,160px 28px,100% 100%' : '120px 70px,100% 100%'} !important;
  background-position: center !important;
  border-bottom: 1px solid ${alertBorder} !important;
  box-shadow: ${hardMetal ? 'inset 0 1px rgba(255,255,255,.06), inset 0 -1px rgba(0,0,0,.8)' : 'inset 0 0 16px rgba(0,0,0,.18)'} !important;
}
${isTactical ? `.alert { border-left:3px solid rgba(143,38,48,.82) !important; border-right:1px solid rgba(127,134,139,.28) !important; }` : ''}
${isShadow ? `.alert { border-left:2px solid rgba(207,213,217,.35) !important; border-right:1px solid rgba(130,136,140,.22) !important; }` : ''}
.alert-actions a {
  color: var(--sl-text) !important;
  background: var(--sl-button) !important;
  border-color: var(--sl-border-strong) !important;
}
.settings-section, .tracked-award-card, .award-card, .market-watch, .pawn-candidate,
.networth-summary, .networth-live, .networth-history, .daily-api-status, .privacy, .exclusion,
.catalog-controls, .awards-controls, .networth-session, .dollar-bazaar-row {
  background-color: var(--sl-surface-soft) !important;
  border-color: var(--sl-border) !important;
  box-shadow: inset 0 0 12px rgba(0,0,0,.22) !important;
}
progress, .progress, [class*="progress"] { accent-color: var(--sl-accent) !important; }
input[type="checkbox"], input[type="radio"] { accent-color: var(--sl-accent) !important; }
${energyAnimation ? `
@keyframes slinkThemeEnergyPulse { 0%,100% { filter:none; } 50% { filter:drop-shadow(0 0 3px var(--sl-accent)); } }
.header { animation:slinkThemeEnergyPulse 3.6s ease-in-out infinite; }
` : ''}
`;
  }

  function applyTheme() {
    if (!dashboardRoot || applying) return;
    applying = true;
    try {
      const theme = Theme.getSelected();
      let style = dashboardRoot.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        dashboardRoot.appendChild(style);
      }
      style.textContent = buildDashboardCss(theme);
      buildSelector(theme);
    } finally {
      applying = false;
    }
  }

  function startWatchingDashboard() {
    if (!dashboardRoot) return;
    observer?.disconnect();
    observer = new MutationObserver(() => {
      if (!dashboardRoot.getElementById(STYLE_ID)) queueMicrotask(applyTheme);
    });
    observer.observe(dashboardRoot, { childList:true, subtree:false });
    applyTheme();
  }

  function buildSelector(theme) {
    let host = document.getElementById('sl-theme-test-selector-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'sl-theme-test-selector-host';
      host.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;';
      document.documentElement.appendChild(host);
      const root = host.attachShadow({ mode:'open' });
      root.innerHTML = `<style>
        :host{all:initial;color-scheme:dark}
        .box{display:flex;align-items:center;gap:6px;padding:6px 7px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#11161a;box-shadow:0 5px 18px rgba(0,0,0,.55);font:11px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#eaf1f5}
        label{font-weight:750;color:#aeb9c0}
        select{min-width:92px;color:#f2f5f7;background:#20272c;border:1px solid #59646b;border-radius:5px;padding:4px 22px 4px 6px;color-scheme:dark;font:inherit}
        option,optgroup{color:#f2f5f7;background:#161b1f}
        button{width:24px;height:24px;border:1px solid #59646b;border-radius:5px;color:#d8e0e5;background:#20272c;cursor:pointer}
      </style><div class="box"><label>SLINK Theme</label><select id="theme"></select><button id="hide" title="Hide theme selector">×</button></div>`;
      root.getElementById('theme').addEventListener('change', (e) => Theme.setSelected(e.target.value));
      root.getElementById('hide').addEventListener('click', () => { host.style.display='none'; });
      host._slRoot = root;
    }
    const root = host._slRoot || host.shadowRoot;
    if (!root) return;
    const select = root.getElementById('theme');
    select.innerHTML = Theme.list().map(t => `<option value="${t.id}" ${t.id===theme.id?'selected':''}>${t.name}</option>`).join('');
  }

  addEventListener('considious-theme-test-change', applyTheme);

  // If this test script was injected after the Dashboard on a live page, a reload is required
  // because the production Dashboard intentionally uses a closed ShadowRoot.
  setTimeout(() => {
    if (!dashboardRoot) buildSelector(Theme.getSelected());
  }, 1500);
})();
