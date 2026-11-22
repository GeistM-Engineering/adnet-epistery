// Overview — the advertiser at a glance: the identity treasury that stakes its
// campaigns, each deployed campaign's budget / spent / available (read from the
// contract via the factory — the contract is the truth), and the transactions
// this session has on record. Amounts are POL; the USD beside them is a gloss.
// Adapted from blackfire-agent's Status.

import Component from '/lib/componentry.mjs';
import { esc, shortAddr, fmtPol, weiToPol, polUsd, failureNote, stateBadge } from '../util.mjs';
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

    // Local, fast: the sealed records this device already holds. Everything that
    // can be drawn from them is painted NOW; the chain figures fill in after.
    let campaigns, links, headlines;
    try {
      [campaigns, links, headlines] = await Promise.all([records.list('campaign'), records.list('link'), records.list('headline')]);
    } catch (e) { this.element.innerHTML = failureNote(e, 'load the overview'); return; }
    const deployed = campaigns.filter((c) => c.contractAddress);

    // Cheap, non-chain: the price gloss (a cached fetch) and the explorer base (a
    // config read). The slow reads — the identity's balance and every campaign's
    // economics — are deferred below so the overview paints immediately.
    const [price, x] = await Promise.all([polUsd(), explorer()]);
    const usd = (p) => (price != null && p != null ? ` <span class="usd">($${(p * price).toFixed(2)})</span>` : '');
    const addr = (a) => `<a href="${esc(x.address(a))}" target="_blank" rel="noopener" class="mono">${shortAddr(a)}</a>`;

    // --- the treasury: the one balance that stakes every campaign (filled after) ---
    const stats = this.div('stats');
    const treTile = this.div('stat', stats);
    const stakedTile = this.div('stat', stats);
    treTile.innerHTML = `<div class="stat-value">…</div>
      <div class="stat-label">Identity treasury · ${addr(owner)}</div>`;
    stakedTile.innerHTML = `<div class="stat-value">…</div>
      <div class="stat-label">Staked and unspent across campaigns</div>`;

    const chips = this.div('chips');
    for (const [label, value] of [['Campaigns', campaigns.length], ['Deployed', deployed.length], ['Headlines', headlines.length], ['Links', links.length]]) {
      this.div('chip', chips).innerHTML = `<span class="chip-value">${value}</span> <span class="chip-label">${label}</span>`;
    }

    // --- deployed campaigns: names / rule / contract now; economics fill in ---
    const camps = this.div('panel');
    if (!deployed.length) {
      camps.innerHTML = '<h2>Campaigns</h2><p class="empty">No deployed campaigns yet.</p>';
    } else {
      camps.innerHTML = `<h2>Campaigns</h2>
        <div class="table-box"><table class="adnet-table">
          <thead><tr><th>Campaign</th><th>Status</th><th>Rule</th><th>Budget</th><th>Spent</th><th>Available</th><th>Views</th><th>Clicks</th><th>Contract</th></tr></thead>
          <tbody>${deployed.map((c) => `<tr data-cid="${esc(c.id)}">
            <td><a data-go="campaigns/${esc(c.id)}">${esc(c.name)}</a></td>
            <td class="col-badge"><span class="badge">…</span></td>
            <td class="rule mono" title="declared payment rule">${esc(c.settlementRule || 'open')}</td>
            <td class="num col-budget">…</td>
            <td class="num col-spent">…</td>
            <td class="num col-remaining"><strong>…</strong></td>
            <td class="num col-views">…</td>
            <td class="num col-clicks">…</td>
            <td>${addr(c.contractAddress)}</td>
          </tr>`).join('')}</tbody>
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

    // --- the chain reads, OFF the paint path ---
    // One cached /network call carries every campaign's economics at once — not a
    // /report per campaign. That fan-out (N uncached contract reads, issued one
    // request at a time) is what made this page sit blank on the chain; /network
    // reads the same contracts in parallel behind a 30s cache. The page is already
    // interactive — these only fill the money cells when they arrive.
    const [tre, net] = await Promise.all([
      treasury(ctx).catch(() => null),
      factory.network().catch(() => null),
    ]);
    if (!this.element?.isConnected) return;   // navigated away before the chain answered

    treTile.innerHTML = `<div class="stat-value">${fmtPol(tre?.pol)}${usd(tre?.pol)}</div>
      <div class="stat-label">Identity treasury · ${addr(owner)}</div>`;
    const remaining = net ? num(net.totals?.remaining) : null;
    stakedTile.innerHTML = `<div class="stat-value">${fmtPol(remaining)}${usd(remaining)}</div>
      <div class="stat-label">Staked and unspent across campaigns</div>`;

    if (deployed.length) {
      // contractAddress → the network's per-campaign economics row.
      const econ = new Map((net?.campaigns || []).map((r) => [String(r.contractAddress || '').toLowerCase(), r]));
      // Delivered with the settled subset beside it: "12 · 8 ✓". A muted "0 ✓" is
      // exactly what an advertiser needs to notice — delivered, unpaid.
      const vc = (d, st) => (d == null ? '—' : st == null ? `${d}` : `${d} <span class="settled${st > 0 ? '' : ' settled-none'}">${st}&nbsp;✓</span>`);
      for (const c of deployed) {
        const row = camps.querySelector(`tr[data-cid="${c.id}"]`);
        if (!row) continue;
        const r = econ.get(String(c.contractAddress).toLowerCase());
        // The serving state is the economics owner's to say (serving / exhausted /
        // unfunded / paused); retired is this record's own.
        const sb = r ? stateBadge(r.state) : null;
        row.querySelector('.col-badge').innerHTML = c.retired ? '<span class="badge">Retired</span>'
          : sb ? `<span class="badge ${sb.cls}">${sb.label}</span>` : '<span class="badge">—</span>';
        row.querySelector('.col-budget').textContent = fmtPol(r ? num(r.budget) : null);
        row.querySelector('.col-spent').textContent = fmtPol(r ? num(r.spent) : null);
        row.querySelector('.col-remaining').innerHTML = `<strong>${fmtPol(r ? num(r.remaining) : null)}</strong>`;
        row.querySelector('.col-views').innerHTML = vc(r?.delivered ? num(r.delivered.views) : null, r?.settled ? num(r.settled.views) : null);
        row.querySelector('.col-clicks').innerHTML = vc(r?.delivered ? num(r.delivered.clicks) : null, r?.settled ? num(r.settled.clicks) : null);
      }
    }
  }
}
