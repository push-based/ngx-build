import { ModuleGraph, ModuleImport, OutputPath } from './utils/bundle-graph';
import { topologicalSort } from './utils/topological-sort';

/**
 *
 * Reachability strategy
 *
 * The concept it pretty simple, we run a revert reachability analysis on static nodes from each entry point.
 *
 * 1 Identify all nodes statically accessible from the root (application entry point).
 *  1.1 Collapse them into a new vertex `owned-by:${vertex}` (Collapsing should include mutating the original Graph)
 *
 * 2 Run BFS until we identify an entry point node
 *  2.1 Identify all vertex statically accessible from the entry point vertex
 *  2.2 Identify all vertex accessible from the root vertex if we exclude traversal of the entry point node being analysis
 *  2.3 Identify which nodes statically accessible from the entry point vertex are note accessible from the root vertex if we exclude traversal of the entry point node being analysis
 *  2.4 Collapse them into a new vertex `owned-by:${vertex}` (Collapsing should include mutating the original Graph)
 *  2.5 Continue BFS until we identify an entry point node
 *
 *
 * Note: This way of doing things would require a couple of calculation before time and mutation of the original graph multiple times.
 * An alternative to the collapsing mechanism would be to simply collect the vertex we intend to collapse.
 *
 *
 * 0. Get all Entry point chunks and assign them so merge chunk with only them self
 *
 * 1. Main Entry Point Chunk
 *  1.1 Calculate Root entry points static closure
 *  1.2 Add merge group to Map
 *  1.3 Add merged chunks to assigned chunk set
 *
 * 2. Assign all entry point static chunk not yet assign
 *  2.1 Run BSF on graph until we travers an entry point
 *  2.2 Get set of all nodes reachable from root if current entry point is not traversed
 *  2.3 Get entry point static closure that are not present in above-mentioned
 *      reachability set and are not present are not already assigned.
 *  2.4 Create merge group and add them to assigned chunks set
 *
 * 3. Get all Entry point chunks and assign them so merge chunk with only them self
 *
 * Definitions
 * - Entry Point Static Closure (EPSC): All chunks statically imported by an entry point chunk
 *
 */
export function reachabilityStrategy(
  source: OutputPath,
  graph: ModuleGraph,
  excludedEntryPoints: string[] = []
) {
  const orderedEntryPoints = topologicalSort(graph, source)
    .filter((vertex) => graph[vertex].entryPoint)
    .reverse();

  const mergeGroups = new Map<string, OutputPath[]>();
  const assignedVertices = new Set<OutputPath>();

  const rootStaticClosure = getStaticClosure(source, graph);
  mergeGroups.set(source, [...rootStaticClosure, source]);
  assignedVertices.add(source);
  rootStaticClosure.forEach((vertex: OutputPath) =>
    assignedVertices.add(vertex)
  );

  for (const vertex of orderedEntryPoints) {
    if (vertex === source) {
      continue;
    }

    const staticClosure = getStaticClosure(vertex, graph);
    const accessibleOutsideClosure =
      getReachableVerticesWithEntryPointExclusions(source, graph, [
        ...excludedEntryPoints,
        vertex,
      ]);
    const mergedVertices = [vertex];
    // TODO I am not sure this work
    // Can a merge elements from reachability strategy into the entry point?
    assignedVertices.add(vertex);
    staticClosure.forEach((cursor) => {
      if (
        !accessibleOutsideClosure.has(cursor) &&
        !assignedVertices.has(cursor) &&
        !graph[cursor].entryPoint
      ) {
        mergedVertices.push(cursor);
        assignedVertices.add(cursor);
      }
    });
    mergeGroups.set(vertex, mergedVertices);
  }

  return mergeGroups;
}

export function getReachableVertices(
  entryPoint: OutputPath,
  graph: ModuleGraph,
  traversalExclusionFn?: (moduleImport: ModuleImport) => boolean
) {
  const visited = new Set<OutputPath>();
  const stack: OutputPath[] = [entryPoint];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const output = graph[current];

    for (const imp of output.imports) {
      if (traversalExclusionFn && traversalExclusionFn(imp)) {
        continue;
      }
      const nextPath = imp.path as OutputPath;
      if (!visited.has(nextPath)) {
        stack.push(nextPath);
      }
    }
  }
  return visited;
}

