// Monitor — the sites this session follows, as the emcee observed them.
//
// A followed site is a session record (`site-<id>`, {domain}), sealed like every
// other adnet record and written by the member's own device. The numbers come from
// the agency's emcee (`<factory>/emcee/site/<domain>`): who requested the site's
// pages — people, AI agents (verified against what their operators publish, or only
// claimed), crawlers, impostors — and how paid clicks arrived, set against Meta's
// own click counts for the ads that land only on that site.
//
// The emcee reports its own coverage; it is shown, not smoothed over. Controls on
// who may see which site come later — today the read is public, like the publisher
// performance on the Publishing page.

import Component from '/lib/componentry.mjs';
import { Button } from './Button.mjs';
import { InputText } from './InputText.mjs';
import { esc, failureNote } from '../util.mjs';
import { newId } from '../records.mjs';

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const normalize = (d) => String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
const n = (v) => (v == null ? '—' : Math.round(v).toLocaleString());
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');

export default class Monitor extends Component {
  static css = `
.Monitor { display: flex; flex-direction: column; gap: var(--spacer2); min-width: 0; }
.Monitor .mon-note { color: var(--text-muted); font-size: 0.9em; margin: 0; }
.Monitor .mon-follow { display: flex; gap: var(--spacer); align-items: flex-end; min-width: 0; }
.Monitor .mon-follow .InputText { flex: 1 1 auto; min-width: 0; }
.Monitor .mon-site { display: flex; flex-direction: column; gap: var(--spacer); min-width: 0; }
.Monitor .mon-head { display: flex; justify-content: space-between; align-items: center; gap: var(--spacer); min-width: 0; }
.Monitor .mon-head h3 { margin: 0; font-size: 1.05rem; overflow-wrap: anywhere; }
.Monitor .mon-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--spacer); }
.Monitor .mon-tile { border: 1px solid var(--page-border); border-radius: 8px; padding: var(--spacer); background: var(--bg-color); min-width: 0; }
.Monitor .mon-tile .k { color: var(--text-muted); font-size: 0.8em; }
.Monitor .mon-tile .v { font-size: 1.25rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.Monitor .mon-tile .s { color: var(--text-muted); font-size: 0.8em; }
.Monitor .mon-warn { color: var(--status-warning); }
.Monitor details > summary { cursor: pointer; color: var(--text-muted); font-size: 0.9em; }
`;

  constructor(props) {
    super(props);
    this.hub = true;
  }

  async render(element) {
    await super.render(element);
    const { context } = this.props;
    const toolbar = this.div('toolbar');
    toolbar.innerHTML = '<h2>Monitor</h2>';
    this.div('mon-note').innerHTML = `Sites this session follows, as GeistM's edge observed them: who asked for their pages —
      people, AI agents (verified against what their operators publish, or only claimed), crawlers and impostors — and how
      paid clicks arrived against what the ad network reports.`;

    let sites;
    try {
      sites = await context.records.list('site');
      sites.sort((a, b) => String(a.domain).localeCompare(String(b.domain)));
    } catch (e) { this.div('panel').innerHTML = failureNote(e, 'load followed sites'); return; }

    if (context.canEdit) {
      const row = this.div('mon-follow');
      this.input = await this.draw(InputText, { name: 'domain', title: 'Follow a site', placeholder: 'popdust.com', data: {} }, row);
      await this.draw(Button, { title: 'Follow', variant: 'primary', onClick: () => this.follow(sites) }, row);
    }

    if (!sites.length) {
      this.div('panel').innerHTML = '<p class="empty">No sites followed yet.</p>';
      return;
    }
    for (const site of sites) await this.draw(SiteStats, { site, context, onUnfollow: () => this.unfollow(site) }, this.element);
  }

  async follow(sites) {
    const domain = normalize(this.input.value);
    if (!DOMAIN_RE.test(domain)) return window.toast?.error('Enter a domain, like popdust.com');
    if (sites.some((s) => s.domain === domain)) return window.toast?.status(`Already following ${esc(domain)}`);
    try {
      await this.props.context.records.put('site', { id: newId(6), domain, _created: new Date().toISOString() });
      window.toast?.success(`Following ${esc(domain)}`);
      this.components = [];
      await this.render();
    } catch (e) { window.toast?.error('Could not follow: ' + esc(e.message)); }
  }

