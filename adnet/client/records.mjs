// The session's adnet records — read, sealed and written by THIS member's device.
//
// Each record is its own file, {id, epoch, iv, ciphertext}: sealed under the
// session key K here, written rivet-signed straight to the relay
// (ctx.io.storage), opened here with the key of the epoch that sealed it. The
// server only lists what is stored.
//
//   campaign-<id> · link-<id> · headline-<id> · creative-<files entry id>

import * as cipher from '/lib/cipher.mjs';

export function newId(bytes = 6) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function recordsFor(ctx) {
  const keyFor = (epoch) => (ctx.keys?.keyFor ? ctx.keys.keyFor(epoch) : ctx.keys?.K) || null;

  async function open(env) {
    const K = keyFor(env.epoch);
    if (!K) throw new Error('this device holds no key for that record');
    return { ...JSON.parse(await cipher.decryptText(K, env)), id: env.id };
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
      const K = ctx.keys?.K;
      if (!K) throw new Error("This device doesn't hold this session's key yet.");
      const { id, ...body } = record;
      const sealed = await cipher.encryptText(K, JSON.stringify(body));
      const epoch = ctx.keys.epoch;
      await ctx.io.storage.writeJSON(`${kind}-${id}.json`, epoch === undefined ? { id, ...sealed } : { id, epoch, ...sealed });
      return record;
    },

    async remove(kind, id) {
      await ctx.io.storage.remove(`${kind}-${id}.json`);
    },
  };
}
