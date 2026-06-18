import { ModuleGraph, ModuleImport, OutputPath } from './utils/bundle-graph';
import { topologicalSort } from './utils/topological-sort';

/**
 * Reachability Strategy
 *
 * @description
 * Traverses the graph from a provided entry point checking the reachability of each node reachable from the entry point
 *
 * @param source
 * @param graph
 * @param excludedEntryPoints
 */
export function reachabilityStrategy(source: OutputPath, graph: ModuleGraph, excludedEntryPoints: string[] = []) {
    const orderedEntryPoints = topologicalSort(graph, source)
        .filter((vertex) => graph[vertex].entryPoint)
        .reverse();

    const mergeGroups = new Map<string, OutputPath[]>();
    const assignedVertices = new Set<OutputPath>();

    const rootStaticClosure = getStaticClosure(source, graph);
    mergeGroups.set(source, [...rootStaticClosure, source]);
    assignedVertices.add(source);
    rootStaticClosure.forEach((vertex: OutputPath) => assignedVertices.add(vertex));

    for (const vertex of orderedEntryPoints) {
        if (vertex === source) {
            continue;
        }

        const staticClosure = getStaticClosure(vertex, graph);
        const accessibleOutsideClosure = getReachableVerticesWithEntryPointExclusions(source, graph, [...excludedEntryPoints, vertex]);
        const mergedVertices = [vertex];
        assignedVertices.add(vertex);
        staticClosure.forEach((cursor) => {
            if (!accessibleOutsideClosure.has(cursor) && !assignedVertices.has(cursor) && !graph[cursor].entryPoint) {
                mergedVertices.push(cursor);
                assignedVertices.add(cursor);
            }
        });
        mergeGroups.set(vertex, mergedVertices);
    }

    return mergeGroups;
}

export function getReachableVertices(entryPoint: OutputPath, graph: ModuleGraph, traversalExclusionFn?: (moduleImport: ModuleImport) => boolean) {
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

export function getStaticClosure(entryPoint: OutputPath, graph: ModuleGraph) {
    const reachableVertices = getReachableVertices(entryPoint, graph, (imp) => imp.kind !== 'import-statement');

    for (const vertex of reachableVertices) {
        if (graph[vertex].entryPoint) {
            reachableVertices.delete(vertex);
        }
    }
    return reachableVertices;
}

function getReachableVerticesWithEntryPointExclusions(entryPoint: OutputPath, graph: ModuleGraph, excludedEntryPoints: OutputPath[]) {
    const excluded = new Set<OutputPath>(excludedEntryPoints);

    const reachableVertices = getReachableVertices(entryPoint, graph, (imp) => excluded.has(imp.path));

    for (const vertex of reachableVertices) {
        if (graph[vertex].entryPoint) {
            reachableVertices.delete(vertex);
        }
    }
    return reachableVertices;
}
