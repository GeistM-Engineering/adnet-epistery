// Image picker — a multi-select grid over this session's own images (the
// composed Files). Adapted from blackfire-agent's ImagePicker, which reached into
// a separate files agent; here the images are in the room.
//
// The images are ciphertext. Thumbnails are fetched and opened HERE with the room
// key, shown as object URLs, and released when the picker goes away. Nothing is
// public until a campaign that names an image deploys.
//
// Shows every image in Files, or one folder when Settings names one.
// Writes the selected entry ids into props.data[props.name].

import Component from '/lib/componentry.mjs';
import { esc, failureNote } from '../util.mjs';

export default class ImagePicker extends Component {
  static css = `
.ImagePicker { min-width: 0; }
.ImagePicker .image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer);
  max-height: 380px;
  overflow-y: auto;
  padding: var(--spacer);
  border: 1px solid var(--page-border);
  border-radius: 8px;
  background: var(--bg-color);
}
.ImagePicker .image-tile {
  flex: 0 0 140px;
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
}
.ImagePicker .image-tile:hover { border-color: var(--page-border); }
.ImagePicker .image-tile.selected { border-color: var(--primary); }
.ImagePicker .image-tile .thumb { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: var(--steel-100); }
.ImagePicker .image-name { font-size: 0.75rem; padding: var(--spacerhalf); background: var(--steel-50); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ImagePicker .image-check {
  position: absolute;
  top: var(--spacerhalf);
  right: var(--spacerhalf);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-color);
  border: 1px solid var(--page-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--primary-contrast);
}
.ImagePicker .image-tile.selected .image-check { background: var(--primary); border-color: var(--primary); }
.ImagePicker .image-tile.selected .image-check::after { content: "✓"; }
.ImagePicker .image-grid .empty { flex: 1 1 100%; }
`;

  constructor(props) {
    super(props);
    this.props.data[this.props.name] = this.props.data[this.props.name] || [];
    this.selected = new Set(this.props.data[this.props.name]);
    this.urls = [];
  }

  async render(element) {
    await super.render(element);
    if (!this.props.hideTitle) this.div('form-element-title').textContent = this.props.title || this.props.name;
    this.grid = this.div('image-grid');
    this.grid.innerHTML = '<p class="empty">Loading images…</p>';
    await this._load();
  }

  async _load() {
    const { context } = this.props;
    const folder = context.ctx.session.params?.imageFolder || '';
    let entries;
    try { ({ entries = [] } = await context.api('GET', '/entries')); }
    catch (e) { this.grid.innerHTML = failureNote(e, 'list images'); return; }
    const images = entries.filter((e) => e.type === 'file' && (e.mime || '').startsWith('image/') && (!folder || e.parent === folder));
    if (!images.length) {
      this.grid.innerHTML = `<p class="empty">No images${folder ? ' in the chosen folder' : ''} yet. Upload some under <a data-go="files">Art</a>.</p>`;
      return;
    }
    this.grid.innerHTML = '';
    for (const entry of images) this._tile(entry);
  }

  _tile(entry) {
    const tile = document.createElement('div');
    tile.className = 'image-tile';
    tile.classList.toggle('selected', this.selected.has(entry.id));
    tile.innerHTML = `<img class="thumb" alt="${esc(entry.name)}"><div class="image-name">${esc(entry.name)}</div><div class="image-check"></div>`;
    tile.addEventListener('click', () => this._toggle(entry.id, tile));
    this.grid.append(tile);
    this._thumb(entry, tile.querySelector('.thumb'));
  }

  // Open the image with the key of the epoch that sealed it.
  async _thumb(entry, img) {
    const { ctx } = this.props.context;
    if (!ctx.keys.ready || !entry.url || !entry.iv) return;
    try {
      const r = await fetch(ctx.io.resolveRelayUrl?.(entry.url) || entry.url);
      if (!r.ok) return;
      const opened = await ctx.keys.openBlob(entry, await r.blob(), { mime: entry.mime });
      if (!opened.ok) { console.warn(`[adnet] thumbnail ${entry.name}: ${opened.message}`); return; }
      const url = URL.createObjectURL(opened.blob);
      this.urls.push(url);
      img.src = url;
    } catch (e) { console.warn('[adnet] thumbnail failed:', e.message); }
  }

  _toggle(id, tile) {
    if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
    tile.classList.toggle('selected', this.selected.has(id));
    this.props.data[this.props.name] = [...this.selected];
    this.announceUpdate(this.props.name);
  }

  get value() { return [...this.selected]; }

  teardown() {
    for (const u of this.urls) URL.revokeObjectURL(u);
    this.urls = [];
  }
}
