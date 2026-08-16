// ==UserScript==
// @name         Considious Torn ADHD Dashboard - THEME TEST
// @namespace    Considious [3853023]
// @version      0.2.0
// @description  Visual-only textured theme prototype for the ADHD Dashboard. Makes no API calls.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/shared/Considious_Torn_Theme_Test.js?v=0.2.0
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';
  const Theme = globalThis.ConsidiousThemeTest;
  if (!Theme) throw new Error('Considious theme test library failed to load.');

  const host = document.createElement('div');
  host.id = 'tdd-theme-test-host';
  host.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:2147483647;width:min(780px,calc(100vw - 24px));';
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);
  let collapsed = false;

  function render() {
    const selected = Theme.getSelected();
    const options = Theme.list().map(t => `<option value="${t.id}" ${t.id===selected.id?'selected':''}>${t.name}</option>`).join('');
    shadow.innerHTML = `
<style>
:host{all:initial;${Theme.cssVariables(selected.id)}}
*{box-sizing:border-box}button,select{font:inherit;color:inherit}
.wrap{font-family:Arial,Helvetica,sans-serif;color:var(--sl-text);filter:drop-shadow(0 10px 24px rgba(0,0,0,.65))}
.panel{position:relative;overflow:hidden;background:linear-gradient(180deg,var(--sl-surface),var(--sl-bg));border:1px solid var(--sl-border-strong);clip-path:polygon(var(--sl-cut) 0,calc(100% - var(--sl-cut)) 0,100% var(--sl-cut),100% calc(100% - var(--sl-cut)),calc(100% - var(--sl-cut)) 100%,var(--sl-cut) 100%,0 calc(100% - var(--sl-cut)),0 var(--sl-cut));box-shadow:inset 0 0 28px rgba(0,0,0,.72),0 0 16px var(--sl-accent-soft)}
.panel:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:var(--sl-texture-opacity);mix-blend-mode:screen}
.header{position:relative;display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 14px;background:linear-gradient(180deg,var(--sl-header-from),var(--sl-header-to));border-bottom:1px solid var(--sl-border-strong);overflow:hidden}
.header:before{content:"";position:absolute;inset:0;opacity:.35;pointer-events:none}
.brand{font-weight:900;font-size:20px;letter-spacing:1.5px;color:var(--sl-accent-strong);text-shadow:0 0 10px var(--sl-accent)}
.sub{font-size:11px;color:var(--sl-muted);letter-spacing:.4px}.spacer{flex:1}
select,.btn{border:1px solid var(--sl-border);background:linear-gradient(180deg,var(--sl-surface-raised),var(--sl-button));padding:6px 9px;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.btn{cursor:pointer}.btn:hover{border-color:var(--sl-border-strong);box-shadow:0 0 9px var(--sl-accent-soft)}
.body{padding:12px;display:${collapsed?'none':'block'}}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.wide{grid-column:1/-1}
.card{position:relative;overflow:hidden;min-height:76px;padding:11px 12px 10px 15px;background:linear-gradient(145deg,var(--sl-surface-raised),var(--sl-surface-soft));border:1px solid var(--sl-border);clip-path:polygon(var(--sl-cut) 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - var(--sl-cut)),calc(100% - var(--sl-cut)) 100%,5px 100%,0 calc(100% - 5px),0 var(--sl-cut));box-shadow:inset 0 0 18px rgba(0,0,0,.55)}
.card:before,.card:after{content:"";position:absolute;pointer-events:none}.card:before{inset:0;opacity:var(--sl-texture-opacity)}
.card:after{left:0;top:0;bottom:0;width:4px;background:var(--sl-accent);box-shadow:0 0 9px var(--sl-accent)}
.title{font-weight:800;font-size:13px;letter-spacing:.3px;position:relative;z-index:2}.meta{font-size:11px;color:var(--sl-muted);margin-top:4px;position:relative;z-index:2}.value{font-size:17px;font-weight:900;color:var(--sl-accent-strong);position:relative;z-index:2}
.row{display:flex;justify-content:space-between;align-items:center;gap:10px}.progress{height:8px;margin-top:8px;background:#050607;border:1px solid var(--sl-border);overflow:hidden;position:relative;z-index:2}.progress>i{display:block;height:100%;width:68%;background:linear-gradient(90deg,var(--sl-accent),var(--sl-accent-strong));box-shadow:0 0 8px var(--sl-accent)}
.section{margin-top:10px;padding:10px;background:var(--sl-surface-soft);border:1px solid var(--sl-border);position:relative;overflow:hidden}.section strong{color:var(--sl-accent-strong)}
.badge{font-size:10px;padding:2px 6px;border:1px solid var(--sl-border-strong);background:var(--sl-accent-soft);color:var(--sl-accent-strong)}
.theme-core .panel:before,.theme-core .card:before{background-image:linear-gradient(90deg,transparent 47%,var(--sl-accent) 49%,transparent 51%),linear-gradient(0deg,transparent 47%,var(--sl-accent) 49%,transparent 51%),radial-gradient(circle at 20% 30%,var(--sl-accent) 0 1px,transparent 2px);background-size:34px 34px,34px 34px,42px 42px}
.theme-core .header:before{background:linear-gradient(110deg,transparent 0 12%,var(--sl-accent) 12.3% 12.7%,transparent 13% 25%,var(--sl-accent) 25.2% 25.6%,transparent 26% 100%);filter:drop-shadow(0 0 5px var(--sl-accent))}
.theme-tactical .panel:before,.theme-tactical .card:before{background-image:linear-gradient(30deg,var(--sl-accent) 1px,transparent 1px),linear-gradient(150deg,var(--sl-accent) 1px,transparent 1px),linear-gradient(90deg,var(--sl-accent) 1px,transparent 1px);background-size:28px 49px}.theme-tactical .card{border-width:2px}.theme-tactical .card:after{width:8px;background:linear-gradient(180deg,#596168,var(--sl-accent),#596168)}
.theme-redline .panel:before,.theme-redline .card:before{background-image:repeating-linear-gradient(115deg,transparent 0 24px,var(--sl-accent) 25px,transparent 26px 49px);opacity:.08}.theme-redline .header:before,.theme-redline .card:before{background-image:linear-gradient(90deg,transparent 0 4%,var(--sl-accent) 4.4% 4.8%,transparent 5% 14%,var(--sl-accent) 14.4% 15%,transparent 15.4% 32%,var(--sl-accent) 32.4% 33%,transparent 33.4% 48%,var(--sl-accent) 48.3% 49.2%,transparent 49.5% 67%,var(--sl-accent) 67.4% 68%,transparent 68.4% 84%,var(--sl-accent) 84.3% 85%,transparent 85.5%);background-size:100% 2px;background-repeat:no-repeat;background-position:center;filter:drop-shadow(0 0 5px var(--sl-accent));opacity:.33}
.theme-shadow .panel:before,.theme-shadow .card:before{background-image:linear-gradient(135deg,rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(45deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:34px 34px}.theme-shadow .card{border-color:rgba(205,210,214,.32);box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -14px 24px rgba(0,0,0,.44)}.theme-shadow .card:after{background:linear-gradient(#666,#bbb,#555);box-shadow:none}
.theme-omega .panel:before,.theme-omega .card:before{background-image:linear-gradient(30deg,var(--sl-accent) 1px,transparent 1px),linear-gradient(150deg,var(--sl-accent) 1px,transparent 1px),radial-gradient(circle at 35% 50%,var(--sl-accent) 0 1px,transparent 2px);background-size:30px 52px,30px 52px,46px 46px}.theme-omega .header:before,.theme-omega .card:before{background-image:linear-gradient(90deg,transparent 0 8%,var(--sl-accent) 8.4% 9%,transparent 9.4% 20%,var(--sl-accent) 20.4% 21%,transparent 21.4% 37%,var(--sl-accent) 37.3% 38.1%,transparent 38.5% 55%,var(--sl-accent) 55.4% 56%,transparent 56.5% 73%,var(--sl-accent) 73.5% 74.4%,transparent 75% 100%);background-size:100% 2px;background-repeat:no-repeat;background-position:center;filter:drop-shadow(0 0 7px var(--sl-accent));opacity:.4;animation:pulse 2.3s ease-in-out infinite alternate}
@keyframes pulse{from{opacity:.2;transform:scaleX(.97)}to{opacity:.55;transform:scaleX(1)}}
@media(max-width:620px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}.brand{font-size:16px}.header{gap:7px;padding:8px}.sub{display:none}}
</style>
<div class="wrap ${Theme.themeClass(selected.id)}">
  <div class="panel">
    <div class="header">
      <div><div class="brand">SLINK // ADHD DASHBOARD</div><div class="sub">TEXTURED THEME PROTOTYPE • ${selected.description}</div></div>
      <div class="spacer"></div>
      <select id="theme">${options}</select>
      <button class="btn" id="collapse">${collapsed?'＋':'—'}</button>
    </div>
    <div class="body">
      <div class="grid">
        <div class="card"><div class="row"><div><div class="title">⚡ ENERGY FULL</div><div class="meta">Ready for your next action</div></div><div class="value">150/150</div></div><div class="progress"><i style="width:100%"></i></div></div>
        <div class="card"><div class="row"><div><div class="title">💊 DRUG COOLDOWN</div><div class="meta">Xanax available soon</div></div><div class="value">12m</div></div><div class="progress"><i style="width:82%"></i></div></div>
        <div class="card"><div class="row"><div><div class="title">🏁 RACE OR FLY</div><div class="meta">No active race or travel</div></div><span class="badge">ACTION</span></div></div>
        <div class="card"><div class="row"><div><div class="title">🛒 MARKET WATCH</div><div class="meta">Three watched items below target</div></div><div class="value">3</div></div></div>
        <div class="card wide"><div class="row"><div><div class="title">🏆 TRACKED AWARD — FINISHER</div><div class="meta">Weapon finishing hits</div></div><div class="value">684 / 1000</div></div><div class="progress"><i></i></div></div>
      </div>
      <div class="section"><div class="row"><strong>Appearance Test</strong><span class="badge">${selected.name.toUpperCase()}</span></div><div class="meta">Compare the physical language: cut corners, steel framing, hex/circuit texture, energy traces, recessed surfaces and theme-specific edge treatments.</div></div>
      <div class="section"><div class="row"><strong>API Controls</strong><button class="btn">Refresh now</button></div><div class="meta">Visual-only prototype. No Torn API requests are made by this test script.</div></div>
    </div>
  </div>
</div>`;
    shadow.getElementById('theme').addEventListener('change', e => { Theme.setSelected(e.target.value); render(); });
    shadow.getElementById('collapse').addEventListener('click', () => { collapsed = !collapsed; render(); });
  }

  addEventListener('considious-theme-test-change', render);
  render();
})();
