// GeistM Adnet for Epistery — the Adnet campaign builder as a console session kind.
//
// Ported from the epistery-host agent blackfire-agent. What changed is who the
// advertiser is. On a host it was the domain and its wallet; here it is the
// session's OWNER IDENTITY — a contract. It is each campaign's advertiser: the
// campaign is staked from the identity's treasury and a withdrawal returns there.
// A contract cannot sign; its signers can. So everything that speaks or pays for
// the advertiser happens in a signer's browser, on that signer's signature.
//
// THIS SERVER IS NOT IN THAT PATH. It holds no key, no wallet and no money. Like
// every plugin's browser-path facade, it is read-only: members write their own
// records rivet-signed straight to the relay, sealed under the session key K on
// their own device. What is left for the server is to list what is stored, and to
// serve the images through the composed files plugin.
//
//   campaign-<id>.json   a campaign — draft, or deployed with its contract address
//   link-<id>.json       a destination link
//   headline-<id>.json   a headline
//   creative-<id>.json   the public URL an image was published at (id = its files entry)
//   entry-<id>.json      an image — compose('files'), the files plugin verbatim
//   site-<id>.json       a site the session follows on the Monitor page ({domain})
//
// Every record is {id, epoch, iv, ciphertext}. There is no plaintext branch.
//
// An MCP agent that is a member writes through its own per-signer facade: the
// POST below seals nothing itself — mcpWriteTransform hands it the record already
// encrypted under the agent's K — and on the browser path the facade refuses the
// write by construction.

import express from 'express';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

// This plugin's version, from its manifest — never restated as a literal.
const { version: VERSION } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const KINDS = new Set(['campaign', 'link', 'headline', 'creative', 'site']);
const ID_RE = /^[0-9a-f]{8,48}$/;
const fileOf = (kind, id) => `${kind}-${id}.json`;

export const manifest = {
  kind: 'adnet',
  title: 'GeistM Adnet',
  // One sentence, for the create page: what this kind is FOR.
  blurb: `Advertise on the GeistM Adnet. Build campaigns from your own images,
    headlines and links; each deploys as its own contract, staked from your
    identity's treasury and paid out to the publishers who carry it.`,
  icon: 'icon.svg',
  client: 'client/mount.mjs',
  // The campaign images are the files plugin verbatim (buildRouter's
  // compose('files')). Declared here so the registry mounts it and the files
  // tools are named alongside adnet's own.
  composes: ['files'],
  // No serverAuthor: nobody writes here but the members themselves.
  paramsSchema: {
    adnetBaseUrl: { type: 'string', required: false },   // the Agency campaigns deploy through
    imageFolder: { type: 'string', required: false },    // the Files folder the image picker shows
  },
};

export function buildRouter({ storage, compose }) {
  const router = express.Router();

  router.get('/version', (req, res) => res.json({ kind: 'adnet', version: VERSION }));

  // The sealed records of one kind, as stored. The reader opens them with its own K.
  router.get('/records/:kind', async (req, res) => {
    const { kind } = req.params;
    if (!KINDS.has(kind)) return res.status(404).json({ error: `no record kind "${kind}"` });
    try {
      const re = new RegExp(`^${kind}-[0-9a-f]+\\.json$`);
      const items = (await storage.list()).filter((i) => re.test(i.path));
      const records = [];
      for (const item of items) {
        const rec = await storage.readJSON(item.path, null);
        if (rec) records.push(rec);
      }
      res.json({ records });
    } catch (e) {
      res.status(502).json({ error: 'could not read records: ' + e.message });
    }
  });

  router.get('/records/:kind/:id', async (req, res) => {
    const { kind, id } = req.params;
    if (!KINDS.has(kind) || !ID_RE.test(id)) return res.status(404).json({ error: 'no such record' });
    try {
      res.json({ record: await storage.readJSON(fileOf(kind, id), null) });
    } catch (e) {
      res.status(502).json({ error: 'could not read the record: ' + e.message });
    }
  });

  // An agent's write (MCP). The body is already sealed; plaintext is refused.
  router.post('/records/:kind', async (req, res) => {
    const { kind } = req.params;
    const { iv, ciphertext, epoch } = req.body || {};
    if (!KINDS.has(kind) || kind === 'creative') return res.status(404).json({ error: `cannot create a "${kind}" here` });
    if (typeof iv !== 'string' || typeof ciphertext !== 'string') {
      return res.status(400).json({ error: 'records are sealed under the session key; plaintext refused' });
    }
    const id = crypto.randomBytes(kind === 'campaign' ? 8 : 6).toString('hex');
    try {
      // The key epoch rides with the ciphertext; the relay refuses session content without it.
      await storage.writeJSON(fileOf(kind, id), { id, epoch, iv, ciphertext });
      res.json({ id });
    } catch (e) {
      res.status(403).json({ error: e.message });
    }
  });

  // Images: the files plugin, composed by kind — /entries… at the root.
  router.use(compose('files'));

  return router;
}

// Seal an MCP agent's record before it reaches the router — the same record shape
// a member's browser writes. `encrypt` is the MCP layer's, under the agent's own K.
const MCP_FIELDS = {
  create_campaign: ['name', 'status', 'budget', 'pacing', 'settlementRule', 'attributes', 'images', 'headlines', 'links'],
  create_link: ['name', 'url', 'attributes'],
  create_headline: ['text', 'subtext'],
};

export async function mcpWriteTransform(toolName, args, { encrypt }) {
  const fields = MCP_FIELDS[toolName];
  if (!fields) return args;
  const record = { _created: new Date().toISOString() };
  for (const f of fields) if (args[f] !== undefined) record[f] = args[f];
  if (toolName === 'create_campaign') {
    // The name rides in every deployed link, so it must round-trip unencoded.
    if (!/^[A-Za-z0-9._~-]+$/.test(String(record.name || ''))) {
      throw new Error('name must be URL-safe (letters, digits, . _ ~ -)');
    }
    record.status = record.status || 'ACTIVE';
    record.settlementRule = record.settlementRule || 'open';
    record.images = record.images || [];
    record.headlines = record.headlines || [];
    record.links = record.links || [];
  }
  return encrypt(JSON.stringify(record));
}
