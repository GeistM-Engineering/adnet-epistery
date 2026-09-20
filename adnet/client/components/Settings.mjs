// Settings (admins) — replaces blackfire-agent's Admin page.
//
// What moved where: access control is the session's own member list, managed in
// the console's session settings, so the ACL iframe is gone. Configuration
// that lived as a private attribute on the host's DomainAgent contract is now
// this session's params, written by this admin's device rivet-signed
// (ctx.ui.saveParams) — no server write, no transaction.
//
//   Adnet factory — the Agency campaigns deploy through
//   Image folder  — the Files folder the campaign image picker shows
//
// This draws into the SHELL's settings modal, as its plugin tab (Main.openSettings)
// — beside Members, Discovery, Bot access and Danger, which are the session's and
// not adnet's. So it carries no heading of its own (the modal titles the section)
// and no separate Save toolbar: the one Save belongs to the one thing here that
// is adnet's to write, the configuration.

import Component from '/lib/componentry.mjs';
import { InputUrl } from './InputText.mjs';
import { InputSelect } from './InputSelect.mjs';
import { Button } from './Button.mjs';
import { esc } from '../util.mjs';

const DEFAULT_ADNET_URL = 'https://adnet.geistm.com';

export default class Settings extends Component {
  static css = `
.Settings { display: flex; flex-direction: column; gap: var(--spacer2); min-width: 0; max-width: 720px; }
.Settings .help { font-size: 0.85em; color: var(--text-muted); margin: var(--spacerhalf) 0 0; }
.Settings .fields { display: flex; flex-direction: column; gap: var(--spacer2); }
.Settings dl { display: flex; flex-wrap: wrap; gap: var(--spacerhalf) var(--spacer2); margin: 0; }
.Settings dt { flex: 0 0 140px; color: var(--text-muted); }
.Settings dd { flex: 1 1 240px; margin: 0; min-width: 0; }
.Settings .save-row { display: flex; justify-content: flex-end; margin-top: var(--spacer2); }
`;

  constructor(props) {
    super(props);
    this.hub = true;
  }

  async render(element) {
    await super.render(element);
    const { ctx } = this.props.context;
    const params = ctx.session.params || {};
    this.data = { adnetBaseUrl: params.adnetBaseUrl || DEFAULT_ADNET_URL, imageFolder: params.imageFolder || '' };

    // Who the advertiser is, and who may act and pay for it.
    const who = this.div('panel');
    who.innerHTML = '<h2>Advertiser</h2><p class="empty">Loading…</p>';
    this._who(who);

    const cfg = this.div('panel');
    cfg.innerHTML = '<h2>Configuration</h2>';
    const fields = this.div('fields', cfg);
    await this.draw(InputUrl, { name: 'adnetBaseUrl', title: 'Adnet factory', placeholder: DEFAULT_ADNET_URL, data: this.data }, fields);
    this.div('help', fields).textContent = 'The Agency this session deploys campaigns through.';

    let folders = [];
    try {
      const { entries = [] } = await this.props.context.api('GET', '/entries');
      folders = entries.filter((e) => e.type === 'folder');
    } catch { /* the picker offers "all images" only */ }
    const options = [{ name: 'All images', value: '' }, ...folders.map((f) => ({ name: f.name, value: f.id }))];
    await this.draw(InputSelect, { name: 'imageFolder', title: 'Image folder', options, data: this.data }, fields);
    this.div('help', fields).textContent = 'The folder under Art that the campaign image picker shows.';

    await this.draw(Button, { title: 'Save', variant: 'primary', onClick: () => this.save() }, this.div('save-row', cfg));
  }

  async _who(panel) {
    const owner = this.props.context.ctx.session.owner;
    const ep = await import('/epistery.mjs');
    const name = await ep.contractName(owner).catch(() => null);
    panel.innerHTML = `<h2>Advertiser</h2><dl>
      <dt>Identity</dt><dd>${name ? `${esc(name)} · ` : ''}<span class="mono">${esc(owner)}</span></dd>
      <dt>Pays from</dt><dd>the identity's treasury, on a signer's own signature</dd>
    </dl>
    <p class="help">Campaigns name this identity as their advertiser. Its signers — and the admins of this session — may deploy and operate them; only its signers can stake or withdraw.
      Who those admins and members are is the session's own roster, on the <strong>Members</strong> tab.</p>`;
  }

  async save() {
    const adnetBaseUrl = String(this.data.adnetBaseUrl || '').trim().replace(/\/+$/, '');
    if (adnetBaseUrl && !/^https?:\/\//.test(adnetBaseUrl)) return window.toast?.warning('The Adnet factory must be an http(s) URL');
    try {
      await this.props.context.ctx.ui.saveParams({ adnetBaseUrl: adnetBaseUrl || DEFAULT_ADNET_URL, imageFolder: this.data.imageFolder || '' });
      window.toast?.success('Saved');
    } catch (e) { window.toast?.error('Save failed: ' + esc(e.message)); }
  }
}
