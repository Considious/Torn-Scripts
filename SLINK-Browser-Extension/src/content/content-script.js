(async function startSlinkContent(global) {
  'use strict';

  if (global.__SLINK_EXTENSION_CONTENT_STARTED__) return;
  Object.defineProperty(global, '__SLINK_EXTENSION_CONTENT_STARTED__', { value:true });
  const SLINK = global.SLINK_EXTENSION;
  const ui = SLINK.core.uiShell.createShell({ title:'SLINK', subtitle:'Shared Live Intelligence NetworK' });

  ui.onHide(async () => {
    await SLINK.core.storage.set('ui.pagePanelHidden', true);
    ui.setHidden(true);
  });
  ui.setHidden(await SLINK.core.storage.get('ui.pagePanelHidden', false));

  chrome.storage.onChanged.addListener(changes => {
    const hiddenKey = SLINK.core.storage.fullKey('ui.pagePanelHidden');
    if (changes[hiddenKey]) ui.setHidden(Boolean(changes[hiddenKey].newValue));
    const permissionsKey = SLINK.core.storage.fullKey('permissions.snapshot');
    const visibilityChanged = Object.keys(changes).some(key =>
      key.startsWith(SLINK.core.storage.fullKey('ui.modules.')) && key.endsWith('.showInTorn')
    );
    if (changes[permissionsKey] || visibilityChanged) global.location.reload();
  });

  try {
    await SLINK.core.messaging.send('content.ready', { url:global.location.href });
    const permissions = await SLINK.core.messaging.send('permissions.get');
    await SLINK.modules.startAll({
      url:new URL(global.location.href),
      permissions,
      ui,
      moduleVisible: module => SLINK.core.storage.get(`ui.modules.${module.id}.showInTorn`, module.defaultShowInTorn)
    });
  } catch (error) {
    console.error('[SLINK] Content startup:', error);
  }
})(globalThis);
