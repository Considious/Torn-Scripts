// ==UserScript==
// @name         Considious Torn ADHD Dashboard - THEME TEST
// @namespace    Considious [3853023]
// @version      0.4.0
// @description  Visual-only SLINK skin overlay for the real ADHD Dashboard. Preserves layout and functionality.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/shared/Considious_Torn_Theme_Test.js?v=0.4.0
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/torn-adhd-dashboard-theme-test.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/torn-adhd-dashboard-theme-test.user.js
// @grant        GM_registerMenuCommand
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
  const SELECTOR_HOST_ID = 'sl-theme-test-selector-host';

  // Capture the ADHD Dashboard's closed ShadowRoot without changing production code.
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

  const LIGHTNING_RED = svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 100" preserveAspectRatio="none"><defs><filter id="g"><feGaussianBlur stdDeviation="3.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g fill="none" stroke="#ff2c39" filter="url(#g)"><path d="M0 54 L48 53 L67 46 L82 57 L101 22 L116 74 L139 50 L178 53 L194 43 L211 62 L231 13 L250 80 L271 50 L315 53 L333 44 L350 61 L371 25 L389 72 L411 51 L457 54 L476 42 L495 64 L516 17 L535 78 L558 49 L603 53 L621 44 L639 60 L658 30 L674 69 L700 54" stroke-width="2.3" opacity=".78"/><path d="M92 55 L112 39 L127 55 L145 35 M353 58 L372 43 L389 59 L407 37 M520 58 L542 38 L559 56 L578 35" stroke-width="1.3" opacity=".48"/></g></svg>`);
  const LIGHTNING_PURPLE = svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 105" preserveAspectRatio="none"><defs><filter id="g"><feGaussianBlur stdDeviation="4.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g fill="none" stroke="#b43cff" filter="url(#g)"><path d="M0 57 L43 55 L61 45 L77 62 L97 17 L113 82 L137 52 L176 55 L196 41 L215 66 L236 10 L255 85 L279 51 L323 55 L342 42 L361 66 L382 18 L400 81 L424 51 L467 55 L486 39 L507 69 L529 8 L549 86 L573 50 L615 55 L634 42 L653 65 L674 21 L690 76 L700 57" stroke-width="2.5" opacity=".82"/><path d="M78 61 L99 44 L118 62 L140 38 M235 65 L257 45 L276 64 L299 39 M505 67 L527 43 L547 66 L569 37" stroke-width="1.4" opacity=".54"/></g></svg>`);
  const CIRCUIT = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="70" viewBox="0 0 120 70"><g fill="none" stroke="#42d4ff" stroke-width="1" opacity=".22"><path d="M0 18h28l8 8h24l8-8h52M0 51h19l8-8h27l8 8h58M31 0v18M88 0v18M54 43v27"/><circle cx="31" cy="18" r="2"/><circle cx="88" cy="18" r="2"/><circle cx="54" cy="43" r="2"/></g></svg>`);
  const HEX = (color, opacity='.13') => svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="52" height="60" viewBox="0 0 52 60"><g fill="none" stroke="${color}" stroke-width="1" opacity="${opacity}"><path d="M13 1h26l12 14v30L39 59H13L1 45V15z"/><path d="M13 1L1 15m38-14 12 14M1 45l12 14m38-14L39 59"/></g></svg>`);
  const BRUSHED = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="28" viewBox="0 0 160 28"><g stroke="#d0d3d5" opacity=".065"><path d="M0 3h160M0 7h160M0 13h160M0 18h160M0 25h160"/><path d="M12 5h52M84 10h61M28 21h89" stroke-width="2"/></g></svg>`);
  const CRACKS = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="90" viewBox="0 0 180 90"><g fill="none" stroke="#c6cbd0" stroke-width=".8" opacity=".085"><path d="M12 17l22 10 9 17 24-8 19 14 28-6 17 12 35-8M48 44l-8 19 13 13M86 50l4 20 17 8M131 56l-6 18 16 8"/></g></svg>`);
  const BLOOD_MARKS = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="90" viewBox="0 0 220 90"><g fill="#921f2b" opacity=".12"><path d="M13 0h3v90h-3zM32 0h1v90h-1zM178 0h2v90h-2z"/><path d="M0 72h72v2H0zM153 17h67v2h-67z"/></g><g fill="none" stroke="#921f2b" stroke-width="1.2" opacity=".17"><path d="M8 18h30l8 8h31M146 62h24l8-8h34"/></g></svg>`);

  function textureFor(id) {
    switch (id) {
      case 'core': return `${CIRCUIT}, linear-gradient(180deg,rgba(66,212,255,.08),transparent 45%)`;
      case 'tactical': return `${BLOOD_MARKS}, ${BRUSHED}, ${HEX('#7f868b','.09')}, linear-gradient(135deg,rgba(255,255,255,.035),transparent 35%)`;
      case 'redline': return `${LIGHTNING_RED}, ${CRACKS}, linear-gradient(180deg,rgba(255,44,57,.11),transparent 62%)`;
      case 'shadow': return `${CRACKS}, ${BRUSHED}, linear-gradient(160deg,rgba(255,255,255,.025),transparent 42%)`;
      case 'omega': return `${LIGHTNING_PURPLE}, ${HEX('#b43cff','.16')}, radial-gradient(circle at 70% 35%,rgba(180,60,255,.16),transparent 44%)`;
      default: return 'none';
    }
  }

  function backgroundSizes(id, compact = false) {
    if (id === 'core') return compact ? '120px 70px,100% 100%' : '120px 70px,100% 100%';
    if (id === 'tactical') return compact ? '220px 90px,160px 28px,52px 60px,100% 100%' : '220px 90px,160px 28px,52px 60px,100% 100%';
    if (id === 'shadow') return '180px 90px,160px 28px,100% 100%';
    return compact ? '100% 96px,180px 90px,100% 100%' : '100% 110px,180px 90px,100% 100%';
  }

  function buildDashboardCss(theme) {
    const v = theme.vars;
    const isTactical = theme.id === 'tactical';
    const isShadow = theme.id === 'shadow';
    const hardMetal = isTactical || isShadow;
    const bodyTexture = textureFor(theme.id);
    const energyAnimation = theme.id === 'redline' || theme.id === 'omega';
    const mainTextShadow = '0 1px 1px rgba(0,0,0,.95), 1px 0 1px rgba(0,0,0,.8), -1px 0 1px rgba(0,0,0,.8)';

    return `
