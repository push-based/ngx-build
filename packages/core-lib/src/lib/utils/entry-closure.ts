import { Id, IndexedGraph } from './indexed-graph';

/**
 * Compute the main entry's static closure I (including the main itself).
 * Traverses ONLY 'import-statement' relationships.
 *
 * @param G    Indexed graph from Step 1
 * @param main The chosen main entry module id
 * @returns    A Set<Id> containing all modules in the entry bundle (pinned), including `main`
 * @throws     If `main` is not present or not marked as an entry point
 */
export function computeEntryClosure(G: IndexedGraph, main: Id): Set<Id> {
  if (!G.modules.has(main)) {
    throw new Error(`computeEntryClosure: main "${main}" is not present in graph modules.`);
  }
  if (!G.entryPoints.has(main)) {
    // If your convention is “main must be an entry point”, keep this as an error.
    // If not, downgrade to a warning depending on your ingestion rules.
    throw new Error(`computeEntryClosure: "${main}" is not marked entryPoint=true.`);
  }

  // DFS/BFS over static imports only
  const I = new Set<Id>([main]);
  const stack: Id[] = [main];

  while (stack.length) {
    const u = stack.pop()!;
    const neighbors = G.staticAdj.get(u);
    if (!neighbors) continue;

    for (const v of neighbors) {
      if (!I.has(v)) {
        I.add(v);
        stack.push(v);
      }
    }
  }

  return I;
}
