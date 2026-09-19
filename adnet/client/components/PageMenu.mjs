// The adnet page menu — adapted from blackfire-agent's PageMenu (itself from
// pro-console). Vertical, one entry per page.
//
// props: { items: [{key, title, glyph}], activeKey, onSelect(key) }

import Component from '/lib/componentry.mjs';
import { esc } from '../util.mjs';

export default class PageMenu extends Component {
  static css = `
.PageMenu { display: flex; flex-direction: column; gap: var(--spacerhalf); padding: var(--spacerhalf) 0; min-width: 0; }
.PageMenu .nav-button {
  display: flex;
  align-items: center;
  gap: var(--spacer);
  padding: var(--spacerhalf) var(--spacer);
  border-radius: 8px;
  border: 1px solid transparent;
  color: var(--text-color);
  cursor: pointer;
  user-select: none;
}
.PageMenu .nav-button:hover { background: var(--tray-bg); }
.PageMenu .nav-button.selected { background: var(--page-action); border-color: var(--page-border); color: var(--primary); font-weight: 600; }
.PageMenu .glyph { width: 1.2em; text-align: center; color: var(--text-muted); }
.PageMenu .nav-button.selected .glyph { color: var(--primary); }
@media (max-width: 720px) { .PageMenu { flex-direction: row; flex-wrap: wrap; } }
`;

  async render(element) {
    await super.render(element);
    this.buttons = {};
    for (const item of this.props.items) {
      const btn = this.div('nav-button');
      btn.dataset.key = item.key;
      btn.innerHTML = `<span class="glyph" aria-hidden="true">${esc(item.glyph || '')}</span><span class="text">${esc(item.title)}</span>`;
      btn.addEventListener('click', () => this.props.onSelect?.(item.key));
      this.buttons[item.key] = btn;
    }
    this.setActive(this.props.activeKey);
  }

  setActive(key) {
    for (const [k, b] of Object.entries(this.buttons || {})) b.classList.toggle('selected', k === key);
  }
}
