// The session's adnet records — read, sealed and written by THIS member's device.
//
// Each record is its own file, {id, epoch, iv, ciphertext}: sealed and opened
// through ctx.keys (@epistery/client-lib/sealed — the one mechanism every plugin
// uses), written rivet-signed straight to the relay (ctx.io.storage). The server
// only lists what is stored.
//
//   campaign-<id> · link-<id> · headline-<id> · creative-<files entry id> · site-<id>


export function newId(bytes = 6) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function recordsFor(ctx) {
  async function open(env) {
    const r = await ctx.keys.open(env);
    if (!r.ok) throw new Error(r.message);
    return { ...JSON.parse(r.text), id: env.id };
  }

  return {
    async list(kind) {
      const { records = [] } = await ctx.io.api('GET', `/records/${kind}`);
      const out = [];
      for (const env of records) {
        try { out.push(await open(env)); }
        catch (e) { console.warn(`[adnet] ${kind} ${env.id} unreadable: ${e.message}`); }
      }
      return out;
    },

    async get(kind, id) {
      const { record } = await ctx.io.api('GET', `/records/${kind}/${id}`);
      return record ? open(record) : null;
    },

    // `opts.uploads` (optional): cleartext /upload URLs this record references. They are
    // written UNSEALED beside the sealed body so the relay's orphan sweep — which counts
    // a blob as referenced only when its URL appears in a record's CLEARTEXT
    // (sealed-shape.mjs / sweepUploadOrphans) — does not reclaim it. A sealed-only
    // reference is invisible to the sweep and the blob is deleted ~24h after upload
    // (this is why published creatives vanished). The creative is public bytes, so
    // naming its URL in the clear leaks nothing — the same shape a files entry uses.
    async put(kind, record, { uploads } = {}) {
      if (!ctx.keys.ready) throw new Error("This device doesn't hold this session's key yet.");
      const { id, ...body } = record;
      const sealed = await ctx.keys.seal(JSON.stringify(body));   // { epoch, iv, ciphertext }
      const envelope = { id, ...sealed };
      if (Array.isArray(uploads) && uploads.length) envelope.uploads = uploads;
      await ctx.io.storage.writeJSON(`${kind}-${id}.json`, envelope);
      return record;
    },

    async remove(kind, id) {
      await ctx.io.storage.remove(`${kind}-${id}.json`);
    },
  };
}
