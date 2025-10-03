import { Id, IndexedGraph } from './indexed-graph';
import { PerEntryClosures } from './async-closure';

export interface EntryPointDAG {
  /** nodes = { main } ∪ roots */
  nodes: ReadonlySet<Id>;
  /** adjacency: entryPoint -> set of entryPoints it dynamically imports */
  adj: ReadonlyMap<Id, ReadonlySet<Id>>;
  /** edge list form (convenience for later passes / debugging) */
  edges: ReadonlyArray<{ from: Id; to: Id }>;
  /**
   * Ownership sets used to derive edges:
   * - ownerSet.get(main) = I (pinned)
   * - ownerSet.get(r)    = { r } ∪ C(r)
   */
  ownerSet: ReadonlyMap<Id, ReadonlySet<Id>>;
}

/**
 * Nodes are the main entry and all async roots.
 * Edge E -> F exists if some module "owned by E" has a dynamic-import to F.
 *   - owner(main) = I (the pinned entry closure, includes main)
 *   - owner(r)    = { r } ∪ C(r)   (the root module plus its static closure excluding I)
 *
 * We ignore dynamic edges to targets that are not entry points in `nodes`.
 */
export function buildEntryPointDAG(
  G: IndexedGraph,
  main: Id,
  I: ReadonlySet<Id>,                 // from Step 2
  per: PerEntryClosures               // from Step 3
): EntryPointDAG {
  // 1) Nodes
  const nodes = new Set<Id>([main, ...per.roots]);

  // 2) Ownership sets
  const ownerSet = new Map<Id, Set<Id>>();
  // main owns its pinned closure I (already includes main)
  ownerSet.set(main, new Set(I));
  // each root owns itself plus its closure (excluding I by construction)
  for (const r of per.roots) {
    const clos = per.closures.get(r) ?? new Set<Id>();
    const set = new Set<Id>([r, ...clos]);
    ownerSet.set(r, set);
  }

  // 3) Build adjacency by scanning dynamic imports from each owner set
  const adj = new Map<Id, Set<Id>>();
  const ensure = (m: Map<Id, Set<Id>>, k: Id) => (m.get(k) ?? (m.set(k, new Set<Id>()), m.get(k)!));

  for (const fromEntry of nodes) {
    const owned = ownerSet.get(fromEntry) ?? new Set<Id>();
    const out = ensure(adj, fromEntry);

    for (const ownerModule of owned) {
      const dynTargets = G.dynamicAdj.get(ownerModule);
      if (!dynTargets) continue;

      for (const t of dynTargets) {
        // Only keep edges to other entry points in this DAG
        if (!nodes.has(t)) continue;          // ignore non-entry or filtered targets
        if (t === fromEntry) continue;        // drop self-loops
        out.add(t);
      }
    }
  }

  // 4) Edge list form
  const edges: Array<{ from: Id; to: Id }> = [];
  for (const [u, vs] of adj) {
    for (const v of vs) edges.push({ from: u, to: v });
  }

  // Freeze-ish read-only views
  const roSet = <T>(s: Set<T>) => new Set(s) as ReadonlySet<T>;
  const roMap = (m: Map<Id, Set<Id>>) =>
    new Map([...m.entries()].map(([k, v]) => [k, roSet(v)])) as ReadonlyMap<Id, ReadonlySet<Id>>;
  const roOwner = new Map<Id, ReadonlySet<Id>>(
    [...ownerSet.entries()].map(([k, v]) => [k, roSet(v)])
  );

  return {
    nodes: roSet(nodes),
    adj: roMap(adj),
    edges,
    ownerSet: roOwner,
  };
}
