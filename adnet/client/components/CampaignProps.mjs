// One campaign — create, edit, deploy, stake, operate. Adapted from
// blackfire-agent's CampaignProps.
//   id === 'new': the name is editable; Create writes the record and moves to it.
//   otherwise:    the name is fixed; Save rewrites the draft.
// Deployed campaigns lock the form — their terms are on the contract.
//
// Everything happens on this device. The record is sealed and written here; the
// factory is called from here; every act that speaks or pays for the advertiser
// (this session's identity) is signed here by this device's rivet:
//   Deploy / Enable / Disable / Settle — a fresh signature for the factory call.
//   Stake / Add budget / Withdraw — this signer's own transaction through the
//     identity's treasury: the identity pays the stake, the device pays the gas.
// The contract is the truth; the record keeps what this device did, with the
// transaction hash for anyone to check.

import Component from '/lib/componentry.mjs';
import { InputText, InputNumber } from './InputText.mjs';
import { InputSelect } from './InputSelect.mjs';
import { Button } from './Button.mjs';
import AttributesEditor from './AttributesEditor.mjs';
import ImagePicker from './ImagePicker.mjs';
import HeadlinePicker from './HeadlinePicker.mjs';
import LinkPicker from './LinkPicker.mjs';
import CampaignReport from './CampaignReport.mjs';
import { esc, shortAddr, weiToPol, polToWei, fmtPol, polUsd } from '../util.mjs';
import { newId } from '../records.mjs';
import { mintShortCode } from './Links.mjs';
import { creativeUrl } from '../creatives.mjs';
import { factoryAuth, payFromTreasury, withdrawBudget, canPay, treasury, signerAddress, explorer } from '../signer.mjs';

const STATUS_OPTIONS = ['ACTIVE', 'PAUSED', 'INACTIVE'];
// The payment rule the Agency enforces at settlement, baked onto the contract at
// deploy. `whitelisted` is not offered yet: without a publisher list (and an
// updatable on-chain one) it would deploy a campaign that denies everyone.
const SETTLEMENT_RULES = ['open', 'confirmedDomain'];
const NAME_RE = /^[A-Za-z0-9._~-]+$/;
const eqAddr = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

export default class CampaignProps extends Component {
  static css = `
.CampaignProps { display: flex; flex-direction: column; gap: var(--spacer2); min-width: 0; }
.CampaignProps .detail-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--spacer); flex-wrap: wrap; }
.CampaignProps .detail-title { flex: 1 1 280px; min-width: 0; }
.CampaignProps .campaign-name { font-size: 1.5rem; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; margin-bottom: var(--spacerhalf); }
.CampaignProps .name-field { display: flex; flex-direction: column; gap: var(--spacerhalf); max-width: 520px; }
.CampaignProps .name-hint { color: var(--text-muted); font-size: 0.8rem; }
.CampaignProps .detail-meta { display: flex; gap: var(--spacer); flex-wrap: wrap; align-items: center; color: var(--text-muted); font-size: 0.8rem; }
.CampaignProps .detail-controls { display: flex; gap: var(--spacerhalf); flex-wrap: wrap; }
.CampaignProps .section { display: flex; flex-direction: column; gap: var(--spacerhalf); min-width: 0; }
.CampaignProps .section-title { color: var(--text-muted); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.CampaignProps .section-panel { border: 1px solid var(--page-border); border-radius: 8px; background: var(--bg-color); padding: var(--spacer2); min-width: 0; }
.CampaignProps .options-row { display: flex; flex-wrap: wrap; gap: var(--spacer2); align-items: flex-end; }
.CampaignProps .options-row > * { flex: 1 1 180px; min-width: 0; }
.CampaignProps .assets { display: flex; flex-direction: column; gap: var(--spacer2); }
.CampaignProps .field-note { margin: var(--spacer) 0 0; font-size: 0.8em; color: var(--text-muted); }
.CampaignProps .field-note strong { color: var(--text-color); font-family: ui-monospace, monospace; }
.CampaignProps .field-readonly label { display: block; font-size: 0.85em; color: var(--text-muted); margin-bottom: var(--spacerhalf); }
.CampaignProps .field-readonly .ro-value { padding: var(--spacerhalf) var(--spacer); background: var(--steel-50); border-radius: 4px; }
`;

