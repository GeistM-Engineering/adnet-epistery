// A deployed campaign's data — totals, a views/clicks timeline, the publishers
// that carried it, device/browser context and the latest raw records, all from
// the factory's contract-anchored event log. "Show what we capture." Adapted
// from blackfire-agent's CampaignReport.

import Component from '/lib/componentry.mjs';
import { esc, campaignKey } from '../util.mjs';

export default class CampaignReport extends Component {
  static css = `
.CampaignReport { min-width: 0; }
.CampaignReport .report-totals { display: flex; flex-wrap: wrap; gap: var(--spacer2); align-items: center; margin-bottom: var(--spacer); }
.CampaignReport .report-totals .rt b { font-size: 1.5em; font-weight: 600; }
.CampaignReport .report-verify { margin-left: auto; font-size: 0.85em; color: var(--text-muted); }
.CampaignReport .report-chart { margin-bottom: var(--spacer2); }
.CampaignReport .report-svg { width: 100%; height: 96px; display: block; background: var(--steel-50); border-radius: 6px; }
.CampaignReport .report-svg .views { fill: var(--primary-mid); }
.CampaignReport .report-svg .clicks { fill: var(--accent); }
.CampaignReport .report-legend { display: flex; gap: var(--spacer); font-size: 0.8em; color: var(--text-muted); margin-top: var(--spacerhalf); }
.CampaignReport .report-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: var(--spacerhalf); vertical-align: middle; }
.CampaignReport .report-legend .views { background: var(--primary-mid); }
.CampaignReport .report-legend .clicks { background: var(--accent); }
.CampaignReport .report-block { margin-bottom: var(--spacer2); min-width: 0; }
.CampaignReport .report-block h4 { margin: 0 0 var(--spacerhalf); font-size: 0.95em; }
.CampaignReport .report-ctx { display: flex; gap: var(--spacer2); flex-wrap: wrap; }
.CampaignReport .report-ctx-col { flex: 1 1 160px; min-width: 0; }
.CampaignReport .report-ctx-col h5 { margin: 0 0 var(--spacerhalf); font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); }
.CampaignReport .ctx-row { display: flex; justify-content: space-between; gap: var(--spacer); font-size: 0.9em; }
.CampaignReport .rt-tag { font-size: 0.75em; color: var(--text-muted); }
.CampaignReport .rt-addr { font-size: 0.85em; }
`;

  async render(element) {
    await super.render(element);
    let d;
    try { d = await this.props.context.factory.events(campaignKey(this.props.campaign)); }
    catch (e) { this.element.innerHTML = `<p class="empty">Failed to load data: ${esc(e.message)}</p>`; return; }
    if (!d || d.status !== 'success') { this.element.innerHTML = `<p class="empty">${esc(d?.error || 'No data yet.')}</p>`; return; }
    if (!d.totals?.views && !d.totals?.clicks) { this.element.innerHTML = '<p class="empty">No views or clicks recorded yet.</p>'; return; }

    const bs = d.byStatus || {};
    const bits = [];
    if (bs.settled) bits.push(`<span class="rt-status is-settled">${bs.settled} settled</span>`);
    if (bs.pending) bits.push(`<span class="rt-status">${bs.pending} pending</span>`);
    if (bs.denied) bits.push(`<span class="rt-status is-denied">${bs.denied} denied</span>`);
    this.div('report-totals').innerHTML = `<span class="rt"><b>${d.totals.views}</b> views</span>`
      + `<span class="rt"><b>${d.totals.clicks}</b> clicks</span>` + bits.join('')
      + (d.contractAddress ? `<a class="report-verify mono" href="https://polygonscan.com/address/${esc(d.contractAddress)}" target="_blank" rel="noopener">verify on chain ↗</a>` : '');

    this.div('report-chart').innerHTML = this._chart(d.series);

    this.div('report-block').innerHTML = '<h4>Publishers</h4>' + this._table(['Domain', 'Address', 'Views', 'Clicks'],
      (d.byPublisher || []).map((p) => [
        esc(p.domain) + (p.rung ? ` <span class="rt-tag">${esc(p.rung)}</span>` : ''),
        this._publisherAddress(p),
        { n: p.views }, { n: p.clicks },
      ]));

    this.div('report-block').innerHTML = '<h4>Context</h4><div class="report-ctx">'
      + this._breakdown('Device', d.byDevice) + this._breakdown('Browser', d.byBrowser) + '</div>';

    this.div('report-block').innerHTML = '<h4>Most recent records</h4>' + this._table(
      ['When', 'Type', 'Status', 'Publisher', 'Device', 'Browser', 'Destination'],
      (d.recent || []).map((r) => [
        r.ts ? esc(new Date(r.ts).toLocaleString()) : '—',
        `<span class="tx-type ${r.type === 'click' ? 'is-click' : 'is-view'}">${esc(r.type)}</span>`,
        `<span class="rt-status is-${esc(r.status || 'pending')}">${esc(r.status || 'pending')}</span>`,
        esc(r.publisher || '—'),
        esc(r.device || '—'),
        esc(r.browser || '—'),
        r.target ? `<a href="${esc(r.target)}" target="_blank" rel="noopener" class="mono">${esc(String(r.target).slice(0, 40))}</a>` : esc(r.referrer || '—'),
      ]));
  }

