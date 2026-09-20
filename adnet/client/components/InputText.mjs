// Text inputs — adapted from @metric-im/common-mixin's InputText family, on the
// console's componentry base. Each binds to props.data[props.name] and announces
// changes to its hub.
//
// props: { name, title, placeholder, data, hideTitle }

import Component from '/lib/componentry.mjs';

export class InputText extends Component {
  static css = `
.InputText { display: flex; flex-direction: column; min-width: 0; }
.InputText input { width: 100%; }
`;

  async render(element) {
    await super.render(element);
    this.element.classList.add('InputText');   // subclasses share the layout
    if (!this.props.hideTitle) {
      this.title = this.div('form-element-title');
      this.title.textContent = this.props.title || this.props.name;
    }
    this.input = document.createElement('input');
    this.input.placeholder = this.props.placeholder || `Enter ${this.props.title || this.props.name}`;
    this.input.value = this.props.data[this.props.name] ?? '';
    this.element.append(this.input);
    this.input.addEventListener('input', async () => {
      this.props.data[this.props.name] = this.value;
      await this.announceUpdate(this.props.name);
    });
  }

  async handleUpdate(attributeName) {
    await super.handleUpdate(attributeName);
    if (this.props.name === attributeName && this.input) this.value = this.props.data[this.props.name] ?? '';
  }

  get value() { return this.input.value; }
  set value(v) { this.input.value = v; }
}

export class InputLongText extends InputText {}

export class InputUrl extends InputText {
  async render(element) {
    await super.render(element);
    this.input.type = 'url';
  }
}

export class InputNumber extends InputText {
  async render(element) {
    await super.render(element);
    this.input.type = 'number';
    if (this.props.step) this.input.step = this.props.step;
  }

  // An empty box is "no value" (null), not zero — pacing depends on the difference.
  get value() { return this.input.value === '' ? null : Number(this.input.value); }
  set value(v) { this.input.value = v ?? ''; }

  // A number box must not be rewritten from its own announcement. A number input
  // reports `.value` as '' while its text is an incomplete number, so half way
  // through typing 0.5 — at "0." — this reads null, and writing null back assigns
  // '', which replaces the text the user typed. The point is erased on every
  // attempt, so 0.5 can never be reached (the wheel works: its values are always
  // whole). Only rewrite when the box says a DIFFERENT number than the data —
  // which leaves a partial entry alone, keeps a trailing zero, and still takes
  // changes from elsewhere.
  async handleUpdate(attributeName) {
    if (this.props.name === attributeName && this.input
      && Number(this.input.value) === Number(this.props.data[this.props.name])) {
      return Component.prototype.handleUpdate.call(this, attributeName);
    }
    await super.handleUpdate(attributeName);
  }
}

export class InputTextArea extends InputText {
  static css = `
.InputTextArea { display: flex; flex-direction: column; min-width: 0; }
.InputTextArea textarea { width: 100%; resize: vertical; }
`;

  async render(element) {
    await Component.prototype.render.call(this, element);
    if (!this.props.hideTitle) {
      this.title = this.div('form-element-title');
      this.title.textContent = this.props.title || this.props.name;
    }
    this.input = document.createElement('textarea');
    this.input.rows = this.props.rows || 6;
    if (this.props.placeholder) this.input.placeholder = this.props.placeholder;
    this.element.append(this.input);
  }
}