  constructor(props) {
    super(props);
    this.hub = true;
    this.id = props.id;
    this.isNew = this.id === 'new';
    this.context = props.context;
  }

  async render(element) {
    await super.render(element);
    const { context } = this;
    const { ctx } = context;
    if (this.isNew) {
      this.campaign = { name: '', status: 'ACTIVE', budget: 0, pacing: null, settlementRule: 'open', attributes: {}, images: [], headlines: [], links: [], contractAddress: null };
    } else {
      try { this.campaign = await context.records.get('campaign', this.id); }
      catch (e) { this.element.innerHTML = `<p class="empty">Failed to load campaign: ${esc(e.message)}</p>`; return; }
      if (!this.campaign) { this.element.innerHTML = '<p class="empty">No such campaign.</p>'; return; }
      await this._adoptUnfinishedDeploy();
    }
    const c = this.campaign;

    // The working copy the inputs mutate in place.
    this.data = {
      name: c.name || '',
      status: c.status || 'ACTIVE',
      budget: c.budget ?? 0,
      pacing: c.pacing ?? null,
      settlementRule: c.settlementRule || 'open',
      attributes: { ...(c.attributes || {}) },
      images: [...(c.images || [])],
      headlines: [...(c.headlines || [])],
      links: [...(c.links || [])],
    };

    const deployed = !!c.contractAddress;
    const edit = context.canEdit;
    this.payer = deployed ? await canPay(ctx) : false;

    // --- header ---
    const header = this.div('detail-header');
    const title = this.div('detail-title', header);
    if (this.isNew) {
      title.innerHTML = '<h1 class="campaign-name">New campaign</h1>';
      const nameField = this.div('name-field', title);
      await this.draw(InputText, { name: 'name', title: 'Campaign name', placeholder: 'e.g. GeistM_AATC_EY_agelessPromo_A', data: this.data }, nameField);
      this.div('name-hint', nameField).textContent = 'The name is permanent and rides in every link. Letters, digits and . _ ~ -';
    } else {
      title.innerHTML = `<h1 class="campaign-name">${esc(c.name)}</h1>`;
      const meta = this.div('detail-meta', title);
      meta.innerHTML = `
        <span class="badge ${deployed ? 'deployed' : 'draft'}">${deployed ? 'Deployed' : 'Draft'}</span>
        ${this._unfunded() ? '<span class="badge draft">Unfunded</span>' : ''}
        ${deployed && c.active === false ? `<span class="badge">${c.retired ? 'Retired' : 'Disabled'}</span>` : ''}
        <span>Created ${c._created ? esc(new Date(c._created).toLocaleString()) : '-'}</span>
        ${deployed ? `<span class="mono">${esc(c.contractAddress)}</span>` : ''}`;
    }

    this.controls = this.div('detail-controls', header);
    await this.draw(Button, { title: this.isNew ? 'Cancel' : 'Back', onClick: () => context.go('campaigns') }, this.controls);
    if (edit && !deployed) {
      await this.draw(Button, { title: this.isNew ? 'Create' : 'Save', variant: 'primary', onClick: () => this.save() }, this.controls);
      if (!this.isNew) await this.draw(Button, { title: 'Deploy', onClick: () => this.deploy() }, this.controls);
    }
    if (edit && deployed && !c.retired) {
      const isActive = c.active !== false;
      await this.draw(Button, { title: isActive ? 'Disable' : 'Enable', onClick: () => this.setActive(!isActive) }, this.controls);
      await this.draw(Button, { title: 'Settle', onClick: () => this.settle() }, this.controls);
      if (this.payer) {
        await this.draw(Button, { title: 'Add budget', onClick: () => this.addBudget() }, this.controls);
        await this.draw(Button, { title: 'Withdraw', onClick: () => this.withdraw() }, this.controls);
      }
    }
    if (edit && !this.isNew) await this.draw(Button, { title: 'Delete', variant: 'danger', onClick: () => this.remove() }, this.controls);

    if (!this.isNew) {
      this.opSlot = this.div('op-banner-slot');
      this._renderStanding();
    }

    // --- Campaign configuration ---
    const cfg = this._section('Campaign configuration');
    await this.draw(AttributesEditor, { name: 'attributes', title: 'Campaign attributes', data: this.data }, cfg);

    // --- Campaign options ---
    const opts = this._section('Campaign options');
    const row = this.div('options-row', opts);
    await this.draw(InputSelect, { name: 'status', title: 'Status', options: STATUS_OPTIONS, data: this.data }, row);
    await this.draw(InputNumber, { name: 'budget', title: 'Budget (USD)', step: '0.01', data: this.data }, row);
    await this.draw(InputNumber, { name: 'pacing', title: 'Pacing (minutes)', placeholder: 'No pacing', data: this.data }, row);
    // The rule has no on-chain setter, so once deployed it is shown, not offered.
    if (deployed) {
      const ro = this.div('field-readonly', row);
      ro.innerHTML = `<label>Payment rule</label><div class="ro-value mono">${esc(this.data.settlementRule)}</div>`;
    } else {
      await this.draw(InputSelect, { name: 'settlementRule', title: 'Payment rule', options: SETTLEMENT_RULES, data: this.data }, row);
      this.div('field-note', opts).innerHTML = '<strong>open</strong>: pay any publisher we can attribute · '
        + '<strong>confirmedDomain</strong>: only publishers with a verified domain (epistery-scan). '
        + 'Set before deploy — it is baked onto the contract.';
    }

    // --- Ad management ---
    const ads = this._section('Ad management');
    const assets = this.div('assets', ads);
    await this.draw(ImagePicker, { name: 'images', title: 'Images', data: this.data, context }, assets);
    await this.draw(HeadlinePicker, { name: 'headlines', title: 'Headlines', data: this.data, context }, assets);
    await this.draw(LinkPicker, { name: 'links', title: 'Target links', data: this.data, context }, assets);

    // --- Data (deployed) ---
    if (deployed) {
      const data = this._section('Data');
      await this.draw(CampaignReport, { campaign: c, context }, data);
      this.element.classList.add('deployed-locked');
    }
  }

