// ==UserScript==
// @name         SLINK Honor Theme Lab
// @namespace    Considious [3853023]
// @version      0.2.0
// @description  Experimental honor-bar palette extraction + reusable archetype skinning for the real ADHD Dashboard.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/honor-theme-lab.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/theme-prototype/honor-theme-lab.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const STORAGE = 'slink:honor-theme-lab:v1';
  const STYLE_ID = 'slink-honor-theme-lab-style';
  const OLD_THEME_STYLE_ID = 'sl-theme-overlay-style';
  const OLD_SELECTOR_HOST_ID = 'sl-theme-test-selector-host';
  let dashboardRoot = null;

  const state = Object.assign({
    archetype: 'electric',
    bg: '#0b0610',
    surface: '#1a0b22',
    accent: '#b23cff',
    highlight: '#efb5ff',
    muted: '#c3a5cc',
    intensity: 0.82,
    lastImageName: ''
  }, load());

  const nativeAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function(init) {
    const root = nativeAttachShadow.call(this, init);
    if (this.id === 'tdd-host') {
      dashboardRoot = root;
      queueMicrotask(apply);
    }
    return root;
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch {}
  }
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const hex = n => clamp(Math.round(n),0,255).toString(16).padStart(2,'0');
  const rgbHex = ([r,g,b]) => `#${hex(r)}${hex(g)}${hex(b)}`;
  const rgb = h => {
    const s=h.replace('#','');
    return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];
  };
  const mix = (a,b,t) => rgbHex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));
  const rgba = (h,a) => { const [r,g,b]=rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const luminance = ([r,g,b]) => .2126*r+.7152*g+.0722*b;
  const saturation = ([r,g,b]) => Math.max(r,g,b)-Math.min(r,g,b);

  function extractPalette(img) {
    const c=document.createElement('canvas');
    const max=220, scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    c.width=Math.max(1,Math.round(img.naturalWidth*scale));
    c.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const x=c.getContext('2d',{willReadFrequently:true});
    x.drawImage(img,0,0,c.width,c.height);
    const d=x.getImageData(0,0,c.width,c.height).data;
    const bins=new Map();
    for(let i=0;i<d.length;i+=16){
      if(d[i+3]<120) continue;
      const raw=[d[i],d[i+1],d[i+2]];
      // Ignore near-transparent-looking black edge pixels and near-white text highlights
      // when choosing the dominant palette. They are still eligible for highlight below.
      const q=raw.map(v=>clamp(Math.round(v/24)*24,0,255));
      const key=q.join(',');
      bins.set(key,(bins.get(key)||0)+1);
    }
    const colors=[...bins]
      .map(([k,n])=>({c:k.split(',').map(Number),n}))
      .sort((a,b)=>b.n-a.n)
      .slice(0,64);
    if(!colors.length) throw new Error('No readable pixels found in image.');

    const useful=colors.filter(({c})=>luminance(c)>8 && luminance(c)<247);
    const pool=useful.length ? useful : colors;
    const dark=[...pool].sort((a,b)=>(luminance(a.c)+saturation(a.c)*.05)-(luminance(b.c)+saturation(b.c)*.05))[0].c;
    const vivid=[...pool].sort((a,b)=>((saturation(b.c)+18)*Math.log2(b.n+2))-((saturation(a.c)+18)*Math.log2(a.n+2)))[0].c;
    const bright=[...colors].sort((a,b)=>luminance(b.c)-luminance(a.c))[0].c;
    const bg=rgbHex(dark), accent=rgbHex(vivid), highlight=rgbHex(bright);
    return { bg, surface:mix(bg,accent,.22), accent, highlight, muted:mix('#b0b0b0',accent,.20) };
  }

  const svg = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  function texture() {
    const a=state.accent, i=state.intensity;
    if(state.archetype==='electric') return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 100" preserveAspectRatio="none"><defs><filter id="g"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M0 55L48 54 67 45 82 61 101 18 117 80 140 50 180 54 198 40 216 67 237 10 256 86 280 50 325 54 344 41 363 67 384 16 402 82 426 50 470 54 489 38 510 70 532 8 552 87 576 49 620 54 639 41 658 66 678 20 694 78 700 55" fill="none" stroke="${a}" stroke-width="2.5" opacity="${i}" filter="url(#g)"/></svg>`);
    if(state.archetype==='armored') return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="80"><g stroke="#cbd0d3" opacity=".09"><path d="M0 8h180M0 16h180M0 30h180M0 48h180M0 67h180"/></g><g fill="none" stroke="${a}" opacity="${i*.34}"><path d="M0 68h55l10-10h42l10 10h63M18 0v20l8 8v52M153 0v18l-8 8v54"/></g></svg>`);
    if(state.archetype==='cyber') return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="70"><g fill="none" stroke="${a}" stroke-width="1" opacity="${i*.38}"><path d="M0 18h28l8 8h24l8-8h52M0 51h19l8-8h27l8 8h58M31 0v18M88 0v18M54 43v27"/><circle cx="31" cy="18" r="2"/><circle cx="88" cy="18" r="2"/></g></svg>`);
    if(state.archetype==='stealth') return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="90"><g fill="none" stroke="#c9ced1" stroke-width=".8" opacity=".10"><path d="M12 17l22 10 9 17 24-8 19 14 28-6 17 12 35-8M48 44l-8 19 13 13M86 50l4 20 17 8M131 56l-6 18 16 8"/></g></svg>`);
    return 'none';
  }

  function css() {
    const t=texture(), metal=state.archetype==='armored'||state.archetype==='stealth';
    const edge=rgba(state.accent, metal?.60:.78);
    return `
:host{--hl-bg:${state.bg};--hl-surface:${state.surface};--hl-accent:${state.accent};--hl-hi:${state.highlight};--hl-muted:${state.muted};color-scheme:dark!important}
.panel{background-color:var(--hl-bg)!important;background-image:${t},linear-gradient(180deg,${rgba(state.accent,.11)},transparent 48%)!important;background-size:${state.archetype==='electric'?'100% 105px':'auto'},100% 100%!important;border-color:${edge}!important;box-shadow:inset 0 0 28px rgba(0,0,0,.62),0 10px 30px rgba(0,0,0,.45),0 0 14px ${rgba(state.accent,.24)}!important}
.header,.alert,.tracked-awards{background-color:var(--hl-surface)!important;background-image:${t}!important;background-size:${state.archetype==='electric'?'100% 95px':'auto'}!important;border-color:${edge}!important}
${metal?`.alert,.tracked-award,.settings-section,.award-card{box-shadow:inset 3px 0 ${rgba(state.accent,.58)},inset -1px 0 rgba(210,215,218,.16),inset 0 1px rgba(255,255,255,.05),inset 0 -1px rgba(0,0,0,.8)!important}`:''}
button,input,textarea,select,.tracked-award,.settings-section,.award-card,.award-progress,.awards-summary>div{background-color:${mix(state.surface,'#000000',.18)}!important;border-color:${rgba(state.accent,.50)}!important;color:#f7f7f7!important;color-scheme:dark!important}
select option,select optgroup{background:#151719!important;color:#fff!important}
.title,.alert-title,strong,.tracked-award strong{color:#fff!important;text-shadow:0 1px 1px #000,1px 0 1px #000,-1px 0 1px #000!important}
a,a:visited,a:hover,.alert a,.alert-actions a,.header-alerts a{color:#fff!important;text-shadow:0 1px 2px #000!important}
.status,.alert-detail,small,.privacy,.daily-api-status{color:var(--hl-muted)!important}
.view-button.active,button.active{border-color:var(--hl-hi)!important;background:${rgba(state.accent,.26)}!important;color:#fff!important}
input[type=checkbox],input[type=radio],progress{accent-color:var(--hl-accent)!important}
`;
  }

  function disableOldThemeOverlay() {
    // The earlier SLINK theme test and this lab both target the same closed Shadow DOM.
    // If both are enabled, whichever style block renders last wins. Remove the old test's
    // injected style and floating selector so the Honor Lab is unambiguous.
    try { dashboardRoot?.getElementById(OLD_THEME_STYLE_ID)?.remove(); } catch {}
    try { document.getElementById(OLD_SELECTOR_HOST_ID)?.remove(); } catch {}
  }

  function apply(){
    if(!dashboardRoot) { buildLab(); setStatus('Waiting for Daily Dashboard…','warn'); return; }
    disableOldThemeOverlay();
    let s=dashboardRoot.getElementById(STYLE_ID);
    if(!s){s=document.createElement('style');s.id=STYLE_ID;dashboardRoot.appendChild(s);}
    s.textContent=css();
    buildLab();
    setStatus(state.lastImageName ? `Applied palette from ${state.lastImageName}` : 'Theme applied. Upload an honor image to extract colors.','ok');
  }

  function buildLab(){
    let host=document.getElementById('slink-honor-theme-lab');
    if(host) return syncLab(host.shadowRoot);
    host=document.createElement('div'); host.id='slink-honor-theme-lab'; host.style.cssText='position:fixed;right:10px;bottom:52px;z-index:2147483647';
    document.documentElement.appendChild(host);
    const r=host.attachShadow({mode:'open'});
    r.innerHTML=`<style>:host{all:initial;color-scheme:dark}.box{width:270px;padding:9px;border:1px solid #59636a;border-radius:8px;background:#11161a;color:#eef2f4;box-shadow:0 6px 20px #0009;font:11px/1.25 system-ui}.head{display:flex;justify-content:space-between;align-items:center;font-weight:800;margin-bottom:7px}.grid{display:grid;grid-template-columns:78px 1fr;gap:6px;align-items:center}select,input[type=range],input[type=color],input[type=file],button{box-sizing:border-box;width:100%;background:#20272c;color:#fff;border:1px solid #59636a;border-radius:5px;padding:4px;color-scheme:dark}input[type=file]{font-size:10px}option{background:#171b1e;color:#fff}.colors{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:7px}.colors input{height:30px;padding:1px}.labels{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;color:#87969f;font-size:9px;text-align:center;margin-top:2px}.note{color:#9caab2;margin-top:7px}.status{margin-top:7px;padding:5px 6px;border-radius:5px;background:#1b2227;color:#b8c5cc}.status.ok{color:#9ee5ba}.status.err{color:#ff9999}.status.warn{color:#ffd27a}.row{display:flex;gap:5px;margin-top:7px}.row button{cursor:pointer}.x{width:24px!important}</style><div class=box><div class=head><span>SLINK Honor Theme Lab v0.2</span><button class=x id=hide>×</button></div><div class=grid><label>Honor image</label><input id=file type=file accept="image/*,.webp"><label>Archetype</label><select id=arch><option value=electric>Electric</option><option value=armored>Armored</option><option value=cyber>Cyber</option><option value=stealth>Stealth</option></select><label>Intensity</label><input id=intensity type=range min=.2 max=1 step=.05></div><div class=colors><input id=bg type=color title=Background><input id=surface type=color title=Surface><input id=accent type=color title=Accent><input id=highlight type=color title=Highlight></div><div class=labels><span>BG</span><span>Surface</span><span>Accent</span><span>Highlight</span></div><div id=status class=status>Ready. Upload an honor image.</div><div class=note>Palette extraction happens locally in your browser. The four swatches should visibly change immediately after a successful upload.</div><div class=row><button id=reset>Reset</button><button id=apply>Apply</button></div></div>`;
    r.getElementById('hide').onclick=()=>host.style.display='none';
    r.getElementById('file').onchange=e=>{
      const f=e.target.files?.[0]; if(!f)return;
      setStatus(`Reading ${f.name}…`,'warn');
      const im=new Image();
      const objectUrl=URL.createObjectURL(f);
      im.onload=()=>{
        try {
          const p=extractPalette(im);
          Object.assign(state,p,{lastImageName:f.name});
          save(); syncLab(r); setStatus(`Extracted ${f.name}: ${state.bg} / ${state.accent}`,'ok'); apply();
        } catch(err) {
          console.error('[SLINK Honor Theme Lab] palette extraction failed',err);
          setStatus(`Could not read palette: ${err.message || err}`,'err');
        } finally { URL.revokeObjectURL(objectUrl); }
      };
      im.onerror=()=>{ URL.revokeObjectURL(objectUrl); setStatus('Browser could not decode this image. Try PNG/JPG to compare.','err'); };
      im.src=objectUrl;
    };
    r.getElementById('arch').onchange=e=>{state.archetype=e.target.value;save();apply();};
    r.getElementById('intensity').oninput=e=>{state.intensity=Number(e.target.value);save();apply();};
    ['bg','surface','accent','highlight'].forEach(k=>r.getElementById(k).oninput=e=>{state[k]=e.target.value;save();apply();});
    r.getElementById('apply').onclick=apply;
    r.getElementById('reset').onclick=()=>{Object.assign(state,{archetype:'electric',bg:'#0b0610',surface:'#1a0b22',accent:'#b23cff',highlight:'#efb5ff',muted:'#c3a5cc',intensity:.82,lastImageName:''});save();syncLab(r);setStatus('Reset to lab defaults.','ok');apply();};
    syncLab(r);
  }
  function syncLab(r){if(!r)return;r.getElementById('arch').value=state.archetype;r.getElementById('intensity').value=state.intensity;['bg','surface','accent','highlight'].forEach(k=>r.getElementById(k).value=state[k]);}
  function setStatus(text,type='') {
    const r=document.getElementById('slink-honor-theme-lab')?.shadowRoot;
    const el=r?.getElementById('status'); if(!el)return;
    el.textContent=text; el.className=`status ${type}`;
  }

  setTimeout(()=>buildLab(),700);
})();
