// Publishing — the other side of Adnet: sessions that carry ads.
//
// A session is an inner page of the identity that owns it. It declares itself
// (title, description, audience, core concepts, and whether it carries ads) in a
// declaration signed by one of its admins; Scan checks that signature against the
// session's contract, and an ad network pays that contract for what the session
// delivers. The host serving it is never the publisher.
//
// This page lists the viewer's sessions of kinds that can carry ads (a kind says
// so in its own manifest), with each one's declaration, whether its contract
// vouches for it per Scan, ads on/off (for its admins), and its performance as
// the ad network reports it.
//
// A session is not the only thing that can carry ads: any site its owner controls
// can, on the same terms. The second half of the page is how — the four steps the
// agency's own publisher docs name, said here so a publisher never has to leave to
// find them. It is instructions only: nothing on an outside site is configured from
// here, because nothing about it belongs to this session.
//
// Last, the same campaigns without the script: a bare /link per campaign and an
// <img> tag wrapped in it (DirectLinks), with what each way can and cannot see.

import Component from '/lib/componentry.mjs';
import { esc, failureNote } from '../util.mjs';
import DirectLinks from './DirectLinks.mjs';

const DEFAULT_AGENCY = 'https://adnet.geistm.com';

export default class Publishing extends Component {
  static css = `
.Publishing { display: flex; flex-direction: column; min-width: 0; }
.Publishing .pub-note { color: var(--text-muted); font-size: 0.9em; margin: 0 0 var(--spacer2); }
.Publishing .pub-ok { color: var(--status-success); }
.Publishing .pub-warn { color: var(--status-warning); }
.Publishing .pub-toggle { display: flex; align-items: center; gap: var(--spacerhalf); white-space: nowrap; }
.Publishing .pub-perf { font-variant-numeric: tabular-nums; white-space: nowrap; }
.Publishing .pub-edit { border: 1px solid var(--page-border); background: var(--bg-color); color: var(--text-color); border-radius: 8px; padding: 0 var(--spacer); font: inherit; cursor: pointer; }
.Publishing .pub-site { margin-top: var(--spacer3); min-width: 0; }
.Publishing .pub-step { display: flex; flex-direction: column; gap: var(--spacerhalf); min-width: 0; margin-bottom: var(--spacer2); }
.Publishing .pub-step:last-child { margin-bottom: 0; }
.Publishing .pub-step h3 { margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text-color); }
.Publishing .pub-step p { margin: 0; color: var(--text-muted); font-size: 0.9em; overflow-wrap: anywhere; }
.Publishing .pub-step pre { margin: var(--spacerhalf) 0 0; padding: var(--spacer); min-width: 0; overflow-x: auto;
  background: var(--adnet-quiet-bg); border: 1px solid var(--page-border); border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; color: var(--text-color); }
`;

