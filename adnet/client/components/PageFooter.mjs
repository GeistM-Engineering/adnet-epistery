// Footer — copyright and this plugin's version, as the server reports it (read
// from its package.json there, never restated here). Adapted from blackfire-agent.

import Component from '/lib/componentry.mjs';

export default class PageFooter extends Component {
  static css = `
.PageFooter { display: flex; justify-content: space-between; gap: var(--spacer); font-size: 0.8em; color: var(--text-muted); }
`;

  async render(element) {
    await super.render(element);
    this.element.innerHTML = `<span>&copy; ${new Date().getFullYear()} GeistM Inc.</span><span class="version-label"></span>`;
    try {
      const s = await this.props.context.api('GET', '/version');
      if (s.version) this.element.querySelector('.version-label').textContent = `GeistM Adnet ${s.version}`;
    } catch { /* no version to show — say nothing rather than guess */ }
  }
}
