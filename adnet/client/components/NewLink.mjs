// New destination link — name, target URL, attributes. Adapted from blackfire-agent.

import Component from '/lib/componentry.mjs';
import { InputText, InputUrl } from './InputText.mjs';
import { Button } from './Button.mjs';
import AttributesEditor from './AttributesEditor.mjs';
import { esc } from '../util.mjs';
import { newId } from '../records.mjs';
import { mintShortCode } from './Links.mjs';
import { signerAddress } from '../signer.mjs';

export default class NewLink extends Component {
  constructor(props) {
    super(props);
    this.hub = true;
    this.data = { name: '', url: '', attributes: {} };
  }

  async render(element) {
    await super.render(element);
    const { context } = this.props;
    const header = this.div('toolbar');
    header.innerHTML = '<h2>New link</h2>';
    const controls = this.div('controls', header);
    await this.draw(Button, { title: 'Cancel', onClick: () => context.go('links') }, controls);
    await this.draw(Button, { title: 'Save', variant: 'primary', onClick: () => this.save() }, controls);

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
    const payload = { name: this.data.name?.trim(), url: this.data.url?.trim(), attributes: this.data.attributes || {} };
    if (!payload.name) return window.toast?.warning('Name is required');
    if (!payload.url) return window.toast?.warning('Target URL is required');
    try {
      const { records } = this.props.context;
      const all = await records.list('link');
      const link = { id: newId(6), code: mintShortCode((c) => all.some((l) => l.code === c)), ...payload, _created: new Date().toISOString(), _createdBy: await signerAddress() };
      await records.put('link', link);
      window.toast?.success('Link saved');
      this.props.context.go(`links/${link.id}`);
    } catch (e) { window.toast?.error('Save failed: ' + esc(e.message)); }
  }
}