  _section(text) {
    const section = this.div('section');
    this.div('section-title', section).textContent = text;
    return this.div('section-panel', section);
  }

  _unfunded() {
    const c = this.campaign;
    return !!(c.contractAddress && c.fundingTargetWei && !c.fundedTxHash && !c.retired);
  }

  _payload() {
    const pacing = Number(this.data.pacing);
    return {
      status: this.data.status || 'ACTIVE',
      budget: Number(this.data.budget) || 0,
      pacing: pacing > 0 ? pacing : null,   // empty, 0 and NaN all mean "no pacing"
      settlementRule: this.data.settlementRule || 'open',
      attributes: this.data.attributes || {},
      images: this.data.images,
      headlines: this.data.headlines,
      links: this.data.links,
    };
  }

  async save() {
    const { context } = this;
    if (this.isNew) {
      const name = this.data.name?.trim();
      if (!name) return window.toast?.warning('Campaign name is required');
      if (!NAME_RE.test(name)) return window.toast?.warning('Name must be URL-safe (letters, digits, . _ ~ -)');
      try {
        const taken = (await context.records.list('campaign')).some((x) => x.name === name);
        if (taken) return window.toast?.warning(`A campaign named "${esc(name)}" already exists`);
        const id = newId(8);
        await context.records.put('campaign', { id, name, ...this._payload(), contractAddress: null, payments: [], _created: new Date().toISOString(), _createdBy: await signerAddress() });
        window.toast?.success('Campaign created');
        context.go(`campaigns/${id}`);
      } catch (e) { window.toast?.error('Create failed: ' + esc(e.message)); }
      return;
    }
    try {
      Object.assign(this.campaign, this._payload(), { _modified: new Date().toISOString() });
      await context.records.put('campaign', this.campaign);
      window.toast?.success('Saved');
    } catch (e) { window.toast?.error('Save failed: ' + esc(e.message)); }
  }

  // ── acts, run here with a progress banner ────────────────────────────────

  async _run(title, fn) {
    if (this._busy) return;
    this._busy = true;
    this.controls?.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const step = (text) => this._banner('running', `${title} — ${text}…`);
    try {
      const done = await fn(step);
      // Redraw this page from the updated record, then say what happened.
      this.components = [];
      await this.render();
      this._banner('done', done);
    } catch (e) {
      this._banner('error', `${title} failed — ${e.message}`);
      this.controls?.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    } finally {
      this._busy = false;
    }
  }

