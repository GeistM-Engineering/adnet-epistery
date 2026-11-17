// Overview — the advertiser at a glance: the identity treasury that stakes its
// campaigns, each deployed campaign's budget / spent / available (read from the
// contract via the factory — the contract is the truth), and the transactions
// this session has on record. Amounts are POL; the USD beside them is a gloss.
// Adapted from blackfire-agent's Status.

import Component from '/lib/componentry.mjs';
import { esc, shortAddr, fmtPol, weiToPol, polUsd, failureNote, campaignKey } from '../util.mjs';
import { treasury, explorer } from '../signer.mjs';

const num = (v) => Number(v) || 0;
const TYPE = { fund: 'Staked', budget: 'Budget added', withdraw: 'Withdrawn' };

export default class Status extends Component {
  static css = `
.Status { display: flex; flex-direction: column; min-width: 0; }
.Status .stats { display: flex; flex-wrap: wrap; gap: var(--spacer2); margin-bottom: var(--spacer2); }
.Status .stat { flex: 1 1 240px; min-width: 0; padding: var(--spacer2); background: var(--bg-color); border: 1px solid var(--page-border); border-radius: 8px; }
.Status .stat-value { font-size: 1.6em; font-weight: 600; }
.Status .stat-value .usd { font-size: 0.55em; color: var(--text-muted); font-weight: 400; }
.Status .stat-label { font-size: 0.85em; color: var(--text-muted); }
.Status .chips { display: flex; flex-wrap: wrap; gap: var(--spacer); margin-bottom: var(--spacer2); }
.Status .chip { padding: 0 var(--spacer); background: var(--bg-color); border: 1px solid var(--page-border); border-radius: 999px; font-size: 0.9em; }
.Status .chip-value { font-weight: 600; }
.Status .chip-label { color: var(--text-muted); }
.Status .settled { color: var(--status-success); font-weight: 600; font-size: 0.85em; white-space: nowrap; }
.Status .settled.settled-none { color: var(--text-muted); font-weight: 500; }
.Status .rule { font-size: 0.85em; color: var(--text-muted); }
.Status .row-flags { margin-top: var(--spacerhalf); display: flex; gap: var(--spacerhalf); flex-wrap: wrap; }
`;

