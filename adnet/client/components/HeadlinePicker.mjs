// Headline picker — multi-select over this session's headlines. Adapted from
// blackfire-agent. Writes the selected ids into props.data[props.name].

import Component from '/lib/componentry.mjs';
import { esc, failureNote } from '../util.mjs';

export default class HeadlinePicker extends Component {
  constructor(props) {
    super(props);
    this.props.data[this.props.name] = this.props.data[this.props.name] || [];
    this.selected = new Set(this.props.data[this.props.name]);
  }

  async render(element) {
    await super.render(element);
    if (!this.props.hideTitle) this.div('form-element-title').textContent = this.props.title || this.props.name;
    this.list = this.div('pick-list');
    this.list.innerHTML = '<p class="empty">Loading headlines…</p>';
    try {
      const headlines = await this.props.context.records.list('headline');
      if (!headlines.length) {
        this.list.innerHTML = '<p class="empty">No headlines yet. Add some under <a data-go="headlines">Headlines</a>.</p>';
        return;
      }
      this.list.innerHTML = '';
      for (const h of headlines) {
        const row = document.createElement('div');
        row.className = 'pick-row';
        row.classList.toggle('selected', this.selected.has(h.id));
        row.innerHTML = `<div class="pick-main">${esc(h.text)}</div>${h.subtext ? `<div class="pick-sub">${esc(h.subtext)}</div>` : ''}`;
        row.addEventListener('click', () => this._toggle(h.id, row));
        this.list.append(row);
      }
    } catch (e) { this.list.innerHTML = failureNote(e, 'load headlines'); }
  }

  _toggle(id, row) {
    if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
    row.classList.toggle('selected', this.selected.has(id));
    this.props.data[this.props.name] = [...this.selected];
    this.announceUpdate(this.props.name);
  }

  get value() { return [...this.selected]; }
}
