// Key/value editor for querystring attributes (UTM parameters and the like).
// Adapted from blackfire-agent. Mutates props.data[props.name] = { … } in place.

import Component from '/lib/componentry.mjs';

export default class AttributesEditor extends Component {
  static css = `
.AttributesEditor { min-width: 0; }
.AttributesEditor .attr-table { border: 1px solid var(--page-border); border-radius: 8px; background: var(--bg-color); padding: var(--spacerhalf); margin-bottom: var(--spacerhalf); }
.AttributesEditor .attr-row { display: flex; gap: var(--spacerhalf); padding: var(--spacerhalf) 0; align-items: center; }
.AttributesEditor .attr-row input:nth-child(1) { flex: 1 1 0; }
.AttributesEditor .attr-row input:nth-child(2) { flex: 2 1 0; }
.AttributesEditor .attr-remove { background: transparent; border: 1px solid transparent; color: var(--text-muted); border-radius: 6px; cursor: pointer; padding: var(--spacerhalf) var(--spacer); }
.AttributesEditor .attr-remove:hover { color: var(--status-error); border-color: var(--status-error); }
.AttributesEditor .attr-empty { color: var(--text-muted); font-size: 0.85rem; padding: var(--spacerhalf); text-align: center; }
.AttributesEditor .attr-add-btn { background: transparent; border: 1px dashed var(--page-border); color: var(--primary); border-radius: 8px; padding: var(--spacerhalf) var(--spacer2); font: inherit; font-size: 0.85rem; cursor: pointer; }
.AttributesEditor .attr-add-btn:hover { border-color: var(--primary); }
`;

  constructor(props) {
    super(props);
    this.props.data[this.props.name] = this.props.data[this.props.name] || {};
    this._rows = Object.entries(this.props.data[this.props.name]).map(([name, value]) => ({ name, value }));
  }

  async render(element) {
    await super.render(element);
    if (!this.props.hideTitle) this.div('form-element-title').textContent = this.props.title || this.props.name;
    this.table = this.div('attr-table');
    this._renderRows();
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'attr-add-btn';
    add.textContent = '+ Add attribute';
    add.addEventListener('click', () => { this._rows.push({ name: '', value: '' }); this._renderRows(); this._commit(); });
    this.element.append(add);
  }

  _renderRows() {
    this.table.innerHTML = '';
    if (!this._rows.length) {
      this.div('attr-empty', this.table).textContent = 'No attributes';
      return;
    }
    this._rows.forEach((row, idx) => {
      const tr = this.div('attr-row', this.table);
      for (const field of ['name', 'value']) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = field;
        input.value = row[field];
        input.addEventListener('input', () => { row[field] = input.value; this._commit(); });
        tr.append(input);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'attr-remove';
      remove.title = 'Remove';
      remove.textContent = '✕';
      remove.addEventListener('click', () => { this._rows.splice(idx, 1); this._renderRows(); this._commit(); });
      tr.append(remove);
    });
  }

  _commit() {
    const obj = {};
    for (const r of this._rows) if (r.name?.trim()) obj[r.name.trim()] = r.value;
    this.props.data[this.props.name] = obj;
    this.announceUpdate(this.props.name);
  }

  get value() { return this.props.data[this.props.name]; }
}
