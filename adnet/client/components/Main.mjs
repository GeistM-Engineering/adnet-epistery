// Adnet app shell — a page menu and the page. Ported from blackfire-agent's Main.
//
// Routing is in memory, not in location.hash: the console owns the hash
// (#/s/<owner>/<id> is this session; changing it remounts the view). The
// current path lives in `context.path` ("/campaigns/<id>"); pages move with
// context.go('campaigns/<id>'), and any element with data-go="…" is a link.
//
// The menu goes into the console's context panel when the shell offers one
// (ctx.ui.subnav — where a session's own navigation lives), inline otherwise.

import Component from '/lib/componentry.mjs';
import PageMenu from './PageMenu.mjs';
import PageFooter from './PageFooter.mjs';
import Status from './Status.mjs';
import Campaigns from './Campaigns.mjs';
import Headlines from './Headlines.mjs';
import Links from './Links.mjs';
import FilesPane from './FilesPane.mjs';
import Settings from './Settings.mjs';
import Publishing from './Publishing.mjs';
import Monitor from './Monitor.mjs';
import { recordsFor } from '../records.mjs';
import { factoryFor } from '../factory.mjs';

const PAGES = {
  status: { title: 'Status', glyph: '◎', component: Status },
  campaigns: { title: 'Campaigns', glyph: '▤', component: Campaigns },
  headlines: { title: 'Headlines', glyph: '❝', component: Headlines },
  links: { title: 'Links', glyph: '↗', component: Links },
  files: { title: 'Art', glyph: '▣', component: FilesPane },
  publishing: { title: 'Publishing', glyph: '◈', component: Publishing },
  monitor: { title: 'Monitor', glyph: '◉', component: Monitor },
};
const DEFAULT_KEY = 'status';

// Settings is NOT one of the pages. Who may read, write and administer this
// session is the session's own member list, and it has exactly one home: the
// console's settings modal (Members, Discovery, Bot access, Danger). Adnet
// drawing its configuration as a page of its own left that modal unreachable
// from here, so there was nowhere to declare a member. The entry now opens the
// shell's modal and hands it the adnet configuration as one tab — the same
// `ctx.ui.openSettings` call files, wiki, chatbot and message-board make. Adnet
// must never grow a member list of its own; there would then be two.
const SETTINGS_KEY = 'settings';

export default class Main extends Component {
  static css = `
.Main { display: flex; flex-direction: column; gap: var(--spacer2); min-width: 0; min-height: 0; padding: var(--spacer2); }
.Main .adnet-row { display: flex; gap: var(--spacer2); min-width: 0; min-height: 0; flex: 1 1 auto; }
.Main .adnet-nav { flex: 0 0 auto; }
.Main .adnet-body { flex: 1 1 auto; min-width: 0; }
@media (max-width: 720px) { .Main .adnet-row { flex-direction: column; } }
`;

  constructor(props) {
    super(props);
    this.hub = true;
    const ctx = props.ctx;
    const role = ctx.me?.role;
    this.context = {
      ctx,
      path: `/${DEFAULT_KEY}`,
      api: ctx.io.api,
      records: recordsFor(ctx),
      // Read per use: an admin may change the factory in Settings while mounted.
      get factory() { return factoryFor(ctx); },
      canEdit: role === 'edit' || role === 'admin',
      isAdmin: role === 'admin',
      go: (p) => this.go(p),
      refresh: () => this.go(this.context.path.slice(1)),
    };
  }

  _activeKey() {
    const key = this.context.path.split('/')[1];
    return PAGES[key] ? key : DEFAULT_KEY;
  }

  async render(element) {
    await super.render(element);
    const row = this.div('adnet-row');
    const subnav = this.props.ctx.ui?.subnav || null;
    const navHost = subnav || this.div('adnet-nav', row);
    if (subnav) subnav.innerHTML = '';

    const items = Object.entries(PAGES).map(([key, p]) => ({ key, title: p.title, glyph: p.glyph }));
    // Shown to everyone, like the gear in every other plugin: the SHELL decides
    // what is inside (Members, Bot access and Danger are its own admin gate, the
    // declaration is readable by anyone). Gating the entry here instead would
    // hide the modal from a member who has every right to read it, and would
    // hide it outright from an admin whose role resolved late or wrong — which is
    // how this came to look like a missing button in the first place.
    items.push({ key: SETTINGS_KEY, title: 'Settings', glyph: '⚙' });
    this.menu = await this.draw(PageMenu, {
      items,
      activeKey: this._activeKey(),
      onSelect: (k) => (k === SETTINGS_KEY ? this.openSettings() : this.go(k)),
    }, navHost);

    this.body = this.div('adnet-body', row);
    // Any [data-go] inside the app is an in-app link.
    this.element.addEventListener('click', (e) => {
      const el = e.target.closest?.('[data-go]');
      if (!el || !this.element.contains(el)) return;
      e.preventDefault();
      this.go(el.dataset.go);
    });
    await this._renderActive();
//    await this.draw(PageFooter, { context: this.context }, this.element);
  }

  // The session's settings, framed by the shell. The adnet configuration goes in
  // as the modal's plugin tab; Members and the rest are the shell's own.
  //
  // The node is built outside our root, so it carries `plugin-adnet` itself —
  // adnet.css is injected document-wide (mount.mjs) and every rule in it is
  // scoped to that class, so without it the panel would render unstyled in the
  // popup.
  async openSettings() {
    // A modal is not a place: the menu goes on pointing at the page underneath.
    this.menu?.setActive(this._activeKey());
    this.settingsPanel?.teardown?.();
    this.components = this.components.filter((c) => c !== this.settingsPanel);
    this.settingsPanel = null;
    // The adnet configuration is a steward's write (ctx.ui.saveParams, signed by
    // this device), so a non-admin gets the shell's tabs without it rather than a
    // Save that can only fail.
    let host = null;
    if (this.context.isAdmin) {
      host = document.createElement('div');
      host.className = 'plugin-adnet';
      this.settingsPanel = this.new(Settings, { context: this.context });
      await this.settingsPanel.render(host);
    }
    this.props.ctx.ui?.openSettings?.(host ? { content: host } : {});
  }

  async go(path) {
    this.context.path = '/' + String(path || DEFAULT_KEY).replace(/^[#/]+/, '');
    await this._renderActive();
  }

  async _renderActive() {
    const key = this._activeKey();
    this.menu?.setActive(key);
    if (!this.body) return;
    this.page?.teardown?.();
    this.components = this.components.filter((c) => c !== this.page);
    this.body.innerHTML = '';
    this.page = this.new(PAGES[key].component, { context: this.context });
    await this.page.render(this.body);
  }

  teardown() {
    this.page?.teardown?.();
    this.settingsPanel?.teardown?.();
    const subnav = this.props.ctx.ui?.subnav;
    if (subnav && this.menu?.element && subnav.contains(this.menu.element)) this.menu.element.remove();
  }
}
