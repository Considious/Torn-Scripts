import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('./src/00-crime-lifecycle.part', import.meta.url), 'utf8');
const crimes = ['arson', 'pickpocket', 'cracking', 'disposal', 'forgery', 'hustling', 'scamming'];

function fixture() {
  const window = new EventTarget();
  const document = new EventTarget();
  const navigation = new EventTarget();
  const frames = new Map();
  const observers = new Set();
  let frameId = 0;
  let root = null;
  let scope = main();
  function main() {
    return {
      nodeType: 1,
      contains: node => node === scope || node === root,
      querySelectorAll: () => root ? [root] : []
    };
  }
  document.body = document.documentElement = scope;
  document.querySelector = () => scope;
  document.hidden = false;
  Object.assign(window, {
    document, navigation, URLSearchParams,
    location: { pathname: '/page.php', search: '?sid=crimes', hash: '#/arson' },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    MutationObserver: class {
      constructor(callback) { this.notify = callback; }
      observe() { observers.add(this); }
      disconnect() { observers.delete(this); }
    }
  });
  runInNewContext(source, window);
  function flush() {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback());
  }
  return {
    window, document, navigation, flush, observers,
    setRoot(value) { root = value; },
    replaceMain() { scope = main(); },
    nativeMutation() {
      for (const observer of observers) observer.notify([{
        type: 'childList', target: scope, addedNodes: root ? [root] : []
      }]);
    }
  };
}

function dispatch(target, name) {
  target.dispatchEvent(new Event(name));
}

test('all enabled helpers enter, exit, and re-enter their own route through one observer', () => {
  const { window, navigation, flush, observers } = fixture();
  const mounted = new Set();
  const controllers = crimes.map(name => window.SLINK_CRIME_LIFECYCLE.connect(name, {
    eligible: () => true,
    sync() { mounted.add(name); },
    stop() { mounted.delete(name); }
  }));
  controllers[0].sync();
  assert.deepEqual([...mounted], ['arson']);
  for (const crime of [...crimes.slice(1), ...crimes]) {
    window.location.hash = crime === 'pickpocket' ? '#/pickpocketing?from=menu' : '#/' + crime;
    dispatch(navigation, 'currententrychange');
    flush();
    assert.deepEqual([...mounted], [crime]);
    assert.equal(observers.size, 1);
  }
  window.location.hash = '#/shoplifting';
  dispatch(window, 'hashchange');
  flush();
  assert.equal(mounted.size, 0);
  controllers.forEach(controller => controller.dispose());
  assert.equal(observers.size, 0);
});

test('works with late or replaced Torn content and a history change without a route event', () => {
  const app = fixture();
  let mounted = null;
  let stopped = 0;
  const { window, flush } = app;
  const selector = '.crime-root';
  const options = {
    eligible: () => true,
    selector,
    sync(root) { mounted = root; },
    stop() { mounted = null; stopped++; }
  };
  const arson = window.SLINK_CRIME_LIFECYCLE.connect('arson', options);
  const cracking = window.SLINK_CRIME_LIFECYCLE.connect('cracking', options);
  const root = id => ({
    id, nodeType: 1, isConnected: true, closest: () => null,
    getClientRects: () => [1], matches: name => name === selector
  });
  arson.sync();
  assert.equal(mounted, null);
  app.setRoot(root('first'));
  app.nativeMutation();
  flush();
  assert.equal(mounted.id, 'first');
  app.replaceMain();
  app.setRoot(root('second'));
  app.nativeMutation();
  flush();
  assert.equal(stopped, 1);
  assert.equal(mounted.id, 'second');
  window.location.hash = '#/cracking';
  app.setRoot(root('third'));
  app.nativeMutation();
  flush();
  assert.equal(stopped, 2);
  assert.equal(mounted.id, 'third');
  arson.dispose();
  cracking.dispose();
});

test('permission and visibility changes tear down the active helper and restore it on return', () => {
  const { window, document, observers } = fixture();
  let allowed = true;
  let mounted = false;
  const helper = window.SLINK_CRIME_LIFECYCLE.connect('arson', {
    eligible: () => allowed,
    sync() { mounted = true; },
    stop() { mounted = false; }
  });
  helper.sync();
  assert.equal(mounted, true);
  allowed = false;
  helper.sync();
  assert.equal(mounted, false);
  allowed = true;
  helper.sync();
  document.hidden = true;
  dispatch(document, 'visibilitychange');
  assert.equal(mounted, false);
  assert.equal(observers.size, 0);
  document.hidden = false;
  dispatch(document, 'visibilitychange');
  assert.equal(mounted, true);
  dispatch(window, 'pagehide');
  assert.equal(mounted, false);
  dispatch(window, 'pageshow');
  assert.equal(mounted, true);
  helper.dispose();
});
