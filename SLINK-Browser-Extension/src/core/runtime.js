(function installRuntime(global) {
  'use strict';

  if (global.SLINK_EXTENSION) return;

  const VERSION = '0.3.0';
  const STORAGE_PREFIX = 'slink.';

  const runtime = {
    VERSION,
    STORAGE_PREFIX,
    core: Object.create(null),
    modules: Object.create(null),
    services: Object.create(null),
    define(group, name, value) {
      if (!runtime[group] || typeof runtime[group] !== 'object') {
        throw new Error(`Unknown SLINK namespace: ${group}`);
      }
      if (Object.prototype.hasOwnProperty.call(runtime[group], name)) {
        throw new Error(`SLINK ${group}.${name} is already defined.`);
      }
      Object.defineProperty(runtime[group], name, {
        value,
        enumerable: true,
        configurable: false,
        writable: false
      });
      return value;
    }
  };

  Object.defineProperty(global, 'SLINK_EXTENSION', {
    value: runtime,
    enumerable: true,
    configurable: false,
    writable: false
  });
})(globalThis);
