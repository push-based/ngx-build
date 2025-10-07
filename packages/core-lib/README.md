# Vertex Reduction & Merge Strategy

> **Purpose**: Reduce a large JS module graph to a smaller chunk graph (super-vertices) that yields fewer network requests while guaranteeing no byte increase on any execution path.

This document provides a complete specification for implementing an optimal module chunking algorithm. It includes the problem definition, data model, step-by-step algorithm, mathematical guarantees, and validation criteria.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Input & Output](#input--output)
3. [Core Concepts & Definitions](#core-concepts--definitions)
4. [Algorithm](#algorithm)
5. [Guarantees](#guarantees)
6. [Worked Examples](#worked-examples)
7. [Validation Checklist](#validation-checklist)
8. [Complexity Analysis](#complexity-analysis)
9. [Implementation Notes](#implementation-notes)
10. [Final Output](#final-output)

## Problem Statement

**Goal**: Given a module dependency graph with static imports (`import`) and dynamic imports (`import()`), partition modules into chunks such that:

- ✅ **No byte increase**: Users never download more bytes than before along any execution path
- ✅ **Minimal requests**: The number of network requests is minimized when safe to do so  
- ✅ **Valid load order**: Async load order remains valid (no cycles, providers load before consumers)

**Output Artifact**:
```typescript
type MergeStrategyMap = Map<ChunkId, ModuleId[]>  // chunk membership mapping
```

## Input & Output

### Input: ESBuild Metafile

The input is an ESBuild metafile containing build metadata and module relationships.

```typescript
import { Metafile } from 'esbuild';

function mergeStrategy(
  entryPointChunk: string,  // explicit entry point chunk identifier
  metafile: Metafile        // esbuild build metadata
): Map<string, string[]>

// The metafile is processed to extract a module graph with:
interface ProcessedModuleGraph {
  [moduleId: string]: {
    imports: Array<{
      path: string;           // target module ID
      kind: 'import-statement' | 'dynamic-import';
    }>;
    entryPoint: boolean;      // true for main entry and async entry points
  };
}

// Internal data structures used during processing:
interface IndexedGraph {
  modules: ReadonlySet<string>;
  entryPoints: ReadonlySet<string>;
  staticAdj: ReadonlyMap<string, ReadonlySet<string>>;
  dynamicAdj: ReadonlyMap<string, ReadonlySet<string>>;
  warnings: string[];  // Diagnostic warnings collected during processing
}

interface PerEntryClosures {
  roots: ReadonlySet<string>;
  closures: ReadonlyMap<string, ReadonlySet<string>>;
  skipped: {  // Diagnostic information
    inEntryClosure: ReadonlySet<string>;
    unreachableFromMain: ReadonlySet<string>;
    notDynamicTargets: ReadonlySet<string>;
  };
}
```

**Key Properties**:
- **Static edges** (`import-statement`): Target must be present before source executes
- **Dynamic edges** (`dynamic-import`): Target is loadable later (async entry point)
- **Entry points**: Main entry plus any modules marked for separate async chunks

### Error Handling & Diagnostics

The implementation includes comprehensive error handling and diagnostic features:

#### Critical Errors
The algorithm throws errors for invalid input conditions:
```typescript
// Entry point validation
throw new Error(`computeEntryClosure: main "${main}" is not present in graph modules.`)
throw new Error(`computeEntryClosure: "${main}" is not marked entryPoint=true.`)

// DAG validation  
throw new Error(`computeDominators: root "${root}" is not a node in the DAG.`)
```

#### Warning Collection
Non-fatal issues are collected in `IndexedGraph.warnings[]`:
```typescript
// Missing module references
`Import from "${from}" to missing module "${path}"`

// Invalid dynamic targets
`Dynamic target "${path}" (imported by "${from}") is not marked entryPoint=true`
```

#### Configuration Options
- `computePerEntryClosures(G, main, I, opts)` accepts:
  - `opts.onlyReachableFromMain?: boolean` (default: true) - Filter unreachable async roots

### Output: MergeStrategyMap

A mapping from chunk ID to sorted list of member module IDs.

```typescript
type ChunkId = string;
type ModuleId = string;
type MergeStrategyMap = Map<ChunkId, ModuleId[]>;
```

**Chunk ID Naming Convention**:
- `chunk:main` - The main entry chunk
- `chunk:<entryId>` - Individual async entry chunks  
- `chunk:shared:<ep1|ep2|...>` - Shared chunks for multiple consumers with no safe dominator

**Result**: Vertex reduction from many module vertices → fewer chunk vertices

## Core Concepts & Definitions

### Edge Types
- **Static edge**: `A → B` via `import` means B must be present before A executes
- **Dynamic edge**: `A -.-> R` via `import()` means R is loadable later (async entry point)

### Key Sets and Closures

#### Entry Points
- **Main entry**: The application's primary entry point
- **Async entries**: Modules marked `entryPoint: true` for separate async chunks

#### Static Closure of X
All modules reachable from X following only static edges.

#### Pinned Entry Set (I)
```
I = StaticClosure(main) ∪ {main}
```
The initial bundle that cannot move. Always present before any dynamic import.

#### Per-Entry Closure C(r)
For async entry `r`:
```
C(r) = StaticClosure(r) \ I
```
Modules needed when `r` loads, excluding those already in the pinned set.

#### Entry-Point DAG
A directed graph representing runtime load dependencies:

- **Nodes**: `{main} ∪ {async entries}`
- **Edges**: `E → F` exists if any module owned by E performs `import(F)`

**Ownership Rules**:
```
owner(main) = I
owner(r) = {r} ∪ C(r)  // for async entry r
```

**Purpose**: Captures the runtime load order backbone where modules live inside chunk nodes.

#### Latest Safe Merge Point
The closest node to all consumers that lies on every path from main to those consumers.

**Equivalent to**: Deepest Common Dominator (DCD) of consumer entries in the entry-point DAG.

**Intuition**: The safest place to relocate shared code without increasing bytes for any user.

## Algorithm

The algorithm consists of 5 sequential steps that transform the ESBuild metafile into an optimal chunk configuration, with dominator analysis integrated into the assignment phase.

### Step 1: Process Metafile and Normalize the Graph

**Purpose**: Convert ESBuild metafile to module graph and build efficient adjacency representations for fast traversal.

First, extract the module graph from the metafile:
```typescript
const graph = generateBundleGraph(entryPointChunk, metafile);
const indexedGraph = indexModuleGraph(graph);
```

Build two adjacency views:
```typescript
staticAdj: Map<ModuleId, Set<ModuleId>> = {}   // static edges only
dynamicAdj: Map<ModuleId, Set<ModuleId>> = {}  // dynamic edges only
```

Also collect the fundamental sets:
```typescript
modules: Set<ModuleId> = new Set(Object.keys(processedGraph))
entryPoints: Set<ModuleId> = new Set(
  Object.entries(processedGraph)
    .filter(([_, module]) => module.entryPoint)
    .map(([id, _]) => id)
)
```

**Why**: Adjacency sets deduplicate edges and make traversals linear-time.

### Step 2: Compute the Pinned Entry Set I

**Algorithm**:
```typescript
function computeEntryClosure(indexedGraph: IndexedGraph, entryPointChunk: string): Set<ModuleId> {
  const I = new Set<ModuleId>()
  const stack = [entryPointChunk]
  
  while (stack.length > 0) {
    const current = stack.pop()!
    if (I.has(current)) continue
    
    I.add(current)
    for (const neighbor of indexedGraph.staticAdj.get(current) || []) {
      if (!I.has(neighbor)) {
        stack.push(neighbor)
      }
    }
  }
  return I
}
```

**Why**: I is guaranteed to load before any dynamic import. It acts as an immutable barrier—async closures cannot cross into it, and we never hoist anything new into I.

### Step 3: Identify Async Roots and Their Closures

**Filter async roots**:
```typescript
const asyncClosures = computePerEntryClosures(
  indexedGraph,
  entryPointChunk,
  entryClosure
);
```

**Compute per-entry closures**:
```typescript
function computePerEntryClosures(
  G: IndexedGraph,
  main: Id,
  I: ReadonlySet<Id>
): PerEntryClosures {
  // Find dynamic targets that are entry points and not in I
  const roots = new Set<Id>();
  
  // Compute static closure for each root, stopping at I
  const closures = new Map<Id, ReadonlySet<Id>>();
  for (const r of roots) {
    const C = staticClosureStoppingAt(r, G.staticAdj, I);
    closures.set(r, C);
  }
  
  return { roots, closures };
}
```

**Why**: This captures exactly what needs to be available when each async root executes, beyond what the entry chunk already provides.

### Step 4: Build the Entry-Point DAG

**Create DAG structure**:
```typescript
const entryPointDAG = buildEntryPointDAG(
  indexedGraph,
  entryPointChunk,
  entryClosure,
  asyncClosures
);

function buildEntryPointDAG(
  G: IndexedGraph,
  main: Id,
  I: ReadonlySet<Id>,
  per: PerEntryClosures
): EntryPointDAG {
  const nodes = new Set([main, ...per.roots]);
  const adj = new Map<Id, Set<Id>>();
  
  // Build ownership sets and derive edges
  for (const fromEntry of nodes) {
    const owned = fromEntry === main ? I : new Set([fromEntry, ...per.closures.get(fromEntry) || []]);
    
    for (const module of owned) {
      for (const target of G.dynamicAdj.get(module) || []) {
        if (nodes.has(target) && target !== fromEntry) {
          if (!adj.has(fromEntry)) adj.set(fromEntry, new Set());
          adj.get(fromEntry)!.add(target);
        }
      }
    }
  }
  
  return { nodes, adj };
}
```

**Why**: This captures where `import()` calls can originate at runtime, once a chunk is loaded.

### Step 5: Decide Module Placement (Merge Strategy)

**Compute dominators and assign modules**:
```typescript
const dominators = computeDominators(entryPointChunk, entryPointDAG);
const plan = assignModulesToChunks(
  entryPointChunk,
  entryClosure,
  asyncClosures,  
  entryPointDAG,
  dominators
);
```

**Assignment algorithm**:
```typescript
function assignModulesToChunks(
  main: Id,
  I: ReadonlySet<Id>,
  per: PerEntryClosures,
  dag: EntryPointDAG,
  dom: DominatorAnalysis
): ChunkPlan {
  const moduleToChunk = new Map<Id, ChunkId>();
  const chunks = new Map<ChunkId, Set<Id>>();
  
  // 1) All modules in I go to main chunk
  for (const m of I) addToChunk(`chunk:${main}`, m);
  
  // 2) Each async root gets its own chunk  
  for (const r of per.roots) {
    addToChunk(`chunk:${r}`, r);
  }
  
  // 3) For each shared module, find deepest common dominator
  for (const [s, consumers] of buildConsumerSets(per)) {
    const dcd = deepestCommonDominator(consumers, dom, { exclude: new Set([main]) });
    
    if (dcd) {
      addToChunk(`chunk:${dcd}`, s);
    } else {
      // Create shared chunk
      const key = [...consumers].sort().join('|');
      addToChunk(`chunk:shared:${key}`, s);
    }
  }
  
  return { moduleToChunk, chunks };
}
```

**Why**: This rule guarantees no byte increase and co-locates shared code when a safe dominator exists.

## Guarantees

The algorithm provides three mathematical guarantees that make it safe for production use:

### ✅ No Byte Increase

**Guarantee**: Users never download more bytes than the original unbundled approach.

**Proof**: 
- We never place new modules in `main` (the pinned set I is immutable)
- We only place module `s` into chunk `P` if `P` lies on every path from `main` to `s`'s consumers
- Users who never traverse paths requiring `s` won't load chunk `P`
- Therefore, they don't pay for `s` in bytes

### ✅ Fewer Requests (When Safe)

**Guarantee**: Network requests are minimized without violating the byte guarantee.

**Proof**:
- If one async entry dominates others, shared modules merge into the dominating chunk
- This eliminates separate shared chunks when mathematically safe
- The dominance relationship ensures the merged chunk loads before its dependents

### ✅ Valid Async Execution Order

**Guarantee**: The chunk loading order respects all import dependencies.

**Proof**:
- If consumer chunk needs module `s`, the chosen owner chunk `P` appears earlier on the same runtime path
- The entry-point DAG construction ensures `P` loads before consumers execute
- No circular dependencies are introduced (DAG property preserved)

## Worked Examples

### Example 1: Parallel Branches (No Dominance)

**Graph Structure**:
```
main -.-> d1    // dynamic import to d1
main -.-> d2    // dynamic import to d2
d1 → s          // d1 statically imports s  
d2 → s          // d2 statically imports s
```

**Analysis**:
- `Consumers(s) = {d1, d2}`
- Only common node on all paths from main to {d1, d2} is `main`
- `main` is excluded to prevent byte increase

**Result**:
```typescript
{
  "chunk:main" => [main],
  "chunk:d1" => [d1], 
  "chunk:d2" => [d2],
  "chunk:shared:d1|d2" => [s]
}
```

**Impact**: +1 request vs hoisting to main, but bytes unchanged for users visiting only one branch.

### Example 2: Nested Dynamics (Dominance Exists)

**Graph Structure**:
```
main -.-> d1 -.-> d2    // main imports d1, d1 imports d2
d1 → s                  // d1 statically imports s
d2 → s                  // d2 statically imports s  
```

**Analysis**:
- `Consumers(s) = {d1, d2}`
- `d1` lies on all paths from main to `d2` (dominates)
- Safe to place `s` in `chunk:d1`

**Result**:
```typescript
{
  "chunk:main" => [main],
  "chunk:d1" => [d1, s],    // s merged here
  "chunk:d2" => [d2]
}
```

**Impact**: Fewer requests (no shared chunk needed), bytes unchanged on paths needing d2.

### Example 3: Dynamic Target Inside Entry

**Graph Structure**:
```
main → r        // static import
main -.-> r     // also dynamic import (redundant)
```

**Analysis**:
- `r ∈ I` (pinned entry set) due to static import
- `r` is not treated as async root (already in initial bundle)

**Result**:
```typescript
{
  "chunk:main" => [main, r]    // r stays in main
}
```

**Impact**: No duplication, avoids creating unnecessary async chunk.

## Validation Checklist

Use these assertions to verify your implementation correctness:

### ✅ Closure Correctness

```typescript
// Assert pinned entry set I includes main and is closed under static edges
assert(I.has(entryPointChunk))
for (const module of I) {
  for (const staticDep of indexedGraph.staticAdj.get(module) || []) {
    assert(I.has(staticDep), `${module} → ${staticDep} violates I closure`)
  }
}

// Assert each C(r) contains no nodes from I and is closed under static edges until I
for (const r of asyncClosures.roots) {
  const closure = asyncClosures.closures.get(r) ?? new Set<Id>();
  for (const module of closure) {
    assert(!I.has(module), `${module} in C(${r}) but also in I`)
    
    for (const staticDep of indexedGraph.staticAdj.get(module) || []) {
      assert(
        I.has(staticDep) || closure.has(staticDep),
        `${module} → ${staticDep} violates C(${r}) closure`
      )
    }
  }
}
```

### ✅ DAG Sanity

```typescript
// Assert nodes are {main} ∪ asyncRoots
const expectedNodes = new Set([entryPointChunk, ...asyncClosures.roots])
assert(setsEqual(entryPointDAG.nodes, expectedNodes))

// Assert edges are valid and non-self-referential  
for (const [source, targets] of entryPointDAG.adj) {
  assert(entryPointDAG.nodes.has(source), `Invalid DAG source: ${source}`)
  for (const target of targets) {
    assert(entryPointDAG.nodes.has(target), `Invalid DAG target: ${target}`)
    assert(source !== target, `Self-edge detected: ${source} → ${source}`)
  }
}
```

### ✅ Placement Invariants

```typescript
// Assert every module is assigned to exactly one chunk
const allModules = new Set(Object.keys(processedGraph))
const assignedModules = new Set()

for (const [chunkId, members] of mergeStrategy) {
  for (const module of members) {
    assert(!assignedModules.has(module), `${module} assigned to multiple chunks`)
    assignedModules.add(module)
  }
}
assert(setsEqual(allModules, assignedModules))

// Assert no new modules added to main beyond I
const mainChunk = mergeStrategy.get(`chunk:${entryPointChunk}`) || []
assert(setsEqual(new Set(mainChunk), entryClosure))
```

### ✅ Determinism

```typescript
// Assert chunk membership lists are sorted
for (const [chunkId, members] of mergeStrategy) {
  const sorted = [...members].sort()
  assert(JSON.stringify(members) === JSON.stringify(sorted))
}

// Assert shared chunk IDs are stable (same consumer sets → same ID)
const sharedChunks = Array.from(mergeStrategy.keys())
  .filter(id => id.startsWith('chunk:shared:'))
```

## Complexity Analysis

### Time Complexity

| Step | Complexity | Notes |
|------|------------|-------|
| 1. Normalize graph | **O(E)** | Linear in edges |
| 2. Compute I | **O(E_static)** | Linear in static edges from main |
| 3. Async closures | **O(R × E_static)** | Linear per root (R = async roots) |
| 4. Build DAG | **O(E_dynamic)** | Proportional to dynamic edges in owner sets |
| 5. Placement | **O(M × N²)** | M modules × N² dominance checks |

**Overall**: **O(E + M × N²)** for typical applications

### Space Complexity
- **Adjacency maps**: O(E) for static + dynamic edges  
- **Closures**: O(M) for all modules across all closures
- **Entry DAG**: O(N²) for N nodes × N potential edges
- **Overall**: **O(E + M + N²)**

### Optimizations
- Use formal dominators algorithm for O(N × α(N)) placement queries
- Pre-contract strongly connected components for better performance
- Cache closures and DAG between builds when possible

## Implementation Notes

### Critical Design Decisions

#### 🔒 Pinned Entry Set (I) is Immutable
- **Never** allow async closures to cross into I
- **Never** hoist new modules into I  
- I defines the initial bundle size and acts as a hard boundary

#### 🔄 Result Reconciliation Process
The final step performs complex reconciliation to ensure consistency:
```typescript
// Collect all referenced chunk IDs (even empty ones)
const allChunkIds = new Set<string>();
for (const cid of plan.chunks.keys()) allChunkIds.add(cid);
for (const [, cid] of plan.moduleToChunk) allChunkIds.add(cid);
for (const e of plan.dynamicEdges ?? []) {
  allChunkIds.add(e.fromChunk);
  allChunkIds.add(e.toChunk);
}

// Reconcile with moduleToChunk mapping
for (const [mod, cid] of plan.moduleToChunk) {
  let set = membersByChunk.get(cid);
  if (!set) {
    set = new Set<string>();
    membersByChunk.set(cid, set);
  }
  set.add(mod);
}
```

#### 🔍 Unknown Dynamic Targets
```typescript
// Handle unresolvable import() expressions  
if (!canResolve(dynamicImportExpression)) {
  // DO NOT treat as async root
  // DO NOT hoist modules based on this edge
  continue
}
```

#### 🔄 Static Strongly Connected Components
If your static graph contains cycles, pre-contract them so cyclic groups move together. The algorithm and guarantees remain unchanged.

### Future Extensions

#### Multi-Entry Support
Add a virtual super-root node with edges to each true entry and run the same steps using the super-root as the dominance root.

## Final Output

Your implementation should produce a **MergeStrategyMap**:

```typescript
type MergeStrategyMap = Map<string, string[]>

// Usage:
export function mergeStrategy(
  entryPointChunk: string,
  metafile: Metafile
): Map<string, string[]>
```

### Chunk Types
- **`chunk:${entryPointChunk}`** → Pinned entry set I (always includes entry point)
- **`chunk:${asyncEntry}`** → Entry module + safely merged shared code  
- **`chunk:shared:${sorted-consumers}`** → Shared code with no safe dominator

### Result Properties
This produces a **compact, deterministic, vertex-reduced chunk graph** with:
- ✅ **Fewer vertices** (chunks vs modules)
- ✅ **Preserved semantics** (no execution order violations)  
- ✅ **Fewer requests** when mathematically safe
- ✅ **Zero byte increases** along any execution path

---

**End of Specification** — You now have complete guidance to implement an optimal module chunking algorithm that guarantees performance improvements without user experience degradation.