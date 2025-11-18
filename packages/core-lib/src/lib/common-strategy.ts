import { getStaticClosure } from './reachability-strategy';
import { ModuleGraph } from './utils/bundle-graph';

/**
 * Common Feature Strategy for module bundling optimization.
 *
 * This strategy identifies modules that are shared across multiple entry points
 * but are not explicitly excluded, creating a common bundle to reduce duplication.
 *
 * The strategy works by:
 * 1. Building a set of all modules reachable from excluded entry points
 * 2. Finding modules that are reachable from included entry points but not in the excluded set
 * 3. Filtering out entry point modules themselves (only including dependencies)
 * 4. Creating a single common bundle containing all shared modules
 *
 * @param includedEntryPoint - Array of entry point identifiers that should be included in the common bundle analysis
 * @param excludedEntryPoints - Array of entry point identifiers that should be excluded from the common bundle
 * @param graph - The module dependency graph containing all modules and their relationships
 * @returns A Map where the key is the first common module and the value is an array of all common modules
 *
 */
export function commonFeatureStrategy(includedEntryPoint: string[], excludedEntryPoints: string[], graph: ModuleGraph) {
    const common = new Set<string>();
    const excluded = new Set<string>();

    excludedEntryPoints.forEach((entry) => {
        getStaticClosure(entry, graph).forEach((e) => excluded.add(e));
    });

    includedEntryPoint.forEach((entry) => {
        getStaticClosure(entry, graph).forEach((e) => {
            if (!excluded.has(e) && !graph[e].entryPoint) {
                common.add(e);
            }
        });
    });

    const _common = [...common];
    return new Map<string, string[]>([[_common[0], _common]]);
}
