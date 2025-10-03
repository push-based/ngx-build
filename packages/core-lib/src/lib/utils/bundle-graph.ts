import { Metafile } from 'esbuild';
import { strict as assert } from 'node:assert';

type OutputPath = keyof Metafile['outputs'] & string;
type OutputImport = Metafile['outputs'][OutputPath]['imports'][number];

// type ImportType = Extract<
//   Metafile['outputs'][keyof Metafile['outputs']]['imports'][number]['kind'],
//   'import-statement' | 'dynamic-import'
// >;
type ImportKind = 'import-statement' | 'dynamic-import';

/**
 * 
 * Simplified module graph data structure for algorithm processing.
 * 
 * **Purpose**: This creates a complete reachable module graph (following both static and dynamic imports)
 * as a **simplified data structure** to reduce complexity in subsequent algorithm steps.
 * 
 * **Important**: Including all reachable modules here does NOT violate async boundaries because:
 * - The actual chunking decisions happen in later steps that properly distinguish static vs dynamic edges  
 * - `computeEntryClosure()` uses ONLY static edges to compute the pinned entry set I
 * - `computePerEntryClosures()` uses dynamic edges only to identify async targets, then computes 
 *   closures using static edges with proper boundary enforcement
 * 
 */
export type ModuleGraph = {
  [p: OutputPath]: {
    imports: {
      path: OutputPath;
      kind: ImportKind;
    }[];
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
  // const prune = [
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/sport-tree/sport-tree.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/geo-location/geo-location.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/media/media.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/minigames/minigames.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/banner/banner-widget.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/teaser/teaser.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/popular-bets/popular-multi-bets-widget/popular-multi-bets.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/main/main.component.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/panic-button/panic-button.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/hidden-market/hidden-market.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/bet-column/bet-column.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/bet-generator-shared/bet-generator.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/crm-promotion-widget/crm-promotion-widget.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/favourites-widget/favourites-widget.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/story-content/story-content.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/standings/standings-widget.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/calendar/time-filters-widget.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/competition-list/top-items-widget.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/quick-links/quick-links.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/next-to-go/next-to-go.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/priceboost/price-boost.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/widget/composable/composable-widget.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/outrights-grid/outrights-grid.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/showcase/showcase.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/tabbed-grid/tabbed-grid.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/top-events/top-events.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/highlights-marquee/highlights-marquee.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/scoreboard-carousel/scoreboard-carousel.feature.js',
  //   'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/betfinder-integration/betfinder-wrapper.component.js',
  // ].map((p) => findEntryPointOutput(p, manifest.outputs));

  return getReachableVertices(entryPoint, manifest.outputs).reduce(
    (acc, curr) => {
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
          .filter((v, i, a) => {
            return !a.some((vv, ii) => {
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
              /**
               * This is a known but unexpected to detail. It seems to be
               * duplicating some entries inside the metafile outputs imports
               */
              // console.debug(
              //   `Unexpected duplication of import ${v.path} in chunk stats of ${curr}`
              // );
              return true;
            });
          })
          //.filter((v) => !(prune.includes(v.path) && v.kind === 'dynamic-import')),
      };
      return acc;
    },
    {} as ModuleGraph
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

export function getReachableVerticesFromImportStatements(
  entryPoint: OutputPath,
  metaFileOutputs: Metafile['outputs']
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
      if (imp.kind !== 'import-statement') {
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

export function findEntryPointOutput(
  entryPointPath: string,
  metaFileOutputs: Metafile['outputs']
) {
  return Object.keys(metaFileOutputs).find(
    (key) => metaFileOutputs[key].entryPoint === entryPointPath
  );
}
