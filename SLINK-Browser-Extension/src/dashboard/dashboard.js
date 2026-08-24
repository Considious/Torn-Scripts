(async function startDashboard() {
  'use strict';

  const SLINK = globalThis.SLINK_EXTENSION;
  const byId = id => document.getElementById(id);
  let leveling = null;
  let termsExpanded = false;
  let levelingInTorn = true;
  let contribution = null;
  let contributionTerms = null;

  function setBusy(button, busy) {
    button.disabled = busy;
  }

  function showError(error) {
    const element = byId('leveling-error');
    element.textContent = SLINK.core.format.errorMessage(error);
    element.hidden = false;
  }

  function clearError() {
    byId('leveling-error').hidden = true;
    byId('leveling-error').textContent = '';
  }

  function targetCard(target) {
    const article = document.createElement('article');
    article.className = 'target';
    const profileUrl = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
    const attackUrl = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(target.id)}`;
    const fairFight = Number(target.fair_fight);
    const fairFightText = Number.isFinite(fairFight) && fairFight > 0
      ? `${target.fair_fight_estimated ? '~' : ''}${fairFight.toFixed(2)}`
      : '?';
    article.innerHTML = `
      <div class="target-head"><a></a><span class="level"></span></div>
      <div class="target-meta"></div>
      <div class="target-meta secondary-meta"></div>
      <div class="target-actions"><a class="button" target="_blank" rel="noopener noreferrer">Attack</a><a class="button secondary" target="_blank" rel="noopener noreferrer">Profile</a></div>
    `;
    const links = article.querySelectorAll('a');
    links[0].href = profileUrl;
    links[0].textContent = `${target.name || 'Unknown'} [${target.id}]`;
    links[1].href = attackUrl;
    links[2].href = profileUrl;
    article.querySelector('.level').textContent = `Lv ${target.level ?? '?'}`;
    const meta = article.querySelector('.target-meta');
    for (const text of [
      target.status || 'Unknown',
      `FF ${fairFightText}`,
      target.local_difficulty,
      `BS ${SLINK.core.format.shortNumber(target.bs_estimate ?? target.total_stats)}`,
      `Hosp 24h: ${Number(target.hospitalizations_24h) || 0}`
    ].filter(Boolean)) {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = text;
      meta.appendChild(pill);
    }
    article.querySelector('.secondary-meta').textContent = `${target.competition_tier || 'Prime'} ${Number(target.competition_score) || 0}`;
    return article;
  }

  function renderLeveling() {
    const runtime = leveling.runtime;
    byId('target-count').textContent = runtime.targets.length;
    byId('assigned-count').textContent = runtime.lastCycleChecked || 0;
    byId('reported-count').textContent = runtime.lastCycleReported || 0;
    byId('pending-count').textContent = runtime.pendingChecks || 0;
    byId('api-usage').textContent = `${leveling.tornApiUsage.count}/${leveling.tornApiUsage.limit}`;
    byId('leveling-role').textContent = runtime.collector ? 'API collector' : (leveling.configured ? 'Standby device' : 'Setup required');
    byId('leveling-status').textContent = runtime.cycleStatus || 'Ready';
    byId('session-state').textContent = leveling.session.authenticated
      ? `Authenticated as ${leveling.session.userId}`
      : 'Not authenticated';
    byId('page-panel').checked = levelingInTorn;
    byId('page-panel').disabled = !SLINK.core.permissions.hasScope(leveling.permissions, 'slink.level');

    const settings = leveling.settings;
    const admin = SLINK.core.permissions.hasScope(leveling.permissions, 'admin.*');
    byId('torn-key').placeholder = settings.hasTornKey ? 'Saved - leave blank to keep' : 'Required';
    byId('ff-key').placeholder = settings.hasFfKey ? 'Saved - leave blank to keep' : 'Required for refined Fair Fight values';
    byId('poll-seconds').value = settings.pollSeconds;
    byId('zero-contribution-row').hidden = !admin;
    byId('zero-contribution').checked = admin && Number(settings.apiContributionLimit) === 0;
    byId('min-ff').value = settings.minFF;
    byId('max-ff').value = settings.maxFF;

    const terms = leveling.terms;
    byId('terms-summary').textContent = terms.summary;
    byId('terms-link').href = terms.documentUrl;
    byId('agreement-label').textContent = `I agree to terms ${terms.version} and the current Leveling disclosure.`;
    byId('accept-terms').checked = terms.accepted;
    byId('terms-accepted').textContent = terms.accepted ? `Terms ${terms.version} accepted` : 'Acceptance required';
    byId('terms-full').hidden = !termsExpanded && terms.accepted;
    byId('toggle-terms').textContent = byId('terms-full').hidden ? 'View terms' : 'Hide terms';

    const targets = byId('targets');
    targets.replaceChildren(...runtime.targets.map(targetCard));
    byId('target-summary').textContent = runtime.targets.length ? `${runtime.targets.length} recommendations` : 'No targets loaded';
    if (runtime.lastError) showError(runtime.lastError);
  }

  function renderContribution() {
    const donation = contribution?.donation;
    const active = donation?.active === true;
    byId('donation-state').textContent = active ? `Active for Torn user ${donation.user_id}` : 'No active donation';
    byId('donation-summary').textContent = contributionTerms?.summary || 'Current donation terms are unavailable.';
    byId('donation-terms-link').href = contributionTerms?.document_url || '#';
    byId('donation-agreement').textContent = `I agree to donation terms ${contributionTerms?.version || ''}.`;
    byId('donation-submit').textContent = active ? 'Replace encrypted key' : 'Encrypt and donate key';
    byId('donation-revoke').hidden = !active;
  }

  function formatDiagnostic(report) {
    if (!report) return 'Run a diagnostic to create a report.';
    const lines = [
      `Overall: ${String(report.overall || 'unknown').toUpperCase()}`,
      `Run: ${new Date(report.at).toLocaleString()}`,
      `Extension: v${report.extensionVersion}`,
      `Core: v${report.coreVersion}`,
      '',
      `Background: ${report.background?.ok ? 'OK' : 'FAILED'}`,
      `Storage: ${report.storage?.ok ? 'OK' : 'FAILED'}`,
      `Torn injection: ${report.pageInjection?.at ? `OK (${new Date(report.pageInjection.at).toLocaleString()})` : 'Not detected'}`,
      '',
      `SLINK Worker: ${report.worker?.connected ? 'CONNECTED' : 'NOT CONNECTED'}`,
      `Worker version: ${report.worker?.version || 'unknown'}`,
      `Response time: ${report.worker?.latencyMs ?? 'unknown'} ms`,
      `Main database: ${report.worker?.database || 'not checked'}`,
      `Consent database: ${report.worker?.consentDatabase || 'not checked'}`,
      `Permissions database: ${report.worker?.permissionsDatabase || 'not checked'}`,
      `Contribution service: ${report.contributionWorker?.ok ? 'CONNECTED' : 'NOT CONNECTED'}`,
      `Contribution database: ${report.contributionWorker?.database || 'not checked'}`,
      '',
      `Leveling configured: ${report.leveling?.configured ? 'YES' : 'NO'}`,
      `Leveling authenticated: ${report.leveling?.authenticated ? 'YES' : 'NO'}`,
      `Leveling targets: ${report.leveling?.targets ?? 0}`,
      `Leveling pending checks: ${report.leveling?.pendingChecks ?? 0}`,
      '',
      'Browser access:',
      ...Object.values(report.capabilities || {}).map(capability => `- ${capability.label}: ${capability.granted ? 'granted' : 'MISSING'}`)
    ];
    return lines.join('\n');
  }

  async function refresh() {
    clearError();
    const [status, donationTerms] = await Promise.all([
      SLINK.core.messaging.send('system.status'),
      SLINK.core.messaging.send('contribution.terms').catch(() => null)
    ]);
    leveling = status.leveling;
    contribution = status.contribution;
    contributionTerms = donationTerms;
    levelingInTorn = await SLINK.core.storage.get('ui.modules.leveling.showInTorn', true);
    byId('donation-in-torn').checked = await SLINK.core.storage.get('ui.modules.contribution.showInTorn', false);
    byId('connection').textContent = status.worker.connected ? 'Worker connected' : 'Worker offline';
    byId('connection').className = status.worker.connected ? 'badge ready' : 'badge error';
    renderLeveling();
    renderContribution();
    byId('diagnostic').textContent = formatDiagnostic(status.lastDiagnostic);
  }

  byId('refresh-all').addEventListener('click', refresh);
  byId('refresh-targets').addEventListener('click', async event => {
    setBusy(event.currentTarget, true);
    clearError();
    try {
      const response = await SLINK.core.messaging.send('leveling.cycle.prepare', { contribute: false });
      leveling = response.status;
      renderLeveling();
    } catch (error) { showError(error); }
    finally { setBusy(event.currentTarget, false); }
  });
  byId('toggle-terms').addEventListener('click', () => { termsExpanded = !termsExpanded; renderLeveling(); });
  byId('page-panel').addEventListener('change', async event => {
    levelingInTorn = event.currentTarget.checked;
    await SLINK.core.storage.set('ui.modules.leveling.showInTorn', levelingInTorn);
    if (levelingInTorn) await SLINK.core.storage.set('ui.pagePanelHidden', false);
  });
  byId('reset-position').addEventListener('click', () => SLINK.core.storage.remove('ui.main.position'));
  byId('settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    clearError();
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    setBusy(submit, true);
    try {
      leveling = await SLINK.core.messaging.send('leveling.settings.save', {
        tornKey: byId('torn-key').value,
        ffKey: byId('ff-key').value,
        pollSeconds: byId('poll-seconds').value,
        apiContributionLimit: byId('zero-contribution').checked ? 0 : 60,
        minFF: byId('min-ff').value,
        maxFF: byId('max-ff').value,
        acceptTerms: byId('accept-terms').checked && !leveling.terms.accepted
      });
      byId('torn-key').value = '';
      byId('ff-key').value = '';
      renderLeveling();
    } catch (error) { showError(error); }
    finally { setBusy(submit, false); }
  });
  byId('clear-session').addEventListener('click', async () => { leveling = await SLINK.core.messaging.send('leveling.session.clear'); renderLeveling(); });
  byId('clear-ff').addEventListener('click', async () => { leveling = await SLINK.core.messaging.send('leveling.settings.save', { clearFfKey: true }); renderLeveling(); });
  byId('clear-torn').addEventListener('click', async () => {
    if (!confirm('Remove the saved Torn API key and stop SLINK Leveling authentication?')) return;
    leveling = await SLINK.core.messaging.send('leveling.settings.save', { clearTornKey: true });
    renderLeveling();
  });
  byId('run-diagnostic').addEventListener('click', async event => {
    setBusy(event.currentTarget, true);
    try { byId('diagnostic').textContent = formatDiagnostic(await SLINK.core.messaging.send('diagnostics.run')); }
    catch (error) { showError(error); }
    finally { setBusy(event.currentTarget, false); }
  });

  for (const button of document.querySelectorAll('.dashboard-tab')) {
    button.addEventListener('click', () => {
      for (const item of document.querySelectorAll('.dashboard-tab')) item.classList.toggle('active', item === button);
      for (const page of document.querySelectorAll('[data-page]')) page.hidden = page.dataset.page !== button.dataset.tab;
    });
  }

  byId('donation-in-torn').addEventListener('change', async event => {
    await SLINK.core.storage.set('ui.modules.contribution.showInTorn', event.currentTarget.checked);
    if (event.currentTarget.checked) await SLINK.core.storage.set('ui.pagePanelHidden', false);
  });
  byId('donation-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = byId('donation-submit');
    setBusy(submit, true);
    byId('donation-message').textContent = '';
    try {
      contribution = await SLINK.core.messaging.send('contribution.donate', {
        apiKey:byId('donation-key').value,
        acceptTerms:byId('donation-accept').checked
      });
      byId('donation-key').value = '';
      byId('donation-accept').checked = false;
      byId('donation-message').textContent = 'Donation active. Only encrypted key material is stored remotely.';
      renderContribution();
    } catch (error) { byId('donation-message').textContent = SLINK.core.format.errorMessage(error); }
    finally { setBusy(submit, false); }
  });
  byId('donation-revoke').addEventListener('click', async () => {
    if (!confirm('Revoke this donation? Its encrypted key material will be erased and it can no longer be used.')) return;
    contribution = await SLINK.core.messaging.send('contribution.revoke');
    byId('donation-message').textContent = 'Donation revoked and encrypted key material erased.';
    renderContribution();
  });

  await refresh();
})();
