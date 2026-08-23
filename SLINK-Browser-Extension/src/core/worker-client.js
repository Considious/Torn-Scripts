(function installWorkerClient(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the Worker client.');

  const BASE_URL = 'https://slinkyleveling.richard-johnson554.workers.dev';

  async function probe(options = {}) {
    const deep = options.deep === true;
    const startedAt = Date.now();
    const checkedAt = new Date(startedAt).toISOString();
    const endpoint = deep ? '/api/health' : '/';

    try {
      const response = await SLINK.core.http.requestJson(
        'slinkWorker',
        `${BASE_URL}${endpoint}`,
        { cache: 'no-store' }
      );
      const connected = response?.ok === true;
      return Object.freeze({
        connected,
        checkedAt,
        latencyMs: Math.max(0, Date.now() - startedAt),
        mode: deep ? 'deep' : 'connection',
        service: String(response?.service || 'SLINK Leveling API'),
        version: String(response?.version || 'unknown'),
        database: response?.database || null,
        consentDatabase: response?.consent_database || null,
        permissionsDatabase: response?.permissions_database || null,
        error: connected ? null : String(response?.error || 'The Worker returned an unhealthy response.')
      });
    } catch (error) {
      return Object.freeze({
        connected: false,
        checkedAt,
        latencyMs: Math.max(0, Date.now() - startedAt),
        mode: deep ? 'deep' : 'connection',
        service: 'SLINK Leveling API',
        version: 'unknown',
        database: null,
        consentDatabase: null,
        error: SLINK.core.format.errorMessage(error)
      });
    }
  }

  SLINK.define('core', 'workerClient', Object.freeze({
    BASE_URL,
    probe
  }));
})(globalThis);
