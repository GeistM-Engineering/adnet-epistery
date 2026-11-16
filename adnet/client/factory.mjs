// The Adnet factory (the Agency) — called straight from this browser.
//
// Reads are public. Every action carries this signer's own "Epistery Auth <ms>"
// signature (signer.factoryAuth); the factory checks on chain that the signer acts
// for the advertiser — a signer of the session's identity, or an admin of this
// session. Nothing sits between the member and the Agency.

export const DEFAULT_ADNET_URL = 'https://adnet.geistm.com';

export function factoryFor(ctx) {
  const base = String(ctx.session.params?.adnetBaseUrl || DEFAULT_ADNET_URL).replace(/\/+$/, '');
  const campaignUrl = (id, suffix = '') => `${base}/publish/campaign/${encodeURIComponent(id)}${suffix}`;

  async function call(url, { method = 'GET', auth, body } = {}) {
    const headers = {};
    if (auth) headers.Authorization = auth;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
  }

  function refusal(action, res) {
    const why = res.body?.message || res.body?.error || `HTTP ${res.status}`;
    return new Error(res.status === 403
      ? `the factory refused to ${action}: ${why}. The signer must be a signer of this identity or an admin of this session.`
      : `the factory could not ${action}: ${why}`);
  }

  return {
    base,

    async report(id) {
      try { const r = await call(campaignUrl(id, '/report')); return r.ok ? r.body.report || null : null; }
      catch { return null; }
    },

    async detail(id) {
      try { const r = await call(campaignUrl(id)); return r.ok ? r.body.contract || null : null; }
      catch { return null; }
    },

    // The network ledger — value delivered / paid / unrealized across every deployed
    // campaign, with per-campaign rows and a daily timeline. Read-only, like report.
    async network() {
      try { const r = await call(`${base}/publish/network`); return r.ok ? r.body.network || null : null; }
      catch { return null; }
    },

    async events(id) {
      const r = await call(campaignUrl(id, '/events'));
      if (!r.ok) throw refusal('read campaign events', r);
      return r.body;
    },

    async deploy(auth, payload) {
      const r = await call(`${base}/publish/campaign`, { method: 'POST', auth, body: payload });
      if (!r.ok || r.body.status !== 'success') throw refusal('deploy the campaign', r);
      if (r.body.contract?.deploymentError) throw new Error(`the contract failed to deploy: ${r.body.contract.deploymentError}`);
      return r.body.contract || {};
    },

    async setActive(auth, id, active) {
      const r = await call(campaignUrl(id, active ? '/unpause' : '/pause'), { method: 'POST', auth });
      if (!r.ok) throw refusal(active ? 'enable the campaign' : 'disable the campaign', r);
    },

    async settle(auth, id) {
      const r = await call(campaignUrl(id, '/settle'), { method: 'POST', auth });
      if (!r.ok || r.body.status !== 'success') throw refusal('settle the campaign', r);
      return r.body.summary || {};
    },
  };
}
