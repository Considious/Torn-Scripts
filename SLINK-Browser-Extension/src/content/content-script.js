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
    const warSettingsChanged = Boolean(changes[SLINK.core.storage.fullKey('war.settings.v1')]);
    if (changes[permissionsKey] || visibilityChanged || warSettingsChanged) global.location.reload();
  });

  try {
    await SLINK.core.messaging.send('content.ready', { url:global.location.href });
    const permissions = await SLINK.core.messaging.send('permissions.get');
    await SLINK.modules.startAll({
      url:new URL(global.location.href),
      permissions,
      ui,
      modulePresentation: async module => {
        if (module.id !== 'war') {
          return await SLINK.core.storage.get(`ui.modules.${module.id}.showInTorn`, module.defaultShowInTorn)
            ? 'full'
            : 'hidden';
        }
        const settings = await SLINK.core.storage.get('war.settings.v1', {});
        if (settings.displayMode === 'extension') return 'headless-extension';
        if (settings.displayMode === 'hybrid') return 'headless';
        return 'full';
      },
      moduleVisible: module => SLINK.core.storage.get(`ui.modules.${module.id}.showInTorn`, module.defaultShowInTorn)
    });
  } catch (error) {
    console.error('[SLINK] Content startup:', error);
  }
})(globalThis);
