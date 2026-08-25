(function installHttp(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before HTTP helpers.');

  const CAPABILITY_ORIGINS = Object.freeze({
    tornApi: 'https://api.torn.com',
    ffscouter: 'https://ffscouter.com',
    slinkWorker: 'https://slinkyleveling.richard-johnson554.workers.dev',
    contributionWorker: 'https://slinkcontributionworker.richard-johnson554.workers.dev',
    warWorker: 'https://slinkwarworker.richard-johnson554.workers.dev'
  });

  async function hasCapability(name) {
    const capability = SLINK.core.permissions.getCapability(name);
    return chrome.permissions.contains({ origins: [...capability.origins] });
  }

  function validateUrl(capabilityName, input) {
    const expectedOrigin = CAPABILITY_ORIGINS[capabilityName];
    if (!expectedOrigin) throw new Error(`No HTTP origin is configured for ${capabilityName}.`);
    const url = new URL(String(input));
    if (url.origin !== expectedOrigin) {
      const error = new Error(`Blocked ${capabilityName} request to ${url.origin}.`);
      error.code = 'SLINK_ORIGIN_BLOCKED';
      throw error;
    }
    return url;
  }

  async function requestJson(capabilityName, input, options = {}) {
    const url = validateUrl(capabilityName, input);
    if (!await hasCapability(capabilityName)) {
      const error = new Error(`${SLINK.core.permissions.getCapability(capabilityName).label} permission has not been granted.`);
      error.code = 'SLINK_BROWSER_PERMISSION_REQUIRED';
      throw error;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        const error = new Error(`Expected JSON from ${url.hostname}.`);
        error.code = 'SLINK_INVALID_JSON';
        throw error;
      }
    }
    if (!response.ok) {
      const error = new Error(data?.error?.message || data?.error || `HTTP ${response.status}`);
      error.code = 'SLINK_HTTP_ERROR';
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function requestText(capabilityName, input, options = {}) {
    const url = validateUrl(capabilityName, input);
    if (!await hasCapability(capabilityName)) {
      const error = new Error(`${SLINK.core.permissions.getCapability(capabilityName).label} permission has not been granted.`);
      error.code = 'SLINK_BROWSER_PERMISSION_REQUIRED';
      throw error;
    }

    const response = await fetch(url, options);
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.code = 'SLINK_HTTP_ERROR';
      error.status = response.status;
      throw error;
    }
    return text;
  }

  SLINK.define('core', 'http', Object.freeze({
    CAPABILITY_ORIGINS,
    hasCapability,
    requestJson,
    requestText,
    validateUrl
  }));
})(globalThis);