function getStaticClosure(entryPoint: OutputPath, graph: ModuleGraph) {
  const reachableVertices = getReachableVertices(
    entryPoint,
    graph,
    (imp) => imp.kind !== 'import-statement'
  );

  for (const vertex of reachableVertices) {
    if (graph[vertex].entryPoint) {
      reachableVertices.delete(vertex);
    }
  }
  return reachableVertices;
}

function getReachableVerticesWithEntryPointExclusions(
  entryPoint: OutputPath,
  graph: ModuleGraph,
  excludedEntryPoints: OutputPath[]
) {
  const excluded = new Set<OutputPath>(excludedEntryPoints);

  const reachableVertices = getReachableVertices(entryPoint, graph, (imp) =>
    excluded.has(imp.path)
  );

  for (const vertex of reachableVertices) {
    if (graph[vertex].entryPoint) {
      reachableVertices.delete(vertex);
    }
  }
  return reachableVertices;
}

export function getProductExclusionEntryPoints(
  mainEntryPoint: string,
  productEntryPoint: string,
  graph: ModuleGraph
) {
  const rootClosure = getReachableVertices(
    mainEntryPoint,
    graph,
    (imp) => imp.kind !== 'import-statement'
  );

  const exclude = new Set<OutputPath>();
  for (const vertex of rootClosure) {
    for (const imps of graph[vertex].imports) {
      if (imps.kind === 'dynamic-import' && productEntryPoint !== imps.path) {
        exclude.add(imps.path);
      }
    }
  }
  return exclude;
}

export function applyReachabilityStrategy(
  graph: ModuleGraph,
  reachabilityStrategy: Map<string, string[]>
) {
  const deletedNodes = new Set<string>();
  const updatedGraph = structuredClone(graph);

  // Iterate over the strategy
  for (const [key, nodes] of reachabilityStrategy) {
    for (const node of nodes) {
      // If node is same as key, do nothing
      if (node === key) {
        continue;
      }

      // Delete node from graph
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete updatedGraph[node];

      // Save into deleted nodes set
      deletedNodes.add(node);
    }
  }

  // Iterate over graph and remove all imports to deleted nodes
  for (const nodePath of Object.keys(updatedGraph)) {
    const module = updatedGraph[nodePath];

    // Filter out imports that reference deleted nodes
    module.imports = module.imports.filter(
      (imp) => !deletedNodes.has(imp.path)
    );
  }
  return updatedGraph;
}

/**
 * Apply leaf strategy to the module graph
 * Removes merged leaf nodes and redirects imports to the primary node in each group
 */
export function applyLeafStrategy(
  graph: ModuleGraph,
  leafStrategy: Map<string, string[]>
) {
  const deletedNodes = new Set<string>();
  const nodeMapping = new Map<string, string>(); // Maps deleted node -> primary node
  const updatedGraph = structuredClone(graph);

  // Build mapping and delete merged nodes
  for (const [primaryNode, nodes] of leafStrategy) {
    for (const node of nodes) {
      // If node is same as primary, skip it
      if (node === primaryNode) {
        continue;
      }

      // Map this node to the primary node
      nodeMapping.set(node, primaryNode);

      // Delete node from graph
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete updatedGraph[node];

      // Save into deleted nodes set
      deletedNodes.add(node);
    }
  }

  // Iterate over graph and update imports
  for (const nodePath of Object.keys(updatedGraph)) {
    const module = updatedGraph[nodePath];

    // Update imports: redirect to primary node or remove if deleted
    module.imports = module.imports
      .map((imp) => {
        // If import points to a deleted node, redirect to primary node
        if (nodeMapping.has(imp.path)) {
          return {
            ...imp,
            path: nodeMapping.get(imp.path)!,
          };
        }
        return imp;
      })
      .filter((imp, index, self) => {
        // Remove duplicates (same path after mapping)
        return index === self.findIndex((i) => i.path === imp.path);
      });
  }

  return updatedGraph;
}
