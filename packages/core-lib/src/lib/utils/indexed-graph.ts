import { ModuleGraph } from './bundle-graph';

export type Id = string;
export interface IndexedGraph {
  /** all modules that appear as keys in the graph */
  modules: ReadonlySet<Id>;
  /** the subset marked as entry points (main + dynamic targets) */
  entryPoints: ReadonlySet<Id>;
  /** importer -> statically imported modules */
  staticAdj: ReadonlyMap<Id, ReadonlySet<Id>>;
  /** importer -> dynamically imported targets (module ids) */
  dynamicAdj: ReadonlyMap<Id, ReadonlySet<Id>>;
  /** quick warnings collected during indexing (missing nodes, non-entry dyn targets, etc.) */
  warnings: string[];
}/**
 * Normalize/Index the ModuleGraph
 * - Build adjacency sets for static and dynamic imports
 * - Collect the set of entry points
 * - Sanity-check that dynamic targets exist (and optionally are entry points)
 */
export function indexModuleGraph(graph: ModuleGraph): IndexedGraph {
  const modules = new Set<Id>(Object.keys(graph));
  const entryPoints = new Set<Id>(Object.keys(graph).filter((id) => graph[id].entryPoint));

  const staticAdj = new Map<Id, Set<Id>>();
  const dynamicAdj = new Map<Id, Set<Id>>();
  const warnings: string[] = [];

  const ensure = (m: Map<Id, Set<Id>>, from: Id) => {
    let s = m.get(from);
    if (!s) { s = new Set<Id>(); m.set(from, s); }
    return s;
  };

  for (const [from, node] of Object.entries(graph)) {
    for (const imp of node.imports ?? []) {
      if (!modules.has(imp.path)) {
        warnings.push(`Import from "${from}" to missing module "${imp.path}"`);
        continue;
      }
      if (imp.kind === 'import-statement') {
        ensure(staticAdj, from).add(imp.path);
      } else {
        // dynamic-import
        ensure(dynamicAdj, from).add(imp.path);
        if (!entryPoints.has(imp.path)) {
          // If your convention is “every dynamic target is an entry point”, flag it.
          warnings.push(
            `Dynamic target "${imp.path}" (imported by "${from}") is not marked entryPoint=true`
          );
        }
      }
    }
    // ensure keys exist even if node has no imports
    if (!staticAdj.has(from)) staticAdj.set(from, new Set());
    if (!dynamicAdj.has(from)) dynamicAdj.set(from, new Set());
  }

  // freeze-ish read-only views
  const roSet = <T>(s: Set<T>) => new Set(s) as ReadonlySet<T>;
  const roMap = (m: Map<Id, Set<Id>>) =>
    new Map([...m.entries()].map(([k, v]) => [k, roSet(v)])) as ReadonlyMap<Id, ReadonlySet<Id>>;

  return {
    modules: roSet(modules),
    entryPoints: roSet(entryPoints),
    staticAdj: roMap(staticAdj),
    dynamicAdj: roMap(dynamicAdj),
    warnings,
  };
}

