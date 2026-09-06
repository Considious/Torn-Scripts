// ==UserScript==
// @name         SLINK PDA Dashboard Prototype
// @namespace    Considious [3853023]
// @version      0.1.0
// @description  Mobile-first SLINK dashboard shell for Torn PDA. This prototype makes no network or API requests.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/SLINK_PDA_Dashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/SLINK_PDA_Dashboard.user.js
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function installSlinkPdaDashboard(global) {
  'use strict';

  const BUILD = '0.1.0-prototype';
  const HOST_ID = 'slink-pda-dashboard-host';
  const STORAGE_KEY = 'slink-pda-dashboard:ui:v1';
  const ROOT_OVERFLOW_KEY = 'slinkPdaPreviousOverflow';

  if (global.SLINK_PDA_DASHBOARD?.build === BUILD) {
    global.SLINK_PDA_DASHBOARD.open();
    return;
  }
  document.getElementById(HOST_ID)?.remove();

  const defaults = Object.freeze({
    page: 'combat',
    combatTab: 'leveling',
    efficiencyTab: 'alerts',
    theme: 'slink-dark',
    bubblePosition: null
  });

  function readState() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
    } catch {
      return { ...defaults };
    }
  }

  function writeState() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        page: state.page,
        combatTab: state.combatTab,
        efficiencyTab: state.efficiencyTab,
        theme: state.theme,
        bubblePosition: state.bubblePosition
      }));
    } catch {}
  }

  const state = readState();
  let dashboardOpen = false;
  let drag = null;
  let swipe = null;
  let host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      --s-bg:#0b1118;--s-panel:#121b25;--s-card:#17222e;--s-control:#223140;
      --s-border:rgba(132,199,255,.43);--s-soft:rgba(255,255,255,.11);
      --s-text:#edf7ff;--s-muted:#9fb2c4;--s-accent:#3b8cca;--s-alt:#75c1ff;
      --s-ready:#91e2a8;--s-warning:#ffd174;--s-error:#ff9c9c;
      --s-shadow:rgba(0,0,0,.72);--s-page:radial-gradient(circle at 50% -20%,#203950 0,#0b1118 48%,#070b10 100%);
      all:initial;color-scheme:dark;font-family:Arial,sans-serif;
    }
    :host([data-theme="slinky-pursuit"]){--s-bg:#03070c;--s-panel:#080e16;--s-card:#0e1621;--s-control:#172334;--s-border:rgba(232,239,246,.68);--s-text:#f7fbff;--s-muted:#adbac8;--s-accent:#167fe8;--s-alt:#ef3333;--s-ready:#7dd8ff;--s-warning:#ffca57;--s-page:radial-gradient(circle at 4% 0,rgba(220,25,25,.34),transparent 34%),radial-gradient(circle at 96% 0,rgba(20,115,255,.36),transparent 36%),#02050a}
    :host([data-theme="slinky-underglow"]){--s-bg:#020303;--s-panel:#070909;--s-card:#0d1010;--s-control:#161a19;--s-border:rgba(211,181,255,.69);--s-text:#faf7fc;--s-muted:#b9b0c0;--s-accent:#9f43ed;--s-alt:#74ef42;--s-ready:#9cff74;--s-warning:#dcff61;--s-page:radial-gradient(circle at 8% 100%,rgba(82,255,28,.25),transparent 38%),radial-gradient(circle at 92% 0,rgba(171,51,255,.31),transparent 42%),#010202}
    *{box-sizing:border-box}
    button,select{font:inherit}
    button{min-height:44px;border:1px solid var(--s-border);border-radius:9px;background:var(--s-control);color:var(--s-text);cursor:pointer;touch-action:manipulation}
    button:active{filter:brightness(1.25);transform:translateY(1px)}
    .launcher{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483647;display:grid;width:58px;height:58px;min-height:58px;padding:0;place-items:center;border:1px solid var(--s-border);border-radius:50%;background:linear-gradient(145deg,var(--s-accent),var(--s-bg));box-shadow:0 8px 25px var(--s-shadow),-3px 0 13px color-mix(in srgb,var(--s-alt) 45%,transparent),3px 0 13px color-mix(in srgb,var(--s-accent) 55%,transparent);cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none}
    .launcher[data-dragging="true"]{cursor:grabbing;transform:scale(1.06)}
    .launcher[data-open="true"]{border-color:var(--s-alt);box-shadow:0 0 0 3px color-mix(in srgb,var(--s-alt) 22%,transparent),0 8px 25px var(--s-shadow)}
    .coil{position:relative;width:31px;height:27px;pointer-events:none}.coil i{position:absolute;left:3px;width:25px;height:10px;border:2px solid #edf4f7;border-radius:50%;filter:drop-shadow(0 0 3px var(--s-alt))}.coil i:nth-child(1){top:0}.coil i:nth-child(2){top:6px}.coil i:nth-child(3){top:12px}.coil i:nth-child(4){top:18px}
    .launcher-label{position:absolute;right:52px;padding:5px 8px;border:1px solid var(--s-soft);border-radius:7px;background:var(--s-panel);color:var(--s-text);font:bold 10px/1 Arial,sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transform:translateX(5px);transition:.16s}.launcher:focus-visible .launcher-label,.launcher:hover .launcher-label{opacity:1;transform:none}
    .overlay[hidden]{display:none}.overlay{position:fixed;inset:0;z-index:2147483646;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;background:var(--s-page);color:var(--s-text);font:13px/1.42 Arial,sans-serif;overscroll-behavior:contain}
    .topbar{display:flex;align-items:center;gap:10px;min-height:64px;padding:max(9px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 9px max(14px,env(safe-area-inset-left));border-bottom:1px solid var(--s-border);background:color-mix(in srgb,var(--s-bg) 94%,transparent);box-shadow:0 7px 22px var(--s-shadow);touch-action:pan-x}
    .brand-mark{display:grid;width:39px;height:39px;flex:0 0 auto;place-items:center;border-radius:10px;background:linear-gradient(145deg,var(--s-accent),var(--s-bg));box-shadow:inset 0 0 0 1px var(--s-border),0 0 13px color-mix(in srgb,var(--s-alt) 30%,transparent);font-weight:900}
    .brand{min-width:0;flex:1}.brand strong,.brand span{display:block}.brand strong{font-size:15px}.brand span{overflow:hidden;color:var(--s-muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
    .prototype{padding:4px 7px;border:1px solid var(--s-warning);border-radius:999px;color:var(--s-warning);font-size:9px;font-weight:700;white-space:nowrap}
    .close{width:46px;flex:0 0 46px;padding:0;font-size:22px}
    .primary-nav{display:flex;gap:7px;padding:8px max(14px,env(safe-area-inset-right)) 8px max(14px,env(safe-area-inset-left));border-bottom:1px solid var(--s-soft);background:color-mix(in srgb,var(--s-panel) 93%,transparent)}
    .primary-nav button{min-width:105px;padding:7px 17px;color:var(--s-muted);font-weight:700}.primary-nav button[aria-selected="true"]{border-color:var(--s-alt);background:linear-gradient(135deg,var(--s-accent),var(--s-control));color:var(--s-text);box-shadow:0 0 12px color-mix(in srgb,var(--s-alt) 22%,transparent)}
    .scroll{min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:14px max(14px,calc((100vw - 1240px)/2)) max(24px,env(safe-area-inset-bottom))}
    .page[hidden],.subpage[hidden]{display:none}
    .page-head{display:flex;align-items:start;gap:12px;margin:2px 0 12px}.page-head>div{min-width:0;flex:1}.page-head h1{margin:0;font-size:22px}.page-head p{margin:3px 0 0;color:var(--s-muted)}
    .page-actions{display:flex;gap:7px}.page-actions button{padding:6px 12px}
    .subnav{display:flex;gap:6px;margin-bottom:11px;overflow:auto;scrollbar-width:none}.subnav::-webkit-scrollbar{display:none}.subnav button{min-width:92px;padding:6px 12px;color:var(--s-muted);white-space:nowrap}.subnav button[aria-selected="true"]{background:var(--s-accent);color:var(--s-text)}
    .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:11px}.card{grid-column:span 4;min-width:0;padding:13px;border:1px solid var(--s-border);border-radius:11px;background:color-mix(in srgb,var(--s-panel) 96%,transparent);box-shadow:0 8px 20px var(--s-shadow)}.card.wide{grid-column:span 8}.card.full{grid-column:1/-1}.card h2,.card h3{margin:0}.card h2{font-size:15px}.card h3{font-size:12px}.muted{color:var(--s-muted)}
    .card-head{display:flex;align-items:start;gap:8px;margin-bottom:10px}.card-head>div{min-width:0;flex:1}.badge{display:inline-block;padding:3px 7px;border:1px solid var(--s-soft);border-radius:999px;color:var(--s-muted);font-size:9px;white-space:nowrap}.badge.ready{border-color:var(--s-ready);color:var(--s-ready)}.badge.warn{border-color:var(--s-warning);color:var(--s-warning)}
    .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.stat{padding:9px 5px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg);text-align:center}.stat strong,.stat span{display:block}.stat strong{font-size:17px}.stat span{color:var(--s-muted);font-size:9px}
    .status{margin:10px 0 0;padding:8px 9px;border-left:3px solid var(--s-accent);border-radius:5px;background:var(--s-bg);color:var(--s-muted)}
    .target-list,.alert-list,.merit-list{display:grid;gap:7px}.target,.alert,.merit{display:grid;gap:7px;padding:10px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.target{grid-template-columns:minmax(0,1fr) auto;align-items:center}.target strong,.target small{display:block}.target small{color:var(--s-muted)}.target button{padding:5px 12px}.alert{border-left:4px solid var(--s-ready)}.alert.warn{border-left-color:var(--s-warning)}.alert strong,.alert span{display:block}.alert span{color:var(--s-muted)}
    .two-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.mini{padding:9px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.mini span,.mini strong{display:block}.mini span{color:var(--s-muted);font-size:9px}
    .meter{height:6px;overflow:hidden;border-radius:99px;background:#05080b}.meter i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--s-accent),var(--s-alt))}
    .later{color:var(--s-muted);font-size:10px}.theme-row{display:flex;gap:7px;flex-wrap:wrap}.theme-row button{padding:7px 11px}.theme-row button[aria-selected="true"]{outline:2px solid var(--s-alt);outline-offset:1px}
    .recovery{display:grid;gap:8px}.recovery code{padding:3px 5px;border-radius:4px;background:var(--s-bg);color:var(--s-alt)}
    .mobile-hint{display:none}
    @media(max-width:900px){.card{grid-column:span 6}.card.wide{grid-column:1/-1}}
    @media(max-width:700px){
      .overlay{grid-template-rows:auto minmax(0,1fr)}.topbar{min-height:58px;padding-top:max(7px,env(safe-area-inset-top));padding-bottom:7px}.brand-mark{width:35px;height:35px}.prototype{display:none}.close{width:48px;flex-basis:48px}
      .primary-nav{position:absolute;right:0;bottom:0;left:0;z-index:4;justify-content:stretch;padding:7px max(8px,env(safe-area-inset-right)) max(7px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border-top:1px solid var(--s-border);border-bottom:0;box-shadow:0 -7px 20px var(--s-shadow)}.primary-nav button{min-width:0;flex:1;padding:5px 3px;font-size:11px}.primary-nav button::before{display:block;margin-bottom:1px;font-size:18px}.primary-nav button[data-page="combat"]::before{content:"⚔"}.primary-nav button[data-page="efficiency"]::before{content:"⏱"}.primary-nav button[data-page="access"]::before{content:"⚙"}
      .scroll{padding:10px max(9px,env(safe-area-inset-right)) calc(82px + env(safe-area-inset-bottom)) max(9px,env(safe-area-inset-left))}.page-head{align-items:center}.page-head h1{font-size:18px}.page-head p{font-size:10px}.page-actions button:not([data-action="refresh-demo"]){display:none}.page-actions button{min-height:44px}
      .grid{gap:8px}.card,.card.wide{grid-column:1/-1;padding:11px}.stats{gap:5px}.stat{padding:8px 3px}.stat strong{font-size:15px}.two-column{gap:6px}.mobile-hint{display:block}.launcher{width:54px;height:54px;min-height:54px}.launcher[data-open="true"]:not([data-positioned="true"]){bottom:calc(82px + env(safe-area-inset-bottom))}.launcher-label{display:none}
    }
    @media(max-width:370px){.brand span{display:none}.page-head p{display:none}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.two-column{grid-template-columns:1fr}.subnav button{min-width:82px}}
    @media(orientation:landscape) and (max-height:520px){.topbar{min-height:50px}.brand-mark{width:32px;height:32px}.scroll{padding-top:8px}.primary-nav{position:absolute;top:50px;right:0;bottom:0;left:auto;width:94px;flex-direction:column;justify-content:flex-start;padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) 8px;border-top:0;border-bottom:0;border-left:1px solid var(--s-border);box-shadow:-7px 0 20px var(--s-shadow)}.primary-nav button{width:100%;min-width:0;min-height:54px;flex:0 0 auto}.scroll{padding-right:104px;padding-bottom:max(10px,env(safe-area-inset-bottom))}.launcher[data-open="true"]:not([data-positioned="true"]){right:calc(104px + env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom))}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
  `;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'launcher';
  launcher.setAttribute('aria-label', 'Open SLINK dashboard');
  launcher.title = 'Tap to open SLINK. Drag to move.';
  launcher.innerHTML = '<span class="coil" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="launcher-label">Open SLINK</span>';

  const overlay = document.createElement('section');
  overlay.className = 'overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'SLINK PDA Dashboard');
  overlay.innerHTML = `
    <header class="topbar" data-swipe-close>
      <div class="brand-mark" aria-hidden="true">SL</div>
      <div class="brand"><strong>SLINK Dashboard</strong><span>Shared Live Intelligence NetworK · PDA shell ${BUILD}</span></div>
      <span class="prototype">LAYOUT PROTOTYPE · NO API</span>
      <button class="close" type="button" data-action="close" aria-label="Minimize dashboard" title="Minimize to the movable SLINK bubble">−</button>
    </header>
    <nav class="primary-nav" aria-label="Dashboard sections">
      <button type="button" data-page="combat">Combat</button>
      <button type="button" data-page="efficiency">Efficiency</button>
      <button type="button" data-page="access">Access</button>
    </nav>
    <main class="scroll">
      <section class="page" data-page-panel="combat">
        <div class="page-head"><div><h1>Combat</h1><p>Leveling, War, and your private daily stats in one mobile workspace.</p></div><div class="page-actions"><button type="button" data-action="refresh-demo">Refresh</button></div></div>
        <nav class="subnav" aria-label="Combat tools"><button type="button" data-combat-tab="leveling">Leveling</button><button type="button" data-combat-tab="war">War</button><button type="button" data-combat-tab="stats">Stats</button></nav>
        <div class="subpage" data-combat-panel="leveling">
          <div class="grid">
            <article class="card"><div class="card-head"><div><h2>SLINK Leveling</h2><span class="muted">Standby device</span></div><span class="badge ready">Connected</span></div><div class="stats"><div class="stat"><strong>12</strong><span>Targets</span></div><div class="stat"><strong>4</strong><span>Assigned</span></div><div class="stat"><strong>2</strong><span>Reported</span></div><div class="stat"><strong>8/60</strong><span>API / min</span></div></div><p class="status">Demo data only. Live service wiring comes after the mobile shell is approved.</p></article>
            <article class="card wide"><div class="card-head"><div><h2>Recommended targets</h2><span class="muted">Compact cards keep the Attack button thumb-friendly.</span></div><span class="badge">FF 1–3</span></div><div class="target-list"><div class="target"><div><strong>Example Target [123456]</strong><small>Okay · Idle 2h · Estimated BS 4.2m · FF 2.84</small></div><button type="button">Attack</button></div><div class="target"><div><strong>Another Target [654321]</strong><small>Hospital 3m · Idle 5h · Estimated BS 7.9m · FF 1.92</small></div><button type="button">Profile</button></div></div></article>
          </div>
        </div>
        <div class="subpage" data-combat-panel="war" hidden>
          <div class="grid"><article class="card"><div class="card-head"><div><h2>SLINK War</h2><span class="muted">Ranked war active</span></div><span class="badge warn">Officer</span></div><div class="stats"><div class="stat"><strong>18</strong><span>Attacks</span></div><div class="stat"><strong>9/25</strong><span>War / cap</span></div><div class="stat"><strong>3</strong><span>Mugs</span></div><div class="stat"><strong>2</strong><span>Retals</span></div></div><p class="status">Chain 487 / 500 · 03:42 remaining</p></article><article class="card wide"><div class="card-head"><div><h2>Live retals</h2><span class="muted">Full details remain readable without taking over Torn.</span></div><span class="badge warn">2 active</span></div><div class="alert-list"><div class="alert warn"><strong>Example Enemy [222222]</strong><span>Enemy Faction · Retal available · BS 850m · FF 2.11</span></div><div class="alert warn"><strong>Outside Target [333333]</strong><span>Example Faction · War hit · BS 1.2b · FF 1.75</span></div></div></article></div>
        </div>
        <div class="subpage" data-combat-panel="stats" hidden>
          <div class="grid"><article class="card wide"><div class="card-head"><div><h2>Player stats</h2><span class="muted">Daily local snapshot</span></div><span class="badge ready">Updated today</span></div><div class="two-column"><div class="mini"><span>Xanax · 7 / 30 days</span><strong>12 (1.71/d) · 73 (2.43/d)</strong></div><div class="mini"><span>Attacks · 7 / 30 days</span><strong>134 · 549</strong></div><div class="mini"><span>Respect · 7 / 30 days</span><strong>445 · 1,867</strong></div><div class="mini"><span>Activity · 7 / 30 days</span><strong>2.2h/d · 4.7h/d</strong></div></div></article><article class="card"><div class="card-head"><div><h2>Networth</h2><span class="muted">Current and movement</span></div></div><div class="two-column"><div class="mini"><span>Current</span><strong>$5.08b</strong></div><div class="mini"><span>30 days</span><strong style="color:var(--s-ready)">+$428m</strong></div></div></article></div>
        </div>
      </section>
      <section class="page" data-page-panel="efficiency" hidden>
        <div class="page-head"><div><h1>Efficiency</h1><p>API-backed reminders and Merit farms, locally coordinated inside PDA.</p></div><div class="page-actions"><button type="button" data-action="refresh-demo">Refresh</button></div></div>
        <nav class="subnav" aria-label="Efficiency tools"><button type="button" data-efficiency-tab="alerts">Alerts</button><button type="button" data-efficiency-tab="merits">Merits</button></nav>
        <div class="subpage" data-efficiency-panel="alerts"><div class="grid"><article class="card"><div class="card-head"><div><h2>Active reminders</h2><span class="muted">Large actions for mobile use</span></div><span class="badge warn">3</span></div><div class="alert-list"><div class="alert"><strong>Drug cooldown is clear</strong><span>Items · Faction Armory · Snooze 5m · Snooze 1h</span></div><div class="alert warn"><strong>Energy refill is available</strong><span>Points · Faction Armory</span></div><div class="alert"><strong>Stock benefit ready</strong><span>Collect your dividend</span></div></div></article><article class="card wide"><div class="card-head"><div><h2>Today</h2><span class="muted">One glance before returning to Torn</span></div></div><div class="stats"><div class="stat"><strong>3</strong><span>Active</span></div><div class="stat"><strong>64/100</strong><span>City</span></div><div class="stat"><strong>14m</strong><span>Next check</span></div><div class="stat"><strong>8/60</strong><span>API / min</span></div></div></article></div></div>
        <div class="subpage" data-efficiency-panel="merits" hidden><div class="grid"><article class="card full"><div class="card-head"><div><h2>Active farms</h2><span class="muted">Up to three pinned goals</span></div><span class="badge ready">2/3 pinned</span></div><div class="merit-list"><div class="merit"><strong>Happy Slapper · Medal</strong><span class="muted">Win 250 attacks · 134 / 250 · 116 left</span><div class="meter"><i style="width:54%"></i></div><span class="later">Later: Scar Maker 500 · Tooth and Nail 2,500 · Somebody Call 911 10,000</span></div><div class="merit"><strong>Bouncer · Medal</strong><span class="muted">Successfully defend against 50 attacks · 44 / 50 · 6 left</span><div class="meter"><i style="width:88%"></i></div><span class="later">Later: Brick Wall 250 · Turtle 500 · Solid as a Rock 2,500</span></div></div></article></div></div>
      </section>
      <section class="page" data-page-panel="access" hidden>
        <div class="page-head"><div><h1>Access &amp; layout</h1><p>The final script will use one PDA key, one local session manager, and one shared limiter.</p></div></div>
        <div class="grid"><article class="card wide"><div class="card-head"><div><h2>Mobile recovery</h2><span class="muted">The dashboard can always get out of your way.</span></div><span class="badge ready">Protected</span></div><div class="recovery"><span>Tap <strong>−</strong> in the sticky header or tap the movable SLINK bubble to minimize.</span><span>Drag the bubble anywhere. Its position is clamped back onscreen after rotation and resizing.</span><span>Press <code>Esc</code> or <code>Alt + Shift + S</code> on a keyboard.</span><span>Swipe downward on the dashboard header to minimize on touch devices.</span><button type="button" data-action="reset-layout">Reset launcher position and layout</button></div></article><article class="card"><div class="card-head"><div><h2>Theme preview</h2><span class="muted">Stored only on this device</span></div></div><div class="theme-row"><button type="button" data-theme-choice="slink-dark">Dark</button><button type="button" data-theme-choice="slinky-pursuit">Pursuit</button><button type="button" data-theme-choice="slinky-underglow">Underglow</button></div></article><article class="card full mobile-hint"><strong>Phone note:</strong> The bottom navigation stays reachable above the device safe area. In landscape it moves to the right edge to preserve vertical room.</article></div>
      </section>
    </main>`;

  shadow.append(style, overlay, launcher);
  document.documentElement.appendChild(host);

  function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), Math.max(min, max));
  }

  function clampLauncher(persist = false) {
    if (!state.bubblePosition) {
      delete launcher.dataset.positioned;
      launcher.style.removeProperty('left');
      launcher.style.removeProperty('top');
      launcher.style.removeProperty('right');
      launcher.style.removeProperty('bottom');
      return;
    }
    const width = launcher.offsetWidth || 58;
    const height = launcher.offsetHeight || 58;
    const left = clamp(state.bubblePosition.left, 4, global.innerWidth - width - 4);
    const top = clamp(state.bubblePosition.top, 4, global.innerHeight - height - 4);
    launcher.style.left = `${left}px`;
    launcher.style.top = `${top}px`;
    launcher.style.right = 'auto';
    launcher.style.bottom = 'auto';
    launcher.dataset.positioned = 'true';
    state.bubblePosition = { left: Math.round(left), top: Math.round(top) };
    if (persist) writeState();
  }

  function selectPage(page, persist = true) {
    if (!['combat', 'efficiency', 'access'].includes(page)) page = 'combat';
    state.page = page;
    shadow.querySelectorAll('[data-page-panel]').forEach(panel => { panel.hidden = panel.dataset.pagePanel !== page; });
    shadow.querySelectorAll('[data-page]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.page === page)));
    if (persist) writeState();
    shadow.querySelector('.scroll').scrollTop = 0;
  }

  function selectSubpage(group, tab, persist = true) {
    const allowed = group === 'combat' ? ['leveling', 'war', 'stats'] : ['alerts', 'merits'];
    if (!allowed.includes(tab)) tab = allowed[0];
    state[group === 'combat' ? 'combatTab' : 'efficiencyTab'] = tab;
    shadow.querySelectorAll(`[data-${group}-panel]`).forEach(panel => { panel.hidden = panel.dataset[`${group}Panel`] !== tab; });
    shadow.querySelectorAll(`[data-${group}-tab]`).forEach(button => button.setAttribute('aria-selected', String(button.dataset[`${group}Tab`] === tab)));
    if (persist) writeState();
  }

  function setTheme(theme, persist = true) {
    if (!['slink-dark', 'slinky-pursuit', 'slinky-underglow'].includes(theme)) theme = 'slink-dark';
    state.theme = theme;
    host.dataset.theme = theme;
    shadow.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.themeChoice === theme)));
    if (persist) writeState();
  }

  function lockTornScroll() {
    if (!document.documentElement.dataset[ROOT_OVERFLOW_KEY]) document.documentElement.dataset[ROOT_OVERFLOW_KEY] = document.documentElement.style.overflow || ' ';
    document.documentElement.style.overflow = 'hidden';
  }

  function unlockTornScroll() {
    const prior = document.documentElement.dataset[ROOT_OVERFLOW_KEY];
    if (prior !== undefined) {
      document.documentElement.style.overflow = prior === ' ' ? '' : prior;
      delete document.documentElement.dataset[ROOT_OVERFLOW_KEY];
    }
  }

  function openDashboard() {
    dashboardOpen = true;
    overlay.hidden = false;
    launcher.dataset.open = 'true';
    launcher.setAttribute('aria-label', 'Minimize SLINK dashboard');
    launcher.querySelector('.launcher-label').textContent = 'Minimize SLINK';
    lockTornScroll();
    selectPage(state.page, false);
    global.setTimeout(() => shadow.querySelector('[data-action="close"]')?.focus({ preventScroll: true }), 0);
  }

  function closeDashboard() {
    dashboardOpen = false;
    overlay.hidden = true;
    delete launcher.dataset.open;
    launcher.setAttribute('aria-label', 'Open SLINK dashboard');
    launcher.querySelector('.launcher-label').textContent = 'Open SLINK';
    unlockTornScroll();
    clampLauncher(true);
    launcher.focus({ preventScroll: true });
  }

  function toggleDashboard() {
    if (dashboardOpen) closeDashboard(); else openDashboard();
  }

  function resetLayout() {
    state.page = defaults.page;
    state.combatTab = defaults.combatTab;
    state.efficiencyTab = defaults.efficiencyTab;
    state.theme = defaults.theme;
    state.bubblePosition = null;
    setTheme(state.theme, false);
    selectPage(state.page, false);
    selectSubpage('combat', state.combatTab, false);
    selectSubpage('efficiency', state.efficiencyTab, false);
    clampLauncher(false);
    writeState();
  }

  launcher.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const box = launcher.getBoundingClientRect();
    drag = { id:event.pointerId, x:event.clientX, y:event.clientY, left:box.left, top:box.top, moved:false };
    launcher.dataset.dragging = 'true';
    launcher.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  launcher.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    state.bubblePosition = { left:drag.left + dx, top:drag.top + dy };
    clampLauncher(false);
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    delete launcher.dataset.dragging;
    clampLauncher(true);
    if (!moved) toggleDashboard();
  }
  launcher.addEventListener('pointerup', finishDrag);
  launcher.addEventListener('pointercancel', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    delete launcher.dataset.dragging;
    clampLauncher(true);
  });

  overlay.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') closeDashboard();
    if (action === 'reset-layout') resetLayout();
    if (action === 'refresh-demo') {
      const button = event.target.closest('button');
      const prior = button.textContent;
      button.textContent = 'Layout only';
      button.disabled = true;
      global.setTimeout(() => { button.textContent = prior; button.disabled = false; }, 900);
    }
    const page = event.target.closest('[data-page]')?.dataset.page;
    if (page) selectPage(page);
    const combatTab = event.target.closest('[data-combat-tab]')?.dataset.combatTab;
    if (combatTab) selectSubpage('combat', combatTab);
    const efficiencyTab = event.target.closest('[data-efficiency-tab]')?.dataset.efficiencyTab;
    if (efficiencyTab) selectSubpage('efficiency', efficiencyTab);
    const theme = event.target.closest('[data-theme-choice]')?.dataset.themeChoice;
    if (theme) setTheme(theme);
  });

  const swipeHeader = shadow.querySelector('[data-swipe-close]');
  swipeHeader.addEventListener('pointerdown', event => { if (!event.target.closest('button')) swipe = { id:event.pointerId, x:event.clientX, y:event.clientY }; });
  swipeHeader.addEventListener('pointerup', event => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = Math.abs(event.clientX - swipe.x);
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (dy > 70 && dy > dx * 1.35) closeDashboard();
  });
  swipeHeader.addEventListener('pointercancel', () => { swipe = null; });

  global.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dashboardOpen) closeDashboard();
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      toggleDashboard();
    }
  });
  global.addEventListener('resize', () => clampLauncher(true));
  global.addEventListener('orientationchange', () => global.setTimeout(() => clampLauncher(true), 180));
  global.addEventListener('pagehide', unlockTornScroll, { once:true });

  const guardian = new MutationObserver(() => {
    if (!host.isConnected && document.documentElement) document.documentElement.appendChild(host);
  });
  guardian.observe(document, { childList:true, subtree:true });

  if (typeof global.GM_registerMenuCommand === 'function') {
    global.GM_registerMenuCommand('Open SLINK PDA Dashboard', openDashboard);
    global.GM_registerMenuCommand('Reset SLINK PDA layout', resetLayout);
  }

  setTheme(state.theme, false);
  selectPage(state.page, false);
  selectSubpage('combat', state.combatTab, false);
  selectSubpage('efficiency', state.efficiencyTab, false);
  clampLauncher(false);

  global.SLINK_PDA_DASHBOARD = Object.freeze({
    build:BUILD,
    open:openDashboard,
    close:closeDashboard,
    toggle:toggleDashboard,
    reset:resetLayout,
    isOpen:() => dashboardOpen
  });
})(globalThis);
