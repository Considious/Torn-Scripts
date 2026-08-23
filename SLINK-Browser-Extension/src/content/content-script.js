(async function startSlinkContent(global) {
  'use strict';

  if (global.__SLINK_EXTENSION_CONTENT_STARTED__) return;
  Object.defineProperty(global, '__SLINK_EXTENSION_CONTENT_STARTED__', {
    value: true,
    configurable: false,
    writable: false
  });

  const SLINK = global.SLINK_EXTENSION;
  const ui = SLINK.core.uiShell.createShell({
    title: 'SLINK Foundation',
    subtitle: 'No SLINK systems are enabled yet'
  });

  ui.onHide(async () => {
    await SLINK.core.storage.set('ui.pagePanelHidden', true);
    ui.setHidden(true);
  });

  const hidden = await SLINK.core.storage.get('ui.pagePanelHidden', false);
  ui.setHidden(hidden);

  chrome.storage.onChanged.addListener(changes => {
    const hiddenKey = SLINK.core.storage.fullKey('ui.pagePanelHidden');
    const positionKey = SLINK.core.storage.fullKey('ui.pagePanelPosition');
    if (changes[hiddenKey]) ui.setHidden(Boolean(changes[hiddenKey].newValue));
    if (changes[positionKey]?.newValue) ui.setPosition(changes[positionKey].newValue);
    else if (changes[positionKey]) ui.resetPosition();
  });

  try {
    await SLINK.core.messaging.send('content.ready', { url: global.location.href });
    const permissions = await SLINK.core.messaging.send('permissions.get');
    const result = await SLINK.modules.startAll({
      url: new URL(global.location.href),
      permissions,
      ui
    });

    if (!result.started.length && result.denied.length) {
      const required = result.denied.flatMap(module => module.requiredScopes);
      ui.setRows([{ label: 'Required scopes', value: required.join(', ') }]);
      ui.setStatus('This SLINK module is not available for the current user.', 'error');
    }
  } catch (error) {
    ui.setStatus(SLINK.core.format.errorMessage(error), 'error');
  }
})(globalThis);
