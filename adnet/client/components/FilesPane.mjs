// Art — this session's images, in the files plugin's own client.
//
// blackfire-agent linked out to a separate files agent. Here Files is composed
// INTO the session (the server mounts compose('files')), so its client is
// embedded the way the data room embeds its Docs: the plugin's own mount, handed
// a scoped ctx whose folder tree renders into a pane-local aside instead of the
// console's context panel (which holds the adnet menu). Upload creatives here;
// pick them in a campaign.

import Component from '/lib/componentry.mjs';
import { esc } from '../util.mjs';

export default class FilesPane extends Component {
  static css = `
.FilesPane { display: flex; gap: var(--spacer2); min-width: 0; min-height: 0; }
.FilesPane .files-nav { flex: 0 0 200px; min-width: 0; }
.FilesPane .files-main { flex: 1 1 auto; min-width: 0; }
@media (max-width: 720px) { .FilesPane { flex-direction: column; } .FilesPane .files-nav { flex: 0 0 auto; } }
`;

  async render(element) {
    await super.render(element);
    const { ctx } = this.props.context;
    const nav = this.div('files-nav');
    const main = this.div('files-main');
    try {
      const { mount } = await import('/plugins/files/client/mount.mjs');
      // The files mount owns its root's class, so it gets a child, not our element.
      const host = document.createElement('div');
      main.append(host);
      this._teardown = await mount(host, { ...ctx, ui: { ...ctx.ui, subnav: nav, setSubcrumb: () => {} } });
    } catch (e) {
      main.innerHTML = `<p class="empty">Could not open Files: ${esc(e.message)}</p>`;
    }
  }

  teardown() {
    if (typeof this._teardown === 'function') { try { this._teardown(); } catch { /* best-effort */ } }
  }
}
