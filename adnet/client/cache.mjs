// A small stale-while-revalidate cache for the chain-backed reads — the factory's
// /network and /report, and the identity's treasury balance. These are the only
// slow, chain-latency values a page shows; everything else it draws is local.
//
// The cache lives on the app context (one per mounted session), NOT inside a page.
// A page is torn down and rebuilt on every navigation, so data held in the page is
// lost the moment you flip away from it — which is why the summary kept blanking.
// Held here instead, the last value survives the flip: a page paints it instantly
// and a background refresh updates it in place, rather than spinning from empty.
//
// One owner: each value has exactly one key and one fetcher, defined here. Pages
// never fetch these directly — they watch() a handle and patch their cells when it
// changes, so the fact flows through one channel, not re-derived per page.

import { treasury } from './signer.mjs';

function store() {
  const entries = new Map();   // key -> { value, at, inflight, subs:Set<fn> }
  const slot = (key) => {
    let e = entries.get(key);
    if (!e) { e = { value: undefined, at: 0, inflight: null, subs: new Set() }; entries.set(key, e); }
    return e;
  };
  return {
    peek: (key) => entries.get(key)?.value,
    subscribe(key, fn) { const e = slot(key); e.subs.add(fn); return () => e.subs.delete(fn); },
    invalidate(key) { const e = entries.get(key); if (e) e.at = 0; },
    // Fetch only if the value is older than ttl and nothing is already in flight.
    // The stale value stays on screen meanwhile; subscribers are notified when the
    // fresh one lands. A failed refresh keeps the last good value — it never blanks
    // what we already had.
    refresh(key, fetcher, ttl) {
      const e = slot(key);
      if ((e.at && Date.now() - e.at < ttl) || e.inflight) return e.value;
      e.inflight = Promise.resolve().then(fetcher).then(
        (v) => {
          e.inflight = null;
          e.at = Date.now();
          // Notify only when the value actually changed — a background refresh that
          // comes back identical must not make every watching page rebuild and flicker.
          let ser; try { ser = JSON.stringify(v); } catch { ser = null; }
          if (ser === null || ser !== e.ser) { e.value = v; e.ser = ser; e.subs.forEach((fn) => fn(v)); }
          return v;
        },
        () => { e.inflight = null; return e.value; },
      );
      return e.value;
    },
  };
}

// A page revalidates on mount; 15s keeps rapid flipping from refetching every time,
// while a value more than 15s old refreshes in the background on the next landing.
const TTL = 15000;

// The chain-backed reads, each with its one key and fetcher. Fetchers read
// context.factory lazily (an admin may repoint the factory in Settings) and swallow
// their own failure to null, so a watcher only ever sees data or null — never a throw.
export function chainCache(context) {
  const s = store();
  const handle = (key, fetcher) => ({
    value: s.peek(key),
    subscribe: (fn) => s.subscribe(key, fn),
    revalidate: () => s.refresh(key, fetcher, TTL),
  });
  return {
    network: () => handle('network', () => context.factory.network().catch(() => null)),
    treasury: () => handle('treasury', () => treasury(context.ctx).catch(() => null)),
    report: (id) => handle(`report:${id}`, () => context.factory.report(id).catch(() => null)),
    // After an act (stake, add budget, settle, deploy, withdraw…) the on-chain truth
    // changed, so drop the cached reads it affects: the next watch refetches instead
    // of showing a value that predates the act.
    touched(reportId) { s.invalidate('network'); s.invalidate('treasury'); if (reportId) s.invalidate(`report:${reportId}`); },
  };
}

// Paint now from whatever is cached (maybe undefined, on the very first load), update
// in place when a background refresh lands, and kick that refresh. Returns an
// unsubscribe fn the page MUST call on teardown, so a refresh that resolves after the
// page is gone never patches a dead view.
export function watch(h, apply) {
  apply(h.value);
  const unsub = h.subscribe(apply);
  h.revalidate();
  return unsub;
}
