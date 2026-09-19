// One destination link — edit or delete. Same shape as NewLink, loaded from the
// saved record. Adapted from blackfire-agent.

import Component from '/lib/componentry.mjs';
import { InputText, InputUrl } from './InputText.mjs';
import { Button } from './Button.mjs';
import AttributesEditor from './AttributesEditor.mjs';
import { esc } from '../util.mjs';

export default class LinkProps extends Component {
  constructor(props) {
    super(props);
    this.hub = true;
  }

  async render(element) {
    await super.render(element);
    const { context, id } = this.props;
    try { this.link = await context.records.get('link', id); }
    catch (e) { this.element.innerHTML = `<p class="empty">Failed to load link: ${esc(e.message)}</p>`; return; }
    if (!this.link) { this.element.innerHTML = '<p class="empty">No such link.</p>'; return; }
    this.data = { name: this.link.name || '', url: this.link.url || '', attributes: { ...(this.link.attributes || {}) } };

    const header = this.div('toolbar');
    header.innerHTML = `<div><h2>${esc(this.link.name) || '(unnamed)'}</h2>
      <div class="table-note">Code <span class="mono">${esc(this.link.code || '—')}</span> · created ${this.link._created ? esc(new Date(this.link._created).toLocaleString()) : '-'}</div></div>`;
    const controls = this.div('controls', header);
    await this.draw(Button, { title: 'Back', onClick: () => context.go('links') }, controls);
    if (context.canEdit) {
      await this.draw(Button, { title: 'Save', variant: 'primary', onClick: () => this.save() }, controls);
      await this.draw(Button, { title: 'Delete', variant: 'danger', onClick: () => this.remove() }, controls);
    }

    const settings = this.div('panel');
    this.div('panel-title', settings).textContent = 'Link settings';
    const row = this.div('settings-row', settings);
    await this.draw(InputText, { name: 'name', title: 'Name', data: this.data }, row);
    await this.draw(InputUrl, { name: 'url', title: 'Target URL', data: this.data }, row);

    const attrs = this.div('panel');
    this.div('panel-title', attrs).textContent = 'Attributes';
    await this.draw(AttributesEditor, { name: 'attributes', title: 'Attributes', hideTitle: true, data: this.data }, attrs);
  }

  async save() {
    try {
      Object.assign(this.link, {
        name: this.data.name?.trim(), url: this.data.url?.trim(), attributes: this.data.attributes || {},
        _modified: new Date().toISOString(),
      });
      await this.props.context.records.put('link', this.link);
      window.toast?.success('Saved');
    } catch (e) { window.toast?.error('Save failed: ' + esc(e.message)); }
  }

  async remove() {
    if (!(await window.toast.prompt(`Delete link "${esc(this.link.name)}"?`, { ok: 'Delete', cancel: 'Cancel' }))) return;
    try {
      await this.props.context.records.remove('link', this.props.id);
      window.toast?.success('Deleted');
      this.props.context.go('links');
    } catch (e) { window.toast?.error('Delete failed: ' + esc(e.message)); }
  }
}
