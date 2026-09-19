// The acting signer — everything that speaks or pays for the advertiser is signed
// HERE, by this device's rivet.
//
// The advertiser is the session's owner identity, a contract. It cannot sign; its
// signers can:
//   factoryAuth()     — a fresh "Epistery Auth <ms>" signature for one factory call.
//   addBudget()       — identity.executeTransaction(campaign, amount, addBudget()):
//                       the identity's own money into the campaign contract's payable
//                       addBudget(). The identity pays the stake; the device pays gas.
//                       (Not sendETH: its transfer() forwards 2300 gas, which the
//                       campaign's receive() cannot run on — it reverts.)
//   withdrawBudget()  — identity.executeTransaction(campaign, 0, withdrawBudget()):
//                       the unspent budget back to the identity; campaign retired.
// A transaction is only a fact once the chain shows it: each waits until the
// campaign contract's balance has moved, and fails loudly if it does not.
// The signature is the explicit acknowledgment that money moves.

const ep = () => import('/epistery.mjs');

const SEL_ADD_BUDGET = '0x687792db';        // CampaignContract.addBudget() payable
const SEL_WITHDRAW_BUDGET = '0x579a583e';   // CampaignContract.withdrawBudget()

export async function factoryAuth() {
  const e = await ep();
  const message = `Epistery Auth ${Date.now()}`;
  const { signer, signature } = await e.signAs(message);
  return 'Bot ' + btoa(JSON.stringify({ address: signer, signature, message }));
}

export async function signerAddress() {
  const e = await ep();
  return e.current().signer || null;
}

// Money comes from the SESSION'S identity, so this device must sign for it. An
// admin from another identity may operate the campaign, but cannot spend this
// identity's treasury (sendFromContract would draw on their own).
async function asAdvertiser(ctx) {
  const e = await ep();
  const mine = String(e.current().contract || '').toLowerCase();
  if (mine !== String(ctx.session.owner).toLowerCase()) {
    throw new Error(`Payments come from this session's identity (${ctx.session.owner}); this device signs for ${e.current().contract || 'no identity'}.`);
  }
  return e;
}

export async function canPay(ctx) {
  try { await asAdvertiser(ctx); return true; } catch { return false; }
}

// Poll an address's balance until `landed(wei)` holds. Bounded — silence is not
// an answer, and a payment the chain never shows must not be recorded as made.
async function awaitBalance(e, address, landed, { tries = 40, delayMs = 3000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try { if (landed(BigInt((await e.polBalance(address)).wei))) return true; } catch { /* transient */ }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function notLanded(label, txHash) {
  return new Error(`the ${label} was sent (transaction ${txHash}) but the campaign contract's balance has not moved — it most likely reverted. Nothing was recorded; check the transaction on the explorer.`);
}

export async function addBudget(ctx, campaignContract, wei, step = () => {}) {
  const e = await asAdvertiser(ctx);
  const amount = BigInt(wei);
  const before = BigInt((await e.polBalance(campaignContract)).wei);
  step('waiting for your signature');
  const { txHash } = await e.callFromContract(campaignContract, SEL_ADD_BUDGET, amount.toString());
  step('confirming on chain');
  if (!(await awaitBalance(e, campaignContract, (b) => b >= before + amount))) throw notLanded('payment', txHash);
  return txHash;
}

export async function withdrawBudget(ctx, campaignContract, step = () => {}) {
  const e = await asAdvertiser(ctx);
  const before = BigInt((await e.polBalance(campaignContract)).wei);
  step('waiting for your signature');
  const { txHash } = await e.callFromContract(campaignContract, SEL_WITHDRAW_BUDGET, 0);
  step('confirming on chain');
  if (!(await awaitBalance(e, campaignContract, (b) => b < before))) throw notLanded('withdrawal', txHash);
  return txHash;
}

// The identity's treasury, as the relay reads it.
export async function treasury(ctx) {
  const e = await ep();
  const b = await e.polBalance(ctx.session.owner);
  return { wei: BigInt(b.wei), pol: Number(b.formatted) };
}

// Explorer links, from the console's own explorer.
export async function explorer() {
  const e = await ep();
  const base = e.explorerUrl('').replace(/\/address\/$/, '');
  return { address: (a) => `${base}/address/${a}`, tx: (h) => `${base}/tx/${h}` };
}
