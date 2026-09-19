// Campaigns — the list, or one campaign, by path:
//   /campaigns        → list
//   /campaigns/new    → CampaignProps, new
//   /campaigns/<id>   → CampaignProps, existing
// Adapted from blackfire-agent's Campaigns.

import Component from '/lib/componentry.mjs';
import CampaignProps from './CampaignProps.mjs';
import { esc, failureNote } from '../util.mjs';

export default class Campaigns extends Component {
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

    const list = this.div('table-box');
    try {
      const campaigns = await context.records.list('campaign');
      campaigns.sort((a, b) => String(b._created).localeCompare(String(a._created)));
      if (!campaigns?.length) {
        list.innerHTML = '<p class="empty">No campaigns yet. Create one to start.</p>';
        return;
      }
      list.innerHTML = `<table class="adnet-table">
        <thead><tr><th>Name</th><th>Status</th><th>Images</th><th>Headlines</th><th>Links</th><th>Budget</th><th>Deployed</th><th>Created</th></tr></thead>
        <tbody>${campaigns.map((c) => `
          <tr data-go="campaigns/${esc(c.id)}">
            <td>${esc(c.name)}</td>
            <td>${esc(c.status || '-')}</td>
            <td>${(c.images || []).length}</td>
            <td>${(c.headlines || []).length}</td>
            <td>${(c.links || []).length}</td>
            <td>${c.budget != null ? '$' + esc(c.budget) : '-'}</td>
            <td>${opBadge(c)}</td>
            <td>${c._created ? new Date(c._created).toLocaleDateString() : '-'}</td>
          </tr>`).join('')}</tbody>
      </table>`;
    } catch (e) {
      list.innerHTML = failureNote(e, 'load campaigns');
    }
  }

  teardown() { this.detail?.teardown?.(); }
}

// Deployed or draft, and whether the stake is still owed.
function opBadge(c) {
  const deployed = !!c.contractAddress;
  let badge = `<span class="badge ${deployed ? 'deployed' : 'draft'}">${deployed ? 'Deployed' : 'Draft'}</span>`;
  if (deployed && c.fundingTargetWei && !c.fundedTxHash && !c.retired) badge += ' <span class="badge draft">Unfunded</span>';
  if (c.retired) badge += ' <span class="badge">Retired</span>';
  return badge;
}
