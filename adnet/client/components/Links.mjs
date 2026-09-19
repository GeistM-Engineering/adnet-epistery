// Links — the list, or one link, by path:
//   /links        → list
//   /links/new    → NewLink
//   /links/<id>   → LinkProps
// Adapted from blackfire-agent's Links.

import Component from '/lib/componentry.mjs';
import NewLink from './NewLink.mjs';
import LinkProps from './LinkProps.mjs';
import { esc, failureNote } from '../util.mjs';

// A link's public shortcode — URL-safe, without the look-alikes 0/O/1/I/l.
// Minted at creation and stable for the link's life.
const SHORTCODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export function mintShortCode(isTaken, len = 7) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    const code = [...bytes].map((b) => SHORTCODE_ALPHABET[b % SHORTCODE_ALPHABET.length]).join('');
    if (!isTaken(code)) return code;
  }
  throw new Error('could not mint a unique shortcode');
}

export default class Links extends Component {
  constructor(props) {
    super(props);
    this.hub = true;
  }

  async render(element) {
    await super.render(element);
    const { context } = this.props;
    const sub = (context.path || '').split('/').filter(Boolean)[1];
    if (sub === 'new') return void await this.draw(NewLink, { context }, this.element);
    if (sub) return void await this.draw(LinkProps, { id: sub, context }, this.element);

    const toolbar = this.div('toolbar');
    toolbar.innerHTML = '<h2>Destination links</h2>';
    if (context.canEdit) {
      const btn = document.createElement('button');
      btn.className = 'adnet-btn';
      btn.textContent = '+ New link';
      btn.dataset.go = 'links/new';
      toolbar.append(btn);
    }
    const list = this.div('table-box');
    try {
      const links = await context.records.list('link');
      links.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (!links?.length) {
        list.innerHTML = '<p class="empty">No links yet. Create one to point campaigns at a destination.</p>';
        return;
      }
      list.innerHTML = `<table class="adnet-table">
        <thead><tr><th>Name</th><th>URL</th><th>Code</th><th>Attributes</th><th>Created</th></tr></thead>
        <tbody>${links.map((l) => `
          <tr data-go="links/${esc(l.id)}">
            <td>${esc(l.name)}</td>
            <td class="mono">${esc(l.url)}</td>
            <td class="mono">${esc(l.code || '')}</td>
            <td>${Object.keys(l.attributes || {}).length}</td>
            <td>${l._created ? new Date(l._created).toLocaleDateString() : '-'}</td>
          </tr>`).join('')}</tbody>
      </table>`;
    } catch (e) { list.innerHTML = failureNote(e, 'load links'); }
  }
}
