(async function startPopup() {
  'use strict';

  const SLINK = globalThis.SLINK_EXTENSION;
  const elements = {
    connection: document.getElementById('connection'),
    version: document.getElementById('version'),
    roles: document.getElementById('roles'),
    scopes: document.getElementById('scopes'),
    lastDiagnostic: document.getElementById('last-diagnostic'),
    pagePanel: document.getElementById('page-panel'),
    capabilities: document.getElementById('capabilities'),
    error: document.getElementById('error'),
    runDiagnostic: document.getElementById('run-diagnostic'),
    refresh: document.getElementById('refresh')
  };

  function showError(error) {
    elements.error.textContent = SLINK.core.format.errorMessage(error);
    elements.error.hidden = false;
  }

  function clearError() {
    elements.error.hidden = true;
    elements.error.textContent = '';
  }

  async function renderCapabilities() {
    elements.capabilities.replaceChildren();

    for (const [id, capability] of Object.entries(SLINK.core.permissions.BROWSER_CAPABILITIES)) {
      const granted = await chrome.permissions.contains({ origins: [...capability.origins] });
      const row = document.createElement('div');
      row.className = 'capability';

      const copy = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = capability.label;
      const origin = document.createElement('small');
      origin.textContent = capability.origins.join(', ');
      copy.append(name, origin);

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = granted ? 'Remove' : 'Allow';
      button.dataset.capability = id;
      button.addEventListener('click', async () => {
        clearError();
        button.disabled = true;
        try {
          if (granted) await chrome.permissions.remove({ origins: [...capability.origins] });
          else await chrome.permissions.request({ origins: [...capability.origins] });
          await renderCapabilities();
        } catch (error) {
          showError(error);
          button.disabled = false;
        }
      });

      row.append(copy, button);
      elements.capabilities.appendChild(row);
    }
  }

  async function refresh() {
    clearError();
    elements.connection.textContent = 'Checking';
    elements.connection.className = 'badge';

    try {
      const status = await SLINK.core.messaging.send('system.status');
      elements.version.textContent = chrome.runtime.getManifest().version;
      elements.roles.textContent = status.permissions.roles.join(', ') || 'None';
      elements.scopes.textContent = status.permissions.scopes.join(', ') || 'None';
      elements.lastDiagnostic.textContent = status.lastDiagnostic?.at
        ? new Date(status.lastDiagnostic.at).toLocaleString()
        : 'Not run yet';
      elements.pagePanel.checked = !await SLINK.core.storage.get('ui.pagePanelHidden', false);
      elements.connection.textContent = 'Ready';
      elements.connection.className = 'badge ready';
      await renderCapabilities();
    } catch (error) {
      elements.connection.textContent = 'Error';
      elements.connection.className = 'badge error';
      showError(error);
    }
  }

  elements.pagePanel.addEventListener('change', async () => {
    await SLINK.core.storage.set('ui.pagePanelHidden', !elements.pagePanel.checked);
  });

  elements.runDiagnostic.addEventListener('click', async () => {
    clearError();
    elements.runDiagnostic.disabled = true;
    try {
      await SLINK.core.messaging.send('diagnostics.run');
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
