import { Id } from './indexed-graph';
import { EntryPointDAG } from './entry-point-dag';

export interface DominatorAnalysis {
  /** Dom[B] contains all entry points that dominate B (including B). */
  Dom: ReadonlyMap<Id, ReadonlySet<Id>>;
  /** Shortest-edge distance (BFS) from root; used to pick the "deepest" dominator. */
  depth: ReadonlyMap<Id, number>;
  /** Convenience predicate: does A dominate B? */
  dominates: (A: Id, B: Id) => boolean;
}

/** Build predecessor map from adjacency (entry point graph). */
function buildPreds(dag: EntryPointDAG): ReadonlyMap<Id, ReadonlySet<Id>> {
  const preds = new Map<Id, Set<Id>>();
  for (const n of dag.nodes) preds.set(n, new Set());
  for (const [u, vs] of dag.adj) for (const v of vs) preds.get(v)!.add(u);
  return new Map([...preds.entries()].map(([k, v]) => [k, new Set(v)]));
}

/** BFS distance (fewest edges) from root; works even if the graph isn’t a strict DAG. */
function bfsDepth(root: Id, dag: EntryPointDAG): ReadonlyMap<Id, number> {
  const depth = new Map<Id, number>();
  const q: Id[] = [];
  depth.set(root, 0);
  q.push(root);
  while (q.length) {
    const u = q.shift()!;
    for (const v of dag.adj.get(u) ?? []) {
      if (!depth.has(v)) {
        depth.set(v, (depth.get(u) ?? 0) + 1);
        q.push(v);
      }
    }
  }
  // Unreachable nodes (shouldn’t exist if you filtered in Step 3) are left undefined.
  return depth;
}

/**
 * Compute dominators on the entry-point graph using the classic dataflow algorithm:
 *   Dom[root] = {root}
 *   Dom[n≠root] = ALL initially; iteratively intersect predecessors' Dom and add n.
 */
export function computeDominators(root: Id, dag: EntryPointDAG): DominatorAnalysis {
  if (!dag.nodes.has(root)) {
    throw new Error(`computeDominators: root "${root}" is not a node in the DAG.`);
  }

  const preds = buildPreds(dag);
  const nodes = [...dag.nodes];

  const Dom = new Map<Id, Set<Id>>();
  for (const n of nodes) Dom.set(n, new Set(nodes)); // start with ALL
  Dom.set(root, new Set([root]));

  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n === root) continue;
      const ps = preds.get(n)!; // may be empty if disconnected
      if (ps.size === 0) {
        // If n is unreachable from root, leave Dom[n] as ALL; Step 3 should have pruned these.
        continue;
      }
      // inter = intersection of Dom[p] for p in preds(n)
      let inter: Set<Id> | null = null;
      for (const p of ps) {
        const Dp = Dom.get(p)!;
        inter = inter
          ? new Set(([...inter] as Id[]).filter(x => Dp.has(x)))
          : new Set(Dp);
      }
      // Add n itself
      inter!.add(n);

      const old = Dom.get(n)!;
      const same =
        old.size === inter!.size && [...old].every(x => inter!.has(x));
      if (!same) {
        Dom.set(n, inter!);
        changed = true;
      }
    }
  }

  const depth = bfsDepth(root, dag);
  const dominates = (A: Id, B: Id) => !!Dom.get(B)?.has(A);

  // Freeze-ish views
  const roDom = new Map<Id, ReadonlySet<Id>>(
    [...Dom.entries()].map(([k, v]) => [k, new Set(v)])
  );

  return { Dom: roDom, depth, dominates };
}

/**
 * Helper: deepest common dominator (DCD) for a set of consumer entry points.
 * - Intersect Dom sets of all consumers
 * - Optionally exclude some nodes (e.g., main) to enforce "no-byte-increase"
 * - Pick the argmax by depth; tie-break lexicographically for stability
 */
export function deepestCommonDominator(
  consumers: ReadonlySet<Id>,
  analysis: DominatorAnalysis,
  opts?: { exclude?: ReadonlySet<Id> }
): Id | null {
  const { Dom, depth } = analysis;
  const iter = consumers.values();
  const first = iter.next();
  if (first.done) return null;

  // Start with Dom of the first consumer
  let common = new Set(Dom.get(first.value) ?? new Set<Id>());
  for (const c of iter) {
    const Dc = Dom.get(c);
    if (!Dc) return null; // consumer not in analysis
    common = new Set([...common].filter(x => Dc.has(x)));
    if (common.size === 0) return null;
  }

  // Apply exclusions (e.g., exclude main to avoid hoisting into entry)
  if (opts?.exclude) for (const x of opts.exclude) common.delete(x);
  if (common.size === 0) return null;

  // Pick deepest by BFS depth (largest distance); tie-break by id for determinism
  let best: Id | null = null;
  let bestDepth = -Infinity;
  for (const c of common) {
    const d = depth.get(c) ?? -Infinity;
    if (d > bestDepth || (d === bestDepth && best !== null && c < best)) {
      best = c;
      bestDepth = d;
    } else if (best === null) {
      best = c;
      bestDepth = d;
    }
  }
  return best;
}
