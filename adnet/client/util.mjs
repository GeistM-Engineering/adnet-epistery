// Small shared helpers for the adnet pages.

export function esc(text) {
  if (text == null) return '';
  const d = document.createElement('div');
  d.textContent = String(text);
  return d.innerHTML;
}

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export const weiToPol = (wei) => (wei == null ? null : Number(BigInt(wei)) / 1e18);

// POL → wei at micro-POL precision; exact enough for a budget and free of floats past 1e-6.
export const polToWei = (pol) => BigInt(Math.round(Number(pol) * 1e6)) * 10n ** 12n;

export const fmtPol = (n, digits = 4) => (n == null ? '—' : `${Number(n).toFixed(digits)} POL`);

// A campaign's serving state (from the factory's economics) → label + badge class.
// The factory is the one authority on the state; this only names it for a human.
export const CAMPAIGN_STATE = {
  serving:   { label: 'Serving',   cls: 'state-serving' },
  exhausted: { label: 'Exhausted', cls: 'state-exhausted' },
  unfunded:  { label: 'Unfunded',  cls: 'state-unfunded' },
  paused:    { label: 'Paused',    cls: 'state-paused' },
};
export const stateBadge = (state) => CAMPAIGN_STATE[state] || { label: state || 'unknown', cls: '' };

// Label a POL amount with its USD value, when a price is known: `$1.23`, or '' when
// the price is unavailable. Display only — pair it with fmtPol, never replace it.
export const fmtUsd = (pol, price, digits = 2) =>
  (price == null || pol == null ? '' : `$${(Number(pol) * price).toFixed(digits)}`);

// The market price of POL, for labelling an amount. Display only — the console's
// own figure, and absent (null) when the source is unreachable. Cached per page.
let _price = null;
export function polUsd() {
  if (!_price) {
    _price = fetch('/api/pol-price', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (typeof d?.usd === 'number' ? d.usd : null))
      .catch(() => null);
  }
  return _price;
}

// A page-level failure, stated plainly.
export function failureNote(e, what = 'load') {
  return `<p class="empty">Could not ${esc(what)}: ${esc(e?.message || String(e))}</p>`;
}
