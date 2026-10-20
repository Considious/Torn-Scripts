(function installFactionOfficersPda(global) {
'use strict';
const api = global.SLINK_PDA_PLUGIN_API;
if (!api) throw new Error('SLINK PDA plugin API is unavailable.');
const ID = 'factionOfficers';
const SCOPE = 'slink.war.officer';
const ADMIN_SCOPE = 'admin.*';
const BASE_URL = 'https://slinkcontributionworker.richard-johnson554.workers.dev';
const REFRESH_MS = 5 * 60_000;
const defaults = Object.freeze({ enabled:true, dismissed:{} });
let busy = false;
let error = '';
let notice = '';
let timer = null;
let alertObserver = null;

function settings() {
  const value = api.settings(ID, defaults);
  value.enabled = value.enabled !== false;
  value.dismissed = value.dismissed && typeof value.dismissed === 'object' ? value.dismissed : {};
  return value;
}
function cache() {
  const value = api.cache(ID, {});
  value.alerts = Array.isArray(value.alerts) ? value.alerts : [];
  value.roles = Array.isArray(value.roles) ? value.roles : [];
  return value;
}
function rows(value) {
  return Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
}
function normalizeMembers(payload) {
  const source = payload?.members ?? payload?.faction?.members ?? [];
  return rows(source).map(row => {
    const id = Number(row?.id ?? row?.user_id ?? row?.player_id);
    if (!Number.isInteger(id) || id <= 0) return null;
    const position = row?.position;
    return {
      id,
      name:String(row?.name || ('Player ' + id)),
      position:String(position?.name ?? row?.position_name ?? position ?? row?.rank ?? 'Member').trim() || 'Member',
      level:Math.max(0, Math.trunc(Number(row?.level) || 0))
    };
  }).filter(Boolean);
}
async function http(path, options = {}) {
  const session = await api.ensurePermission(false);
  const url = BASE_URL + path;
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { Accept:'application/json', Authorization:'Bearer ' + session.token, ...(options.headers || {}) };
  const body = options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  if (body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const direct = method === 'POST' ? global.PDA_httpPost : global.PDA_httpGet;
  if (typeof direct === 'function') {
    const response = await direct(url, headers, ...(body === undefined ? [] : [body]));
    const status = Number(response?.status ?? response?.statusCode) || 0;
    const text = typeof response === 'string' ? response : String(response?.responseText ?? response?.body ?? response?.data ?? '');
    let parsed = null;
    try { parsed = JSON.parse(text || 'null'); } catch {}
    if (status && (status < 200 || status >= 300)) throw new Error(parsed?.error || ('HTTP ' + status));
    return parsed || {};
  }
  if (typeof global.GM_xmlhttpRequest === 'function') {
    return new Promise((resolve,reject) => global.GM_xmlhttpRequest({
      method,url,headers,data:body,timeout:30000,
      onload(response) {
        let parsed = null;
        try { parsed = JSON.parse(String(response.responseText || 'null')); } catch {}
        if (Number(response.status) < 200 || Number(response.status) >= 300) return reject(new Error(parsed?.error || ('HTTP ' + response.status)));
        resolve(parsed || {});
      },
      onerror:() => reject(new Error('Faction onboarding request failed.')),
      ontimeout:() => reject(new Error('Faction onboarding request timed out.'))
    }));
  }
  const response = await global.fetch(url,{method,headers,body,cache:'no-store',credentials:'omit'});
  let parsed = null;
  try { parsed = await response.json(); } catch {}
  if (!response.ok) throw new Error(parsed?.error || ('HTTP ' + response.status));
  return parsed || {};
}
function checklist(row) {
  const level = Math.max(0, Number(row?.level) || 0);
  const position = String(row?.position || 'Member');
  const items = [
    ...(level > 0 && level < 15 ? ['proficiency weapon'] : []),
    'armor',
    '20 Pepper Spray',
    '20 Morphine',
    ...(position.toLowerCase().includes('recruit') ? ['4 Xanax only if stacking and still recruit'] : [])
  ];
  return position + (level ? ' · Level ' + level : '') + ' · Check: ' + items.join('; ') + '.';
}
function alertId(row) {
  return 'factionOnboarding:' + Number(row?.user_id) + ':' + (Number(row?.joined_at) || 0);
}
function visibleAlerts() {
  const config = settings();
  if (!config.enabled) return [];
  return cache().alerts.filter(row => Number(config.dismissed[row.user_id]) !== Number(row.joined_at));
}
function alerts() {
  return visibleAlerts().map(row => ({
    id:alertId(row),
    title:'New faction member: ' + String(row.user_name || ('Player ' + row.user_id)) + ' [' + Number(row.user_id) + ']',
    detail:checklist(row),
    links:[['Profile','https://www.torn.com/profiles.php?XID=' + Number(row.user_id)]]
  }));
}
async function loadRoles(members) {
  if (!api.hasScope(ADMIN_SCOPE)) return [];
  const session = await api.ensurePermission(false);
  const factionId = Number(session?.factionId) || 0;
  if (!factionId) throw new Error('Your authenticated Torn account is not in a faction.');
  const response = await http('/api/admin/factions/' + factionId + '/officer-roles');
  const configured = new Set((Array.isArray(response?.roles) ? response.roles : []).filter(role => role?.active).map(role => String(role.name || '').trim()));
  return [...new Set(members.map(member => member.position).filter(Boolean))].sort((a,b) => a.localeCompare(b)).map(name => ({
    name,
    memberCount:members.filter(member => member.position === name).length,
    selected:configured.has(name)
  }));
}
async function refresh(force = false) {
  const current = cache();
  if (busy) return current;
  if (!force && current.fetchedAt && Date.now() - Number(current.fetchedAt) < REFRESH_MS) {
    render();
    enhanceAlertActions();
    return current;
  }
  busy = true;
  error = '';
  render();
  try {
    await api.ensurePermission(false);
    if (!api.hasScope(SCOPE)) throw new Error('Your SLINK account does not have faction officer permission.');
    const members = normalizeMembers(await api.tornJson('/v2/faction/members','SLINK PDA faction onboarding'));
    if (!members.length) throw new Error('Torn returned no faction members.');
    const response = await http('/api/faction/onboarding/sync',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:{members}
    });
    current.alerts = Array.isArray(response?.alerts) ? response.alerts : [];
    current.viewerIsAdmin = response?.viewer_is_admin === true;
    current.factionId = Number(response?.faction_id) || 0;
    current.initialized = response?.initialized === true;
    current.rosterCount = Number(response?.roster_count) || members.length;
    current.roles = api.hasScope(ADMIN_SCOPE) ? await loadRoles(members) : [];
    current.fetchedAt = Date.now();
    current.lastError = '';
    api.save();
    api.alertsChanged();
    return current;
  } catch (caught) {
    error = api.errorMessage(caught);
    current.lastError = error;
    current.fetchedAt = Date.now();
    api.save();
    throw caught;
  } finally {
    busy = false;
    render();
    enhanceAlertActions();
  }
}
async function verify(memberId) {
  const response = await http('/api/faction/onboarding/' + Number(memberId) + '/verify',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:{}
  });
  const current = cache();
  current.alerts = Array.isArray(response?.alerts) ? response.alerts : [];
  current.viewerIsAdmin = response?.viewer_is_admin === true;
  current.fetchedAt = Date.now();
  notice = response?.verification === 'admin'
    ? 'Admin verification saved. This onboarding check is now complete.'
    : 'Officer verification saved and removed from every officer profile.';
  api.save();
  api.alertsChanged();
  render();
}
function dismiss(memberId, joinedAt) {
  settings().dismissed[memberId] = Number(joinedAt) || 0;
  notice = 'Alert dismissed on this device only.';
  api.save();
  api.alertsChanged();
  render();
}
async function saveRoles(root) {
  if (!api.hasScope(ADMIN_SCOPE)) return;
  const session = await api.ensurePermission(false);
  const factionId = Number(session?.factionId) || 0;
  const roles = [...root.querySelectorAll('[data-fo-role]:checked')].map(input => String(input.dataset.foRole || '')).filter(Boolean);
  await http('/api/admin/factions/' + factionId + '/officer-roles',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:{roles}
  });
  await api.ensurePermission(true);
  notice = 'Officer roles saved. Matching faction members receive officer access at their next permission refresh.';
  cache().fetchedAt = 0;
  await refresh(true);
}
function render() {
  const root = api.root(ID);
  if (!root) return;
  const current = cache();
  const pending = visibleAlerts();
  const admin = api.hasScope(ADMIN_SCOPE);
  const roleHtml = admin
    ? '<article class="card wide"><div class="card-head"><div><h2>Automatic officer access</h2><span class="muted">Selected Torn faction roles inherit the existing SLINK faction officer permission.</span></div><button type="button" data-fo-action="save-roles">Save roles</button></div><div class="alert-settings-groups"><fieldset><legend>Faction roles</legend>' +
      (current.roles.length ? current.roles.map(role => '<label><input type="checkbox" data-fo-role="' + api.escapeHtml(role.name) + '" ' + (role.selected ? 'checked' : '') + '><span>' + api.escapeHtml(role.name) + ' · ' + Number(role.memberCount) + ' member' + (Number(role.memberCount) === 1 ? '' : 's') + '</span></label>').join('') : '<p>Refresh to load the current faction roles.</p>') +
      '</fieldset></div></article>'
    : '<article class="card wide"><h2>Officer access</h2><p>Faction roles are configured by an SLINK administrator. You currently have faction officer access.</p></article>';
  root.innerHTML = '<div class="grid"><article class="card wide"><div class="card-head"><div><h2>Faction onboarding</h2><span class="muted">Shared equipment checks for new faction members.</span></div><button type="button" data-fo-action="refresh">' + (busy ? 'Checking…' : 'Refresh') + '</button></div>' +
    (error ? api.moduleMessage(error,'error') : '') + (notice ? api.moduleMessage(notice,'ready') : '') +
    '<label class="check-row"><input type="checkbox" data-fo-enabled ' + (settings().enabled ? 'checked' : '') + '>Show new-member equipment alerts</label>' +
    '<p>' + pending.length + ' pending for this profile · roster ' + Number(current.rosterCount || 0) + ' · updated ' + api.relativeTime(current.fetchedAt) + '</p>' +
    (pending.length ? '<div class="alert-list">' + pending.map(row => '<article class="alert"><div><strong>' + api.escapeHtml(String(row.user_name || ('Player ' + row.user_id))) + ' [' + Number(row.user_id) + ']</strong><span>' + api.escapeHtml(checklist(row)) + '</span></div><div class="target-actions"><a class="action-link" href="https://www.torn.com/profiles.php?XID=' + Number(row.user_id) + '">Profile</a><button type="button" data-fo-action="verify" data-fo-member="' + Number(row.user_id) + '">' + (current.viewerIsAdmin ? 'Admin verified' : 'Verified') + '</button><button type="button" data-fo-action="dismiss" data-fo-member="' + Number(row.user_id) + '" data-fo-joined="' + Number(row.joined_at || 0) + '">Dismiss</button></div></article>').join('') + '</div>' : '<p>No new members are waiting for an equipment check.</p>') +
    '</article>' + roleHtml + '</div>';
  bind(root);
}
function bind(root) {
  if (root.dataset.factionOfficersBound === 'true') return;
  root.dataset.factionOfficersBound = 'true';
  root.addEventListener('change', event => {
    if (!event.target.matches('[data-fo-enabled]')) return;
    settings().enabled = event.target.checked === true;
    api.save();
    api.alertsChanged();
  });
  root.addEventListener('click', event => {
    const control = event.target.closest('[data-fo-action]');
    if (!control) return;
    const action = control.dataset.foAction;
    if (action === 'refresh') void refresh(true).catch(() => undefined);
    if (action === 'save-roles') void saveRoles(root).catch(caught => { error=api.errorMessage(caught); render(); });
    if (action === 'verify') void verify(Number(control.dataset.foMember)).catch(caught => { error=api.errorMessage(caught); render(); });
    if (action === 'dismiss') dismiss(Number(control.dataset.foMember),Number(control.dataset.foJoined));
  });
}
function enhanceAlertActions() {
  const root = api.root('alerts');
  if (!root) return;
  for (const snooze of root.querySelectorAll('[data-alert-id^="factionOnboarding:"]')) {
    const card = snooze.closest('article.alert');
    const actions = snooze.closest('.target-actions');
    if (!card || !actions || actions.querySelector('[data-fo-alert-action]')) continue;
    const parts = String(snooze.dataset.alertId || '').split(':');
    const memberId = Number(parts[1]) || 0;
    const joinedAt = Number(parts[2]) || 0;
    const verifyButton = document.createElement('button');
    verifyButton.type = 'button';
    verifyButton.dataset.foAlertAction = 'verify';
    verifyButton.dataset.foMember = String(memberId);
    verifyButton.textContent = cache().viewerIsAdmin ? 'Admin verified' : 'Verified';
    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.dataset.foAlertAction = 'dismiss';
    dismissButton.dataset.foMember = String(memberId);
    dismissButton.dataset.foJoined = String(joinedAt);
    dismissButton.textContent = 'Dismiss';
    actions.prepend(dismissButton);
    actions.prepend(verifyButton);
  }
}
function bindAlertActions() {
  const root = api.root('alerts');
  if (!root || root.dataset.factionOfficersBound === 'true') return;
  root.dataset.factionOfficersBound = 'true';
  root.addEventListener('click', event => {
    const control = event.target.closest('[data-fo-alert-action]');
    if (!control) return;
    const action = control.dataset.foAlertAction;
    if (action === 'verify') void verify(Number(control.dataset.foMember)).catch(caught => { error=api.errorMessage(caught); render(); });
    if (action === 'dismiss') dismiss(Number(control.dataset.foMember),Number(control.dataset.foJoined));
  });
  alertObserver = new MutationObserver(() => queueMicrotask(enhanceAlertActions));
  alertObserver.observe(root,{childList:true,subtree:true});
  enhanceAlertActions();
}
function start() {
  bindAlertActions();
  if (api.hasScope(SCOPE)) void refresh(false).catch(() => undefined);
  timer = global.setInterval(() => {
    if (api.hasScope(SCOPE) && Date.now() - Number(cache().fetchedAt || 0) >= REFRESH_MS) void refresh(false).catch(() => undefined);
  },60000);
}
api.register({id:ID,title:'Faction Officers',shortTitle:'Officers',scope:SCOPE,render,refresh,alerts,start,test:Object.freeze({normalizeMembers,checklist,alertId})});
})(globalThis);