  _chart(series) {
    if (!series?.length) return '<p class="empty">No timeline yet.</p>';
    const max = Math.max(1, ...series.map((s) => Math.max(s.views, s.clicks)));
    const step = 22, H = 96, pad = 16;
    const W = Math.max(series.length * step, 200);
    let bars = '';
    series.forEach((s, i) => {
      const x = i * step + 4;
      const vh = Math.round((s.views / max) * (H - pad));
      const ch = Math.round((s.clicks / max) * (H - pad));
      bars += `<rect class="views" x="${x}" y="${H - vh}" width="8" height="${vh}"><title>${esc(s.t)} — ${s.views} views</title></rect>`;
      bars += `<rect class="clicks" x="${x + 9}" y="${H - ch}" width="8" height="${ch}"><title>${esc(s.t)} — ${s.clicks} clicks</title></rect>`;
    });
    return `<svg class="report-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg>`
      + '<div class="report-legend"><span><i class="views"></i>views</span><span><i class="clicks"></i>clicks</span></div>';
  }

  // The payee address we know for a publisher, or "none" when it hasn't declared
  // one. The address is meaningless without its chain, so it links to the explorer
  // for the network the publisher declared (defaulting to Polygon mainnet, where
  // the Adnet settles) and flags any non-mainnet network inline.
  _publisherAddress(p) {
    if (!p.address) return '<span class="rt-tag">none</span>';
    const net = (p.network && Number(p.network.chainId)) ? p.network : { name: 'polygon', chainId: 137 };
    const explorer = net.chainId === 80002 ? 'https://amoy.polygonscan.com/address/' : 'https://polygonscan.com/address/';
    const short = esc(`${p.address.slice(0, 6)}…${p.address.slice(-4)}`);
    const tag = (net.name && net.name !== 'polygon') ? ` <span class="rt-tag">${esc(net.name)}</span>` : '';
    return `<a class="mono rt-addr" href="${explorer}${esc(p.address)}" target="_blank" rel="noopener" title="${esc(p.address)}">${short}</a>${tag}`;
  }

  _breakdown(title, obj) {
    const rows = Object.entries(obj || {})
      .sort((a, b) => (b[1].views + b[1].clicks) - (a[1].views + a[1].clicks))
      .map(([k, v]) => `<div class="ctx-row"><span>${esc(k)}</span><b>${v.views}v / ${v.clicks}c</b></div>`).join('');
    return `<div class="report-ctx-col"><h5>${esc(title)}</h5>${rows || '<div class="empty">—</div>'}</div>`;
  }

  _table(headers, rows) {
    if (!rows?.length) return '<p class="empty">—</p>';
    const th = headers.map((h) => `<th>${esc(h)}</th>`).join('');
    const tr = rows.map((r) => `<tr>${r.map((c) => (c && typeof c === 'object' && 'n' in c ? `<td class="num">${c.n}</td>` : `<td>${c}</td>`)).join('')}</tr>`).join('');
    return `<div class="table-box"><table class="adnet-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }
}
