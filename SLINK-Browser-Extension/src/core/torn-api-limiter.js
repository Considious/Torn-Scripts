(function installTornApiLimiter(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the Torn API limiter.');

  const LEDGER_KEY = 'core.tornApiLedger.v1';
  const WINDOW_MS = 60_000;
  const DEFAULT_LIMIT = 60;
  let queue = Promise.resolve();

  function prune(events, now = Date.now()) {
    const cutoff = now - WINDOW_MS;
    return (Array.isArray(events) ? events : [])
      .map(Number)
      .filter(timestamp => Number.isFinite(timestamp) && timestamp > cutoff)
      .sort((a, b) => a - b);
  }

  function serialize(task) {
    const result = queue.then(task, task);
    queue = result.catch(() => undefined);
    return result;
  }

  async function getUsage(limit = DEFAULT_LIMIT) {
    const events = prune(await SLINK.core.storage.get(LEDGER_KEY, []));
    return {
      count: events.length,
      limit: Math.max(1, Number(limit) || DEFAULT_LIMIT),
      remaining: Math.max(0, (Math.max(1, Number(limit) || DEFAULT_LIMIT)) - events.length)
    };
  }

  async function reserve(options = {}) {
    return serialize(async () => {
      const limit = Math.max(1, Number(options.limit) || DEFAULT_LIMIT);
      const wait = options.wait !== false;

      while (true) {
        const now = Date.now();
        const events = prune(await SLINK.core.storage.get(LEDGER_KEY, []), now);
        if (events.length < limit) {
          events.push(now);
          await SLINK.core.storage.set(LEDGER_KEY, events);
          return Object.freeze({ reservedAt: now, count: events.length, limit });
        }
        if (!wait) {
          const error = new Error('The local Torn API limit is currently full.');
          error.code = 'SLINK_TORN_API_LIMIT';
          throw error;
        }
        const delay = Math.max(50, events[0] + WINDOW_MS - now + 25);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    });
  }

  SLINK.define('core', 'tornApiLimiter', Object.freeze({
    DEFAULT_LIMIT,
    WINDOW_MS,
    getUsage,
    prune,
    reserve
  }));
})(globalThis);
