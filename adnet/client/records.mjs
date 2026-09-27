// The session's adnet records — read, sealed and written by THIS member's device.
//
// Each record is its own file, {id, epoch, iv, ciphertext}: sealed and opened
// through ctx.keys (@epistery/client-lib/sealed — the one mechanism every plugin
// uses), written rivet-signed straight to the relay (ctx.io.storage). The server
// only lists what is stored.
//
//   campaign-<id> · link-<id> · headline-<id> · creative-<files entry id>


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

    async put(kind, record) {
      if (!ctx.keys.ready) throw new Error("This device doesn't hold this session's key yet.");
      const { id, ...body } = record;
      const sealed = await ctx.keys.seal(JSON.stringify(body));   // { epoch, iv, ciphertext }
      await ctx.io.storage.writeJSON(`${kind}-${id}.json`, { id, ...sealed });
      return record;
    },

    async remove(kind, id) {
      await ctx.io.storage.remove(`${kind}-${id}.json`);
    },
  };
}
