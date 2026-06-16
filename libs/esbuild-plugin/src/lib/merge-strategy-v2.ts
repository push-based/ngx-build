import { Metafile } from 'esbuild'
// Minimal esbuild metafile types we need (so you don't need to import esbuild types)
export type OutputPath = string;
export type MergeKey = OutputPath;
export type MergeStrategyMap = Map<MergeKey, OutputPath[]>;

// --------- mergeStrategy implementation ---------

/**
 * Build a merge strategy where:
 * - The root entry maps to its static transitive closure.
 * - Each dynamic import reachable from any group becomes a "dynamic root" whose group is its static closure.
 * - If a module is used by an ancestor+descendant, it is assigned to the nearest ancestor group.
 * - If a module is used by multiple sibling groups, it is left unassigned (shared),
 *   unless it's also imported by the root group, in which case it is hoisted to root.
 */
export function mergeStrategyV2(rootEntryPoint: OutputPath, metafile: Metafile): MergeStrategyMap {
  const outputs = metafile.outputs;
  const allOutputPaths = new Set(Object.keys(outputs));

  // Heuristic: JS chunks are those outputs that have an imports array and end with .js
  const isJsChunk = (p: string) => p.endsWith(".js") && !!outputs[p]?.imports;

  // Build imports and reverse maps between *output files* (filtering to those that exist in outputs)
  const importsMap = new Map<OutputPath, { to: OutputPath; kind: string }[]>();
  const reverseMap = new Map<OutputPath, { from: OutputPath; kind: string }[]>();

  for (const [out, info] of Object.entries(outputs)) {
    if (!isJsChunk(out)) continue;
    const list = info.imports ?? [];
    for (const imp of list) {
      if (imp.external) continue;
      const to = resolveOutputPath(out, imp.path, allOutputPaths);
      if (!to) continue;            // ignore non-output or unknown assets
      if (!isJsChunk(to)) continue; // only track JS chunks here
      if (!importsMap.has(out)) importsMap.set(out, []);
      if (!reverseMap.has(to)) reverseMap.set(to, []);
      importsMap.get(out)!.push({ to, kind: imp.kind });
      reverseMap.get(to)!.push({ from: out, kind: imp.kind });
    }
  }

  const isStaticEdge = (kind: string) => kind !== "dynamic-import";

  // Static transitive closure from a start node (DFS) following only static edges
  const staticClosure = (start: OutputPath): Set<OutputPath> => {
    const res = new Set<OutputPath>();
    const stack = [start];
    while (stack.length) {
      const n = stack.pop()!;
      if (res.has(n)) continue;
      res.add(n);
      const edges = importsMap.get(n) ?? [];
      for (const e of edges) if (isStaticEdge(e.kind)) stack.push(e.to);
    }
    return res;
  };

  // 1) Root group: root + its static deps
  const rootGroup = staticClosure(assertKnownOutput(rootEntryPoint, allOutputPaths));

  // 2) Discover dynamic roots recursively (BFS over dynamic edges from known groups),
  //    tracking parent group for ancestor/descendant resolution.
  type GroupInfo = { root: OutputPath; parent?: OutputPath; members: Set<OutputPath> };
  const groups = new Map<OutputPath, GroupInfo>(); // key = group root output path

  // seed queue with dynamic edges from the root group
  const queue: { root: OutputPath; parent?: OutputPath }[] = [];
  const enqueueDynRootsFrom = (fromSet: Set<OutputPath>, parentKey?: OutputPath) => {
    for (const p of fromSet) {
      for (const e of importsMap.get(p) ?? []) {
        if (e.kind === "dynamic-import") {
          // e.to is a dynamic root
          if (!groups.has(e.to)) {
            queue.push({ root: e.to, parent: parentKey });
          }
        }
      }
    }
  };

  enqueueDynRootsFrom(rootGroup, undefined);

  // Process queue: compute each dynamic group's static closure, subtracting ancestors as we go.
  const ancestorChain = new Map<OutputPath, OutputPath | undefined>(); // childRoot -> parentRoot
  while (queue.length) {
    const { root, parent } = queue.shift()!;
    if (groups.has(root)) {
      // already processed (possible if multiple parents tried to enqueue—keep first)
      continue;
    }
    ancestorChain.set(root, parent);

    const closure = staticClosure(root);
    // Remove anything already in ancestor groups along the chain (nearest ancestor wins)
    let cursor: OutputPath | undefined = parent;
    const toSubtract = new Set<OutputPath>();
    // Parent-first walk: build a cumulative subtract set of ancestor members
    while (cursor) {
      const parentMembers = groups.get(cursor)?.members;
      if (parentMembers) for (const m of parentMembers) toSubtract.add(m);
      // also subtract the ancestor root itself
      toSubtract.add(cursor);
      cursor = ancestorChain.get(cursor);
    }
    for (const m of toSubtract) closure.delete(m);

    // Create and store this group
    groups.set(root, { root, parent, members: closure });

    // Enqueue dynamic roots from this group's members
    const carrier = new Set<OutputPath>(closure);
    carrier.add(root); // the dynamic root itself can also have dynamic edges
    enqueueDynRootsFrom(carrier, root);
  }

  // 3) Resolve shared across *sibling* groups:
  // Build membership index: node -> set of group roots that currently contain it
  const memberToGroups = new Map<OutputPath, Set<OutputPath>>();
  for (const { root, members } of groups.values()) {
    for (const n of members) {
      if (!memberToGroups.has(n)) memberToGroups.set(n, new Set());
      memberToGroups.get(n)!.add(root);
    }
  }

  // For any node present in multiple groups:
  // - If *any* of its importers is in rootGroup, hoist it to rootGroup (remove from all groups, add to root).
  // - Else, unassign it from all groups (leave as shared).
  for (const [node, owningGroups] of memberToGroups) {
    if (owningGroups.size <= 1) continue;

    const importers = reverseMap.get(node) ?? [];
    const importedByRoot = importers.some(({ from }) => rootGroup.has(from));
    if (importedByRoot) {
      for (const g of owningGroups) groups.get(g)!.members.delete(node);
      rootGroup.add(node);
    } else {
      for (const g of owningGroups) groups.get(g)!.members.delete(node);
      // leave it unassigned: stays as separate shared chunk
    }
  }

  // 4) Emit MergeStrategyMap
  const result: MergeStrategyMap = new Map();

  // Root key: include the rootEntryPoint itself
  result.set(rootEntryPoint, uniqArray([rootEntryPoint, ...rootGroup]));

  // Dynamic groups: include each group's root as part of its list
  for (const { root, members } of groups.values()) {
    result.set(root, uniqArray([root, ...members]));
  }

  return result;

  // ---------- helpers ----------
  function uniqArray<T>(arr: Iterable<T>): T[] {
    return Array.from(new Set(arr));
  }

  function assertKnownOutput(p: OutputPath, known: Set<string>): OutputPath {
    if (!known.has(p)) {
      // Try to resolve by looking for emitted output whose entryPoint equals p (when a user passes entry source)
      const byEntry = Object.entries(outputs).find(([, info]) => info.entryPoint === p)?.[0];
      if (byEntry && known.has(byEntry)) return byEntry;
      throw new Error(`mergeStrategy: Unknown output path "${p}"`);
    }
    return p;
  }

  /**
   * Resolve `imp` (which is an import specifier recorded in meta for `fromOut`)
   * to another output path, if present. Handles simple relative specifiers between outputs.
   * Returns undefined if the resolved target is not an emitted output.
   */
  function resolveOutputPath(fromOut: string, imp: string, known: Set<string>): string | undefined {
    if (known.has(imp)) return imp; // already absolute (metafile sometimes records output-relative)
    // Normalize relative to dirname(fromOut)
    const resolved = normalizePath(joinPath(dirnamePath(fromOut), imp));
    if (known.has(resolved)) return resolved;
    // Try without leading "./"
    const stripped = imp.startsWith("./") ? imp.slice(2) : imp;
    if (known.has(stripped)) return stripped;
    return undefined;
  }

  // Minimal POSIX-ish helpers (metafile paths are posix-like)
  function dirnamePath(p: string): string {
    const i = p.lastIndexOf("/");
    return i === -1 ? "" : p.slice(0, i);
  }
  function joinPath(a: string, b: string): string {
    if (!a) return b;
    if (b.startsWith("/")) return b; // already absolute-ish
    return a.replace(/\/+$/, "") + "/" + b.replace(/^\/+/, "");
  }
  function normalizePath(p: string): string {
    const parts: string[] = [];
    for (const seg of p.split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return parts.join("/");
  }
}
