import { Id } from './indexed-graph';
import { PerEntryClosures } from './async-closure';
import { EntryPointDAG } from './entry-point-dag';
import { deepestCommonDominator, DominatorAnalysis } from './dominator';

type ChunkId = string;

export interface ChunkPlan {
  /** module id -> chunk id */
  moduleToChunk: Map<Id, ChunkId>;
  /** chunk id -> member modules */
  chunks: Map<ChunkId, Set<Id>>;
  /** dynamic edges between chunks (loader triggers) */
  dynamicEdges: Array<{ fromChunk: ChunkId; toChunk: ChunkId }>;
}

// ---------- Step 6: assignment ----------

/**
 * Build a consumer map: for each module s (outside I), which async roots consume it?
 * Consumers(s) = { r | s ∈ C(r) }
 */
function buildConsumerSets(per: PerEntryClosures): Map<Id, Set<Id>> {
  const consumers = new Map<Id, Set<Id>>();
  for (const r of per.roots) {
    const clos = per.closures.get(r) ?? new Set<Id>();
    for (const s of clos) {
      let set = consumers.get(s);
      if (!set) { set = new Set<Id>(); consumers.set(s, set); }
      set.add(r);
    }
  }
  return consumers;
}

function chunkIdOfEntry(ep: Id): ChunkId {
  return `chunk:${ep}`;
}

/**
 * Step 6 — Assign modules to chunks:
 * - All modules in I go to the main chunk.
 * - Each async root r is a chunk containing at least r itself.
 * - For each module s (not in I), place s in the **deepest common dominator (DCD)**
 *   of its consumer entry-points. If no DCD exists other than main, fall back to
 *   a shared async chunk keyed by its consumer set.
 *
 * This respects your policy:
 *   - Prefer fewer requests (co-locate into a single dominator chunk).
 *   - Never increase bytes (do not hoist into main unless s ∈ I).
 */
export function assignModulesToChunks(
  main: Id,
  I: ReadonlySet<Id>,
  per: PerEntryClosures,
  dag: EntryPointDAG,
  dom: DominatorAnalysis
): ChunkPlan {
  // 0) Setup containers
  const moduleToChunk = new Map<Id, ChunkId>();
  const chunks = new Map<ChunkId, Set<Id>>();

  const MAIN_CHUNK = chunkIdOfEntry(main);

  // helper to add module to chunk
  const addToChunk = (cid: ChunkId, mod: Id) => {
    let set = chunks.get(cid);
    if (!set) { set = new Set<Id>(); chunks.set(cid, set); }
    set.add(mod);
    moduleToChunk.set(mod, cid);
  };

  // 1) Seed the main chunk with its pinned closure (I, which includes main)
  for (const m of I) addToChunk(MAIN_CHUNK, m);

  // 2) Ensure each async root has a chunk containing at least itself
  for (const r of per.roots) {
    const cid = chunkIdOfEntry(r);
    addToChunk(cid, r);
  }

  // 3) Build Consumers(s) = { r | s ∈ C(r) }
  const consumersByModule = buildConsumerSets(per);

  // 4) For each s outside I, place s at the deepest common dominator of its consumers.
  //    Exclude `main` as a placement target (no-byte-increase rule).
  const exclude = new Set<Id>([main]);

  // Shared chunk buckets keyed by sorted consumer list
  const sharedBuckets = new Map<string, Set<Id>>();

  for (const [s, consumers] of consumersByModule) {
    if (I.has(s)) continue;               // already in main
    if (consumers.size === 0) continue;   // unreachable or already accounted

    // deepest common dominator among consumers (excluding main)
    const dcd = deepestCommonDominator(consumers, dom, { exclude });

    if (dcd) {
      // Place s in the dominator's chunk
      addToChunk(chunkIdOfEntry(dcd), s);
    } else {
      // Fall back to a shared async chunk keyed by its consumers
      const key = [...consumers].sort().join('|'); // deterministic
      let bucket = sharedBuckets.get(key);
      if (!bucket) { bucket = new Set<Id>(); sharedBuckets.set(key, bucket); }
      bucket.add(s);
    }
  }

  // 5) Materialize shared chunks (if any)
  let sharedIndex = 0;
  for (const [key, mods] of sharedBuckets) {
    if (mods.size === 0) continue;
    // Deterministic id (stable across runs for the same key)
    const cid = `chunk:shared:${key || (sharedIndex++).toString()}`;
    for (const m of mods) addToChunk(cid, m);
  }

  // 6) Dynamic edges at chunk level are just the DAG edges
  const dynamicEdges: Array<{ fromChunk: ChunkId; toChunk: ChunkId }> = [];
  for (const { from, to } of dag.edges) {
    dynamicEdges.push({ fromChunk: chunkIdOfEntry(from), toChunk: chunkIdOfEntry(to) });
  }

  return { moduleToChunk, chunks, dynamicEdges };
}
