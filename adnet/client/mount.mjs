// GeistM Adnet — client mount. Draws Main (the ported blackfire app shell) into
// the root the shell hands us. Everything the app does, it does from here: the
// records are sealed and written by this device, the factory is called by this
// device, and every payment is signed by this device's rivet.

async function injectStyles() {
  if (document.getElementById('adnet-plugin-styles')) return;
  try {
    const r = await fetch('/plugins/adnet/client/adnet.css', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const css = await r.text();
    const s = document.createElement('style');
    s.id = 'adnet-plugin-styles';
    s.textContent = css;
    document.head.appendChild(s);
  } catch (e) { console.warn('[adnet] stylesheet load failed', e); }
}

export async function mount(rootEl, ctx) {
  rootEl.innerHTML = '';
  rootEl.className = 'plugin-adnet';
  await injectStyles();
  const { default: Main } = await import('/plugins/adnet/client/components/Main.mjs');
  const main = new Main({ ctx });
  await main.render(rootEl);
  return () => main.teardown();
}
