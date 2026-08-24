(function installPermissions(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before permissions.');

  const BROWSER_CAPABILITIES = Object.freeze({
    tornApi: Object.freeze({
      label: 'Torn API',
      optional: false,
      origins: Object.freeze(['https://api.torn.com/*'])
    }),
    ffscouter: Object.freeze({
      label: 'FFScouter',
      optional: false,
      origins: Object.freeze(['https://ffscouter.com/*'])
    }),
    slinkWorker: Object.freeze({
      label: 'SLINK Worker',
      optional: false,
      origins: Object.freeze(['https://slinkyleveling.richard-johnson554.workers.dev/*'])
    }),
    contributionWorker: Object.freeze({
      label: 'SLINK Contribution Service',
      optional: false,
      origins: Object.freeze(['https://slinkcontribution.richard-johnson554.workers.dev/*'])
    })
  });

  function stringList(values) {
    return [...new Set(
      (Array.isArray(values) ? values : [])
        .map(value => String(value || '').trim())
        .filter(Boolean)
    )].sort();
  }

  function normalizeSnapshot(snapshot = {}) {
    return Object.freeze({
      userId: Number.isInteger(Number(snapshot.userId)) ? Number(snapshot.userId) : null,
      roles: Object.freeze(stringList(snapshot.roles)),
      scopes: Object.freeze(stringList(snapshot.scopes)),
      source: String(snapshot.source || 'unknown'),
      issuedAt: Number(snapshot.issuedAt) || 0,
      expiresAt: Number(snapshot.expiresAt) || 0
    });
  }

  function scopeMatches(grantedScope, requiredScope) {
    if (grantedScope === '*' || grantedScope === requiredScope) return true;
    if (!grantedScope.endsWith('.*')) return false;
    return requiredScope.startsWith(grantedScope.slice(0, -1));
  }

  function hasScope(snapshot, requiredScope) {
    const normalized = normalizeSnapshot(snapshot);
    const required = String(requiredScope || '').trim();
    if (!required) return true;
    return normalized.scopes.some(scope => scopeMatches(scope, required));
  }

  function hasAllScopes(snapshot, requiredScopes = []) {
    return stringList(requiredScopes).every(scope => hasScope(snapshot, scope));
  }

  function requireScopes(snapshot, requiredScopes = []) {
    const missing = stringList(requiredScopes).filter(scope => !hasScope(snapshot, scope));
    if (missing.length) {
      const error = new Error(`Missing SLINK permission${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);
      error.code = 'SLINK_PERMISSION_DENIED';
      error.missingScopes = missing;
      throw error;
    }
    return true;
  }

  function getCapability(name) {
    const capability = BROWSER_CAPABILITIES[String(name || '')];
    if (!capability) throw new Error(`Unknown browser capability: ${name}`);
    return capability;
  }

  SLINK.define('core', 'permissions', Object.freeze({
    BROWSER_CAPABILITIES,
    getCapability,
    hasAllScopes,
    hasScope,
    normalizeSnapshot,
    requireScopes,
    scopeMatches
  }));
})(globalThis);
