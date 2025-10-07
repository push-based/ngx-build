import { ModuleGraph, OutputPath } from './bundle-graph';

/**
 * Performs a depth-first topological sort of directed acyclic module graph.
 *
 * Each module (node) appears **after all of its dependencies** in the returned array.
 * The graph is assumed to have a single entry point and no cycles.
 *
 * @param graph - The full module dependency graph.
 * @param entry - The entry point (root node) to start traversal from.
 * @returns An array of output paths in topological order
 *          (dependencies first, entry point last).
 *
 * @example
 * // A → B → C
 * const graph = {
 *   A: { imports: [{ path: 'B', kind: 'import-statement' }], entryPoint: true },
 *   B: { imports: [{ path: 'C', kind: 'import-statement' }], entryPoint: false },
 *   C: { imports: [], entryPoint: false }
 * };
 *
 * topologicalSort(graph, 'A');
 * // → ['C', 'B', 'A']
 */
export function topologicalSort(
  graph: ModuleGraph,
  entry: OutputPath
): OutputPath[] {
  const visited = new Set<OutputPath>();
  const order: OutputPath[] = [];

  function dfs(node: OutputPath) {
    if (visited.has(node)) return;
    visited.add(node);

    for (const imp of graph[node].imports) {
      dfs(imp.path);
    }

    order.push(node);
  }

  dfs(entry);
  return order;
}
