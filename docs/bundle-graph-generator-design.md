# Bundle Graph Generator - Technical Design Document

## Overview & Purpose

The Bundle Graph Generator is a helper function that transforms esbuild's complex dependency graph structure into a simplified, traversable bundle graph. It extracts meaningful dependency relationships by starting from an entry point and following only import-statement and dynamic-import edges.

### Problem Statement
- Esbuild's `Metafile` contains complex DAG structures with multiple edge types
- Need to analyze bundle dependencies starting from specific entry points
- Only certain import types are relevant for bundle analysis
- Must handle circular dependencies gracefully

## Function Specification

### Signature
```typescript
function generateBundleGraph(
  entrypoint: OutputPath,
  manifest: Metafile
): BundleGraph
```

### Parameters
- **`entrypoint`**: `OutputPath` - A key from `manifest.outputs` representing the starting point for traversal
- **`manifest`**: `Metafile` - The esbuild metafile containing the complete dependency graph

### Returns
- **`BundleGraph`**: A simplified graph structure containing only relevant dependencies

## Type Definitions

```typescript
import { Metafile } from 'esbuild';

// Core types derived from esbuild
type OutputPath = keyof Metafile['outputs'];

type EdgeType = Extract<
  Metafile['outputs'][keyof Metafile['outputs']]['imports'][number]['kind'], 
  'import-statement' | 'dynamic-import'
>;

// Output types
interface BundleGraph {
  /** All reachable output paths from the entrypoint */
  vertices: Set<OutputPath>;
  
  /** Adjacency list representation of filtered dependencies */
  edges: Map<OutputPath, BundleEdge[]>;
  
  /** The starting point of the traversal */
  entrypoint: OutputPath;
  
  /** Detected circular dependency paths (for debugging) */
  cycles: OutputPath[][];
  
  /** Traversal metadata */
  metadata: TraversalMetadata;
}

interface BundleEdge {
  /** Target output path */
  target: OutputPath;
  
  /** Type of import relationship */
  kind: EdgeType;
}

interface TraversalMetadata {
  /** Total nodes processed */
  totalNodes: number;
  
  /** Number of cycles detected */
  cycleCount: number;
  
  /** Traversal execution time in milliseconds */
  executionTime: number;
}

// Internal traversal state
interface TraversalState {
  white: Set<OutputPath>;  // Unvisited nodes
  gray: Set<OutputPath>;   // Currently being processed
  black: Set<OutputPath>;  // Fully processed
  cycles: OutputPath[][];  // Detected cycles
  currentPath: OutputPath[]; // Current traversal path for cycle detection
}
```

## Algorithm Design

### High-Level Approach
1. **Initialize**: Set up traversal state with all nodes as "white" (unvisited)
2. **Traverse**: Use Depth-First Search (DFS) from the entrypoint
3. **Filter**: Only follow edges of type 'import-statement' or 'dynamic-import'
4. **Detect Cycles**: Track cycles using three-state coloring
5. **Build Graph**: Construct the simplified graph structure

### Detailed Algorithm

```typescript
function generateBundleGraph(entrypoint: OutputPath, manifest: Metafile): BundleGraph {
  const startTime = performance.now();
  
  // Initialize traversal state
  const state: TraversalState = {
    white: new Set(Object.keys(manifest.outputs) as OutputPath[]),
    gray: new Set(),
    black: new Set(),
    cycles: [],
    currentPath: []
  };
  
  const graph: BundleGraph = {
    vertices: new Set(),
    edges: new Map(),
    entrypoint,
    cycles: [],
    metadata: {
      totalNodes: 0,
      cycleCount: 0,
      executionTime: 0
    }
  };
  
  // Perform DFS traversal
  dfsTraverse(entrypoint, manifest, state, graph);
  
  // Finalize metadata
  graph.metadata.executionTime = performance.now() - startTime;
  graph.metadata.totalNodes = graph.vertices.size;
  graph.metadata.cycleCount = graph.cycles.length;
  
  return graph;
}

function dfsTraverse(
  node: OutputPath, 
  manifest: Metafile, 
  state: TraversalState, 
  graph: BundleGraph
): void {
  // Cycle detection: if node is gray, we've found a cycle
  if (state.gray.has(node)) {
    const cycleStart = state.currentPath.indexOf(node);
    const cycle = state.currentPath.slice(cycleStart).concat([node]);
    state.cycles.push(cycle);
    graph.cycles.push(cycle);
    return; // Don't continue processing to avoid infinite loop
  }
  
  // Skip if already fully processed
  if (state.black.has(node)) {
    return;
  }
  
  // Mark as currently being processed
  state.white.delete(node);
  state.gray.add(node);
  state.currentPath.push(node);
  
  // Add to graph
  graph.vertices.add(node);
  if (!graph.edges.has(node)) {
    graph.edges.set(node, []);
  }
  
  // Process dependencies
  const output = manifest.outputs[node];
  if (output?.imports) {
    for (const importInfo of output.imports) {
      // Filter for relevant edge types
      if (importInfo.kind === 'import-statement' || importInfo.kind === 'dynamic-import') {
        const targetPath = importInfo.path as OutputPath;
        
        // Add edge to graph
        graph.edges.get(node)!.push({
          target: targetPath,
          kind: importInfo.kind
        });
        
        // Recursively traverse target
        dfsTraverse(targetPath, manifest, state, graph);
      }
    }
  }
  
  // Mark as fully processed
  state.gray.delete(node);
  state.black.add(node);
  state.currentPath.pop();
}
```

## Circular Dependency Handling

