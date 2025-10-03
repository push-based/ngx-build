import { Metafile } from 'esbuild';
import { strict as assert } from 'node:assert';

type OutputPath = keyof Metafile['outputs'] & string;

// type ImportType = Extract<
//   Metafile['outputs'][keyof Metafile['outputs']]['imports'][number]['kind'],
//   'import-statement' | 'dynamic-import'
// >;
type ImportKind = 'import-statement' | 'dynamic-import';

export type ModuleGraph = {
  [p: OutputPath]: {
    imports: {
      path: OutputPath;
      kind: ImportKind;
    }[];
    entryPoint: boolean;
  };
};

export function generateBundleGraph(
  entryPoint: OutputPath,
  manifest: Metafile
): ModuleGraph {
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
          }),
      };
      return acc;
    },
    {} as ModuleGraph
  );
}

export function getReachableVertices(
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
      // if (imp.kind === 'dynamic-import' || imp.external) {
      //   continue;
      // }
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
