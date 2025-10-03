import { assignModulesToChunks } from './utils/assignment';
import { Metafile } from 'esbuild';
import { generateBundleGraph } from './utils/bundle-graph';
import { indexModuleGraph } from './utils/indexed-graph';
import { computeEntryClosure } from './utils/entry-closure';
import { computePerEntryClosures } from './utils/async-closure';
import { buildEntryPointDAG } from './utils/entry-point-dag';
import { computeDominators } from './utils/dominator';

export function mergeStrategy(
  entryPointChunk: string,
  metafile: Metafile
): Map<string, string[]> {
  const graph = generateBundleGraph(entryPointChunk, metafile);

  const indexedGraph = indexModuleGraph(graph);
  const entryClosure = computeEntryClosure(indexedGraph, entryPointChunk);
  const asyncClosures = computePerEntryClosures(
    indexedGraph,
    entryPointChunk,
    entryClosure
  );

  const entryPointDAG = buildEntryPointDAG(
    indexedGraph,
    entryPointChunk,
    entryClosure,
    asyncClosures
  );

  const dominators = computeDominators(entryPointChunk, entryPointDAG);
  const plan = assignModulesToChunks(
    entryPointChunk,
    entryClosure,
    asyncClosures,
    entryPointDAG,
    dominators
  );

  // Collect all chunk ids we know about (even empty ones referenced by edges).
  const allChunkIds = new Set<string>();
  for (const cid of plan.chunks.keys()) allChunkIds.add(cid);
  for (const [, cid] of plan.moduleToChunk) allChunkIds.add(cid);
  for (const e of plan.dynamicEdges ?? []) {
    allChunkIds.add(e.fromChunk);
    allChunkIds.add(e.toChunk);
  }

  // Start from the provided chunk membership sets.
  const membersByChunk = new Map<string, Set<string>>();
  for (const [cid, mods] of plan.chunks) {
    membersByChunk.set(cid, new Set(mods));
  }

  // Reconcile with moduleToChunk (in case chunks was empty or incomplete).
  for (const [mod, cid] of plan.moduleToChunk) {
    let set = membersByChunk.get(cid);
    if (!set) {
      set = new Set<string>();
      membersByChunk.set(cid, set);
    }
    set.add(mod);
  }

  // Ensure we include chunks that have no members but exist in edges.
  for (const cid of allChunkIds) {
    if (!membersByChunk.has(cid)) membersByChunk.set(cid, new Set());
  }

  const out = new Map<string, string[]>();

  // Convert to sorted arrays for MergeStrategyMap.
  for (const [cid, mods] of membersByChunk) {
    out.set(cid, [...mods].sort());
  }

  return out;
}
