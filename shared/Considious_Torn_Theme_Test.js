// ==UserScript==
// @name         Considious Torn Theme Test
// @namespace    Considious [3853023]
// @version      0.1.0
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

  const THEMES = Object.freeze({
    core: Object.freeze({
      id: 'core',
      name: 'Core',
      description: 'Clean cyan command-interface styling.',
      vars: Object.freeze({
        bg: '#08151d',
        surface: '#0e202b',
        surfaceRaised: '#122a37',
        surfaceSoft: '#0b1a23',
        headerFrom: '#12384b',
        headerTo: '#0a202c',
        border: 'rgba(88, 211, 255, .30)',
        borderStrong: 'rgba(88, 211, 255, .58)',
        accent: '#58d3ff',
        accentStrong: '#8fe5ff',
        accentSoft: 'rgba(88, 211, 255, .13)',
        text: '#edf9ff',
        muted: '#8ca8b6',
        link: '#83dcff',
        button: '#173847',
        buttonHover: '#205168',
        glow: '0 0 26px rgba(51, 198, 255, .20)',
        headerGlow: 'inset 0 -1px rgba(88,211,255,.22), 0 5px 20px rgba(0,0,0,.24)',
        texture: 'linear-gradient(rgba(88,211,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(88,211,255,.025) 1px, transparent 1px)',
        textureSize: '18px 18px',
        progressFrom: '#2fbef4',
        progressTo: '#8fe5ff',
      }),
    }),
    tactical: Object.freeze({
      id: 'tactical',
      name: 'Tactical',
      description: 'Gunmetal, hex-grid, field-terminal styling.',
      vars: Object.freeze({
        bg: '#111416',
        surface: '#1a2024',
        surfaceRaised: '#222a2f',
        surfaceSoft: '#151a1d',
        headerFrom: '#38434a',
        headerTo: '#20272b',
        border: 'rgba(153, 190, 210, .23)',
        borderStrong: 'rgba(111, 193, 236, .52)',
        accent: '#70c7f4',
        accentStrong: '#b2e3fb',
        accentSoft: 'rgba(112, 199, 244, .10)',
        text: '#edf2f4',
        muted: '#99a6ad',
        link: '#9bd8f6',
        button: '#303a40',
        buttonHover: '#3b4850',
        glow: '0 0 18px rgba(98, 173, 215, .12)',
        headerGlow: 'inset 0 -1px rgba(150,205,235,.14), 0 5px 18px rgba(0,0,0,.28)',
        texture: 'radial-gradient(circle at 25% 25%, rgba(135,180,205,.06) 0 1px, transparent 1.5px)',
        textureSize: '12px 12px',
        progressFrom: '#4b9fc9',
        progressTo: '#8dd6fa',
      }),
    }),
    redline: Object.freeze({
      id: 'redline',
      name: 'Redline',
      description: 'Black carbon surfaces with crimson energy.',
      vars: Object.freeze({
        bg: '#12090b',
        surface: '#1c0f12',
        surfaceRaised: '#281418',
        surfaceSoft: '#160b0d',
        headerFrom: '#4a1119',
        headerTo: '#1c0b0e',
        border: 'rgba(255, 72, 92, .26)',
        borderStrong: 'rgba(255, 72, 92, .62)',
        accent: '#ff485c',
        accentStrong: '#ff8995',
        accentSoft: 'rgba(255,72,92,.11)',
        text: '#fff0f2',
        muted: '#b58d93',
        link: '#ff9aa5',
        button: '#3a171d',
        buttonHover: '#512029',
        glow: '0 0 28px rgba(255, 43, 70, .18)',
        headerGlow: 'inset 0 -1px rgba(255,72,92,.24), 0 5px 24px rgba(0,0,0,.30)',
        texture: 'repeating-linear-gradient(135deg, rgba(255,255,255,.018) 0 2px, transparent 2px 8px)',
        textureSize: 'auto',
        progressFrom: '#d9273f',
        progressTo: '#ff6b7b',
      }),
    }),
    shadow: Object.freeze({
      id: 'shadow',
      name: 'Shadow',
      description: 'Low-light graphite and silver stealth styling.',
      vars: Object.freeze({
        bg: '#0b0c0e',
        surface: '#121417',
        surfaceRaised: '#1a1d21',
        surfaceSoft: '#0f1114',
        headerFrom: '#292d32',
        headerTo: '#14171a',
        border: 'rgba(207, 216, 224, .14)',
        borderStrong: 'rgba(207,216,224,.34)',
        accent: '#aebbc4',
        accentStrong: '#e2e7eb',
        accentSoft: 'rgba(190,200,208,.07)',
        text: '#e8ebed',
        muted: '#818a91',
        link: '#c4d0d7',
        button: '#25292e',
        buttonHover: '#30353b',
        glow: '0 8px 30px rgba(0,0,0,.48)',
        headerGlow: 'inset 0 -1px rgba(255,255,255,.08), 0 5px 20px rgba(0,0,0,.36)',
        texture: 'linear-gradient(115deg, rgba(255,255,255,.018), transparent 34%, rgba(255,255,255,.012) 35%, transparent 70%)',
        textureSize: '240px 240px',
        progressFrom: '#747f87',
        progressTo: '#d0d7dc',
      }),
    }),
    omega: Object.freeze({
      id: 'omega',
      name: 'Omega',
      description: 'Deep violet futuristic command styling.',
      vars: Object.freeze({
        bg: '#10091b',
        surface: '#1a1028',
        surfaceRaised: '#26153a',
        surfaceSoft: '#130c20',
        headerFrom: '#4d2170',
        headerTo: '#1c0d2d',
        border: 'rgba(184, 103, 255, .27)',
        borderStrong: 'rgba(195,111,255,.62)',
        accent: '#bc72ff',
        accentStrong: '#dfb5ff',
        accentSoft: 'rgba(188,114,255,.12)',
        text: '#f7edff',
        muted: '#a78eb8',
        link: '#d29cff',
        button: '#39214f',
        buttonHover: '#4c2c68',
        glow: '0 0 32px rgba(164, 72, 255, .22)',
        headerGlow: 'inset 0 -1px rgba(214,150,255,.20), 0 5px 26px rgba(0,0,0,.28)',
        texture: 'radial-gradient(circle at 20% 10%, rgba(204,132,255,.055), transparent 24%), radial-gradient(circle at 80% 90%, rgba(99,52,180,.07), transparent 28%)',
        textureSize: 'auto',
        progressFrom: '#8849c9',
        progressTo: '#d29cff',
      }),
    }),
  });

  function list() {
    return Object.values(THEMES).map(({ id, name, description }) => ({ id, name, description }));
  }

  function get(id) {
    return THEMES[String(id || '').toLowerCase()] || THEMES.core;
  }

  function getSelected() {
    try {
      return get(global.localStorage?.getItem(STORAGE_KEY) || 'core');
    } catch {
      return THEMES.core;
    }
  }

  function setSelected(id) {
    const theme = get(id);
    try { global.localStorage?.setItem(STORAGE_KEY, theme.id); } catch {}
    try {
      global.dispatchEvent(new CustomEvent('considious-theme-test-change', { detail: { id: theme.id } }));
    } catch {}
    return theme;
  }

  function cssVariables(id) {
    const theme = get(id);
    const v = theme.vars;
    return `
      --sl-bg:${v.bg};
      --sl-surface:${v.surface};
      --sl-surface-raised:${v.surfaceRaised};
      --sl-surface-soft:${v.surfaceSoft};
      --sl-header-from:${v.headerFrom};
      --sl-header-to:${v.headerTo};
      --sl-border:${v.border};
      --sl-border-strong:${v.borderStrong};
      --sl-accent:${v.accent};
      --sl-accent-strong:${v.accentStrong};
      --sl-accent-soft:${v.accentSoft};
      --sl-text:${v.text};
      --sl-muted:${v.muted};
      --sl-link:${v.link};
      --sl-button:${v.button};
      --sl-button-hover:${v.buttonHover};
      --sl-glow:${v.glow};
      --sl-header-glow:${v.headerGlow};
      --sl-texture:${v.texture};
      --sl-texture-size:${v.textureSize};
      --sl-progress-from:${v.progressFrom};
      --sl-progress-to:${v.progressTo};
    `.trim();
  }

  Object.defineProperty(global, 'ConsidiousThemeTest', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      VERSION: '0.1.0',
      STORAGE_KEY,
      THEMES,
      list,
      get,
      getSelected,
      setSelected,
      cssVariables,
    }),
  });
})(globalThis);