  async unfollow(site) {
    try {
      await this.props.context.records.remove('site', site.id);
      this.components = [];
      await this.render();
    } catch (e) { window.toast?.error('Could not unfollow: ' + esc(e.message)); }
  }
}

class SiteStats extends Component {
  async render(element) {
    await super.render(element);
    const { site, context } = this.props;
    this.element.classList.add('panel', 'mon-site');
    const head = this.div('mon-head');
    head.innerHTML = `<h3>${esc(site.domain)}</h3>`;
    if (context.canEdit) await this.draw(Button, { title: 'Unfollow', onClick: () => this.props.onUnfollow() }, head);
    const body = this.div();
    body.innerHTML = '<p class="empty">Loading…</p>';

    let s;
    try {
      const res = await fetch(`${context.factory.base}/emcee/site/${encodeURIComponent(site.domain)}?days=7`, { credentials: 'omit' });
      s = await res.json();
      if (!res.ok) throw new Error(s.reason || s.message || `the emcee answered ${res.status}`);
    } catch (e) { body.innerHTML = failureNote(e, `read ${site.domain}`); return; }
    if (!s.days?.length || !s.totals.requests) {
      body.innerHTML = `<p class="empty">The emcee has no traffic for ${esc(site.domain)} yet.</p>`;
      return;
    }

    const t = s.totals, m = t.meta;
    const tile = (k, v, sub = '', warn = false) => `<div class="mon-tile"><div class="k">${esc(k)}</div><div class="v${warn ? ' mon-warn' : ''}">${v}</div><div class="s">${sub}</div></div>`;
    body.innerHTML = `
      <p class="mon-note">${esc(s.days[0])} – ${esc(s.days[s.days.length - 1])} · ${s.days.length} day${s.days.length === 1 ? '' : 's'} ·
        sees ${pct(s.coverage.siteKnownShare, 1)} of fleet requests <span title="${esc(s.coverage.note)}">ⓘ</span></p>
      <div class="mon-tiles">
        ${tile('Requests', n(t.requests))}
        ${tile('People', pct(t.human, t.requests), `${n(t.human)} browser + in-app`)}
        ${tile('AI agents', n(t.ai), `${pct(t.aiVerified, t.ai)} verified`)}
        ${tile('Crawlers & tools', n(t.crawlers))}
        ${tile('Impostors', n(t.impostors), 'claimed an operator that disowns them', t.impostors > 0)}
        ${tile('Paid clicks arrived', n(t.paid.clicks), `${pct(t.paid.human, t.paid.clicks)} people · ${n(t.paid.preview)} previews`)}
        ${m.ads ? tile('Meta clicks → arrived', pct(m.arrived, m.linkClicks), `${n(m.arrived)} of ${n(m.linkClicks)} · ${m.ads} ads land only here`) : ''}
      </div>
      <div class="table-box"><table class="adnet-table">
        <thead><tr><th>Day</th><th class="num">Requests</th><th class="num">People</th><th class="num">AI</th><th class="num">Crawlers</th><th class="num">Impostors</th><th class="num">Paid arrived</th><th class="num">Meta clicks</th></tr></thead>
        <tbody>${s.daily.map((d) => `<tr><td>${esc(d.day)}</td><td class="num">${n(d.requests)}</td><td class="num">${n(d.human)}</td><td class="num">${n(d.ai)}</td><td class="num">${n(d.crawlers)}</td><td class="num">${n(d.impostors)}</td><td class="num">${n(d.paid.clicks)}</td><td class="num">${d.meta.linkClicks ? n(d.meta.linkClicks) : '—'}</td></tr>`).join('')}</tbody>
      </table></div>
      <details><summary>Agents (${s.agents.length})</summary>
        <div class="table-box"><table class="adnet-table">
          <thead><tr><th>Agent</th><th>Operator</th><th>Kind</th><th class="num">Requests</th><th class="num">Verified</th><th class="num">Impostor</th><th class="num">Unverifiable</th></tr></thead>
          <tbody>${s.agents.map((a) => `<tr><td>${esc(a.agent)}</td><td>${esc(a.operator)}</td><td>${esc(a.class)}</td><td class="num">${n(a.requests)}</td><td class="num">${n(a.verified)}</td><td class="num">${n(a.failed)}</td><td class="num">${n(a.unverifiable)}</td></tr>`).join('')}</tbody>
        </table></div>
      </details>`;
  }
}
