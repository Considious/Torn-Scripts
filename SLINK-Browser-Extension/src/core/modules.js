(function installModules(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before modules.');

  const registry = new Map();
  const running = new Map();

  function register(definition) {
    const id = String(definition?.id || '').trim();
    if (!id) throw new Error('A SLINK module ID is required.');
    if (registry.has(id)) throw new Error(`SLINK module ${id} is already registered.`);
    if (typeof definition.start !== 'function') throw new Error(`SLINK module ${id} requires a start function.`);

    const normalized = Object.freeze({
      id,
      title: String(definition.title || id),
      defaultShowInTorn: definition.defaultShowInTorn !== false,
      requiredScopes: Object.freeze([...(definition.requiredScopes || [])]),
      matches: typeof definition.matches === 'function' ? definition.matches : () => true,
      start: definition.start,
      stop: typeof definition.stop === 'function' ? definition.stop : null
    });
    registry.set(id, normalized);
    return normalized;
  }

  function list() {
    return [...registry.values()];
  }

  async function startAll(context) {
    const started = [];
    const denied = [];
    const skipped = [];

    for (const module of registry.values()) {
      if (running.has(module.id)) {
        skipped.push({ id: module.id, reason: 'already-running' });
        continue;
      }
      if (!module.matches(context.url)) {
        skipped.push({ id: module.id, reason: 'url-mismatch' });
        continue;
      }
      if (!SLINK.core.permissions.hasAllScopes(context.permissions, module.requiredScopes)) {
        denied.push({ id: module.id, requiredScopes: [...module.requiredScopes] });
        continue;
      }

      const presentation = typeof context.modulePresentation === 'function'
        ? await context.modulePresentation(module)
        : (typeof context.moduleVisible === 'function' && !await context.moduleVisible(module) ? 'hidden' : 'full');
      if (presentation === 'hidden') {
        skipped.push({ id: module.id, reason: 'hidden-by-user' });
        continue;
      }

      const moduleUi = presentation === 'full' && context.ui?.createModuleView
        ? await context.ui.createModuleView(module)
        : context.ui;
      const instance = await module.start({ ...context, module, ui: moduleUi, presentation });
      running.set(module.id, { module, instance, moduleUi });
      started.push(module.id);
    }

    return { started, denied, skipped };
  }

  async function stopAll() {
    for (const [id, entry] of [...running.entries()].reverse()) {
      if (entry.module.stop) await entry.module.stop(entry.instance);
      else if (typeof entry.instance?.stop === 'function') await entry.instance.stop();
      if (typeof entry.moduleUi?.remove === 'function') entry.moduleUi.remove();
      running.delete(id);
    }
  }

  SLINK.define('modules', 'register', register);
  SLINK.define('modules', 'list', list);
  SLINK.define('modules', 'startAll', startAll);
  SLINK.define('modules', 'stopAll', stopAll);
})(globalThis);
