// Network — adnet at a glance, across every deployed campaign. The feedback the
// console was missing and the pitch leans on: value DELIVERED, value PAID to
// publishers, and the UNREALIZED backlog (delivery earned but not yet paid — it
// settles as publishers adopt a key and budgets are topped up). Plus a daily
// delivered-vs-paid timeline and a per-campaign row with its honest serving state.
//
// Every figure comes from the factory's one ledger (/publish/network → services/
// economics.mjs): the contract owns budget/spent/remaining, the event log owns the
// counts, economics turns them into money. This page only draws them. POL is the
// unit; the USD beside it is a gloss from the console's own price (absent when the
// price source is unreachable).

import Component from '/lib/componentry.mjs';
import { esc, fmtPol, fmtUsd, polUsd, stateBadge, failureNote } from '../util.mjs';

export default class Network extends Component {
  static css = `
.Network { display: flex; flex-direction: column; gap: var(--spacer2); min-width: 0; }
.Network .tiles { display: flex; flex-wrap: wrap; gap: var(--spacer2); }
.Network .tile { flex: 1 1 200px; min-width: 0; padding: var(--spacer2); background: var(--bg-color); border: 1px solid var(--page-border); border-radius: 10px; display: flex; flex-direction: column; gap: 2px; }
.Network .tile .t-val { font-size: 1.8em; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.Network .tile .t-usd { color: var(--text-muted); font-size: 0.9em; }
.Network .tile .t-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
.Network .tile .t-hint { font-size: 0.78em; color: var(--text-muted); margin-top: var(--spacerhalf); }
.Network .tile.lead .t-val { color: var(--primary-mid); }
.Network .tile.paid .t-val { color: var(--adnet-good); }
.Network .tile.unrealized { border-color: color-mix(in srgb, var(--adnet-warn) 45%, var(--page-border)); background: color-mix(in srgb, var(--adnet-warn) 7%, transparent); }
.Network .tile.unrealized .t-val { color: var(--adnet-warn); }
.Network .chips { display: flex; flex-wrap: wrap; gap: var(--spacer); }
.Network .chip { padding: var(--spacerhalf) var(--spacer); background: var(--bg-color); border: 1px solid var(--page-border); border-radius: 999px; font-size: 0.9em; }
.Network .chip b { font-variant-numeric: tabular-nums; }
.Network .chip .chip-k { color: var(--text-muted); }
.Network .section-title { color: var(--text-muted); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--spacerhalf); }
.Network .chart-svg { width: 100%; height: 140px; display: block; background: var(--steel-50); border-radius: 8px; }
.Network .chart-svg .delivered { fill: color-mix(in srgb, var(--primary-mid) 30%, transparent); }
.Network .chart-svg .paid { fill: var(--adnet-good); }
.Network .legend { display: flex; gap: var(--spacer2); font-size: 0.8em; color: var(--text-muted); margin-top: var(--spacerhalf); }
.Network .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
.Network .legend .delivered { background: color-mix(in srgb, var(--primary-mid) 40%, transparent); }
.Network .legend .paid { background: var(--adnet-good); }
.Network .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.Network .table-box { overflow-x: auto; }
`;

