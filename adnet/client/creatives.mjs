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

export async function creativeUrl(ctx, records, entry) {
  const known = await records.get('creative', entry.id);
  if (known?.url) return known.url;

  if (!IMAGE_MIMES.has(entry.mime)) throw new Error(`"${entry.name}" is ${entry.mime || 'untyped'}; a creative must be JPEG, PNG, GIF or WebP`);
  const r = await fetch(ctx.io.resolveRelayUrl?.(entry.url) || entry.url);
  if (!r.ok) throw new Error(`could not fetch "${entry.name}" (${r.status})`);
  const opened = await ctx.keys.openBlob(entry, await r.blob(), { mime: entry.mime });
  if (!opened.ok) throw new Error(`"${entry.name}": ${opened.message}`);
  const up = await ctx.io.uploadBlob(opened.blob);
  const url = new URL(up.url, location.origin).href;

  await records.put('creative', { id: entry.id, url, name: entry.name, mime: entry.mime, publishedAt: new Date().toISOString() });
  return url;
}
