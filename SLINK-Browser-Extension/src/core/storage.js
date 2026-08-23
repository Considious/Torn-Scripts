(function installStorage(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before storage.');

  function fullKey(key) {
    const normalized = String(key || '').trim();
    if (!normalized) throw new Error('A SLINK storage key is required.');
    return `${SLINK.STORAGE_PREFIX}${normalized}`;
  }

  async function get(key, fallback = undefined) {
    const storageKey = fullKey(key);
    const values = await chrome.storage.local.get(storageKey);
    return Object.prototype.hasOwnProperty.call(values, storageKey)
      ? values[storageKey]
      : fallback;
  }

  async function set(key, value) {
    await chrome.storage.local.set({ [fullKey(key)]: value });
    return value;
  }

  async function remove(key) {
    await chrome.storage.local.remove(fullKey(key));
  }

  async function update(key, updater, fallback = undefined) {
    if (typeof updater !== 'function') throw new TypeError('Storage updater must be a function.');
    const current = await get(key, fallback);
    const next = await updater(current);
    return set(key, next);
  }

  SLINK.define('core', 'storage', Object.freeze({
    fullKey,
    get,
    remove,
    set,
    update
  }));
})(globalThis);
