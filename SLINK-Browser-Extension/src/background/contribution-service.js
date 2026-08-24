(function installContributionService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const BASE_URL = 'https://slinkcontributionworker.richard-johnson554.workers.dev';
  const TOKEN_KEY = 'contribution.managementToken';

  async function request(path, options = {}) {
    return SLINK.core.http.requestJson('contributionWorker', `${BASE_URL}${path}`, options);
  }

  async function terms() {
    return request('/api/terms');
  }

  async function status() {
    const token = await SLINK.core.storage.get(TOKEN_KEY, '');
    if (!token) return { configured:false, donation:null };
    try {
      const response = await request('/api/donations', {
        headers: { Authorization:`Bearer ${token}` }
      });
      return { configured:true, donation:response.donation };
    } catch (error) {
      if (error.status === 401) await SLINK.core.storage.remove(TOKEN_KEY);
      throw error;
    }
  }

  async function donate(payload) {
    const currentTerms = await terms();
    if (payload?.acceptTerms !== true) {
      const error = new Error('Accept the current API Key Donation Terms first.');
      error.code = 'SLINK_DONATION_TERMS_REQUIRED';
      throw error;
    }
    const response = await request('/api/donations', {
      method:'POST',
      headers: { 'Content-Type':'application/json' },
      body:JSON.stringify({
        api_key:String(payload?.apiKey || '').trim(),
        terms_accepted:true,
        terms_version:currentTerms.version,
        terms_sha256:currentTerms.document_sha256,
        disclosure_version:currentTerms.disclosure_version,
        disclosure_sha256:currentTerms.disclosure_sha256
      })
    });
    await SLINK.core.storage.set(TOKEN_KEY, response.management_token);
    return { configured:true, donation:{
      user_id:response.user_id,
      access_type:response.access_type,
      status:response.status,
      active:true,
      terms_version:response.terms_version,
      created_at:Date.parse(response.donated_at) || Date.now()
    }};
  }

  async function revoke() {
    const token = await SLINK.core.storage.get(TOKEN_KEY, '');
    if (!token) return { configured:false, donation:null };
    await request('/api/donations', {
      method:'DELETE',
      headers: { Authorization:`Bearer ${token}` }
    });
    await SLINK.core.storage.remove(TOKEN_KEY);
    return { configured:false, donation:null };
  }

  async function health() {
    try { return await request('/api/health'); }
    catch (error) { return { ok:false, error:SLINK.core.format.errorMessage(error) }; }
  }

  const service = Object.freeze({ health, terms, status, donate, revoke });
  SLINK.define('services', 'contribution', service);
  SLINK.define('services', 'contributionRoutes', Object.freeze({
    'contribution.terms': terms,
    'contribution.status': status,
    'contribution.donate': donate,
    'contribution.revoke': revoke
  }));
})(globalThis);
