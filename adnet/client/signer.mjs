// The acting signer — everything that speaks or pays for the advertiser is signed
// HERE, by this device's rivet.
//
// The advertiser is the session's owner identity, a contract. It cannot sign; its
// signers can:
//   factoryAuth()     — a fresh "Epistery Auth <ms>" signature for one factory call.
//   payFromTreasury() — identity.sendETH(campaign, amount): the identity's own money
//                       into the campaign contract, whose receive() credits its
//                       budget. The identity pays the stake; the device pays gas.
//   withdrawBudget()  — identity.executeTransaction(campaign, 0, withdrawBudget()):
//                       the unspent budget back to the identity; campaign retired.
// The signature is the explicit acknowledgment that money moves.

const ep = () => import('/epistery.mjs');

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

export async function payFromTreasury(ctx, campaignContract, wei) {
  const e = await asAdvertiser(ctx);
  const { txHash } = await e.sendFromContract(campaignContract, BigInt(wei).toString());
  return txHash;
}

export async function withdrawBudget(ctx, campaignContract) {
  const e = await asAdvertiser(ctx);
  const { txHash } = await e.callFromContract(campaignContract, SEL_WITHDRAW_BUDGET, 0);
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
