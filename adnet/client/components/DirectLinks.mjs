// DirectLinks — carrying a campaign without the script.
//
// A campaign contract's address is all a link needs: the agency's
// /link/<contractAddress> resolves the destination at click time, records the
// click against the contract, and redirects. Wrapped around the campaign's own
// creative it is a whole ad in one <img> tag. This panel says what that leaves
// out next to what the script adds, then lists the live campaigns with their
// links ready to paste.
//
// The agency serves no image bytes of its own (/render returns an HTML fragment),
// so an <img> here points at the creative where the campaign keeps it. The
// agency never sees that fetch: a bare image records clicks, not views. Said
// on the page, not papered over.
//
// What anyone wants from a placement is not assumed here. Attribution and
// payment are offered, never presumed; Adnet takes its toll on what passes
// through either way.

import Component from '/lib/componentry.mjs';
import { esc } from '../util.mjs';

export default class DirectLinks extends Component {
  static css = `
.DirectLinks { display: flex; flex-direction: column; min-width: 0; margin-top: var(--spacer3); }
.DirectLinks .dl-block { display: flex; flex-direction: column; gap: var(--spacerhalf); min-width: 0; margin-bottom: var(--spacer2); }
.DirectLinks .dl-block h3 { margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text-color); }
.DirectLinks .dl-block p, .DirectLinks .dl-block li { margin: 0; color: var(--text-muted); font-size: 0.9em; overflow-wrap: anywhere; }
.DirectLinks .dl-block ul { margin: 0; padding-left: var(--spacer2); display: flex; flex-direction: column; gap: var(--spacerquarter); }
.DirectLinks .dl-campaign { display: flex; flex-direction: column; gap: var(--spacerhalf); min-width: 0;
  padding: var(--spacer) 0; border-top: 1px solid var(--page-border); }
.DirectLinks .dl-campaign h4 { margin: 0; font-size: 0.9rem; font-weight: 600; color: var(--text-color); overflow-wrap: anywhere; }
.DirectLinks .dl-creative { display: flex; align-items: center; gap: var(--spacer); min-width: 0; }
.DirectLinks .dl-creative img { flex: 0 0 auto; max-width: 120px; max-height: 60px; object-fit: contain;
  border: 1px solid var(--page-border); border-radius: 4px; background: var(--adnet-quiet-bg); }
.DirectLinks .dl-copy { display: flex; align-items: flex-start; gap: var(--spacerhalf); min-width: 0; flex: 1 1 auto; }
.DirectLinks .dl-value { flex: 1 1 auto; min-width: 0; user-select: all; overflow-wrap: anywhere;
  padding: var(--spacerquarter) var(--spacerhalf); background: var(--adnet-quiet-bg);
  border: 1px solid var(--page-border); border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8em; color: var(--text-color); }
.DirectLinks .dl-copy button { flex: 0 0 auto; border: 1px solid var(--page-border); background: var(--bg-color);
  color: var(--text-color); border-radius: 8px; padding: 0 var(--spacer); font: inherit; font-size: 0.85em; cursor: pointer; }
`;

