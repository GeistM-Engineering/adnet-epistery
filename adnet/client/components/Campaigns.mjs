// Campaigns — the list, or one campaign, by path:
//   /campaigns        → list
//   /campaigns/new    → CampaignProps, new
//   /campaigns/<id>   → CampaignProps, existing
// Adapted from blackfire-agent's Campaigns.

import Component from '/lib/componentry.mjs';
import CampaignProps from './CampaignProps.mjs';
import { esc, failureNote, fmtPol } from '../util.mjs';

export default class Campaigns extends Component {
  static css = `
.Campaigns .health-summary { display: flex; flex-wrap: wrap; gap: var(--spacer2); margin: 0 0 var(--spacer); font-size: 0.9em; }
.Campaigns .health-summary .hs { color: var(--text-muted); }
.Campaigns .health-summary .hs b { color: var(--text-color); font-variant-numeric: tabular-nums; }
.Campaigns .health-summary .hs.funded b { color: var(--adnet-good); }
.Campaigns .health-summary .hs.needs b { color: var(--adnet-bad); }
.Campaigns .adnet-table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.Campaigns tr.needs-funding { box-shadow: inset 3px 0 0 var(--adnet-bad); }
`;

  constructor(props) {
    super(props);
    this.hub = true;
  }

  async render(element) {
    await super.render(element);
    const { context } = this.props;
    const sub = (context.path || '').split('/').filter(Boolean)[1];
    if (sub) {
      this.detail = await this.draw(CampaignProps, { id: sub, context }, this.element);
      return;
    }

    const toolbar = this.div('toolbar');
    toolbar.innerHTML = `<h2>Campaigns</h2>`;
    if (context.canEdit) {
      const btn = document.createElement('button');
      btn.className = 'adnet-btn';
      btn.textContent = '+ New campaign';
      btn.dataset.go = 'campaigns/new';
      toolbar.append(btn);
    }

    const summary = this.div('health-summary');
    const list = this.div('table-box');

    // The list itself comes from this device's sealed records (fast); it paints NOW
    // with everything local — name, budget cap, deployed, created — and placeholder
    // health cells. The funding health is the factory's to say (/publish/network),
    // a chain read, so it is fetched off the paint path and filled in below. The
    // page never waits on the chain to show its campaigns.
    let campaigns;
    try { campaigns = await context.records.list('campaign'); }
    catch (e) { list.innerHTML = failureNote(e, 'load campaigns'); return; }
    campaigns.sort((a, b) => String(b._created).localeCompare(String(a._created)));
    if (!campaigns?.length) {
      list.innerHTML = '<p class="empty">No campaigns yet. Create one to start.</p>';
      return;
    }

    summary.innerHTML = `<span class="hs">…</span>`;
    list.innerHTML = `<table class="adnet-table">
      <thead><tr><th>Name</th><th>Health</th><th>Funded</th><th>Budget (cap)</th><th>Unrealized</th><th>Deployed</th><th>Created</th></tr></thead>
      <tbody>${campaigns.map((c) => `
        <tr data-go="campaigns/${esc(c.id)}" data-cid="${esc(c.id)}">
          <td>${esc(c.name)}</td>
          <td class="col-health"><span class="badge">…</span></td>
          <td class="num col-funded">…</td>
          <td class="num">${c.budget != null ? '$' + esc(c.budget) : '—'}</td>
          <td class="num col-unrealized">—</td>
          <td>${opBadge(c)}</td>
          <td>${c._created ? new Date(c._created).toLocaleDateString() : '-'}</td>
        </tr>`).join('')}</tbody>
    </table>`;

    // --- the one cached chain read, off the paint path ---
    const net = await context.factory.network().catch(() => null);
    if (!this.element?.isConnected) return;   // navigated away before the chain answered

    // contractAddress → economics row. The number that matters is whether it's funded.
    const econ = new Map((net?.campaigns || []).map((r) => [String(r.contractAddress || '').toLowerCase(), r]));
    const tally = { funded: 0, needs: 0, other: 0 };
    for (const c of campaigns) {
      const h = health(c, econ);
      if (h.key === 'funded') tally.funded++;
      else if (h.key === 'needs') tally.needs++;
      else tally.other++;

      const row = list.querySelector(`tr[data-cid="${c.id}"]`);
      if (!row) continue;
      if (h.key === 'needs') row.classList.add('needs-funding');
      const e = h.e;
      row.querySelector('.col-health').innerHTML = `<span class="badge ${h.cls}">${h.label}</span>`;
      row.querySelector('.col-funded').textContent = e ? fmtPol(e.remaining, 2) : '—';
      row.querySelector('.col-unrealized').textContent = e && e.unrealized > 0 ? fmtPol(e.unrealized, 2) : '—';
    }
    summary.innerHTML =
      `<span class="hs funded"><b>${tally.funded}</b> funded</span>`
      + `<span class="hs needs"><b>${tally.needs}</b> need funding</span>`
      + `<span class="hs other"><b>${tally.other}</b> draft / paused</span>`;
  }

  teardown() { this.detail?.teardown?.(); }
}

// The campaign's real funding health, from the factory economics. `funded` = it can
// serve; `needs` = funding ran out or was never staked (the one that calls for action);
// `other` = draft (not deployed) or paused. Budget is the cap; funding fills toward it.
function health(c, econ) {
  if (!c.contractAddress) return { key: 'other', label: 'Draft', cls: 'state-paused' };
  if (c.retired) return { key: 'other', label: 'Retired', cls: 'state-paused' };
  const e = econ.get(String(c.contractAddress).toLowerCase());
  if (!e) return { key: 'other', label: '—', cls: '' };
  if (e.state === 'serving') return { key: 'funded', label: 'Funded', cls: 'state-serving', e };
  if (e.state === 'paused') return { key: 'other', label: 'Paused', cls: 'state-paused', e };
  // exhausted (funding spent) or unfunded (never staked) — both need funding.
  return { key: 'needs', label: 'Needs funding', cls: e.state === 'unfunded' ? 'state-unfunded' : 'state-exhausted', e };
}

// Deployed or draft, and whether the stake is still owed.
function opBadge(c) {
  const deployed = !!c.contractAddress;
  let badge = `<span class="badge ${deployed ? 'deployed' : 'draft'}">${deployed ? 'Deployed' : 'Draft'}</span>`;
  if (c.retired) badge += ' <span class="badge">Retired</span>';
  return badge;
}
