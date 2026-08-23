(async function startPopup() {
  'use strict';

  const SLINK = globalThis.SLINK_EXTENSION;
  const elements = {
    connection: document.getElementById('connection'),
    version: document.getElementById('version'),
    worker: document.getElementById('worker'),
    leveling: document.getElementById('leveling'),
    roles: document.getElementById('roles'),
    scopes: document.getElementById('scopes'),
    lastDiagnostic: document.getElementById('last-diagnostic'),
    pagePanel: document.getElementById('page-panel'),
    openDashboard: document.getElementById('open-dashboard'),
    resetPosition: document.getElementById('reset-position'),
    diagnosticReport: document.getElementById('diagnostic-report'),
    error: document.getElementById('error'),
    runDiagnostic: document.getElementById('run-diagnostic'),
    refresh: document.getElementById('refresh')
  };
  function yesNo(value) {
    return value ? 'OK' : 'FAILED';
  }

  function formatDiagnostic(report) {
    if (!report) return 'Run a diagnostic to create a readable report.';
    const worker = report.worker || {};
    const injection = report.pageInjection;
    const capabilities = report.capabilities || {};
    const lines = [
      `Overall: ${String(report.overall || 'unknown').toUpperCase()}`,
      `Run: ${report.at ? new Date(report.at).toLocaleString() : 'Unknown'}`,
      `Extension: v${report.extensionVersion || 'unknown'}`,
      `Core: v${report.coreVersion || 'unknown'}`,
      '',
      `Background: ${yesNo(report.background?.ok)}`,
      `Storage: ${yesNo(report.storage?.ok)}`,
      `Connection alarm: ${yesNo(report.alarm?.ok)}${report.alarm?.periodMinutes ? ` (${report.alarm.periodMinutes} min)` : ''}`,
      `Torn injection: ${injection?.at ? `OK (${new Date(injection.at).toLocaleString()})` : 'Not detected yet'}`,
      '',
      `SLINK Worker: ${worker.connected ? 'CONNECTED' : 'NOT CONNECTED'}`,
      `Worker version: ${worker.version || 'unknown'}`,
      `Response time: ${Number.isFinite(worker.latencyMs) ? `${worker.latencyMs} ms` : 'unknown'}`,
      `Main database: ${worker.database || 'not checked'}`,
      `Consent database: ${worker.consentDatabase || 'not checked'}`
    ];

    if (worker.error) lines.push(`Worker error: ${worker.error}`);
    if (report.leveling) {
      lines.push(
        '',
        `Leveling configured: ${report.leveling.configured ? 'YES' : 'NO'}`,
        `Leveling authenticated: ${report.leveling.authenticated ? 'YES' : 'NO'}`,
        `Leveling targets: ${report.leveling.targets}`,
        `Leveling pending checks: ${report.leveling.pendingChecks}`
      );
    }
    lines.push('', 'Browser access:');
    for (const capability of Object.values(capabilities)) {
      lines.push(`- ${capability.label}: ${capability.granted ? 'granted' : (capability.optional ? 'optional / not granted' : 'MISSING')}`);
    }
    return lines.join('\n');
  }

  function renderDiagnostic(report) {
    elements.diagnosticReport.textContent = formatDiagnostic(report);
  }

  function showError(error) {
    elements.error.textContent = SLINK.core.format.errorMessage(error);
    elements.error.hidden = false;
  }

  function clearError() {
    elements.error.hidden = true;
    elements.error.textContent = '';
  }

  async function refresh() {
    clearError();
    elements.connection.textContent = 'Checking';
    elements.connection.className = 'badge';

    try {
      const status = await SLINK.core.messaging.send('system.status');
      elements.version.textContent = chrome.runtime.getManifest().version;
      elements.worker.textContent = status.worker.connected
        ? `Connected / v${status.worker.version}`
        : 'Not connected';
      elements.leveling.textContent = status.leveling.session.authenticated
        ? `${status.leveling.runtime.targets.length} targets`
        : (status.leveling.configured ? 'Authentication required' : 'Setup required');
      elements.roles.textContent = status.permissions.roles.join(', ') || 'None';
      elements.scopes.textContent = status.permissions.scopes.join(', ') || 'None';
      elements.lastDiagnostic.textContent = status.lastDiagnostic?.at
        ? new Date(status.lastDiagnostic.at).toLocaleString()
        : 'Not run yet';
      elements.pagePanel.checked = !await SLINK.core.storage.get('ui.pagePanelHidden', false);
      elements.connection.textContent = status.worker.connected ? 'Connected' : 'Offline';
      elements.connection.className = status.worker.connected ? 'badge ready' : 'badge error';
      renderDiagnostic(status.lastDiagnostic);
    } catch (error) {
      elements.connection.textContent = 'Error';
      elements.connection.className = 'badge error';
      showError(error);
    }
  }

  elements.pagePanel.addEventListener('change', async () => {
    await SLINK.core.storage.set('ui.pagePanelHidden', !elements.pagePanel.checked);
  });

  elements.openDashboard.addEventListener('click', () => chrome.runtime.openOptionsPage());

  elements.resetPosition.addEventListener('click', async () => {
    await SLINK.core.storage.remove('ui.pagePanelPosition');
    elements.resetPosition.textContent = 'Position reset';
    setTimeout(() => { elements.resetPosition.textContent = 'Reset panel position'; }, 1200);
  });

  elements.runDiagnostic.addEventListener('click', async () => {
    clearError();
    elements.runDiagnostic.disabled = true;
    try {
      const report = await SLINK.core.messaging.send('diagnostics.run');
      renderDiagnostic(report);
      await refresh();
    } catch (error) {
      showError(error);
    } finally {
      elements.runDiagnostic.disabled = false;
    }
  });

  elements.refresh.addEventListener('click', refresh);
  await refresh();
})();