  async render(element) {
    await super.render(element);
    const toolbar = this.div('toolbar');
    toolbar.innerHTML = '<h2>Publishing</h2>';
    this.div('pub-note').innerHTML = `Sessions that can carry ads. Each declares itself — signed by one of its admins — and its
      own contract vouches for that declaration; ads it carries are paid to that contract. Turn a session's ads on in its declaration.`;
    const box = this.div('table-box');
    box.innerHTML = '<p class="empty">Loading sessions…</p>';

    let hosting, sessions;
    try {
      const [kinds, list] = await Promise.all([
        fetch('/api/kinds', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/sessions', { credentials: 'include' }).then((r) => r.json()),
      ]);
      hosting = new Map((kinds.kinds || []).filter((k) => k.ads).map((k) => [k.kind, k]));
      sessions = (list.sessions || []).filter((s) => hosting.has(s.kind));
    } catch (e) { box.innerHTML = failureNote(e, 'list sessions'); this._site(); return; }
    if (!sessions.length) {
      box.innerHTML = `<p class="empty">None of your sessions can carry ads yet. Sessions of these kinds can: ${esc([...hosting.values()].map((k) => k.title).join(', ') || 'none installed')}.</p>`;
      this._site();
      return;
    }

    box.innerHTML = `<table class="adnet-table">
      <thead><tr><th>Session</th><th>Kind</th><th>Readable by</th><th>Declaration</th><th>Scan</th><th>Ads</th><th>Delivered</th><th>Settled</th></tr></thead>
      <tbody></tbody></table>`;
    const tbody = box.querySelector('tbody');
    for (const s of sessions) {
      const tr = document.createElement('tr');
      tbody.append(tr);
      this._row(tr, s, hosting.get(s.kind));
    }
    this._site();
  }

  // Carrying ads on a site of your own. The same four steps the agency publishes at
  // /docs#publishers, and the same reason they are in that order: the script only
  // fills slots, the CNAME only makes the calls first-party, and neither one makes
  // the site a payee. Scan does, by confirming the site's own declaration — so a
  // site that skips step 3 still serves ads and still accrues nothing.
  _site() {
    const el = this.div('panel pub-site');
    el.innerHTML = `
      <div class="panel-title">Carry ads on a site you own</div>
      <p class="pub-note">A session is not the only thing that can publish. Any site you control can carry the same
        campaigns on the same terms — it declares itself, Adnet looks it up, and the campaign contract pays it directly.
        These steps are done on that site, not here.</p>

      <div class="pub-step">
        <h3>1 · Put slots on the page and load the script</h3>
        <p>Mark each slot with a class and load the client. It finds the slots, asks which campaigns are live, fetches a
          server-rendered ad per slot and injects it. Nothing renders, records, settles or identifies anyone in the
          browser.</p>
        <pre>&lt;div class="adnet-entry-banner"&gt;&lt;/div&gt;
&lt;script src="${esc(DEFAULT_AGENCY)}/client/client.js" async&gt;&lt;/script&gt;</pre>
        <p>Slot classes: <span class="mono">adnet-entry</span> or <span class="mono">adnet-entry-banner</span> (banner),
          <span class="mono">adnet-entry-square</span>, <span class="mono">adnet-entry-card</span>,
          <span class="mono">adnet-entry-badge</span>, <span class="mono">adnet-entry-qr</span>.</p>
      </div>

      <div class="pub-step">
        <h3>2 · Optional — serve it first-party</h3>
        <p>Point a <span class="mono">_adnet.&lt;yourdomain&gt;</span> CNAME at the agency and load the script from there
          instead. Rendering and clicks then run on your own domain. The record is the whole delegation: creating it
          authorizes Adnet to attribute engagement to the domain. No key is handed over.</p>
        <pre>_adnet.yourdomain.com.  CNAME  ${esc(DEFAULT_AGENCY.replace(/^https?:\/\//, ''))}.</pre>
      </div>

      <div class="pub-step">
        <h3>3 · Declare the site — this is what makes it a payee</h3>
        <p>Serve a <span class="mono">/.well-known/ai</span> manifest, signed. <a href="https://epistery.com" target="_blank"
          rel="noopener">Epistery Scan</a> indexes it and confirms it is served from the domain it claims; the payee address
          Adnet uses at settlement is the one in that declaration. Scan issues nothing — it reports what the site itself
          says and whether the site stands behind it. An undeclared domain still serves ads and is still attributed, but
          there is no address to credit. What Scan observes — signature, DNS and on-chain binding, age — also decides which
          settlement rules the site qualifies under: a <span class="mono">confirmedDomain</span> campaign pays only
          domain-bound publishers.</p>
      </div>

      <div class="pub-step">
        <h3>4 · Withdraw</h3>
        <p>Settlement credits a balance on each campaign contract. Call <span class="mono">withdraw()</span> on the contract
          whenever you like — a direct transfer with an on-chain receipt. No threshold, no payout schedule, no one in
          between.</p>
      </div>

      <p class="pub-note" style="margin-top: var(--spacer2)">The agency's own publisher documentation:
        <a href="${esc(DEFAULT_AGENCY)}/docs#publishers" target="_blank" rel="noopener">${esc(DEFAULT_AGENCY)}/docs</a>.</p>`;
    this.draw(DirectLinks, { agency: DEFAULT_AGENCY }, this.element);
  }

  async _row(tr, s, kind) {
    const label = s.title || s.name || s.id;
    tr.innerHTML = `<td><a href="#/s/${esc(s.owner)}/${esc(s.id)}">${esc(label)}</a></td><td>${esc(kind.title)}</td>
      <td>${esc(s.defaultRole === 'none' || !s.defaultRole ? 'members' : 'anyone')}</td><td colspan="5" class="pub-note">…</td>`;
    let rec;
    try {
      rec = await fetch(`/api/sessions/${s.owner}/${s.id}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
    } catch (e) { tr.lastElementChild.textContent = `Could not read the session: ${e.message}`; return; }
    const d = rec.params?.discovery || null;
    const isPublic = (rec.defaultRole || 'none') !== 'none';
    const admin = rec.role === 'admin';
    const agency = d?.ads?.agency || DEFAULT_AGENCY;
    const [scanned, perf] = await Promise.all([
      fetch(`/scan/api/discovery/session/${rec.owner}/${rec.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${agency}/publish/publisher/session/${rec.owner}/${rec.id}`, { credentials: 'omit' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    const decl = d?._signature
      ? `<span class="pub-ok">signed</span> ${esc(new Date(d._signature.signedAt).toLocaleDateString())}`
      : '<span class="pub-warn">not declared</span>';
    const scan = !d ? '—'
      : scanned?.vouched ? '<span class="pub-ok" title="the contract stands behind this declaration">vouched</span>'
      : scanned ? `<span class="pub-warn" title="${esc(scanned.facts?.reason || 'the contract does not vouch for this declaration yet')}">not vouched</span>`
      : '<span class="pub-warn" title="Scan re-reads each identity on its own cadence">not indexed yet</span>';
    const t = perf?.totals;
    const views = (x) => (x ? `${x.views} views · ${x.clicks} clicks` : '—');

    tr.innerHTML = `
      <td><a href="#/s/${esc(rec.owner)}/${esc(rec.id)}">${esc(label)}</a></td>
      <td>${esc(kind.title)}</td>
      <td>${isPublic ? 'anyone' : 'members'}</td>
      <td>${decl}${admin ? ' <button type="button" class="pub-edit">Edit</button>' : ''}</td>
      <td>${scan}</td>
      <td><label class="pub-toggle"><input type="checkbox" class="pub-ads"${d?.ads?.enabled ? ' checked' : ''}${admin && isPublic ? '' : ' disabled'}> ${d?.ads?.enabled ? 'on' : 'off'}</label></td>
      <td class="pub-perf">${views(t?.delivered)}</td>
      <td class="pub-perf" title="${t ? `${t.pending.views + t.pending.clicks} pending · ${t.denied.views + t.denied.clicks} denied` : ''}">${views(t?.settled)}</td>`;

    tr.querySelector('.pub-edit')?.addEventListener('click', () => this._edit(tr, s, kind, rec));
    tr.querySelector('.pub-ads')?.addEventListener('change', async (e) => {
      const on = e.target.checked;
      e.target.disabled = true;
      try {
        const { saveDeclaration } = await import('/declaration.mjs');
        await saveDeclaration(rec, { ...(d || { title: rec.title || rec.name, description: rec.description || '' }), ads: { enabled: on, agency } });
        window.toast?.success(`Ads ${on ? 'on' : 'off'} for ${esc(label)} — declaration re-signed`);
      } catch (err) {
        window.toast?.error('Could not change ads: ' + esc(err.message));
      }
      this._row(tr, s, kind);
    });
  }

  async _edit(tr, s, kind, rec) {
    const { default: DeclarationEditor } = await import('/components/DeclarationEditor.mjs');
    const host = document.createElement('div');
    window.popup.display(`${esc(rec.title || rec.name)} — declaration`, host, [], { dismissable: true, onClose: () => this._row(tr, s, kind) });
    await new DeclarationEditor({ rec, onSaved: () => window.popup.close() }).render(host);
  }
}
