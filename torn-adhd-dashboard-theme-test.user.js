// ==UserScript==
// @name         Considious Torn ADHD Dashboard - THEME TEST
// @namespace    Considious [3853023]
// @version      0.1.0
// @description  Visual-only theme prototype for the ADHD Dashboard. Makes no API calls.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/shared/Considious_Torn_Theme_Test.js?v=0.1.0
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  const Theme = globalThis.ConsidiousThemeTest;
  if (!Theme) throw new Error('Considious theme test library failed to load.');

  const host = document.createElement('div');
  host.id = 'tdd-theme-test-host';
  host.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  let collapsed = false;
  let activeView = 'alerts';

  function render() {
    const selected = Theme.getSelected();
    const options = Theme.list().map((theme) => `<option value="${theme.id}" ${theme.id === selected.id ? 'selected' : ''}>${theme.name}</option>`).join('');

    shadow.innerHTML = `
      <style>
        :host { all: initial; ${Theme.cssVariables(selected.id)} }
        * { box-sizing: border-box; }
        .panel {
          width: min(560px, calc(100vw - 24px));
          max-height: calc(100vh - 20px);
          overflow: hidden;
          border: 1px solid var(--sl-border-strong);
          border-radius: 0 0 13px 13px;
          color: var(--sl-text);
          background-color: var(--sl-bg);
          background-image: var(--sl-texture);
          background-size: var(--sl-texture-size);
          box-shadow: var(--sl-glow), 0 14px 40px rgba(0,0,0,.42);
          font: 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
          backdrop-filter: blur(12px);
        }
        .header {
          min-height: 42px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 8px 7px 12px;
          border-bottom: 1px solid var(--sl-border);
          background: linear-gradient(180deg, var(--sl-header-from), var(--sl-header-to));
          box-shadow: var(--sl-header-glow);
        }
        .brand { min-width: 0; flex: 1; font-weight: 800; letter-spacing: .35px; }
        .brand small { display: block; margin-top: 1px; color: var(--sl-muted); font-size: 8px; font-weight: 600; letter-spacing: 1.3px; text-transform: uppercase; }
        .count { display:inline-grid; place-items:center; min-width:22px; height:22px; margin-left:6px; padding:0 6px; border:1px solid var(--sl-border-strong); border-radius:999px; color:var(--sl-accent-strong); background:var(--sl-accent-soft); font-size:11px; }
        button, select { font: inherit; }
        button, select {
          border: 1px solid var(--sl-border);
          border-radius: 7px;
          color: var(--sl-text);
          background: var(--sl-button);
        }
        button { cursor:pointer; }
        button:hover { background: var(--sl-button-hover); border-color: var(--sl-border-strong); }
        .header button { height:27px; padding:0 8px; font-size:11px; font-weight:750; }
        .header button.active { color:var(--sl-accent-strong); border-color:var(--sl-border-strong); background:var(--sl-accent-soft); box-shadow:0 0 12px var(--sl-accent-soft); }
        .body { max-height: min(74vh, 720px); overflow:auto; }
        .theme-bar {
          display:flex;
          align-items:center;
          gap:9px;
          padding:9px 10px;
          border-bottom:1px solid var(--sl-border);
          color:var(--sl-muted);
          background:color-mix(in srgb, var(--sl-surface-soft) 94%, transparent);
        }
        .theme-bar strong { color:var(--sl-accent-strong); }
        .theme-bar span { min-width:0; flex:1; font-size:10px; }
        .theme-bar select { padding:5px 26px 5px 7px; color:var(--sl-text); background-color:var(--sl-surface-raised); }
        .status { display:flex; align-items:center; gap:8px; min-height:34px; padding:7px 10px; color:var(--sl-muted); border-bottom:1px solid var(--sl-border); background:var(--sl-surface-soft); font-size:11px; }
        .status span { flex:1; }
        .status b { color:var(--sl-accent); }
        .toolbar { display:flex; gap:6px; padding:8px 10px; border-bottom:1px solid var(--sl-border); background:color-mix(in srgb, var(--sl-surface) 90%, transparent); }
        .toolbar button { flex:1; padding:6px; font-size:10px; }
        .alerts { background:color-mix(in srgb, var(--sl-bg) 94%, transparent); }
        .alert { display:grid; grid-template-columns:8px minmax(0,1fr) auto; gap:9px; align-items:center; padding:10px; border-bottom:1px solid var(--sl-border); }
        .tone { width:8px; height:38px; border-radius:99px; background:var(--sl-accent); box-shadow:0 0 10px color-mix(in srgb, var(--sl-accent) 50%, transparent); }
        .alert.urgent .tone { background:#ff6868; box-shadow:0 0 10px rgba(255,104,104,.35); }
        .alert.ready .tone { background:#65d69b; box-shadow:0 0 10px rgba(101,214,155,.32); }
        .alert.daily .tone { background:var(--sl-accent); }
        .alert-copy { min-width:0; }
        .alert-title { color:var(--sl-text); font-weight:750; }
        .alert-detail { margin-top:2px; overflow:hidden; color:var(--sl-muted); text-overflow:ellipsis; white-space:nowrap; font-size:11px; }
        .alert-actions { display:flex; gap:4px; }
        .alert-actions button { height:25px; padding:3px 7px; color:var(--sl-text); font-size:10px; }
        .alert-actions .open { color:var(--sl-accent-strong); border-color:var(--sl-border-strong); background:var(--sl-accent-soft); }
        .section {
          margin:10px;
          overflow:hidden;
          border:1px solid var(--sl-border);
          border-radius:9px;
          background:color-mix(in srgb, var(--sl-surface) 95%, transparent);
          box-shadow:inset 0 1px rgba(255,255,255,.02);
        }
        .section-head { display:flex; align-items:center; gap:8px; padding:9px 10px; border-bottom:1px solid var(--sl-border); background:var(--sl-surface-raised); }
        .section-head strong { flex:1; color:var(--sl-accent-strong); }
        .section-head small { color:var(--sl-muted); }
        .cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; padding:9px; }
        .card { min-width:0; padding:8px; border:1px solid var(--sl-border); border-radius:8px; background:var(--sl-surface-soft); }
        .card strong, .card span, .card small { display:block; }
        .card strong { color:var(--sl-text); }
        .card span { margin-top:2px; color:var(--sl-accent-strong); font-size:16px; font-weight:800; }
        .card small { margin-top:2px; color:var(--sl-muted); font-size:8px; text-transform:uppercase; }
        .progress { height:6px; margin-top:7px; overflow:hidden; border-radius:99px; background:rgba(255,255,255,.08); }
        .progress i { display:block; width:72%; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--sl-progress-from),var(--sl-progress-to)); box-shadow:0 0 10px var(--sl-accent-soft); }
        .settings-row { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; padding:9px 10px; border-bottom:1px solid var(--sl-border); }
        .settings-row:last-child { border-bottom:0; }
        .settings-row div strong, .settings-row div small { display:block; }
        .settings-row div small { margin-top:2px; color:var(--sl-muted); font-size:9px; }
        .toggle { width:38px; height:21px; padding:2px; border:1px solid var(--sl-border-strong); border-radius:999px; background:var(--sl-accent-soft); }
        .toggle::after { content:''; display:block; width:15px; height:15px; margin-left:16px; border-radius:50%; background:var(--sl-accent-strong); box-shadow:0 0 8px var(--sl-accent-soft); }
        .footer { padding:8px 10px; color:var(--sl-muted); border-top:1px solid var(--sl-border); background:var(--sl-surface-soft); font-size:9px; }
        .footer b { color:var(--sl-accent); }
        .hidden { display:none !important; }
        @media (max-width:560px) { .cards { grid-template-columns:1fr; } .brand small { display:none; } .header button { padding:0 6px; } }
      </style>

      <section class="panel">
        <header class="header">
          <div class="brand">Daily Dashboard <span class="count">4</span><small>SLINK visual systems / theme prototype</small></div>
          <button data-view="alerts" class="${activeView === 'alerts' ? 'active' : ''}">Alerts</button>
          <button data-view="awards" class="${activeView === 'awards' ? 'active' : ''}">Awards</button>
          <button data-view="settings" class="${activeView === 'settings' ? 'active' : ''}">⚙</button>
          <button data-collapse>${collapsed ? '▾' : '▴'}</button>
        </header>

        <div class="body ${collapsed ? 'hidden' : ''}">
          <div class="theme-bar">
            <span><strong>${selected.name}</strong> — ${selected.description}</span>
            <label>Theme <select data-theme>${options}</select></label>
          </div>

          <div data-pane="alerts" class="${activeView !== 'alerts' ? 'hidden' : ''}">
            <div class="status"><span><b>LIVE PAGE + API FALLBACK</b> · 12/60 shared API calls · updated just now</span><button>Refresh</button></div>
            <div class="toolbar"><button>Snooze all 1h</button><button>Snooze all 1d</button><button>Set Turtle timer</button></div>
            <div class="alerts">
              <article class="alert urgent"><span class="tone"></span><div class="alert-copy"><div class="alert-title">Energy is full</div><div class="alert-detail">150 / 150 · ready for gym or attacks</div></div><div class="alert-actions"><button class="open">Open</button><button>1h</button><button>Off</button></div></article>
              <article class="alert ready"><span class="tone"></span><div class="alert-copy"><div class="alert-title">Drug cooldown is clear</div><div class="alert-detail">You can take a drug now.</div></div><div class="alert-actions"><button class="open">Items</button><button>1h</button><button>Off</button></div></article>
              <article class="alert daily"><span class="tone"></span><div class="alert-copy"><div class="alert-title">Buy 100 items from city shops</div><div class="alert-detail">72 / 100 bought since Torn reset · 28 remaining</div></div><div class="alert-actions"><button class="open">City</button><button>1d</button><button>Off</button></div></article>
              <article class="alert daily"><span class="tone"></span><div class="alert-copy"><div class="alert-title">Mission is unfinished</div><div class="alert-detail">Duke contract: finish 6 more attacks</div></div><div class="alert-actions"><button class="open">Open</button><button>1h</button><button>Off</button></div></article>
            </div>
            <section class="section"><div class="section-head"><strong>Tracked awards</strong><small>3 / 3</small></div><div class="cards"><div class="card"><strong>War Machine</strong><span>72%</span><small>Finishing hits</small><div class="progress"><i></i></div></div><div class="card"><strong>Souvenir</strong><span>Japan</span><small>Assigned destination</small><div class="progress"><i style="width:100%"></i></div></div><div class="card"><strong>Crime Goal</strong><span>84%</span><small>Current progress</small><div class="progress"><i style="width:84%"></i></div></div></div></section>
          </div>

          <div data-pane="awards" class="${activeView !== 'awards' ? 'hidden' : ''}">
            <section class="section"><div class="section-head"><strong>Awards</strong><small>Theme applied to the full body</small></div><div class="cards"><div class="card"><strong>Next goals</strong><span>18</span><small>Shown</small></div><div class="card"><strong>Unspent merits</strong><span>4</span><small>Available</small></div><div class="card"><strong>Tracked</strong><span>3/3</span><small>Current</small></div></div><div class="settings-row"><div><strong>War Machine</strong><small>Reach 1,000 finishing hits in every category.</small><div class="progress"><i style="width:72%"></i></div></div><button>Tracking</button></div><div class="settings-row"><div><strong>Long Haul</strong><small>Another sample award showing card/surface treatment.</small><div class="progress"><i style="width:41%"></i></div></div><button>Track</button></div></section>
          </div>

          <div data-pane="settings" class="${activeView !== 'settings' ? 'hidden' : ''}">
            <section class="section"><div class="section-head"><strong>Appearance</strong><small>Prototype only</small></div><div class="settings-row"><div><strong>Shared SLINK theme</strong><small>Eventually this would be selected once in CoreLib and inherited by compatible scripts.</small></div><select data-theme>${options}</select></div><div class="settings-row"><div><strong>Alarm flash</strong><small>Status colors remain semantic even while the surrounding chrome changes.</small></div><span class="toggle"></span></div><div class="settings-row"><div><strong>Browser notifications</strong><small>The theme changes presentation only — not script behavior.</small></div><span class="toggle"></span></div></section>
            <section class="section"><div class="section-head"><strong>API controls</strong><small>Example themed body section</small></div><div class="settings-row"><div><strong>Shared Torn API</strong><small>12 / 60 calls in the last minute</small></div><button>Pause</button></div><div class="settings-row"><div><strong>Slow API mode</strong><small>Low-priority checks yield first.</small></div><span class="toggle"></span></div></section>
          </div>

          <div class="footer"><b>THEME TEST ONLY:</b> this preview makes no Torn API calls and does not use the production Dashboard storage.</div>
        </div>
      </section>`;

    shadow.querySelectorAll('[data-theme]').forEach((select) => select.addEventListener('change', () => {
      Theme.setSelected(select.value);
      render();
    }));
    shadow.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
      activeView = button.dataset.view;
      render();
    }));
    shadow.querySelector('[data-collapse]')?.addEventListener('click', () => {
      collapsed = !collapsed;
      render();
    });
  }

  globalThis.addEventListener('considious-theme-test-change', render);
  render();
})();
