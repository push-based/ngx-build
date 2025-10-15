import { ModuleGraph, ModuleImport, OutputPath } from './utils/bundle-graph';
import { Metafile } from 'esbuild';

export function leafStrategy(
  graph: ModuleGraph,
  entryGroup: string[],
  metafileOutputs: Metafile['outputs']
): Map<string, string[]> {
  const strategy = new Map<string, string[]>();
  const reachableLeafs = new Map<string, number>();

  // Collect all reachable leaf nodes with their sizes
  for (const entry of entryGroup) {
    const reachable = getReachableVertices(entry, graph);
    reachable.forEach((node) => {
      if (!graph[node].entryPoint && graph[node].imports.length === 0) {
        reachableLeafs.set(node, metafileOutputs[node].bytes);
      }
    });
  }

  console.log('leafStrategy - total leaf nodes:', reachableLeafs.size);

  // Convert to array and sort by size (largest first)
  const leafNodes = Array.from(reachableLeafs.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  // Group nodes using size-balanced bin packing
  const MIN_CHUNK_SIZE = 5_000;
  const MAX_CHUNK_SIZE = 60_000;
  const groups = balanceChunksBySize(leafNodes, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE);

  // Convert groups to strategy map
  groups.forEach((group) => {
    if (group.length > 0) {
      const [primaryNode] = group;
      strategy.set(primaryNode, group);
    }
  });

  console.log('leafStrategy - created groups:', groups.length);
  console.log(
    'leafStrategy - group sizes:',
    groups.map((g) => g.length).join(', ')
  );

  return strategy;
}

/**
 * Groups chunks to minimize size while ensuring:
 * - No group is smaller than minSize bytes
 * - No group is larger than maxSize bytes
 * Uses a greedy algorithm to pack nodes until reaching minSize, but not exceeding maxSize
 */
function balanceChunksBySize(
  nodes: Array<[string, number]>,
  minSize: number,
  maxSize: number
): string[][] {
  if (nodes.length === 0) {
    return [];
  }

  // Calculate total size
  const totalSize = nodes.reduce((sum, [, size]) => sum + size, 0);

  // If total size is less than minSize, put everything in one group
  if (totalSize < minSize) {
    console.log(
      `Total size ${totalSize} is less than minSize ${minSize}, creating single group`
    );
    return [nodes.map(([node]) => node)];
  }

  console.log(
    `Total size: ${totalSize}, Min: ${minSize}, Max: ${maxSize} bytes per group`
  );

  const groups: string[][] = [];
  let currentGroup: string[] = [];
  let currentSize = 0;

  // Greedy algorithm: pack nodes between minSize and maxSize
  for (let i = 0; i < nodes.length; i++) {
    const [node, size] = nodes[i];

    // Check if adding this node would exceed maxSize
    if (currentSize > 0 && currentSize + size > maxSize) {
      // Close current group if it meets minSize
      if (currentSize >= minSize) {
        groups.push(currentGroup);
        console.log(
          `Created group with ${currentGroup.length} nodes, total size: ${currentSize}`
        );
        currentGroup = [];
        currentSize = 0;
      }
      // If current group is below minSize, we'll add this node anyway to try to reach it
    }

    currentGroup.push(node);
    currentSize += size;

    // Check if single node exceeds maxSize (edge case)
    if (size > maxSize) {
      console.log(
        `Warning: Single node size ${size} exceeds maxSize ${maxSize}`
      );
    }

    // If we've reached maxSize, close this group and start a new one
    if (currentSize >= maxSize) {
      groups.push(currentGroup);
      console.log(
        `Created group (at max) with ${currentGroup.length} nodes, total size: ${currentSize}`
      );
      currentGroup = [];
      currentSize = 0;
    } else if (currentSize >= minSize && currentGroup.length > 0) {
      // Check if the next node would push us over maxSize
      // If so, close the current group now (greedy approach for smallest groups)
      if (i < nodes.length - 1) {
        const [, nextSize] = nodes[i + 1];
        if (currentSize + nextSize > maxSize) {
          groups.push(currentGroup);
          console.log(
            `Created group (next would exceed) with ${currentGroup.length} nodes, total size: ${currentSize}`
          );
          currentGroup = [];
          currentSize = 0;
        }
      }
    }
  }

  // Handle remaining nodes
  if (currentGroup.length > 0) {
    if (currentSize >= minSize) {
      // Group meets minSize, add it as-is
      console.log(
        `Final group with ${currentGroup.length} nodes, total size: ${currentSize}`
      );
      groups.push(currentGroup);
    } else if (groups.length > 0) {
      // If we have a partial group below minSize, try to merge with last group
      const lastGroupWouldExceedMax = groups.length > 0;
      if (lastGroupWouldExceedMax) {
        // Check if merging would exceed maxSize
        // For now, merge anyway to avoid groups below minSize
        console.log(
          `Merging remaining ${currentGroup.length} nodes (size: ${currentSize}) with last group`
        );
        groups[groups.length - 1].push(...currentGroup);
      }
    } else {
      // If this is the only group, keep it even if below minSize
      console.log(
        `Only one group with ${currentGroup.length} nodes (size: ${currentSize})`
      );
      groups.push(currentGroup);
    }
  }

  console.log(
    `Final: ${groups.length} groups with node counts:`,
    groups.map((g) => g.length)
  );

  return groups;
}

function getReachableVertices(entryPoint: OutputPath, graph: ModuleGraph) {
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
      const nextPath = imp.path as OutputPath;
      if (!visited.has(nextPath)) {
        stack.push(nextPath);
      }
    }
  }
  return visited;
}
