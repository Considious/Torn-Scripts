// ==UserScript==
// @name         SLINK Bounty Scouter - Prototype
// @namespace    Considious [3853023]
// @version      0.1.0
// @description  Local-only bounty catalog for NST, BHG, UMS, and GMS* reasons with CSV export.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @connect      api.torn.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/bounty-scouter-prototype/slink-bounty-scouter.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/bounty-scouter-prototype/slink-bounty-scouter.user.js
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  const STORAGE_KEY = 'slink-bounty-scouter-v1';
  const API_ROOT = 'https://api.torn.com/v2';
  const DEFAULTS = {
    apiKey: '',
    pollSeconds: 60,
    maxPages: 5,
    minimized: false,
    records: {},
    listers: {},
    lastPollAt: 0,
    lastCacheTimestamp: 0,
    lastError: '',
    ffEstimates: {},
  };

  const state = Object.assign({}, DEFAULTS, GM_getValue(STORAGE_KEY, {}));
  state.records ||= {};
  state.listers ||= {};
  state.ffEstimates ||= {};

  const save = () => GM_setValue(STORAGE_KEY, state);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtMoney = n => '$' + Number(n || 0).toLocaleString();
  const fmtTime = ts => ts ? new Date(ts * 1000).toLocaleString() : '—';

  function reasonClass(reason) {
    const r = String(reason || '').trim().toUpperCase();
    if (r === 'NST') return 'NST';
    if (r === 'BHG') return 'BHG';
    if (r === 'UMS') return 'UMS';
    if (r.startsWith('GMS')) return 'GMS*';
    return null;
  }

  function fingerprint(b) {
    return [b.target_id, b.lister_id ?? 'anon', b.reward, b.reason ?? '', b.quantity, b.valid_until].join('|');
  }

  function catalogBounty(b, cacheTs) {
    const klass = reasonClass(b.reason);
    if (!klass) return false;
    const key = fingerprint(b);
    const now = Math.floor(Date.now() / 1000);
    const existing = state.records[key];
    if (existing) {
      existing.last_seen_at = now;
      existing.times_seen = Number(existing.times_seen || 1) + 1;
      existing.last_cache_timestamp = cacheTs || existing.last_cache_timestamp;
      return false;
    }

    const rec = {
      fingerprint: key,
      target_id: b.target_id,
      target_name: b.target_name,
      target_level: b.target_level,
      lister_id: b.lister_id,
      lister_name: b.lister_name,
      is_anonymous: Boolean(b.is_anonymous),
      reward: b.reward,
      quantity: b.quantity,
      reason: b.reason,
      reason_class: klass,
      valid_until: b.valid_until,
      first_seen_at: now,
      last_seen_at: now,
      times_seen: 1,
      first_cache_timestamp: cacheTs || 0,
      last_cache_timestamp: cacheTs || 0,
    };
    state.records[key] = rec;

    if (!rec.is_anonymous && rec.lister_id) {
      const id = String(rec.lister_id);
      const l = state.listers[id] ||= {
        lister_id: rec.lister_id,
        lister_name: rec.lister_name,
        total_matching_bounties: 0,
        unique_targets: {},
        reasons: {},
        total_reward: 0,
        first_seen_at: now,
        last_seen_at: now,
      };
      l.lister_name = rec.lister_name || l.lister_name;
      l.total_matching_bounties += 1;
      l.unique_targets[String(rec.target_id)] = true;
      l.reasons[klass] = Number(l.reasons[klass] || 0) + 1;
      l.total_reward += Number(rec.reward || 0) * Number(rec.quantity || 1);
      l.last_seen_at = now;
    }
    return true;
  }

  function apiGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 20000,
        onload: r => {
          try {
            const data = JSON.parse(r.responseText || '{}');
            if (data.error) reject(new Error(`Torn API ${data.error.code}: ${data.error.error}`));
            else resolve(data);
          } catch (e) { reject(e); }
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('API timeout')),
      });
    });
  }

  async function poll() {
    if (!state.apiKey) { state.lastError = 'Enter a Torn API key first.'; save(); render(); return; }
    if (document.hidden || !document.hasFocus()) return;

    let offset = 0;
    let added = 0;
    let pages = 0;
    let cacheTs = 0;
    try {
      while (pages < Math.max(1, Number(state.maxPages || 5))) {
        const url = `${API_ROOT}/torn/bounties?limit=100&offset=${offset}&key=${encodeURIComponent(state.apiKey)}&comment=SLINK_Bounty_Scouter`;
        const data = await apiGet(url);
        cacheTs = Number(data.bounties_timestamp || 0);
        const rows = Array.isArray(data.bounties) ? data.bounties : [];
        for (const b of rows) if (catalogBounty(b, cacheTs)) added++;
        pages++;
        if (rows.length < 100) break;
        offset += 100;
      }
      state.lastPollAt = Math.floor(Date.now()/1000);
      state.lastCacheTimestamp = cacheTs;
      state.lastError = '';
      save();
      render(`Added ${added} new matching ${added === 1 ? 'bounty' : 'bounties'}.`);
    } catch (e) {
      state.lastError = e.message || String(e);
      save(); render();
    }
  }

  function csvCell(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportBounties() {
    const header = ['target_id','target_name','target_level','reason_class','reason','reward','quantity','lister_id','lister_name','anonymous','valid_until','first_seen_at','last_seen_at','times_seen','ff_estimate','ff_confidence'];
    const rows = [header];
    for (const r of Object.values(state.records).sort((a,b)=>b.first_seen_at-a.first_seen_at)) {
      const ff = state.ffEstimates[String(r.target_id)] || {};
      rows.push([
        r.target_id,r.target_name,r.target_level,r.reason_class,r.reason,r.reward,r.quantity,
        r.lister_id ?? '',r.lister_name ?? '',r.is_anonymous ? 1 : 0,
        new Date(r.valid_until*1000).toISOString(),new Date(r.first_seen_at*1000).toISOString(),new Date(r.last_seen_at*1000).toISOString(),r.times_seen,
        ff.estimate || '',ff.confidence || ''
      ]);
    }
    downloadCsv(`slink-bounty-scouter-${new Date().toISOString().slice(0,10)}.csv`, rows);
  }

  function exportListers() {
    const rows = [['lister_id','lister_name','matching_bounties','unique_targets','NST','BHG','UMS','GMS*','total_reward','first_seen_at','last_seen_at']];
    for (const l of Object.values(state.listers).sort((a,b)=>b.total_matching_bounties-a.total_matching_bounties)) {
      rows.push([l.lister_id,l.lister_name,l.total_matching_bounties,Object.keys(l.unique_targets||{}).length,l.reasons.NST||0,l.reasons.BHG||0,l.reasons.UMS||0,l.reasons['GMS*']||0,l.total_reward,new Date(l.first_seen_at*1000).toISOString(),new Date(l.last_seen_at*1000).toISOString()]);
    }
    downloadCsv(`slink-bounty-listers-${new Date().toISOString().slice(0,10)}.csv`, rows);
  }

  const host = document.createElement('div');
  host.id = 'slink-bounty-scouter';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({mode:'open'});

  function render(flash='') {
    const records = Object.values(state.records);
    const active = records.filter(r => Number(r.valid_until) * 1000 > Date.now()).sort((a,b)=>b.first_seen_at-a.first_seen_at).slice(0,40);
    const listers = Object.values(state.listers).sort((a,b)=>b.total_matching_bounties-a.total_matching_bounties).slice(0,10);
    root.innerHTML = `<style>
      :host{all:initial;color-scheme:dark}.panel{position:fixed;right:10px;top:90px;z-index:2147483646;width:520px;max-height:72vh;overflow:hidden;border:1px solid #55616a;border-radius:8px;background:#151a1e;color:#edf2f5;box-shadow:0 8px 28px #0009;font:12px/1.3 system-ui,-apple-system,Segoe UI,sans-serif}.head{display:flex;align-items:center;gap:7px;padding:7px 8px;background:#232a30;border-bottom:1px solid #4c5861}.head strong{font-size:13px}.spacer{flex:1}.body{display:${state.minimized?'none':'block'};max-height:calc(72vh - 38px);overflow:auto}.controls{display:grid;grid-template-columns:1fr 90px 70px;gap:6px;padding:8px;border-bottom:1px solid #38434b}.controls input,.controls select,button{box-sizing:border-box;color:#fff;background:#20272c;border:1px solid #56636c;border-radius:5px;padding:5px;font:inherit}button{cursor:pointer}.actions{display:flex;gap:5px;padding:0 8px 8px}.actions button{flex:1}.status{padding:6px 8px;color:#9fb0ba;border-bottom:1px solid #303a42}.err{color:#ff9a9a}.flash{color:#a7e9bd}.section{padding:8px}.section h4{margin:0 0 5px}.row{display:grid;grid-template-columns:42px minmax(100px,1fr) 52px 76px 95px;gap:5px;align-items:center;padding:5px 4px;border-top:1px solid #29323a}.row:first-of-type{border-top:0}.tag{font-weight:800;color:#fff}.target a,.lister a{color:#fff;text-decoration:none}.target a:hover,.lister a:hover{text-decoration:underline}.muted{color:#8f9ca5;font-size:10px}.lrow{display:grid;grid-template-columns:minmax(130px,1fr) 54px 54px;gap:6px;padding:4px;border-top:1px solid #29323a}.pill{padding:2px 5px;border:1px solid #52606a;border-radius:12px;text-align:center}.mini{width:26px;height:24px;padding:0}.note{padding:7px 8px;color:#8f9ca5;background:#111518;border-top:1px solid #303940;font-size:10px}</style>
      <div class=panel><div class=head><strong>SLINK Bounty Scouter</strong><span class=muted>Local-only</span><div class=spacer></div><button id=min class=mini>${state.minimized?'＋':'—'}</button></div><div class=body>
      <div class=controls><input id=key type=password placeholder="Torn API key" value="${esc(state.apiKey)}"><select id=poll><option value=30 ${state.pollSeconds==30?'selected':''}>30 sec</option><option value=60 ${state.pollSeconds==60?'selected':''}>60 sec</option><option value=120 ${state.pollSeconds==120?'selected':''}>2 min</option><option value=300 ${state.pollSeconds==300?'selected':''}>5 min</option></select><select id=pages><option value=1 ${state.maxPages==1?'selected':''}>100</option><option value=3 ${state.maxPages==3?'selected':''}>300</option><option value=5 ${state.maxPages==5?'selected':''}>500</option><option value=10 ${state.maxPages==10?'selected':''}>1000</option></select></div>
      <div class=actions><button id=now>Poll now</button><button id=csv>Export Bounties CSV</button><button id=lcsv>Export Listers CSV</button></div>
      <div class="status ${state.lastError?'err':''}">${state.lastError ? esc(state.lastError) : flash ? `<span class=flash>${esc(flash)}</span>` : `Last poll: ${fmtTime(state.lastPollAt)} • Cache: ${fmtTime(state.lastCacheTimestamp)} • Stored: ${records.length}`}</div>
      <div class=section><h4>Current matching bounties (${active.length > 40 ? '40+' : active.length})</h4>${active.length ? active.map(r=>`<div class=row><span class="tag pill">${esc(r.reason_class)}</span><span class=target><a target=_blank href="https://www.torn.com/profiles.php?XID=${r.target_id}">${esc(r.target_name)} [${r.target_id}]</a><div class=muted>Lvl ${r.target_level} • ${esc(r.reason || '')}</div></span><span>${r.quantity}×</span><span>${fmtMoney(r.reward)}</span><span class=lister>${r.is_anonymous ? '<span class=muted>Anonymous</span>' : `<a target=_blank href="https://www.torn.com/profiles.php?XID=${r.lister_id}">${esc(r.lister_name)}</a>`}</span></div>`).join('') : '<div class=muted>No matching bounties recorded yet.</div>'}</div>
      <div class=section><h4>Known non-anonymous listers</h4>${listers.length ? listers.map(l=>`<div class=lrow><span class=lister><a target=_blank href="https://www.torn.com/profiles.php?XID=${l.lister_id}">${esc(l.lister_name)} [${l.lister_id}]</a></span><span class=pill>${l.total_matching_bounties}</span><span class=pill>${Object.keys(l.unique_targets||{}).length} tgt</span></div>`).join('') : '<div class=muted>No known listers yet.</div>'}</div>
      <div class=note>Matches exact NST, BHG, and UMS reasons plus any reason beginning with GMS. Data and API key remain local. FF estimate columns are reserved for the FF Scouter enrichment hook.</div>
      </div></div>`;

    root.getElementById('min').onclick=()=>{state.minimized=!state.minimized;save();render();};
    root.getElementById('key').onchange=e=>{state.apiKey=e.target.value.trim();save();};
    root.getElementById('poll').onchange=e=>{state.pollSeconds=Number(e.target.value);save();restartTimer();};
    root.getElementById('pages').onchange=e=>{state.maxPages=Number(e.target.value);save();};
    root.getElementById('now').onclick=poll;
    root.getElementById('csv').onclick=exportBounties;
    root.getElementById('lcsv').onclick=exportListers;
  }

  let timer = null;
  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!document.hidden && document.hasFocus()) poll();
    }, Math.max(30, Number(state.pollSeconds || 60)) * 1000);
  }

  render(); restartTimer();
})();
