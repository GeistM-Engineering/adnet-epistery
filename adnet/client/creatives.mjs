// Creatives — how an image in this room becomes an ad any publisher can show.
//
// The images are the composed Files': ciphertext under K. An ad must render for
// strangers, and the factory takes a creative only as a URL. So deploying is a
// deliberate act of publication, per image, done HERE by the member who deploys:
// the image is opened with the room key on this device and the plaintext is
// uploaded once to the relay under the owner's contract — write-once, immutable.
// The URL is remembered (creative-<entryId>) so every campaign that uses the image
// names the same URL. The encrypted original stays where it was.


const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// A published creative is reusable only while the relay still serves its bytes.
// A pre-fix (sealed-only) creative the orphan sweep reclaimed will 404 here — we
// then re-publish instead of handing a dead URL to the factory.
async function stillServes(url) {
  try {
    const r = await fetch(url, { method: 'GET', cache: 'no-store' });
    try { r.body?.cancel?.(); } catch { /* ignore */ }
    return r.ok;
  } catch { return false; }
}

export async function creativeUrl(ctx, records, entry) {
  const known = await records.get('creative', entry.id);
  // Reuse the remembered URL only if it still serves. If it was reclaimed (a
  // pre-fix sealed-only creative the sweep deleted), fall through and re-publish —
  // this HEALS an already-broken campaign on a plain redeploy, writing the
  // cleartext `uploads` tag below so it is kept thereafter.
  if (known?.url && await stillServes(known.url)) return known.url;

  if (!IMAGE_MIMES.has(entry.mime)) throw new Error(`"${entry.name}" is ${entry.mime || 'untyped'}; a creative must be JPEG, PNG, GIF or WebP`);
  const r = await fetch(ctx.io.resolveRelayUrl?.(entry.url) || entry.url);
  if (!r.ok) throw new Error(`could not fetch "${entry.name}" (${r.status})`);
  const opened = await ctx.keys.openBlob(entry, await r.blob(), { mime: entry.mime });
  if (!opened.ok) throw new Error(`"${entry.name}": ${opened.message}`);
  const up = await ctx.io.uploadBlob(opened.blob);
  const url = new URL(up.url, location.origin).href;

  // Name the published URL in the clear (`uploads`) so the relay's orphan sweep keeps
  // the blob. A sealed-only reference is invisible to the sweep, which then reclaims the
  // creative ~24h after upload (the broken-image bug). The creative is public, so its
  // URL is not secret.
  await records.put('creative', { id: entry.id, url, name: entry.name, mime: entry.mime, publishedAt: new Date().toISOString() }, { uploads: [url] });
  return url;
}
