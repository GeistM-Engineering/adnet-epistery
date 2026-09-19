// Button — adapted from @metric-im/common-mixin's Button, on the console's
// componentry base. Text only: the host has no icon font, and a label says more.
//
// props: { title, onClick, disabled, variant: 'primary' | 'danger' | undefined }

import Component from '/lib/componentry.mjs';

export class Button extends Component {
  static css = `
.Button { display: inline-flex; }
.Button button {
  border: 1px solid var(--page-border);
  background: var(--bg-color);
  color: var(--text-color);
  border-radius: 8px;
  padding: var(--spacerhalf) var(--spacer2);
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.Button button:hover { border-color: var(--primary-mid); }
.Button button:disabled { opacity: 0.5; cursor: default; }
.Button.primary button { background: var(--primary); border-color: var(--primary); color: var(--primary-contrast); }
.Button.danger button { color: var(--status-error); }
.Button.danger button:hover { border-color: var(--status-error); }
.Button.important button { box-shadow: 0 0 0 2px var(--page-action); border-color: var(--primary-mid); }
`;

  async render(element) {
    await super.render(element);
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.textContent = this.props.title || '';
    this.button.disabled = this.props.disabled ?? false;
    this.button.addEventListener('click', (e) => this.props.onClick?.(e));
    if (this.props.variant) this.element.classList.add(this.props.variant);
    this.element.append(this.button);
  }
}
