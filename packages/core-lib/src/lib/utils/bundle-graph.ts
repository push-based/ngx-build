import { Metafile } from 'esbuild';
import { strict as assert } from 'node:assert/strict';

export type OutputPath = keyof Metafile['outputs'] & string;
export type OutputImport = Metafile['outputs'][OutputPath]['imports'][number];

type ImportKind = Extract<
  Metafile['outputs'][keyof Metafile['outputs']]['imports'][number]['kind'],
  'import-statement' | 'dynamic-import'
>;

export type ModuleImport = {
  path: OutputPath;
  kind: ImportKind;
};
/**
 *
 * Simplified module graph data structure for algorithm processing.
 *
 * **Purpose**: This creates a complete reachable module graph (following both static and dynamic imports)
 * as a **simplified data structure** to reduce complexity in subsequent algorithm steps.
 *
 */
export type ModuleGraph = {
  [p: OutputPath]: {
    imports: ModuleImport[];
    entryPoint: boolean;
  };
};

/**
 * Generate a simplified module graph from ESBuild metafile for algorithm processing.
 *
 * **Data Transformation**: Converts raw ESBuild metafile into a clean, normalized
 * ModuleGraph structure that includes all modules reachable from the entry point
 * (following both static and dynamic imports).
 *
 * **Why include everything**: This comprehensive approach simplifies subsequent
 * algorithm steps by providing a complete view of the module universe, while
 * the actual async boundary enforcement happens in later phases that properly
 * distinguish between edge types.
 *
 * @param entryPoint - The main application entry point
 * @param manifest - ESBuild metafile containing build metadata
 * @returns Simplified module graph with normalized import relationships
 */
export function generateBundleGraph(
  entryPoint: OutputPath,
  manifest: Metafile
): ModuleGraph {
  return getReachableVertices(entryPoint, manifest.outputs).reduce<ModuleGraph>(
    (acc, curr) => {
      // eslint-disable-next-line no-param-reassign
      acc[curr] = {
        entryPoint: !!manifest.outputs[curr].entryPoint,
        imports: manifest.outputs[curr].imports
          .filter(
            (v) => v.kind === 'dynamic-import' || v.kind === 'import-statement'
          )
          .map((v) => ({
            path: v.path as OutputPath,
            kind: v.kind as ImportKind,
          }))
          /**
           * Output Import Deduplication
           *
           * This is a known but unexpected to detail. It seems to be duplicating some entries inside the
           * metafile outputs imports. This can potentially cause issues in future strategy checks and graph
           * traversals. Therefor we deduplicate them, however this only happens when it's a complete duplicate
           * We do not expect a partial duplicate such as two imports with the same path but different kinds.
           */
          .filter(
            (v, i, a) =>
              !a.some((vv, ii) => {
                if (ii >= i) {
                  return false; // only check earlier elements
                }
                if (v.path !== vv.path) {
                  return false;
                }
                /**
                 * This error would be  unexpected as it would mean that a chunk
                 * is being both dynamic and statically imported in another chunk.
                 * And this does not make sense as it breaks the tree shaking
                 * and code splitting paradigm explained in esbuild docs.
                 * https://github.com/evanw/esbuild/blob/main/docs/architecture.md#code-splitting
                 */
                assert(
                  v.kind === vv.kind,
                  `metafile outputs for ${curr} show it importing ${v.path} both as ${v.kind} and ${vv.kind}`
                );
                // console.debug(
                //   `Unexpected duplication of import ${v.path} in chunk stats of ${curr}`
                // );
                return true;
              })
          ),
      };
      return acc;
    },
    {} satisfies ModuleGraph
  );
}

export function getReachableVertices(
  entryPoint: OutputPath,
  metaFileOutputs: Metafile['outputs'],
  exclusionFn?: (imp: OutputImport) => boolean
): OutputPath[] {
  const visited = new Set<OutputPath>();
  const stack: OutputPath[] = [entryPoint];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const output = metaFileOutputs[current];
    if (!output) {
      continue;
    }

    for (const imp of output.imports) {
      if (exclusionFn && exclusionFn(imp)) {
        continue;
      }
      const nextPath = imp.path as OutputPath;
      if (!visited.has(nextPath)) {
        stack.push(nextPath);
      }
    }
  }

  return [...visited];
}
