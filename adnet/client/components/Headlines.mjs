// Headlines editor — rows of text / subtext, saved together. Adapted from
// blackfire-agent (itself from pro-console's AdHeadlines). The list lives in the
// DOM; each row tracks its own state (active / removed / modified) and Save
// sends the upserts and deletes in one PUT.

import Component from '/lib/componentry.mjs';
import { Button } from './Button.mjs';
import { InputLongText, InputTextArea } from './InputText.mjs';
import { esc, failureNote } from '../util.mjs';
import { newId } from '../records.mjs';

export default class Headlines extends Component {
  static css = `
.Headlines { display: flex; flex-direction: column; gap: var(--spacer2); min-width: 0; }
.Headlines .content-list { display: flex; flex-direction: column; gap: var(--spacerhalf); }
.Headlines .Entry, .Headlines .NewEntry { display: flex; gap: var(--spacer); align-items: flex-start; padding: var(--spacer); border: 1px solid var(--page-border); border-radius: 8px; background: var(--bg-color); }
.Headlines .Entry.modified { border-color: var(--primary-mid); }
.Headlines .Entry.removed { opacity: 0.5; }
.Headlines .Entry.removed input { text-decoration: line-through; }
.Headlines .entry-content { flex: 1 1 auto; display: flex; flex-direction: column; gap: var(--spacerhalf); min-width: 0; }
.Headlines .entry-control { flex: 0 0 auto; }
`;

  constructor(props) {
    super(props);
    this.hub = true;
  }

  async render(element) {
    await super.render(element);
    const { context } = this.props;
    let items;
    try {
      items = await context.records.list('headline');
      items.sort((a, b) => String(a._created).localeCompare(String(b._created)));
    }
    catch (e) { this.element.innerHTML = failureNote(e, 'load headlines'); return; }

    const toolbar = this.div('toolbar');
    toolbar.innerHTML = '<h2>Headlines</h2>';
    if (context.canEdit) this.btnSave = await this.draw(Button, { title: 'Save', variant: 'primary', onClick: () => this.save() }, toolbar);

    this.contentList = this.div('content-list');
    if (!items.length && !context.canEdit) this.contentList.innerHTML = '<p class="empty">No headlines yet.</p>';
    for (const item of items) await this.draw(Entry, { data: item, editable: context.canEdit }, this.contentList);
    if (context.canEdit) await this.draw(NewEntry, { target: this.contentList }, this.element);
  }

  async save() {
    const upserts = [];
    const deletes = [];
    for (const el of this.contentList.children) {
      const entry = el._entry;
      if (!entry) continue;
      if (el.classList.contains('removed')) { if (entry.item.id) deletes.push(entry.item.id); }
      else if (el.classList.contains('modified')) upserts.push(entry.value);
    }
    if (!upserts.length && !deletes.length) return window.toast?.status('Nothing to save');
    try {
      const { records } = this.props.context;
      const now = new Date().toISOString();
      for (const id of deletes) await records.remove('headline', id);
      for (const u of upserts) {
        const text = String(u.text || '').trim();
        if (!text) continue;
        const prior = u.id ? await records.get('headline', u.id) : null;
        await records.put('headline', prior
          ? { ...prior, text, subtext: String(u.subtext || '').trim(), _modified: now }
          : { id: newId(6), text, subtext: String(u.subtext || '').trim(), _created: now });
      }
      window.toast?.success('Headlines saved');
      this.components = [];
      await this.render();
    } catch (e) { window.toast?.error('Save failed: ' + esc(e.message)); }
  }

  async handleUpdate(attributeName) {
    await super.handleUpdate(attributeName);
    this.btnSave?.element.classList.toggle('important', !!this.contentList?.querySelector('.modified'));
  }
}

class Entry extends Component {
  constructor(props) {
    super(props);
    this.item = props.data || {};
    this.original = { text: this.item.text || '', subtext: this.item.subtext || '' };
  }

  async render(element) {
    await super.render(element);
    this.element._entry = this;
    const body = this.div('entry-content');
    this.text = await this.draw(InputLongText, { name: 'text', title: 'Primary text', data: this.item, hideTitle: true }, body);
    this.subtext = await this.draw(InputLongText, { name: 'subtext', title: 'Secondary text', data: this.item, hideTitle: true }, body);
    if (!this.props.editable) { this.text.input.readOnly = true; this.subtext.input.readOnly = true; }
    this.control = this.div('entry-control');
    await this._renderState('active');
  }

  async _renderState(state) {
    this.control.innerHTML = '';
    this.element.classList.toggle('removed', state === 'removed');
    if (this.props.editable) {
      await this.draw(Button, state === 'active'
        ? { title: 'Remove', onClick: () => this.remove() }
        : { title: 'Restore', onClick: () => this.restore() }, this.control);
    }
    this._testModified();
  }

  async remove() {
    if (this.item.id) await this._renderState('removed');
    else this.element.remove();
    this.announceUpdate();
  }

  async restore() {
    await this._renderState('active');
    this.announceUpdate();
  }

  _testModified() {
    const modified = !this.item.id
      || this.text.value !== this.original.text
      || this.subtext.value !== this.original.subtext
      || this.element.classList.contains('removed');
    this.element.classList.toggle('modified', modified);
  }

  get value() {
    return { id: this.item.id || undefined, text: this.text.value, subtext: this.subtext.value };
  }

  async handleUpdate(attributeName) {
    if (attributeName === 'text' || attributeName === 'subtext') {
      this._testModified();
      await super.handleUpdate(attributeName);
    }
  }
}

class NewEntry extends Component {
  async render(element) {
    await super.render(element);
    const body = this.div('entry-content');
    this.input = await this.draw(InputTextArea, {
      name: 'new',
      title: 'Add headlines — one per line, an optional subtext after a /',
      rows: 4,
    }, body);
    const control = this.div('entry-control');
    await this.draw(Button, { title: 'Insert', onClick: () => this.insert() }, control);
  }

  async insert() {
    const lines = (this.input.value || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return this.input.input.focus();
    for (const line of lines) {
      const [text, subtext = ''] = line.split(/\s*\/\s*/, 2);
      if (!text) continue;
      const entry = await this.draw(Entry, { data: { text, subtext }, editable: true }, this.props.target);
      entry.element.classList.add('modified');
    }
    this.input.value = '';
    this.input.input.focus();
    this.announceUpdate();
  }
}
