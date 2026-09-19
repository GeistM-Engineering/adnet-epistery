// InputSelect — adapted from @metric-im/common-mixin's InputSelect, on the
// console's componentry base. Options are strings or {name, value}.
//
// props: { name, title, options, data, hideTitle }

import Component from '/lib/componentry.mjs';

export class InputSelect extends Component {
  static css = `
.InputSelect { display: flex; flex-direction: column; min-width: 0; }
.InputSelect select { width: 100%; }
`;

  constructor(props) {
    super(props);
    this.options = (this.props.options || []).map((o) => (typeof o === 'string' ? { name: o, value: o } : o));
  }

  async render(element) {
    await super.render(element);
    if (!this.props.hideTitle) {
      this.title = this.div('form-element-title');
      this.title.textContent = this.props.title || this.props.name;
    }
    this.input = document.createElement('select');
    for (const [i, o] of this.options.entries()) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = o.name;
      opt.selected = o.value === this.props.data[this.props.name];
      this.input.append(opt);
    }
    this.element.append(this.input);
    const current = this.props.data[this.props.name];
    if ((current === undefined || current === null || current === '') && this.options.length) {
      this.props.data[this.props.name] = this.value;
    }
    this.input.addEventListener('change', async () => {
      this.props.data[this.props.name] = this.value;
      await this.announceUpdate(this.props.name);
    });
  }

  async handleUpdate(attributeName) {
    await super.handleUpdate(attributeName);
    if (this.props.name === attributeName && this.input) this.value = this.props.data[this.props.name];
  }

  get value() { return this.options[this.input.value]?.value ?? null; }
  set value(v) {
    const i = this.options.findIndex((o) => o.value === v);
    if (i >= 0) this.input.value = String(i);
  }
}
