import { Id, IndexedGraph } from './indexed-graph';

/** Basic static-only closure, with an optional stop-set that we never cross into. */
function staticClosureStoppingAt(
  root: Id,
  staticAdj: ReadonlyMap<Id, ReadonlySet<Id>>,
  stopAt: ReadonlySet<Id>
): Set<Id> {
  const seen = new Set<Id>();
  const stack: Id[] = [root];

  // We do NOT include root if it’s in stopAt (handled by caller before invoking).
  if (stopAt.has(root)) return seen;

  while (stack.length) {
    const u = stack.pop()!;
    for (const v of staticAdj.get(u) ?? []) {
      if (stopAt.has(v) || seen.has(v)) continue;
      seen.add(v);
      stack.push(v);
    }
  }
  return seen;
}

/** Optional: reachability from main using BOTH static and dynamic edges (to prune unreachable roots). */
function reachableFromMain(
  main: Id,
  staticAdj: ReadonlyMap<Id, ReadonlySet<Id>>,
  dynamicAdj: ReadonlyMap<Id, ReadonlySet<Id>>
): Set<Id> {
  const seen = new Set<Id>([main]);
  const stack: Id[] = [main];
  const step = (adj: ReadonlyMap<Id, ReadonlySet<Id>>, u: Id) => {
    for (const v of adj.get(u) ?? []) {
      if (!seen.has(v)) { seen.add(v); stack.push(v); }
    }
  };
  while (stack.length) {
    const u = stack.pop()!;
    step(staticAdj, u);
    step(dynamicAdj, u);
  }
  return seen;
}

export interface PerEntryClosures {
  /** The set of async entry roots actually considered (after filters). */
  roots: ReadonlySet<Id>;
  /**
   * For each async entry root r, the set C(r) = staticClosure(r) \ I,
   * computed WITHOUT crossing into I.
   */
  closures: ReadonlyMap<Id, ReadonlySet<Id>>;
  /** Diagnostics: roots skipped because they’re in I or unreachable (if filtering). */
  skipped: {
    inEntryClosure: ReadonlySet<Id>;
    unreachableFromMain: ReadonlySet<Id>;
    notDynamicTargets: ReadonlySet<Id>;
  };
}

/**
 * Step 3 — Compute per-entry closures (stopping at main’s closure).
 *
 * @param G    Indexed graph (from Step 1)
 * @param main The main entry module id
 * @param I    The pinned entry static closure from Step 2 (must include `main`)
 * @param opts onlyReachableFromMain: if true, drop async roots unreachable from `main` (default true)
 */
export function computePerEntryClosures(
  G: IndexedGraph,
  main: Id,
  I: ReadonlySet<Id>,
  opts: { onlyReachableFromMain?: boolean } = { onlyReachableFromMain: true }
): PerEntryClosures {
  // 1) Collect dynamic targets (raw async roots)
  const dynamicTargets = new Set<Id>();
  for (const [, tos] of G.dynamicAdj) for (const t of tos) dynamicTargets.add(t);

  // 2) Async roots we care about = dynamic targets that are marked entry points and are not in I
  const inEntryClosure = new Set<Id>();
  const notDynamicTargets = new Set<Id>();
  const rootsRaw = new Set<Id>();

  for (const ep of G.entryPoints) {
    if (!dynamicTargets.has(ep)) { notDynamicTargets.add(ep); continue; }
    if (I.has(ep)) { inEntryClosure.add(ep); continue; }
    if (ep !== main) rootsRaw.add(ep);
  }

  // 3) Optionally prune to roots reachable from main (via static+dynamic)
  const unreachableFromMain = new Set<Id>();
  let reachable: Set<Id> | null = null;
  if (opts.onlyReachableFromMain !== false) {
    reachable = reachableFromMain(main, G.staticAdj, G.dynamicAdj);
  }

  const roots = new Set<Id>();
  for (const r of rootsRaw) {
    if (reachable && !reachable.has(r)) { unreachableFromMain.add(r); continue; }
    roots.add(r);
  }

  // 4) Compute per-root closures, stopping at I and subtracting I (the stop already guarantees no I members leak in)
  const closures = new Map<Id, ReadonlySet<Id>>();
  for (const r of roots) {
    const clos = staticClosureStoppingAt(r, G.staticAdj, I);
    // Ensure r itself isn’t in I; if it is (shouldn’t be), closure stays empty.
    closures.set(r, new Set(clos));
  }

  return {
    roots,
    closures,
    skipped: {
      inEntryClosure: inEntryClosure,
      unreachableFromMain,
      notDynamicTargets,
    },
  };
}
