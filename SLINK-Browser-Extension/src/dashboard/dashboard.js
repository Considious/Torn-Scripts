(async function startDashboard() {
  'use strict';

  const SLINK = globalThis.SLINK_EXTENSION;
  const byId = id => document.getElementById(id);
  let leveling = null;
  let termsExpanded = false;
  let levelingInTorn = true;
  let contribution = null;
  let contributionTerms = null;
  let war = null;
  let warTermsExpanded = false;
  let warView = 'targets';
  let activeDashboardTab = 'leveling';

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

  function showWarError(error) {
    byId('war-error').textContent = SLINK.core.format.errorMessage(error);
    byId('war-error').hidden = false;
  }

  function clearWarError() {
    byId('war-error').hidden = true;
    byId('war-error').textContent = '';
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
    byId('leveling-role').textContent = runtime.contributorOnly || runtime.idle
      ? 'API contributor'
      : (runtime.collector ? 'API collector' : (leveling.configured ? 'Standby device' : 'Setup required'));
    byId('leveling-status').textContent = runtime.cycleStatus || 'Ready';
    byId('session-state').textContent = leveling.session.authenticated
      ? `Authenticated as ${leveling.session.userId}`
      : 'Not authenticated';
    byId('page-panel').checked = levelingInTorn;
    byId('page-panel').disabled = false;

    const settings = leveling.settings;
    const admin = SLINK.core.permissions.hasScope(leveling.permissions, 'admin.*');
    byId('torn-key').placeholder = settings.hasTornKey ? 'Saved - leave blank to keep' : 'Required';
    byId('ff-key').placeholder = settings.hasFfKey ? 'Saved - leave blank to keep' : 'Required for refined Fair Fight values';
    byId('poll-seconds').value = settings.pollSeconds;
    byId('contributor-only').checked = settings.contributorOnly === true;
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

  function warMemberCard(member) {
    const article = document.createElement('article');
    article.className = `target war-result ${member.activity === 'Online' ? 'online' : ''}`;
    const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(member.id)}`;
    const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(member.id)}`;
    article.innerHTML = '<div class="target-head"><a></a><span class="level"></span></div><div class="target-meta"></div><div class="target-meta secondary-meta"></div><div class="target-actions"><a class="button" target="_blank" rel="noopener noreferrer">Attack</a><a class="button secondary" target="_blank" rel="noopener noreferrer">Profile</a></div>';
    const links = article.querySelectorAll('a');
    links[0].href = profile; links[0].textContent = `${member.name} [${member.id}]`;
    links[1].href = attack; links[2].href = profile;
    article.querySelector('.level').textContent = `Lv ${member.level || '?'}`;
    const remaining = SLINK.core.war.statusSeconds(member);
    for (const text of [member.activity, member.statusState || 'Okay', SLINK.core.war.isHospitalized(member) ? `Hospital ${SLINK.core.format.formatHumanDuration(remaining)}` : '', member.lastActionRelative].filter(Boolean)) {
      const pill = document.createElement('span'); pill.className = `pill ${text.startsWith('Hospital') ? 'hospital' : ''}`; pill.textContent = text; article.querySelector('.target-meta').append(pill);
    }
    article.querySelector('.secondary-meta').textContent = member.statusDescription || member.position || '';
    return article;
  }

  function warRetalCard(retal) {
    const article = document.createElement('article');
    article.className = 'target war-result retal';
    const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(retal.attackerId)}`;
    const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(retal.attackerId)}`;
    article.innerHTML = '<div class="target-head"><a></a><span class="level"></span></div><div class="target-meta"></div><div class="target-actions"><a class="button" target="_blank" rel="noopener noreferrer">Retaliate</a><a class="button secondary" target="_blank" rel="noopener noreferrer">Profile</a></div>';
    const links = article.querySelectorAll('a');
    links[0].href = profile; links[0].textContent = `${retal.attackerName || `Player ${retal.attackerId}`} [${retal.attackerId}]`;
    links[1].href = attack; links[2].href = profile;
    article.querySelector('.level').textContent = SLINK.core.format.formatHumanDuration(Number(retal.expiresAt) - Math.floor(Date.now() / 1000));
    article.querySelector('.target-meta').textContent = `${retal.againstWarOpponent ? 'War opponent' : 'Retal'} / Hit ${retal.defenderName || retal.defenderId}`;
    return article;
  }

  function warLogCard(row) {
    const article = document.createElement('article');
    article.className = 'target war-result';
    article.innerHTML = '<div class="target-head"><strong></strong><span class="level"></span></div><div class="target-meta"></div>';
    article.querySelector('strong').textContent = `${row.attacker_name || row.attacker_id} → ${row.defender_name || row.defender_id}`;
    article.querySelector('.level').textContent = String(Number(row.event_count) || 0);
    article.querySelector('.target-meta').textContent = `${String(row.outcome || '').replace('_', ' ')} / ${new Date(Number(row.last_seen_at) || 0).toLocaleDateString()} ${new Date(Number(row.last_seen_at) || 0).toLocaleTimeString()}`;
    return article;
  }

  function renderWarResults() {
    const results = byId('war-results');
    const snapshot = war?.runtime?.snapshot || {};
    const definitions = warView === 'targets'
      ? SLINK.core.war.sortMembers(snapshot.members || []).map(warMemberCard)
      : warView === 'retals'
        ? (snapshot.retals || []).map(warRetalCard)
        : (war?.runtime?.logs || []).map(warLogCard);
    if (!definitions.length) {
      const empty = document.createElement('div'); empty.className = 'war-empty'; empty.textContent = warView === 'targets' ? 'No eligible targets in the latest snapshot.' : warView === 'retals' ? 'No active retaliation alerts.' : 'No aggregate log entries yet.';
      definitions.push(empty);
    }
    results.replaceChildren(...definitions);
    byId('war-view-title').textContent = warView === 'targets' ? 'War targets' : warView === 'retals' ? 'Retaliation alerts' : 'War counters';
    for (const button of document.querySelectorAll('.war-view-tab')) button.classList.toggle('active', button.dataset.warView === warView);
  }

  function renderWar() {
    const runtime = war.runtime || {};
    const snapshot = runtime.snapshot || {};
    byId('war-target-count').textContent = snapshot.members?.length || 0;
    byId('war-retal-count').textContent = snapshot.retals?.length || 0;
    byId('war-log-count').textContent = runtime.logs?.length || 0;
    byId('war-status-source').textContent = runtime.collectStatus ? 'This device' : 'Shared';
    byId('war-attack-source').textContent = runtime.collectAttacks ? 'This device' : (war.session.factionCapable ? 'Standby' : 'Shared');
    byId('war-role').textContent = war.session.factionCapable ? 'Faction API' : (war.session.authenticated ? 'Public API' : 'Setup required');
    byId('war-status').textContent = runtime.status || 'Ready';
    byId('war-session-state').textContent = war.session.authenticated ? `Authenticated as ${war.session.userId}` : 'Not authenticated';
    byId('war-opponent').textContent = war.activeWar?.opponentName || 'No active opponent';
    const settings = war.settings;
    byId('war-torn-key').placeholder = settings.hasTornKey ? 'Saved - leave blank to keep' : 'Required';
    byId('war-display-mode').value = settings.displayMode;
    byId('war-mode').value = settings.warMode;
    byId('war-idle-minutes').value = settings.idleMinutes;
    byId('war-terms-summary').textContent = war.terms.summary;
    byId('war-terms-link').href = war.terms.documentUrl || '#';
    byId('war-agreement-label').textContent = `I agree to terms ${war.terms.version}.`;
    byId('war-accept-terms').checked = war.terms.accepted;
    byId('war-terms-accepted').textContent = war.terms.accepted ? `Terms ${war.terms.version} accepted` : 'Acceptance required';
    byId('war-terms-full').hidden = !warTermsExpanded && war.terms.accepted;
    byId('war-toggle-terms').textContent = byId('war-terms-full').hidden ? 'View terms' : 'Hide terms';
    if (runtime.lastError) showWarError(runtime.lastError);
    renderWarResults();
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
      `War configured: ${report.war?.configured ? 'YES' : 'NO'}`,
      `War authenticated: ${report.war?.authenticated ? 'YES' : 'NO'}`,
      `War faction API: ${report.war?.factionCapable ? 'YES' : 'NO'}`,
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
    war = status.war;
    contribution = status.contribution;
    contributionTerms = donationTerms;
    levelingInTorn = await SLINK.core.storage.get('ui.modules.leveling.showInTorn', true);
    byId('donation-in-torn').checked = await SLINK.core.storage.get('ui.modules.contribution.showInTorn', false);
    byId('connection').textContent = status.worker.connected ? 'Worker connected' : 'Worker offline';
    byId('connection').className = status.worker.connected ? 'badge ready' : 'badge error';
    renderLeveling();
    renderWar();
    renderContribution();
    byId('diagnostic').textContent = formatDiagnostic(status.lastDiagnostic);
  }

  byId('refresh-all').addEventListener('click', refresh);
  byId('refresh-targets').addEventListener('click', async event => {
    setBusy(event.currentTarget, true);
    clearError();
    try {
      leveling = await SLINK.core.messaging.send('leveling.activity.touch');
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
  byId('war-reset-position').addEventListener('click', () => SLINK.core.storage.remove('ui.main.position'));
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
        contributorOnly: byId('contributor-only').checked,
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
  byId('war-refresh').addEventListener('click', async event => {
    setBusy(event.currentTarget, true); clearWarError();
    try { war = await SLINK.core.messaging.send('war.cycle.prepare'); renderWar(); }
    catch (error) { showWarError(error); }
    finally { setBusy(event.currentTarget, false); }
  });
  byId('war-toggle-terms').addEventListener('click', () => { warTermsExpanded = !warTermsExpanded; renderWar(); });
  byId('war-settings-form').addEventListener('submit', async event => {
    event.preventDefault(); clearWarError();
    const submit = event.currentTarget.querySelector('button[type="submit"]'); setBusy(submit, true);
    try {
      war = await SLINK.core.messaging.send('war.settings.save', {
        tornKey:byId('war-torn-key').value,
        displayMode:byId('war-display-mode').value,
        warMode:byId('war-mode').value,
        idleMinutes:byId('war-idle-minutes').value,
        acceptTerms:byId('war-accept-terms').checked && !war.terms.accepted
      });
      byId('war-torn-key').value = '';
      renderWar();
    } catch (error) { showWarError(error); }
    finally { setBusy(submit, false); }
  });
  byId('war-clear-session').addEventListener('click', async () => { war = await SLINK.core.messaging.send('war.session.clear'); renderWar(); });
  for (const button of document.querySelectorAll('.war-view-tab')) button.addEventListener('click', () => { warView = button.dataset.warView; renderWarResults(); });
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
      activeDashboardTab = button.dataset.tab;
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
  setInterval(async () => {
    if (activeDashboardTab !== 'war' || !war?.configured) return;
    try { war = await SLINK.core.messaging.send('war.cycle.prepare'); clearWarError(); renderWar(); }
    catch (error) { showWarError(error); }
  }, 10_000);
})();
