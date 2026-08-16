// ==UserScript==
// @name         Considious Torn Theme Test
// @namespace    Considious [3853023]
// @version      0.3.0
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
      bg:'#06131b',surface:'#0a1d27',surfaceRaised:'#102b38',surfaceSoft:'#081820',headerFrom:'#12455b',headerTo:'#071b25',border:'rgba(79,213,255,.34)',borderStrong:'rgba(98,225,255,.72)',accent:'#42d4ff',accentStrong:'#98ebff',accentSoft:'rgba(66,212,255,.14)',text:'#eefbff',muted:'#87aab9',link:'#7ee4ff',button:'#123748',danger:'#ff5864',success:'#55d18b'
    }, {type:'circuit',opacity:.18,scale:28}, {corner:'8px',cut:9,plate:'cyber'}, {glow:'medium',energy:true,inset:true}),
    tactical: make('tactical', 'Tactical', 'Black gunmetal armor with blood-crimson markings.', {
      bg:'#090a0b',surface:'#121416',surfaceRaised:'#1b1e21',surfaceSoft:'#0d0f10',headerFrom:'#292c2f',headerTo:'#111315',border:'rgba(143,151,157,.34)',borderStrong:'rgba(158,48,59,.76)',accent:'#8f2630',accentStrong:'#d95b66',accentSoft:'rgba(143,38,48,.16)',text:'#eef0f1',muted:'#969da2',link:'#d96a72',button:'#24272a',danger:'#ed5964',success:'#68c58a'
    }, {type:'ballistic',opacity:.14,scale:27}, {corner:'0px',cut:11,plate:'armor'}, {glow:'low',energy:false,inset:true}),
    redline: make('redline', 'Redline', 'Carbon-black aggression with hot crimson electrical traces.', {
      bg:'#120405',surface:'#21090b',surfaceRaised:'#310d10',surfaceSoft:'#160607',headerFrom:'#5c1014',headerTo:'#1d0608',border:'rgba(255,61,70,.38)',borderStrong:'rgba(255,73,82,.84)',accent:'#ff3440',accentStrong:'#ff8a90',accentSoft:'rgba(255,52,64,.13)',text:'#fff3f3',muted:'#c49a9d',link:'#ff7078',button:'#3a0d10',danger:'#ff3440',success:'#6bd196'
    }, {type:'fracture',opacity:.18,scale:34}, {corner:'2px',cut:12,plate:'blade'}, {glow:'high',energy:true,inset:true}),
    shadow: make('shadow', 'Shadow', 'Graphite slabs, beveled steel and restrained texture.', {
      bg:'#08090a',surface:'#111315',surfaceRaised:'#1a1d20',surfaceSoft:'#0d0f10',headerFrom:'#25282b',headerTo:'#111315',border:'rgba(177,183,188,.25)',borderStrong:'rgba(207,213,217,.48)',accent:'#aeb6bb',accentStrong:'#e1e5e7',accentSoft:'rgba(174,182,187,.08)',text:'#e7e9ea',muted:'#858d92',link:'#bbc3c8',button:'#24282b',danger:'#e26267',success:'#75bd91'
    }, {type:'slate',opacity:.11,scale:38}, {corner:'0px',cut:10,plate:'stealth'}, {glow:'none',energy:false,inset:true}),
    omega: make('omega', 'Omega', 'Deep violet evolution skin with layered energy and lightning.', {
      bg:'#0b0412',surface:'#160821',surfaceRaised:'#251036',surfaceSoft:'#100617',headerFrom:'#42135f',headerTo:'#14071d',border:'rgba(168,68,238,.38)',borderStrong:'rgba(200,94,255,.82)',accent:'#ae3fff',accentStrong:'#e0a1ff',accentSoft:'rgba(174,63,255,.16)',text:'#fbf2ff',muted:'#b99bc8',link:'#d584ff',button:'#311045',danger:'#ff5d86',success:'#6fd59a'
    }, {type:'energyHex',opacity:.20,scale:28}, {corner:'3px',cut:11,plate:'evolved'}, {glow:'high',energy:true,inset:true}),
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
    value: Object.freeze({ VERSION:'0.3.0', get, list, getSelected, setSelected, cssVariables, themeClass }),
    configurable:false, enumerable:true, writable:false,
  });
})(globalThis);