  async render(element) {
    await super.render(element);
    const { factory } = this.props.context;

    let net, price;
    try { [net, price] = await Promise.all([factory.network(), polUsd()]); }
    catch (e) { this.element.innerHTML = failureNote(e, 'load the network ledger'); return; }
    if (!net) { this.element.innerHTML = '<p class="empty">No network data yet.</p>'; return; }

    const t = net.totals || {};
    const cc = t.campaignCounts || {};
    const usd = (p) => { const s = fmtUsd(p, price); return s ? `<div class="t-usd">${s}</div>` : ''; };

    // --- the three numbers that tell the story ---
    const tiles = this.div('tiles');
    this.div('tile lead', tiles).innerHTML =
      `<div class="t-label">Value delivered</div><div class="t-val">${fmtPol(t.deliveredValue, 2)}</div>${usd(t.deliveredValue)}`
      + `<div class="t-hint">Everything adnet has served, at campaign rates</div>`;
    this.div('tile paid', tiles).innerHTML =
      `<div class="t-label">Paid to publishers</div><div class="t-val">${fmtPol(t.paidValue, 2)}</div>${usd(t.paidValue)}`
      + `<div class="t-hint">Settled and paid on chain</div>`;
    this.div('tile unrealized', tiles).innerHTML =
      `<div class="t-label">Unrealized payout</div><div class="t-val">${fmtPol(t.unrealized, 2)}</div>${usd(t.unrealized)}`
      + `<div class="t-hint">Earned by publishers who haven't keyed in yet — paid on adoption</div>`;

    // --- the supporting counts ---
    const chips = this.div('chips');
    const chip = (k, v) => `<span class="chip"><b>${esc(String(v))}</b> <span class="chip-k">${esc(k)}</span></span>`;
    chips.innerHTML =
      chip('serving', cc.serving || 0) + chip('exhausted', cc.exhausted || 0)
      + chip('unfunded', cc.unfunded || 0) + chip('paused', cc.paused || 0)
      + chip('publishers reached', t.publishers || 0)
      + `<span class="chip"><b>${fmtPol(t.funded, 2)}</b> <span class="chip-k">funded</span></span>`
      + `<span class="chip"><b>${fmtPol(t.remaining, 2)}</b> <span class="chip-k">remaining</span></span>`;

    // --- delivered vs paid, by day ---
    const chartWrap = this.div('chart');
    this.div('section-title', chartWrap).textContent = 'Delivered vs paid, by day';
    chartWrap.insertAdjacentHTML('beforeend', this._chart(net.series || []));

    // --- per-campaign ledger ---
    const tableWrap = this.div('table');
    this.div('section-title', tableWrap).textContent = 'Campaigns';
    tableWrap.insertAdjacentHTML('beforeend', this._table(net.campaigns || [], price));
  }

  // Each day: the full delivered value as a muted bar, the paid value solid inside
  // it. The gap that stays muted IS the unrealized backlog — the pitch, drawn.
  _chart(series) {
    if (!series.length) return '<p class="empty">No timeline yet.</p>';
    const max = Math.max(1e-9, ...series.map((s) => s.deliveredValue || 0));
    const H = 140, pad = 14, step = Math.max(8, Math.min(40, Math.floor(600 / series.length)));
    const bw = Math.max(3, step - 4);
    const W = Math.max(series.length * step, 200);
    let bars = '';
    series.forEach((s, i) => {
      const x = i * step + 2;
      const dh = Math.round(((s.deliveredValue || 0) / max) * (H - pad));
      const ph = Math.round(((s.paidValue || 0) / max) * (H - pad));
      bars += `<rect class="delivered" x="${x}" y="${H - dh}" width="${bw}" height="${dh}"><title>${esc(s.t)} — delivered ${fmtPol(s.deliveredValue, 3)}</title></rect>`;
      if (ph > 0) bars += `<rect class="paid" x="${x}" y="${H - ph}" width="${bw}" height="${ph}"><title>${esc(s.t)} — paid ${fmtPol(s.paidValue, 3)}</title></rect>`;
    });
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg>`
      + '<div class="legend"><span><i class="delivered"></i>delivered</span><span><i class="paid"></i>paid</span></div>';
  }

  _table(rows, price) {
    if (!rows.length) return '<p class="empty">No deployed campaigns.</p>';
    const u = (p) => { const s = fmtUsd(p, price); return s ? ` <span class="t-usd">${s}</span>` : ''; };
    const tr = rows.map((r) => {
      const sb = stateBadge(r.state);
      return `<tr>
        <td>${esc(r.name)}</td>
        <td><span class="badge ${sb.cls}">${sb.label}</span></td>
        <td class="num">${fmtPol(r.budget, 2)}</td>
        <td class="num">${fmtPol(r.remaining, 2)}</td>
        <td class="num">${fmtPol(r.deliveredValue, 2)}</td>
        <td class="num">${fmtPol(r.paidValue, 2)}</td>
        <td class="num">${fmtPol(r.unrealized, 2)}${u(r.unrealized)}</td>
      </tr>`;
    }).join('');
    return `<div class="table-box"><table class="adnet-table">`
      + `<thead><tr><th>Campaign</th><th>State</th><th>Funded</th><th>Remaining</th><th>Delivered</th><th>Paid</th><th>Unrealized</th></tr></thead>`
      + `<tbody>${tr}</tbody></table></div>`;
  }
}