  async deploy() {
    const { context } = this;
    const { ctx } = context;
    const c = this.campaign;
    Object.assign(c, this._payload());   // deploy what is on the screen
    if (!c.images?.length) return window.toast?.warning('The campaign needs at least one image');
    if (!c.links?.length) return window.toast?.warning('The campaign needs at least one target link');
    const ok = await window.toast.prompt('Deploy this campaign to Adnet? Its images are published publicly and the factory creates the campaign contract with this identity as the advertiser. Staking the budget is a separate step.', { ok: 'Deploy', cancel: 'Cancel' });
    if (!ok) return;

    await this._run('Deploy', async (step) => {
      step('publishing creatives');
      const { entries = [] } = await ctx.io.api('GET', '/entries');
      const creatives = [];
      for (const id of c.images) {
        const entry = entries.find((e) => e.id === id && e.type === 'file');
        if (!entry) throw new Error(`image ${id} is no longer in Art`);
        creatives.push(await creativeUrl(ctx, context.records, entry));
      }

      step('gathering headlines and links');
      const headlines = (await Promise.all((c.headlines || []).map((id) => context.records.get('headline', id)))).filter(Boolean);
      const allLinks = await context.records.list('link');
      const links = (c.links || []).map((id) => allLinks.find((l) => l.id === id)).filter(Boolean);
      if (!links.length) throw new Error('none of the target links exist any more');
      for (const link of links) {
        if (!link.code) {   // older links may predate shortcodes
          link.code = mintShortCode((x) => allLinks.some((l) => l.code === x));
          await context.records.put('link', link);
        }
      }

      // Round-robin creatives × headlines into promotions. The click destination
      // is not baked in: the factory resolves it at click time from links[].
      const count = Math.max(creatives.length, headlines.length || 1, links.length);
      const promotions = [];
      for (let i = 0; i < count; i++) {
        const h = headlines.length ? headlines[i % headlines.length] : null;
        promotions.push({ promotionId: `${c.id}_p${i}`, creative: creatives[i % creatives.length], title: h?.text || '', subtitle: h?.subtext || '' });
      }
      const linkDefs = links.map((l) => ({ code: l.code, urls: [{ href: l.url, weight: 1 }], attributes: l.attributes || {} }));
      const ep = await import('/epistery.mjs');
      const advertiserName = (await ep.contractName(ctx.session.owner).catch(() => null)) || ctx.session.name || ctx.session.owner;

      step('signing');
      const auth = await factoryAuth();
      // Mark it before the factory call, so a page left mid-deploy can adopt the
      // result on its next visit.
      c.deploying = { at: new Date().toISOString(), by: await signerAddress() };
      await context.records.put('campaign', c);

      step('deploying the contract through the factory');
      const out = await context.factory.deploy(auth, {
        campaignId: c.name,
        name: c.name,
        brand: advertiserName,
        advertiserName,
        advertiserWallet: ctx.session.owner,
        advertiserSession: ctx.session.id,
        budget: String(c.budget || 0),
        pacing: c.pacing ?? undefined,
        settlementRule: c.settlementRule || 'open',
        promotions,
        links: linkDefs,
      });

      c.contractAddress = out.contractAddress || null;
      c.factoryCampaignId = out.id || c.name;
      c.fundingTargetWei = out.fundingTargetWei ? String(out.fundingTargetWei) : null;
      c.active = true;
      c.deployedPromotions = promotions.length;
      c._deployed = new Date().toISOString();
      c._deployedBy = c.deploying.by;
      delete c.deploying;
      await context.records.put('campaign', c);
      return `Deployed — contract ${c.contractAddress}. Stake its budget to start serving.`;
    });
  }

  // A deploy this record started but never recorded: if the factory holds a
  // campaign by this name whose advertiser is this identity, it is ours — adopt it.
  async _adoptUnfinishedDeploy() {
    const c = this.campaign;
    if (!c.deploying || c.contractAddress) return;
    const found = await this.context.factory.detail(c.name);
    if (found?.contractAddress && eqAddr(found.advertiser?.wallet, this.context.ctx.session.owner)) {
      c.contractAddress = found.contractAddress;
      c.factoryCampaignId = found.id || c.name;
      c.active = found.active !== false;
      c._deployed = c.deploying.at;
      c._deployedBy = c.deploying.by;
      delete c.deploying;
      if (this.context.canEdit) await this.context.records.put('campaign', c).catch(() => {});
    }
  }

