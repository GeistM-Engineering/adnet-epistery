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

    // Health comes from the factory's one ledger (/publish/network): the real on-chain
    // funding, not the declared budget. Lenient — if it can't be read, the list still
    // renders (health shows '—'), never blocks on the chain.
    const summary = this.div('health-summary');
    const list = this.div('table-box');
    try {
      const [campaigns, net] = await Promise.all([
        context.records.list('campaign'),
        context.factory.network().catch(() => null)
      ]);
      campaigns.sort((a, b) => String(b._created).localeCompare(String(a._created)));
      if (!campaigns?.length) {
        list.innerHTML = '<p class="empty">No campaigns yet. Create one to start.</p>';
        return;
      }

      // contractAddress → economics row. The number that matters is whether it's funded.
      const econ = new Map((net?.campaigns || []).map((r) => [String(r.contractAddress || '').toLowerCase(), r]));
      const tally = { funded: 0, needs: 0, other: 0 };
      for (const c of campaigns) {
        const h = health(c, econ);
        if (h.key === 'funded') tally.funded++;
        else if (h.key === 'needs') tally.needs++;
        else tally.other++;
      }
      summary.innerHTML =
        `<span class="hs funded"><b>${tally.funded}</b> funded</span>`
        + `<span class="hs needs"><b>${tally.needs}</b> need funding</span>`
        + `<span class="hs other"><b>${tally.other}</b> draft / paused</span>`;

      list.innerHTML = `<table class="adnet-table">
        <thead><tr><th>Name</th><th>Health</th><th>Funded</th><th>Budget (cap)</th><th>Unrealized</th><th>Deployed</th><th>Created</th></tr></thead>
        <tbody>${campaigns.map((c) => {
          const h = health(c, econ);
          const e = h.e;
          return `
          <tr data-go="campaigns/${esc(c.id)}" class="${h.key === 'needs' ? 'needs-funding' : ''}">
            <td>${esc(c.name)}</td>
            <td><span class="badge ${h.cls}">${h.label}</span></td>
            <td class="num">${e ? fmtPol(e.remaining, 2) : '—'}</td>
            <td class="num">${c.budget != null ? '$' + esc(c.budget) : '—'}</td>
            <td class="num">${e && e.unrealized > 0 ? fmtPol(e.unrealized, 2) : '—'}</td>
            <td>${opBadge(c)}</td>
            <td>${c._created ? new Date(c._created).toLocaleDateString() : '-'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    } catch (e) {
      list.innerHTML = failureNote(e, 'load campaigns');
    }
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
