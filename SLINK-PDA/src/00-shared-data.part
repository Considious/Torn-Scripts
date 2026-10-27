(function installSharedData(global) {
  'use strict';
  const COMPONENTS = ['strength', 'defense', 'speed', 'dexterity'];
  function finite(value) {
    const raw = value && typeof value === 'object' ? value.value ?? value.total ?? value.amount : value;
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return null;
    const number = Number(raw);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  function personalRecord(body, startedAt, receivedAt, audience) {
    if (body?.error) throw new Error('Torn rejected the shared personal-stat request.');
    const profile = body?.profile ?? body?.basic ?? body;
    const accountId = Number(profile?.id ?? profile?.player_id ?? body?.player_id);
    if (!Number.isInteger(accountId) || accountId <= 0) throw new Error('Torn returned no authenticated player identity.');
    const source = body?.battlestats ?? body?.battle_stats ?? {};
    const components = Object.fromEntries(COMPONENTS.map(key => [key, finite(source[key])]));
    if (Object.values(components).some(value => value === null)) throw new Error('Torn returned incomplete personal battle stats.');
    const total = Object.values(components).reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) throw new Error('Torn returned no usable personal battle-stat total.');
    const level = finite(profile?.level ?? body?.level) || 0;
    return { schema:1, audience, accountId, components, total,
      score:Object.values(components).reduce((sum, value) => sum + Math.sqrt(value), 0),
      level, statsAt:startedAt, levelAt:level > 0 ? startedAt : 0,
      checkedAt:receivedAt, source:'torn-v2-authenticated-battlestats' };
  }
  async function fingerprint(key) {
    const digest = await global.crypto.subtle.digest('SHA-256', new TextEncoder().encode('SLINK shared personal stats\0' + key));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function create(adapter) {
    const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
    const pending = new Map();
    let queue = Promise.resolve();
    let clock = 0;
    const now = adapter.now || Date.now;
    function mutate(updater) {
      const task = queue.then(async () => {
        const latest = copy(await adapter.read() || {});
        const result = await updater(latest);
        await adapter.write(latest);
        return result;
      });
      queue = task.catch(() => undefined);
      return task;
    }
    function requestOnce(id, force, operation) {
      const active = pending.get(id);
      if (active && (!force || active.force)) return active.promise;
      const request = { force, startedAt:clock = Math.max(now(), clock + 1) };
      request.promise = operation(request.startedAt).finally(() => { if (pending.get(id) === request) pending.delete(id); });
      pending.set(id, request);
      return request.promise;
    }
    async function audienceFor(key) {
      if (!String(key || '').trim()) throw new Error('A Torn API key is required.');
      return (adapter.fingerprint || fingerprint)(String(key).trim());
    }
    async function peekPersonal({ key }) {
      const audience = await audienceFor(key);
      const record = (await adapter.read())?.personal?.[audience];
      // Unbound legacy totals are not sufficient to identify an account or derive a score.
      return record?.audience === audience && record.accountId > 0 && COMPONENTS.every(name => finite(record.components?.[name]) !== null) ? copy(record) : null;
    }
    async function personal({ key, force = false, maxAgeMs = 900_000, requireLevel = false }) {
      const audience = await audienceFor(key);
      const cached = await peekPersonal({ key });
      if (!force && !pending.get('personal:' + audience)?.force && cached && now() - cached.statsAt < maxAgeMs
        && (!requireLevel || (cached.level > 0 && now() - cached.levelAt < maxAgeMs))) return cached;
      const result = await requestOnce('personal:' + audience, force, async startedAt => {
        const body = await adapter.request('personal', key);
        const next = personalRecord(body, startedAt, now(), audience);
        return mutate(state => {
          state.personal ||= {};
          const previous = state.personal[audience];
          const current = previous?.statsAt > startedAt ? { ...previous } : { ...next };
          if (previous?.accountId === next.accountId) {
            const level = next.level > 0 && next.levelAt >= Number(previous.levelAt || 0) ? next : previous;
            current.level = level.level;
            current.levelAt = level.levelAt;
          }
          state.personal[audience] = current;
          return current;
        });
      });
      if (requireLevel && (!(result.level > 0) || (maxAgeMs > 0 && now() - result.levelAt >= maxAgeMs))) {
        throw new Error('Torn returned incomplete current player level; valid battle stats were retained.');
      }
      return copy(result);
    }
    async function catalog({ key, force = false, maxAgeMs = 86_400_000, needPrices = false, category = 'All' }) {
      await audienceFor(key);
      if (category !== 'All') throw new Error('Only the complete All-category catalog can be shared.');
      const cached = (await adapter.read())?.catalog;
      const freshAt = needPrices ? cached?.pricesAt : cached?.metadataAt;
      if (!force && !pending.get('catalog:All')?.force && cached?.coverage === 'All' && cached.items?.length && freshAt > 0 && now() - freshAt < maxAgeMs) return copy(cached);
      // Public catalog identity/price data is compatible across callers; credentials remain in the transport only.
      const result = await requestOnce('catalog:All', force, async startedAt => {
        const body = await adapter.request('catalog', key);
        if (body?.error) throw new Error('Torn rejected the shared item catalog request.');
        const items = adapter.normalizeItems(body);
        if (!items.length) throw new Error('Torn returned an empty item catalog.');
        const raw = Array.isArray(body?.items) ? body.items : Object.entries(body?.items || {}).map(([id, item]) => ({ ...item, id:item?.id ?? id }));
        const prices = new Map(raw.map(item => [Number(item?.id), finite(item?.value?.market_price)]));
        return mutate(state => {
          const previous = state.catalog;
          const old = new Map((previous?.items || []).map(item => [item.id, item]));
          const newestMetadata = !(previous?.metadataAt > startedAt);
          const normalized = (newestMetadata ? items : previous.items).map(item => {
            const price = prices.get(item.id);
            const prior = old.get(item.id);
            const usePrice = price !== null && price !== undefined && startedAt >= Number(prior?.priceCheckedAt || 0);
            return { ...item, marketPrice:usePrice ? price : prior?.marketPrice ?? 0,
              priceCheckedAt:usePrice ? startedAt : Number(prior?.priceCheckedAt) || 0,
              priceAvailable:usePrice || prior?.priceAvailable === true };
          });
          const metadataAt = newestMetadata ? startedAt : previous.metadataAt;
          const next = { schema:1, coverage:'All', items:normalized, fetchedAt:newestMetadata ? now() : previous.fetchedAt, metadataAt,
            pricesAt:normalized.every(item => item.priceAvailable) ? Math.min(...normalized.map(item => item.priceCheckedAt)) : 0,
            partialPrices:normalized.some(item => !item.priceAvailable || item.priceCheckedAt < metadataAt), source:'torn-v2-items-all' };
          state.catalog = next;
          return next;
        });
      });
      if (needPrices && (!(result.pricesAt > 0) || now() - result.pricesAt >= maxAgeMs)) throw new Error('Torn returned incomplete current item prices; previous prices were retained.');
      return copy(result);
    }
    return Object.freeze({ personal, peekPersonal, catalog });
  }
  const api = Object.freeze({ create, personalRecord, fingerprint });
  if (global.SLINK_EXTENSION) global.SLINK_EXTENSION.define('core', 'sharedData', api);
  else global.SLINK_SHARED_DATA = api;
})(globalThis);
