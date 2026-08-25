(function installThemes(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before themes.');

  const THEMES = Object.freeze({
    'slink-dark': Object.freeze({
      id: 'slink-dark',
      label: 'SLINK Dark',
      tokens: Object.freeze({
        '--slink-bg': '#121922',
        '--slink-bg-raised': '#202c39',
        '--slink-bg-control': '#2b3745',
        '--slink-border': 'rgba(132, 199, 255, .42)',
        '--slink-border-soft': 'rgba(255, 255, 255, .11)',
        '--slink-text': '#eaf4ff',
        '--slink-muted': '#9eb0c2',
        '--slink-accent': '#69b5f4',
        '--slink-ready': '#8fe0a5',
        '--slink-warning': '#ffd27a',
        '--slink-error': '#ffaaaa',
        '--slink-danger-bg': '#482828',
        '--slink-link': '#8fc9ff',
        '--slink-shadow': 'rgba(0, 0, 0, .42)'
      })
    })
  });

  function get(id = 'slink-dark') {
    return THEMES[id] || THEMES['slink-dark'];
  }

  function cssVariables(id) {
    return Object.entries(get(id).tokens)
      .map(([name, value]) => `${name}:${value}`)
      .join(';');
  }

  SLINK.define('core', 'themes', Object.freeze({ THEMES, cssVariables, get }));
})(globalThis);
