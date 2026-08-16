// ==UserScript==
// @name         Considious Torn Theme Test
// @namespace    Considious [3853023]
// @version      0.4.0
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
    core: make('core', 'Core', 'Cyber/data surfaces with cyan signal energy.', {
      bg:'#06131b',surface:'#0a1d27',surfaceRaised:'#102b38',surfaceSoft:'#081820',headerFrom:'#12455b',headerTo:'#071b25',border:'rgba(79,213,255,.34)',borderStrong:'rgba(98,225,255,.72)',accent:'#42d4ff',accentStrong:'#b9f2ff',accentSoft:'rgba(66,212,255,.14)',text:'#f5fcff',muted:'#9bb9c5',link:'#c4f4ff',button:'#123748',danger:'#ff5864',success:'#55d18b'
    }, {type:'circuit',opacity:.18,scale:28}, {corner:'8px',cut:9,plate:'cyber'}, {glow:'medium',energy:true,inset:true}),
    tactical: make('tactical', 'Tactical', 'Black gunmetal armor with blood-crimson markings.', {
      bg:'#070809',surface:'#101214',surfaceRaised:'#181b1e',surfaceSoft:'#0b0d0f',headerFrom:'#25282b',headerTo:'#0d0f11',border:'rgba(132,140,146,.38)',borderStrong:'rgba(146,35,46,.88)',accent:'#921f2b',accentStrong:'#e26a73',accentSoft:'rgba(146,31,43,.18)',text:'#f2f3f4',muted:'#a6adb2',link:'#ffd0d3',button:'#202326',danger:'#ed5964',success:'#68c58a'
    }, {type:'ballistic',opacity:.16,scale:27}, {corner:'0px',cut:11,plate:'armor'}, {glow:'low',energy:false,inset:true}),
    redline: make('redline', 'Redline', 'Carbon-black aggression with hot crimson electrical traces.', {
      bg:'#0d0203',surface:'#190507',surfaceRaised:'#27090c',surfaceSoft:'#110304',headerFrom:'#4d0b10',headerTo:'#150305',border:'rgba(255,61,70,.40)',borderStrong:'rgba(255,73,82,.92)',accent:'#ff2c39',accentStrong:'#ffb3b8',accentSoft:'rgba(255,44,57,.16)',text:'#fff7f7',muted:'#d0a7aa',link:'#ffd1d4',button:'#340a0e',danger:'#ff3440',success:'#6bd196'
    }, {type:'fracture',opacity:.22,scale:34}, {corner:'2px',cut:12,plate:'blade'}, {glow:'high',energy:true,inset:true}),
    shadow: make('shadow', 'Shadow', 'Graphite slabs, beveled steel and restrained texture.', {
      bg:'#070809',surface:'#0f1113',surfaceRaised:'#181b1e',surfaceSoft:'#0b0d0f',headerFrom:'#232629',headerTo:'#0e1012',border:'rgba(177,183,188,.28)',borderStrong:'rgba(215,220,223,.56)',accent:'#aeb6bb',accentStrong:'#f1f3f4',accentSoft:'rgba(174,182,187,.09)',text:'#f1f2f3',muted:'#9da4a8',link:'#eef1f3',button:'#202427',danger:'#e26267',success:'#75bd91'
    }, {type:'slate',opacity:.13,scale:38}, {corner:'0px',cut:10,plate:'stealth'}, {glow:'none',energy:false,inset:true}),
    omega: make('omega', 'Omega', 'Deep violet evolution skin with layered energy and lightning.', {
      bg:'#08020d',surface:'#12061b',surfaceRaised:'#200c30',surfaceSoft:'#0d0413',headerFrom:'#37104f',headerTo:'#100517',border:'rgba(168,68,238,.42)',borderStrong:'rgba(205,98,255,.90)',accent:'#b43cff',accentStrong:'#f0c2ff',accentSoft:'rgba(180,60,255,.18)',text:'#fff8ff',muted:'#c9add5',link:'#f1c7ff',button:'#2a0d3c',danger:'#ff5d86',success:'#6fd59a'
    }, {type:'energyHex',opacity:.24,scale:28}, {corner:'3px',cut:11,plate:'evolved'}, {glow:'high',energy:true,inset:true}),
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
    value: Object.freeze({ VERSION:'0.4.0', get, list, getSelected, setSelected, cssVariables, themeClass }),
    configurable:false, enumerable:true, writable:false,
  });
})(globalThis);
