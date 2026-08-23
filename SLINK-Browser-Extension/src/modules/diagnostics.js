(function registerDiagnostics(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before diagnostics.');

  SLINK.modules.register({
    id: 'diagnostics',
    requiredScopes: ['diagnostics.read'],
    matches: url => url.hostname === 'www.torn.com',

    async start(context) {
      async function render(run = false) {
        context.ui.setStatus(run ? 'Running foundation diagnostic...' : 'Checking extension services...');
        try {
          const status = run
            ? { lastRun: await SLINK.core.messaging.send('diagnostics.run') }
            : await SLINK.core.messaging.send('diagnostics.status');
          const diagnostic = status.lastRun;
          const worker = diagnostic?.worker || status.worker;
          const ping = await SLINK.core.messaging.send('system.ping');
          context.ui.setRows([
            { label: 'Injection', value: 'Active on Torn' },
            { label: 'Background', value: `Connected / v${ping.extensionVersion}` },
            { label: 'SLINK Worker', value: worker?.connected ? `Connected / v${worker.version}` : 'Not connected' },
            { label: 'Panel', value: 'Drag the header to move it' },
            { label: 'Roles', value: context.permissions.roles.join(', ') || 'None' },
            { label: 'Scopes', value: context.permissions.scopes.join(', ') || 'None' },
            { label: 'Last diagnostic', value: diagnostic?.at ? new Date(diagnostic.at).toLocaleString() : 'Not run yet' }
          ]);
          context.ui.setStatus(
            worker?.connected ? 'SLINK Worker connected.' : 'SLINK Worker is not connected.',
            worker?.connected ? 'ready' : 'error'
          );
        } catch (error) {
          context.ui.setStatus(SLINK.core.format.errorMessage(error), 'error');
        }
      }

      context.ui.onRefresh(() => render(true));
      await render(false);
      return Object.freeze({ render });
    }
  });
})(globalThis);