  async render(element) {
    await super.render(element);
    const { context } = this.props;
    const { ctx, records, factory } = context;
    const owner = ctx.session.owner;

    let campaigns, links, headlines;
    try {
      [campaigns, links, headlines] = await Promise.all([records.list('campaign'), records.list('link'), records.list('headline')]);
    } catch (e) { this.element.innerHTML = failureNote(e, 'load the overview'); return; }
    const deployed = campaigns.filter((c) => c.contractAddress);
    const [reports, price, x, tre] = await Promise.all([
      Promise.all(deployed.map((c) => factory.report(campaignKey(c)))),
      polUsd(),
      explorer(),
      treasury(ctx).catch(() => null),
    ]);
    const usd = (p) => (price != null && p != null ? ` <span class="usd">($${(p * price).toFixed(2)})</span>` : '');
    const addr = (a) => `<a href="${esc(x.address(a))}" target="_blank" rel="noopener" class="mono">${shortAddr(a)}</a>`;

    // --- the treasury: the one balance that stakes every campaign ---
    const stats = this.div('stats');
    const remaining = reports.reduce((a, r) => a + (r ? num(r.remaining) : 0), 0);
    this.div('stat', stats).innerHTML = `<div class="stat-value">${fmtPol(tre?.pol)}${usd(tre?.pol)}</div>
      <div class="stat-label">Identity treasury · ${addr(owner)}</div>`;
    this.div('stat', stats).innerHTML = `<div class="stat-value">${fmtPol(remaining)}${usd(remaining)}</div>
      <div class="stat-label">Staked and unspent across campaigns</div>`;

    const chips = this.div('chips');
    for (const [label, value] of [['Campaigns', campaigns.length], ['Deployed', deployed.length], ['Headlines', headlines.length], ['Links', links.length]]) {
      this.div('chip', chips).innerHTML = `<span class="chip-value">${value}</span> <span class="chip-label">${label}</span>`;
    }

    // --- deployed campaigns ---
    const camps = this.div('panel');
    if (!deployed.length) {
      camps.innerHTML = '<h2>Campaigns</h2><p class="empty">No deployed campaigns yet.</p>';
    } else {
      // Delivered with the settled subset beside it: "12 · 8 ✓". A muted "0 ✓" is
      // exactly what an advertiser needs to notice — delivered, unpaid.
      const vc = (d, st) => (d == null ? '—' : st == null ? `${d}` : `${d} <span class="settled${st > 0 ? '' : ' settled-none'}">${st}&nbsp;✓</span>`);
      const rows = deployed.map((c, i) => {
        const r = reports[i];
        // Unfunded is the contract's to say: no budget staked yet.
        const unfunded = r ? num(r.budget) === 0 : !!(c.fundingTargetWei && !c.fundedTxHash);
        const active = r ? r.active : c.active !== false;
        let badge = '<span class="badge">Paused</span>';
        if (c.retired) badge = '<span class="badge">Retired</span>';
        else if (unfunded) badge = '<span class="badge draft">Unfunded</span>';
        else if (active) badge = '<span class="badge deployed">Active</span>';
        const denied = r?.denied ? num(r.denied.views) + num(r.denied.clicks) : 0;
        const flags = [];
        if (denied) flags.push(`<span class="flag denied" title="flushed but not paid — failed the campaign rule or unattributable">${denied} denied</span>`);
        if (r?.spam) flags.push(`<span class="flag" title="dropped at the doorstep">${num(r.spam)} spam</span>`);
        return `<tr>
          <td><a data-go="campaigns/${esc(c.id)}">${esc(c.name)}</a>${flags.length ? `<div class="row-flags">${flags.join('')}</div>` : ''}</td>
          <td>${badge}</td>
          <td class="rule mono" title="declared payment rule">${esc(c.settlementRule || 'open')}</td>
          <td class="num">${fmtPol(r ? num(r.budget) : null)}</td>
          <td class="num">${fmtPol(r ? num(r.spent) : null)}</td>
          <td class="num"><strong>${fmtPol(r ? num(r.remaining) : null)}</strong></td>
          <td class="num">${vc(r?.delivered ? num(r.delivered.views) : null, r?.settled ? num(r.settled.views) : null)}</td>
          <td class="num">${vc(r?.delivered ? num(r.delivered.clicks) : null, r?.settled ? num(r.settled.clicks) : null)}</td>
          <td>${addr(c.contractAddress)}</td>
        </tr>`;
      }).join('');
      camps.innerHTML = `<h2>Campaigns</h2>
        <div class="table-box"><table class="adnet-table">
          <thead><tr><th>Campaign</th><th>Status</th><th>Rule</th><th>Budget</th><th>Spent</th><th>Available</th><th>Views</th><th>Clicks</th><th>Contract</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <p class="table-note">Budget, spent and available are read from each contract. Views / Clicks are <strong>delivered</strong> counts from the factory's contract-anchored event log; <span class="settled">N&nbsp;✓</span> is the <strong>settled</strong> subset paid to publishers.</p>`;
    }

    // --- transactions on record ---
    const txs = [];
    for (const c of deployed) {
      if (c._deployed) txs.push({ type: 'Deployed', c, contract: c.contractAddress, at: c._deployed, by: c._deployedBy });
      // A payment recorded before confirmation existed may never have landed — say so.
      for (const p of c.payments || []) txs.push({ type: `${TYPE[p.kind] || p.kind}${p.confirmed ? '' : ' (unconfirmed)'}`, c, pol: p.kind === 'withdraw' ? null : weiToPol(p.amountWei), tx: p.txHash, at: p.at, by: p.by });
    }
    txs.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    const tx = this.div('panel');
    tx.innerHTML = !txs.length ? '<h2>Transactions</h2><p class="empty">No transactions yet.</p>'
      : `<h2>Transactions</h2><div class="table-box"><table class="adnet-table">
          <thead><tr><th>When</th><th>Campaign</th><th>Type</th><th>Amount</th><th>On chain</th><th>Signed by</th></tr></thead>
          <tbody>${txs.map((t) => `<tr>
            <td>${t.at ? esc(new Date(t.at).toLocaleString()) : '—'}</td>
            <td><a data-go="campaigns/${esc(t.c.id)}">${esc(t.c.name)}</a></td>
            <td><span class="tx-type">${esc(t.type)}</span></td>
            <td class="num">${t.pol != null ? `${fmtPol(t.pol)}${usd(t.pol)}` : ''}</td>
            <td>${t.tx ? `<a href="${esc(x.tx(t.tx))}" target="_blank" rel="noopener" class="mono">${shortAddr(t.tx)}</a>` : addr(t.contract)}</td>
            <td>${t.by ? `<span class="mono">${shortAddr(t.by)}</span>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;

    this.div('panel').innerHTML = `<h2>Adnet</h2>
      <p>Campaigns deploy through <span class="mono">${esc(factory.base)}</span> with this session's identity
      <span class="mono">${esc(owner)}</span> as the advertiser. Each is its own contract, staked from the identity's
      treasury on a signer's signature; the balances above are read from those contracts.</p>`;
  }
}