:host {
  ${Theme.cssVariables(theme.id)}
  color-scheme: dark !important;
}
.panel {
  color: var(--sl-text) !important;
  background-color: var(--sl-bg) !important;
  background-image: ${bodyTexture} !important;
  background-size: ${backgroundSizes(theme.id)} !important;
  background-repeat: repeat !important;
  border-color: var(--sl-border-strong) !important;
  box-shadow: inset 0 0 28px rgba(0,0,0,.60), 0 12px 35px rgba(0,0,0,.48), 0 0 ${energyAnimation ? '15px' : '7px'} var(--sl-accent-soft) !important;
}
.header {
  color: var(--sl-text) !important;
  background-color: var(--sl-header-to) !important;
  background-image: ${bodyTexture}, linear-gradient(180deg,var(--sl-header-from),var(--sl-header-to)) !important;
  background-size: ${backgroundSizes(theme.id, true)}, 100% 100% !important;
  background-position: center !important;
  border-bottom-color: var(--sl-border-strong) !important;
  box-shadow: inset 0 -1px rgba(0,0,0,.72) !important;
}
.title, .alert-title, .tracked-awards-head strong, .tracked-award strong, .empty strong,
.awards-summary strong, .networth-section-title strong, .settings strong, strong {
  color: var(--sl-text) !important;
  text-shadow: ${mainTextShadow} !important;
}
a, a:visited {
  color: var(--sl-link) !important;
  text-shadow: 0 1px 1px rgba(0,0,0,.95) !important;
}
a:hover { color: var(--sl-accent-strong) !important; }
.count, .header-alerts a { color: var(--sl-accent-strong) !important; }
.status, .empty, .alert-detail, .privacy, .daily-api-status, small,
.tracked-award small, .tracked-award > p, .award-progress small { color: var(--sl-muted) !important; }
.body, .toolbar, .status, .settings, .awards-view, .dollar-bazaars, .networth-view { background-color: rgba(0,0,0,.08) !important; }
.status, .toolbar { border-bottom-color: var(--sl-border) !important; }
button, input, textarea, select {
  color: var(--sl-text) !important;
  background-color: var(--sl-button) !important;
  border-color: var(--sl-border) !important;
  box-shadow: inset 0 1px rgba(255,255,255,.035) !important;
  color-scheme: dark !important;
  text-shadow: 0 1px 1px rgba(0,0,0,.85) !important;
}
select option, select optgroup {
  color: var(--sl-text) !important;
  background: var(--sl-surface-raised) !important;
  text-shadow: none !important;
}
button:hover, select:hover, input:hover { border-color: var(--sl-border-strong) !important; }
.view-button.active, button.active {
  color: var(--sl-accent-strong) !important;
  border-color: var(--sl-border-strong) !important;
  background: var(--sl-accent-soft) !important;
}
.alert {
  position: relative !important;
  background-color: rgba(0,0,0,.17) !important;
  background-image: ${bodyTexture} !important;
  background-size: ${backgroundSizes(theme.id, true)} !important;
  background-position: center !important;
  border-bottom-color: ${hardMetal ? 'var(--sl-border-strong)' : 'var(--sl-border)'} !important;
  box-shadow: ${isTactical ? 'inset 4px 0 rgba(146,31,43,.62), inset -1px 0 rgba(150,155,160,.18), inset 0 1px rgba(255,255,255,.045), inset 0 -1px rgba(0,0,0,.8)' : isShadow ? 'inset 3px 0 rgba(205,210,214,.25), inset -1px 0 rgba(130,136,140,.18), inset 0 1px rgba(255,255,255,.05), inset 0 -1px rgba(0,0,0,.82)' : 'inset 0 0 16px rgba(0,0,0,.18)'} !important;
}
.alert-actions a {
  color: var(--sl-text) !important;
  background: var(--sl-button) !important;
  border-color: var(--sl-border-strong) !important;
  text-shadow: ${mainTextShadow} !important;
}
.tracked-awards {
  background-color: var(--sl-surface) !important;
  background-image: ${bodyTexture} !important;
  background-size: ${backgroundSizes(theme.id, true)} !important;
  border-top-color: var(--sl-border) !important;
}
.tracked-award,
.awards-summary > div,
.award-progress,
.award-card,
.settings-section,
.market-watch,
.pawn-candidate,
.networth-summary,
.networth-live,
.networth-history,
.daily-api-status,
.privacy,
.exclusion,
.catalog-controls,
.awards-controls,
.networth-session,
.dollar-bazaar-row {
  background-color: var(--sl-surface-soft) !important;
  background-image: ${hardMetal ? bodyTexture : 'linear-gradient(180deg,rgba(255,255,255,.018),transparent)'} !important;
  background-size: ${hardMetal ? backgroundSizes(theme.id, true) : '100% 100%'} !important;
  border-color: var(--sl-border) !important;
  box-shadow: inset 0 0 12px rgba(0,0,0,.24) !important;
}
.tracked-award.completed, .award-progress.reached {
  border-color: var(--sl-success) !important;
  background-color: color-mix(in srgb, var(--sl-surface-soft) 88%, var(--sl-success) 12%) !important;
}
.award-progress-meter, .progress, [class*="progress-meter"] {
  border-color: var(--sl-border) !important;
  background-color: rgba(0,0,0,.58) !important;
}
.award-progress-meter i, .progress > i { background: var(--sl-accent) !important; box-shadow: 0 0 6px var(--sl-accent-soft) !important; }
progress, .progress, [class*="progress"] { accent-color: var(--sl-accent) !important; }
input[type="checkbox"], input[type="radio"] { accent-color: var(--sl-accent) !important; }
${energyAnimation ? `
@keyframes slinkThemeEnergyPulse { 0%,100% { filter:none; } 50% { filter:drop-shadow(0 0 3px var(--sl-accent)); } }
.header { animation:slinkThemeEnergyPulse 3.8s ease-in-out infinite; }
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
      syncSelector(theme);
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

  function setTheme(id) {
    Theme.setSelected(id);
    applyTheme();
  }

  function buildSelector() {
    let host = document.getElementById(SELECTOR_HOST_ID);
    if (host) {
      host.style.display = '';
      syncSelector(Theme.getSelected());
      return;
    }
    host = document.createElement('div');
    host.id = SELECTOR_HOST_ID;
    host.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;';
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode:'open' });
    root.innerHTML = `<style>
      :host{all:initial;color-scheme:dark}
      .box{display:flex;align-items:center;gap:6px;padding:6px 7px;border:1px solid #586269;border-radius:8px;background:#101417;box-shadow:0 5px 18px rgba(0,0,0,.6);font:11px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#eef3f6}
      label{font-weight:750;color:#b7c0c6}
      select{min-width:104px;color:#f7f9fa;background:#20262b;border:1px solid #68747b;border-radius:5px;padding:4px 22px 4px 6px;color-scheme:dark;font:inherit}
      option,optgroup{color:#f7f9fa;background:#14191d}
      button{width:24px;height:24px;border:1px solid #68747b;border-radius:5px;color:#e4eaee;background:#20262b;cursor:pointer}
    </style><div class="box"><label>SLINK Theme</label><select id="theme"></select><button id="hide" title="Hide theme selector">×</button></div>`;
    root.getElementById('theme').addEventListener('change', (e) => setTheme(e.target.value));
    root.getElementById('hide').addEventListener('click', () => { host.style.display='none'; });
    host._slRoot = root;
    syncSelector(Theme.getSelected());
  }

  function syncSelector(theme) {
    const host = document.getElementById(SELECTOR_HOST_ID);
    const root = host?._slRoot || host?.shadowRoot;
    if (!root) return;
    const select = root.getElementById('theme');
    if (!select) return;
    select.innerHTML = Theme.list().map(t => `<option value="${t.id}" ${t.id===theme.id?'selected':''}>${t.name}</option>`).join('');
  }

  if (typeof GM_registerMenuCommand === 'function') {
    Theme.list().forEach((theme) => {
      GM_registerMenuCommand(`SLINK Theme: ${theme.name}`, () => setTheme(theme.id));
    });
    GM_registerMenuCommand('SLINK Theme: Show selector', buildSelector);
  }

  addEventListener('considious-theme-test-change', applyTheme);
})();