  async render(element) {
    await super.render(element);
    const agency = this.props.agency;
    this.element.classList.add('panel');
    this.element.innerHTML = `
      <div class="panel-title">Direct links — no script</div>

      <div class="dl-block">
        <p>A campaign's contract address is all a link needs. <span class="mono">${esc(agency)}/link/{campaign}</span>
          resolves the campaign's destination at the moment of the click, records the click against the contract, and
          redirects. It works anywhere a URL does — a page, an email, a PDF, a chat message, a printed QR code. Put the
          campaign's own image inside it and one <span class="mono">&lt;img&gt;</span> tag is the whole ad.</p>
      </div>

      <div class="dl-block">
        <h3>What a bare link tells us</h3>
        <ul>
          <li>The campaign, the moment, and the browser's own User-Agent — enough to know phone from desktop, not who.</li>
          <li>The <span class="mono">Referer</span>, when the browser sends one. For a link to another site most browsers
            send only the origin — the domain, not the page — and send nothing at all from email clients, native apps,
            QR scans, <span class="mono">rel="noreferrer"</span>, or an https page linking to http. When a domain arrives
            it is looked up in Scan like any publisher; when none does, the click still counts for the campaign and is
            attributed to no one.</li>
          <li>Anything the link says for itself. <span class="mono">?page=/your/path</span> records the page;
            <span class="mono">?ref=yourdomain.com</span> names the domain when no Referer arrives. Neither is trusted
            further than the domain's own declaration in Scan.</li>
          <li>Nothing about the image. An <span class="mono">&lt;img&gt;</span> is fetched from wherever the campaign
            keeps its creative; the agency never sees that request, so a bare image records clicks, not views. It also
            carries no byline — saying it is sponsored, and by whom, is left to the page.</li>
        </ul>
      </div>

      <div class="dl-block">
        <h3>What the script adds</h3>
        <ul>
          <li>A view, recorded by the agency as each slot renders, with an impression token that ties a later click to
            the view it came from.</li>
          <li>The page path, and a continuity id kept in the visitor's own browser — an attribute on events, never an
            identity.</li>
          <li>A creative fitted to the slot's shape, under the sponsor's name and wallet and a Sponsored mark.</li>
          <li>A choice of campaign: name none and the Exchange picks for the site. A surface that can fetch HTML but run
            no script gets the same unit from <span class="mono">${esc(agency)}/render/{format}/{campaign}</span>.</li>
        </ul>
      </div>

      <div class="dl-block">
        <h3>What it is for is yours</h3>
        <p>A sponsor may want reach, a visit, or only to stand beside a page it believes in. A publisher may want income,
          to back a cause, or to send readers somewhere worth going. Attribution may matter to one side, both, or neither.
          Adnet does not decide which. It carries the link, records what passes through, and takes its toll.</p>
      </div>

      <div class="dl-block">
        <h3>Live campaigns</h3>
        <div class="dl-list"><p class="empty">Loading campaigns…</p></div>
      </div>`;

    this.element.addEventListener('click', (e) => {
      const btn = e.target.closest('.dl-copy button');
      if (!btn) return;
      const value = btn.previousElementSibling.textContent;
      navigator.clipboard.writeText(value).then(
        () => window.toast?.success('Copied'),
        (err) => window.toast?.error('Could not copy: ' + esc(err.message)));
    });

    const list = this.element.querySelector('.dl-list');
    let campaigns;
    try {
      const r = await fetch(`${agency}/publish/ads?active=true`, { credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      campaigns = ((await r.json()).contracts || []).filter((c) => c.contractAddress);
    } catch (e) {
      list.innerHTML = `<p class="empty">Could not read the agency's live campaigns: ${esc(e.message)}</p>`;
      return;
    }
    if (!campaigns.length) {
      list.innerHTML = '<p class="empty">No campaigns are live at the agency right now.</p>';
      return;
    }
    list.innerHTML = campaigns.map((c) => this._campaign(agency, c)).join('');
  }

  // One campaign: its click-through link, then each creative wrapped in it.
  _campaign(agency, c) {
    const link = `${agency}/link/${c.contractAddress}`;
    const sponsor = c.advertiser?.name ? ` <span class="pub-note">· ${esc(c.advertiser.name)}</span>` : '';
    const creatives = (c.promotions || []).filter((p) => p && p.creative && p.active !== false);
    return `<div class="dl-campaign">
      <h4>${esc(c.name || c.contractAddress)}${sponsor}</h4>
      ${this._copyable(link)}
      ${creatives.map((p) => `<div class="dl-creative">
        <img src="${esc(p.creative)}" alt="${esc(p.title || '')}" loading="lazy">
        ${this._copyable(this._imgTag(link, p))}
      </div>`).join('')}
    </div>`;
  }

  _imgTag(link, p) {
    const dims = p.creativeWidth > 0 && p.creativeHeight > 0 ? ` width="${p.creativeWidth}" height="${p.creativeHeight}"` : '';
    return `<a href="${link}"><img src="${p.creative}"${dims} alt="${(p.title || '').replace(/"/g, '&quot;')}"></a>`;
  }

  // A pasteable value: its own element, selectable whole, with nothing beside it to pick up by accident.
  _copyable(value) {
    return `<div class="dl-copy"><code class="dl-value">${esc(value)}</code><button type="button">Copy</button></div>`;
  }
}