  setActive(active) {
    const c = this.campaign;
    return this._confirmThen(active ? 'Enable' : 'Disable',
      active ? 'Enable this campaign? It resumes serving to publishers.' : 'Disable this campaign? It stops serving to publishers and stays deployed.',
      async (step) => {
        step('signing');
        const auth = await factoryAuth();
        step(`${active ? 'unpausing' : 'pausing'} the contract through the factory`);
        await this.context.factory.setActive(auth, c.factoryCampaignId, active);
        c.active = active;
        await this.context.records.put('campaign', c);
        return active ? 'Enabled — serving to publishers.' : 'Disabled — pulled from rotation (stays deployed).';
      });
  }

  settle() {
    const c = this.campaign;
    return this._confirmThen('Settle',
      "Settle now? Adnet flushes this campaign's accrued views and clicks on chain — dropping spam, confirming each publisher against the payment rule, and crediting publishers from the budget.",
      async (step) => {
        step('signing');
        const auth = await factoryAuth();
        step('settling on chain through the factory');
        const s = await this.context.factory.settle(auth, c.factoryCampaignId);
        const paid = (s.settled?.views || 0) + (s.settled?.clicks || 0);
        return paid
          ? `Settled ${s.settled.batches} batch(es): ${s.settled.views} views / ${s.settled.clicks} clicks paid` + (s.denied ? `, ${s.denied} denied` : '') + (s.spam ? `, ${s.spam} spam` : '')
          : 'Nothing to settle' + (s.denied ? ` (${s.denied} denied)` : '') + (s.spam ? ` (${s.spam} spam)` : '');
      });
  }

  // Stake the amount the factory named at deploy.
  async fund() {
    const c = this.campaign;
    const wei = BigInt(c.fundingTargetWei);
    if (!(await this._treasuryCovers(wei))) return;
    return this._pay('Stake',
      `Stake ${fmtPol(weiToPol(wei))} from this identity's treasury into campaign contract ${shortAddr(c.contractAddress)}? This device signs; the identity pays the stake, the device pays the gas.`,
      'fund', wei, () => payFromTreasury(this.context.ctx, c.contractAddress, wei));
  }

  async addBudget() {
    const c = this.campaign;
    const price = await polUsd();
    if (!price) return window.toast?.error('The POL price is unavailable right now, so a USD amount cannot be converted. Try again shortly.');
    const input = await window.popup.prompt('Add budget — amount in USD', {
      placeholder: 'e.g. 50',
      ok: 'Continue',
      validate: (v) => (Number(v) > 0 ? null : 'Enter a positive USD amount'),
    });
    if (input == null) return;
    const usd = Number(input);
    const wei = polToWei(usd / price);
    if (!(await this._treasuryCovers(wei))) return;
    return this._pay('Add budget',
      `Add $${usd} (${fmtPol(weiToPol(wei), 3)}) from this identity's treasury to ${esc(c.name)}? This device signs; the identity pays, the device pays the gas.`,
      'budget', wei, () => payFromTreasury(this.context.ctx, c.contractAddress, wei), { usd });
  }

  withdraw() {
    const c = this.campaign;
    return this._pay('Withdraw',
      'Withdraw the unspent budget back to this identity and retire the campaign? It is paused on chain and the remaining balance returns to the treasury.',
      'withdraw', 0n, () => withdrawBudget(this.context.ctx, c.contractAddress));
  }

  async _confirmThen(label, question, fn) {
    if (!(await window.toast.prompt(question, { ok: label, cancel: 'Cancel' }))) return;
    return this._run(label, fn);
  }

