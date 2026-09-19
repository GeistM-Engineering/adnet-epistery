// Link picker — multi-select over this session's destination links. Adapted from
// blackfire-agent. At deploy the chosen links travel with the campaign and the
// factory resolves one at each click.

import Component from '/lib/componentry.mjs';
import { esc, failureNote } from '../util.mjs';

export default class LinkPicker extends Component {
  constructor(props) {
    super(props);
    this.props.data[this.props.name] = this.props.data[this.props.name] || [];
    this.selected = new Set(this.props.data[this.props.name]);
  }

  async render(element) {
    await super.render(element);
    if (!this.props.hideTitle) this.div('form-element-title').textContent = this.props.title || this.props.name;
    this.list = this.div('pick-list');
    this.list.innerHTML = '<p class="empty">Loading links…</p>';
    try {
      const links = await this.props.context.records.list('link');
      if (!links.length) {
        this.list.innerHTML = '<p class="empty">No links yet. Add some under <a data-go="links">Links</a>.</p>';
        return;
      }
      this.list.innerHTML = '';
      for (const l of links) {
        const row = document.createElement('div');
        row.className = 'pick-row';
        row.classList.toggle('selected', this.selected.has(l.id));
        row.innerHTML = `<div class="pick-main">${esc(l.name)}</div><div class="pick-sub mono">${esc(l.url)}</div>`;
        row.addEventListener('click', () => this._toggle(l.id, row));
        this.list.append(row);
      }
    } catch (e) { this.list.innerHTML = failureNote(e, 'load links'); }
  }

  _toggle(id, row) {
    if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
    row.classList.toggle('selected', this.selected.has(id));
    this.props.data[this.props.name] = [...this.selected];
    this.announceUpdate(this.props.name);
  }

  get value() { return [...this.selected]; }
}