### Strategy: Detect + Continue
- **Detection**: Use three-state node coloring (White → Gray → Black)
- **Handling**: Record cycles but continue traversal
- **Benefits**: Robust analysis of real-world bundles with circular dependencies

### Cycle Detection Logic
1. **White nodes**: Not yet visited
2. **Gray nodes**: Currently being processed (on the call stack)
3. **Black nodes**: Fully processed

When encountering a **gray** node during traversal:
- Extract the cycle path from current traversal stack
- Record the cycle in the results
- Skip further processing of that path to prevent infinite recursion

### Cycle Information
Detected cycles are stored in the `BundleGraph.cycles` array for:
- Debugging dependency issues
- Bundle optimization insights
- Circular dependency reporting

## Edge Cases & Error Handling

### Input Validation
```typescript
function validateInputs(entrypoint: OutputPath, manifest: Metafile): void {
  if (!manifest.outputs) {
    throw new Error('Invalid manifest: missing outputs');
  }
  
  if (!(entrypoint in manifest.outputs)) {
    throw new Error(`Entrypoint '${entrypoint}' not found in manifest outputs`);
  }
}
```

### Edge Cases Handled
1. **Missing entrypoint**: Function assumes entrypoint exists (per requirements)
2. **Malformed imports**: Gracefully skip invalid import entries
3. **Self-references**: Detected as single-node cycles
4. **Disconnected graphs**: Only processes reachable nodes from entrypoint
5. **Empty dependencies**: Creates graph with single vertex (entrypoint)

## Performance Considerations

### Time Complexity
- **Best case**: O(V + E) - Linear graph traversal
- **Worst case**: O(V + E) - Each node and edge visited once
- **Cycle detection**: O(1) additional overhead per node

### Space Complexity
- **Graph storage**: O(V + E) - Store all vertices and filtered edges
- **Traversal state**: O(V) - Track node states and current path
- **Overall**: O(V + E)

### Optimization Strategies
1. **Early termination**: Skip processing of already-black nodes
2. **Edge filtering**: Only process relevant import types
3. **Set operations**: Use `Set` for O(1) membership testing
4. **Memory efficiency**: Clear traversal state after completion

### Scalability
- Suitable for typical bundle sizes (hundreds to thousands of modules)
- Memory usage grows linearly with graph size
- Execution time typically under 10ms for large bundles

## Usage Examples

### Basic Usage
```typescript
import { generateBundleGraph } from './bundle-graph-generator';
import { Metafile } from 'esbuild';

// Assume we have a manifest from esbuild
const manifest: Metafile = { /* ... */ };
const entrypoint = 'dist/main.js';

const graph = generateBundleGraph(entrypoint, manifest);

console.log(`Found ${graph.vertices.size} reachable modules`);
console.log(`Detected ${graph.cycles.length} circular dependencies`);
```

### Analyzing Dependencies
```typescript
// Find all direct dependencies of a module
const directDeps = graph.edges.get('dist/main.js') || [];
console.log('Direct dependencies:', directDeps.map(edge => edge.target));

// Find dynamic imports
const dynamicImports = directDeps
  .filter(edge => edge.kind === 'dynamic-import')
  .map(edge => edge.target);
console.log('Dynamic imports:', dynamicImports);
```

### Cycle Analysis
```typescript
// Report circular dependencies
if (graph.cycles.length > 0) {
  console.log('Circular dependencies detected:');
  graph.cycles.forEach((cycle, index) => {
    console.log(`Cycle ${index + 1}: ${cycle.join(' → ')}`);
  });
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('generateBundleGraph', () => {
  describe('basic functionality', () => {
    it('should generate graph from simple linear dependency');
    it('should filter non-relevant import types');
    it('should include entrypoint in vertices');
  });
  
  describe('circular dependency handling', () => {
    it('should detect simple circular dependencies');
    it('should detect complex multi-node cycles');
    it('should continue traversal after cycle detection');
    it('should not enter infinite loops');
  });
  
  describe('edge cases', () => {
    it('should handle empty dependencies');
    it('should handle self-referencing modules');
    it('should handle malformed import entries');
    it('should handle disconnected graph components');
  });
  
  describe('performance', () => {
    it('should complete within time bounds for large graphs');
    it('should have linear memory usage');
  });
});
```

### Test Data Generation
```typescript
// Helper to create test manifests
function createTestManifest(structure: DependencyStructure): Metafile {
  // Generate realistic test manifests for various scenarios
}

// Specific test cases
const testCases = {
  linear: createLinearDependencyChain(10),
  circular: createCircularDependencyGraph(),
  complex: createComplexBundleStructure(),
  large: createLargeScaleBundle(1000)
};
```

### Integration Tests
- Test with real esbuild manifests from actual projects
- Validate performance with large-scale applications
- Cross-reference results with manual dependency analysis

## Implementation Checklist

### Core Implementation
- [ ] Define TypeScript interfaces
- [ ] Implement main `generateBundleGraph` function
- [ ] Implement DFS traversal with cycle detection
- [ ] Add input validation
- [ ] Implement performance timing

### Edge Case Handling
- [ ] Handle malformed import entries
- [ ] Handle self-references
- [ ] Handle empty dependency lists
- [ ] Add graceful error handling

### Testing
- [ ] Write comprehensive unit tests  
- [ ] Create test data generators
- [ ] Add performance benchmarks
- [ ] Test with real-world bundle manifests

### Documentation
- [ ] Add JSDoc comments to all public functions
- [ ] Create usage examples
- [ ] Document performance characteristics
- [ ] Add troubleshooting guide

---

**Document Version**: 1.0  
**Last Updated**: October 2, 2025  
**Author**: Technical Design Review
