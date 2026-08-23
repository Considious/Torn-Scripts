(function installFormat(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before format helpers.');

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function errorMessage(error, fallback = 'Unknown error') {
    if (typeof error === 'string' && error.trim()) return error.trim();
    if (error?.message) return String(error.message);
    if (error?.error?.error) return String(error.error.error);
    if (error?.error) return String(error.error);
    return fallback;
  }

  function shortNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value ?? '');

    for (const [size, suffix] of [
      [1e15, 'Q'],
      [1e12, 'T'],
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K']
    ]) {
      if (Math.abs(number) >= size) {
        return `${Number((number / size).toFixed(2))}${suffix}`;
      }
    }
    return String(number);
  }

  function formatHumanDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  }

  SLINK.define('core', 'format', Object.freeze({
    errorMessage,
    escapeHtml,
    formatHumanDuration,
    shortNumber
  }));
})(globalThis);
