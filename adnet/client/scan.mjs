// Announcing a campaign to scan — the index of signed, measurable facts.
//
// A deployed campaign is a contract; scan reads everything about it (advertiser,
// budget, spend, promotions) from the chain itself. All it needs is to be told the
// address. The deploying member's browser tells the console's OWN scan
// (same origin, /scan), so a campaign deployed from epistery.com joins the real
// index and one deployed from a dev console stays in that console's scan.
// The console runs on Polygon mainnet only, hence the chain.

export async function announce(contractAddress) {
  const r = await fetch('/scan/api/monitor', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: contractAddress, chain: 'polygon', type: 'CampaignWallet' }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out.success) throw new Error(out.error || `scan answered ${r.status}`);
}
