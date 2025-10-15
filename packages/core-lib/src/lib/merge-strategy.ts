import { Metafile } from 'esbuild';

import {
  applyLeafStrategy,
  applyReachabilityStrategy,
  getProductExclusionEntryPoints,
  reachabilityStrategy,
} from './reachability-strategy';
import { generateBundleGraph } from './utils/bundle-graph';
import { leafStrategy } from './leaf-strategy';

export function mergeStrategy(
  entryPointChunk: string,
  metafile: Metafile
): Map<string, string[]> {
  const graph = generateBundleGraph(entryPointChunk, metafile);

  const sportsEntry = findEntryPointOutput(
    'dist/build/packages/sports/web/libs/entrypoint-lib/esm2022/frontend-sports-web-entrypoint-lib.js',
    metafile.outputs
  )!;

  const excludedChunksFromReachability: string[] = [
    ...getProductExclusionEntryPoints(entryPointChunk, sportsEntry, graph),
  ];

  const _reachabilityStrategy = reachabilityStrategy(
    entryPointChunk,
    graph,
    excludedChunksFromReachability
  );

  const graphAfterReachability = applyReachabilityStrategy(
    graph,
    _reachabilityStrategy
  );

  const sportsLeafStrategy = leafStrategy(
    graphAfterReachability,
    [sportsEntry],
    metafile.outputs
  );

  // Step 2: Apply sports leaf strategy to update the graph
  const graphAfterSportsLeaf = applyLeafStrategy(
    graphAfterReachability,
    sportsLeafStrategy
  );

  // Step 3: Apply leaf strategy to vanilla entry points on the updated graph
  const vanillaEntryPoints: string[] = [
    ...getProductExclusionEntryPoints(
      entryPointChunk,
      sportsEntry,
      graphAfterSportsLeaf
    ),
  ].filter((excludeEntryPoint) =>
    metafile.outputs[excludeEntryPoint].entryPoint!.includes(
      '/packages/vanilla'
    )
  );

  const vanillaLeafStrategy = leafStrategy(
    graphAfterSportsLeaf,
    vanillaEntryPoints,
    metafile.outputs
  );

  // Step 4: Apply vanilla leaf strategy to get final graph
  const graphAfterLeafStrategy = applyLeafStrategy(
    graphAfterSportsLeaf,
    vanillaLeafStrategy
  );

  // Merge all three strategies
  let mergedStrategy = _reachabilityStrategy;
  mergedStrategy = mergeTwoStrategies(mergedStrategy, sportsLeafStrategy);
  mergedStrategy = mergeTwoStrategies(mergedStrategy, vanillaLeafStrategy);

  // Validate and report statistics
  const assigned = new Set<string>();
  let reachabilityCount = 0;
  _reachabilityStrategy.forEach((group) => {
    group.forEach((c) => {
      if (assigned.has(c)) {
        console.log('Something went wrong in reachability', c);
      }
      assigned.add(c);
    });
    reachabilityCount = reachabilityCount + group.length - 1;
  });

  let sportsLeafCount = 0;
  sportsLeafStrategy.forEach((group) => {
    group.forEach((c) => {
      if (assigned.has(c)) {
        console.log('Something went wrong in sports leaf strategy', c);
      }
      assigned.add(c);
    });
    sportsLeafCount = sportsLeafCount + group.length - 1;
  });

  let vanillaLeafCount = 0;
  vanillaLeafStrategy.forEach((group) => {
    group.forEach((c) => {
      if (assigned.has(c)) {
        console.log('Something went wrong in vanilla leaf strategy', c);
      }
      assigned.add(c);
    });
    vanillaLeafCount = vanillaLeafCount + group.length - 1;
  });

  const chunkCount = Object.keys(graph).length;
  const entryChunkCount = Object.values(graph).filter(
    (c) => c.entryPoint
  ).length;

  console.log(
    `Reachability strategy reduced ${reachabilityCount} chunks from ${chunkCount}`
  );
  console.log(
    `Sports leaf strategy reduced ${sportsLeafCount} additional chunks`
  );
  console.log(
    `Vanilla leaf strategy reduced ${vanillaLeafCount} additional chunks`
  );
  console.log(
    `Total reduction: ${
      reachabilityCount + sportsLeafCount + vanillaLeafCount
    } chunks\n` +
      `There should be ${
        chunkCount - reachabilityCount - sportsLeafCount - vanillaLeafCount
      } chunks remaining of which ${entryChunkCount} are entry points!`
  );

  // Add unassigned chunks to the merged strategy
  // Use the final graph state after both strategies have been applied
  Object.keys(graphAfterLeafStrategy)
    .filter((c) => !assigned.has(c))
    .forEach((c) => {
      if (mergedStrategy.has(c)) {
        throw new Error(`Chunk ${c} already in merged strategy`);
      }
      mergedStrategy.set(c, [c]);
    });

  return mergedStrategy;
}

export function findEntryPointOutput(
  entryPointPath: string,
  metaFileOutputs: Metafile['outputs']
) {
  return Object.keys(metaFileOutputs).find(
    (key) => metaFileOutputs[key].entryPoint === entryPointPath
  );
}

/**
 * Merges two merge strategies together
 * The second strategy takes precedence if there are overlaps
 */
function mergeTwoStrategies(
  strategy1: Map<string, string[]>,
  strategy2: Map<string, string[]>
): Map<string, string[]> {
  const merged = new Map<string, string[]>();

  // Add all entries from strategy1
  for (const [key, value] of strategy1) {
    merged.set(key, [...value]);
  }

  // Add all entries from strategy2
  // If a node was already assigned in strategy1, we need to handle it
  const nodesInStrategy1 = new Set<string>();
  for (const [, nodes] of strategy1) {
    nodes.forEach((node) => nodesInStrategy1.add(node));
  }

  for (const [key, nodes] of strategy2) {
    // Check if any nodes in this group were already assigned
    const alreadyAssigned = nodes.filter((node) => nodesInStrategy1.has(node));

    if (alreadyAssigned.length > 0) {
      console.log(
        `Warning: Nodes already assigned in strategy1:`,
        alreadyAssigned
      );
      // Skip nodes that were already assigned
      const newNodes = nodes.filter((node) => !nodesInStrategy1.has(node));
      if (newNodes.length > 0) {
        merged.set(key, newNodes);
      }
    } else {
      // No overlap, add the group as-is
      merged.set(key, [...nodes]);
    }
  }

  return merged;
}