  // Sign and send a treasury payment, then keep it on the record with its hash.
  _pay(label, question, kind, wei, send, extra = {}) {
    const c = this.campaign;
    return this._confirmThen(label, question, async (step) => {
      step('waiting for your signature');
      const txHash = await send();
      const payment = { kind, txHash, amountWei: wei.toString(), ...extra, by: await signerAddress(), at: new Date().toISOString() };
      c.payments = [...(c.payments || []), payment];
      if (kind === 'fund') c.fundedTxHash = txHash;
      if (kind === 'budget' && extra.usd) c.budget = (Number(c.budget) || 0) + extra.usd;   // display; the contract is the truth
      if (kind === 'withdraw') { c.active = false; c.retired = true; }
      await this.context.records.put('campaign', c);
      const x = await explorer();
      return `${label} sent — transaction <a href="${x.tx(txHash)}" target="_blank" rel="noopener" class="mono">${shortAddr(txHash)}</a>.`;
    });
  }

  // A payment the treasury cannot cover is refused before anyone is asked to sign.
  async _treasuryCovers(wei) {
    try {
      const t = await treasury(this.context.ctx);
      if (t.wei >= wei) return true;
      window.toast?.error(`Insufficient funds: the identity treasury holds ${fmtPol(t.pol, 3)}, this needs ${fmtPol(weiToPol(wei), 3)}. Fund the identity, then retry.`);
    } catch (e) {
      window.toast?.error('Could not read the treasury: ' + esc(e.message));
    }
    return false;
  }

  // ── the banner ───────────────────────────────────────────────────────────

  // `html` for 'done' is ours (it may carry a link); everything else is escaped.
  _banner(state, text) {
    if (!this.opSlot) return;
    this.opSlot.innerHTML = '';
    const b = document.createElement('div');
    b.className = `op-banner ${state}`;
    if (state === 'running') b.innerHTML = `<span class="op-spinner"></span><span class="op-text">${esc(text)}</span>`;
    else if (state === 'done') b.innerHTML = `<span class="op-icon">✓</span><span class="op-text">${text}</span>`;
    else b.innerHTML = `<span class="op-icon">✕</span><span class="op-text">${esc(text)}</span>`;
    if (state !== 'running') {
      const x = document.createElement('button');
      x.className = 'op-dismiss';
      x.title = 'Dismiss';
      x.textContent = '×';
      x.addEventListener('click', () => this._renderStanding());
      b.append(x);
    }
    this.opSlot.append(b);
    // What is still owed stays in view under the outcome.
    if (state !== 'running') this._renderStanding({ clear: false });
    b.scrollIntoView?.({ block: 'nearest' });
  }

  // What stays in view between acts: an unfinished deploy, or a stake still owed.
  _renderStanding({ clear = true } = {}) {
    if (!this.opSlot) return;
    if (clear) this.opSlot.innerHTML = '';
    const c = this.campaign;
    if (c.deploying && !c.contractAddress) {
      const b = document.createElement('div');
      b.className = 'op-banner error';
      b.innerHTML = `<span class="op-text">A deploy started ${esc(new Date(c.deploying.at).toLocaleString())} did not finish, and the factory has no campaign by this name for this identity. Deploy again when ready.</span>`;
      this.opSlot.append(b);
    }
    if (this._unfunded()) {
      const amount = fmtPol(weiToPol(c.fundingTargetWei));
      const b = document.createElement('div');
      b.className = 'op-banner pending';
      b.innerHTML = `<span class="op-text">Deployed, not yet staked. The contract serves once its budget of <strong>${amount}</strong> is staked from this identity's treasury.</span>`;
      if (this.context.canEdit && this.payer) {
        const btn = document.createElement('button');
        btn.className = 'adnet-btn';
        btn.textContent = `Stake ${amount}`;
        btn.addEventListener('click', () => this.fund());
        b.append(btn);
      } else {
        b.insertAdjacentHTML('beforeend', '<span class="op-when">A device of the advertiser identity stakes it.</span>');
      }
      this.opSlot.append(b);
    }
  }

  async remove() {
    const c = this.campaign;
    const deployedNote = c.contractAddress ? ' Its contract stays on chain; only this record goes.' : '';
    if (!(await window.toast.prompt(`Delete campaign "${esc(c.name)}"?${deployedNote}`, { ok: 'Delete', cancel: 'Cancel' }))) return;
    try {
      await this.context.records.remove('campaign', this.id);
      window.toast?.success('Deleted');
      this.context.go('campaigns');
    } catch (e) { window.toast?.error('Delete failed: ' + esc(e.message)); }
  }

  teardown() {
    for (const comp of this.components) comp.teardown?.();
  }
}
