// ==UserScript==
// @name         Considious Torn Theme Test
// @namespace    Considious [3853023]
// @version      0.2.0
// @description  Experimental shared visual theme registry for Considious [3853023]'s Torn scripts.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function installConsidiousThemeTest(global) {
  'use strict';
  if (global.ConsidiousThemeTest) return;

  const STORAGE_KEY = 'considious:theme-test:selected:v1';
  const make = (id, name, description, vars, texture, geometry, effects) => Object.freeze({
    id, name, description,
    vars: Object.freeze(vars),
    texture: Object.freeze(texture),
    geometry: Object.freeze(geometry),
    effects: Object.freeze(effects),
  });

  const THEMES = Object.freeze({
    core: make('core', 'Core', 'Cyber/data panels with cyan signal energy.', {
      bg:'#06131b',surface:'#0a1d27',surfaceRaised:'#102b38',surfaceSoft:'#081820',headerFrom:'#12455b',headerTo:'#071b25',border:'rgba(79,213,255,.34)',borderStrong:'rgba(98,225,255,.72)',accent:'#42d4ff',accentStrong:'#98ebff',accentSoft:'rgba(66,212,255,.14)',text:'#eefbff',muted:'#87aab9',link:'#7ee4ff',button:'#123748',danger:'#ff5864',success:'#55d18b'
    }, {type:'circuit',opacity:.18,scale:28}, {corner:'8px',cut:9,plate:'cyber'}, {glow:'medium',energy:true,inset:true}),
    tactical: make('tactical', 'Tactical', 'Armored steel plates, hex mesh and segmented framing.', {
      bg:'#0b0f12',surface:'#151a1f',surfaceRaised:'#20272d',surfaceSoft:'#101519',headerFrom:'#31383e',headerTo:'#171c20',border:'rgba(159,177,187,.38)',borderStrong:'rgba(78,190,239,.72)',accent:'#35bced',accentStrong:'#95dcf8',accentSoft:'rgba(53,188,237,.10)',text:'#edf2f4',muted:'#9aa8af',link:'#63caf1',button:'#273139',danger:'#ef6b64',success:'#62c987'
    }, {type:'hex',opacity:.13,scale:26}, {corner:'0px',cut:12,plate:'armor'}, {glow:'low',energy:false,inset:true}),
    redline: make('redline', 'Redline', 'Carbon-black aggression with heartbeat/electrical traces.', {
      bg:'#120405',surface:'#21090b',surfaceRaised:'#310d10',surfaceSoft:'#160607',headerFrom:'#5c1014',headerTo:'#1d0608',border:'rgba(255,61,70,.38)',borderStrong:'rgba(255,73,82,.84)',accent:'#ff3440',accentStrong:'#ff8a90',accentSoft:'rgba(255,52,64,.13)',text:'#fff3f3',muted:'#c49a9d',link:'#ff7078',button:'#3a0d10',danger:'#ff3440',success:'#6bd196'
    }, {type:'fracture',opacity:.18,scale:34}, {corner:'2px',cut:12,plate:'blade'}, {glow:'high',energy:true,inset:true}),
    shadow: make('shadow', 'Shadow', 'Graphite slabs, beveled steel and restrained texture.', {
      bg:'#08090a',surface:'#111315',surfaceRaised:'#1a1d20',surfaceSoft:'#0d0f10',headerFrom:'#25282b',headerTo:'#111315',border:'rgba(177,183,188,.25)',borderStrong:'rgba(207,213,217,.48)',accent:'#aeb6bb',accentStrong:'#e1e5e7',accentSoft:'rgba(174,182,187,.08)',text:'#e7e9ea',muted:'#858d92',link:'#bbc3c8',button:'#24282b',danger:'#e26267',success:'#75bd91'
    }, {type:'slate',opacity:.11,scale:38}, {corner:'0px',cut:10,plate:'stealth'}, {glow:'none',energy:false,inset:true}),
    omega: make('omega', 'Omega', 'Evolution skin with violet energy and layered hex fields.', {
      bg:'#0e0617',surface:'#1a0b28',surfaceRaised:'#28113d',surfaceSoft:'#12091d',headerFrom:'#4b176f',headerTo:'#170923',border:'rgba(179,77,255,.38)',borderStrong:'rgba(194,91,255,.78)',accent:'#b447ff',accentStrong:'#dc9fff',accentSoft:'rgba(180,71,255,.15)',text:'#faf2ff',muted:'#b89bc8',link:'#ce82ff',button:'#35134d',danger:'#ff5d86',success:'#6fd59a'
    }, {type:'energyHex',opacity:.18,scale:28}, {corner:'3px',cut:11,plate:'evolved'}, {glow:'high',energy:true,inset:true}),
  });

  function get(id) { return THEMES[id] || THEMES.core; }
  function list() { return Object.values(THEMES); }
  function getSelected() {
    try { return get(localStorage.getItem(STORAGE_KEY) || 'core'); } catch { return THEMES.core; }
  }
  function setSelected(id) {
    const theme = get(id);
    try { localStorage.setItem(STORAGE_KEY, theme.id); } catch {}
    global.dispatchEvent(new CustomEvent('considious-theme-test-change', { detail: theme.id }));
    return theme;
  }
  function cssVariables(id) {
    const t = get(id);
    const v = t.vars;
    return [
      `--sl-bg:${v.bg}`,`--sl-surface:${v.surface}`,`--sl-surface-raised:${v.surfaceRaised}`,`--sl-surface-soft:${v.surfaceSoft}`,
      `--sl-header-from:${v.headerFrom}`,`--sl-header-to:${v.headerTo}`,`--sl-border:${v.border}`,`--sl-border-strong:${v.borderStrong}`,
      `--sl-accent:${v.accent}`,`--sl-accent-strong:${v.accentStrong}`,`--sl-accent-soft:${v.accentSoft}`,`--sl-text:${v.text}`,
      `--sl-muted:${v.muted}`,`--sl-link:${v.link}`,`--sl-button:${v.button}`,`--sl-danger:${v.danger}`,`--sl-success:${v.success}`,
      `--sl-cut:${t.geometry.cut}px`,`--sl-radius:${t.geometry.corner}`,`--sl-texture-opacity:${t.texture.opacity}`,`--sl-texture-scale:${t.texture.scale}px`
    ].join(';');
  }
  function themeClass(id) { return `theme-${get(id).id}`; }

  Object.defineProperty(global, 'ConsidiousThemeTest', {
    value: Object.freeze({ VERSION:'0.2.0', get, list, getSelected, setSelected, cssVariables, themeClass }),
    configurable:false, enumerable:true, writable:false,
  });
})(globalThis);
