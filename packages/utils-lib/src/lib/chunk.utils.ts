import { createHash } from 'crypto';
import { Metafile } from 'esbuild';
import { ReadonlyDeep } from 'type-fest';

export function hashFromPaths(paths: readonly string[]): string {
  return createHash('sha256').update(paths.join('')).digest('hex').substring(0, 8).toUpperCase();
}

export function importsInEntryPoint(
    entryPoint: string,
    metaFileOutputs: ReadonlyDeep<Metafile['outputs']>,
    traversedImports: readonly string[] = [entryPoint]
): readonly string[] {
  const staticImports = metaFileOutputs[entryPoint].imports.filter(
      ({ kind, path }) => kind !== 'dynamic-import' && !traversedImports.includes(path),
  );

  if (!staticImports.length) {
    return traversedImports;
  }

  return staticImports.flatMap(({ path }) => importsInEntryPoint(path, metaFileOutputs, [...traversedImports, path]));
}

export function getChunkNameByEntryPoint(entryPoint: string, metafileOutputs: ReadonlyDeep<Metafile['outputs']>): string | undefined {
  return Object.keys(metafileOutputs).find((name) => metafileOutputs[name].entryPoint === entryPoint);
}

type ReducedOutputs = {
  readonly [path: string]: {
    readonly bytes: number;
    readonly imports: readonly string[];
  };
}

type Trace = {
  readonly [path: string]: readonly string[];
}[];

function hasCircularDependency(chunk: string, outputs: ReadonlyDeep<Metafile['outputs']>): boolean {
  return !outputs[chunk].imports.flatMap(({path}) => importsInEntryPoint(path, outputs)).some((path) => path === chunk);
}

function isNotDynamic({ kind }: ReadonlyDeep<Metafile['outputs'][string]['imports'][number]>): boolean {
  return kind !== 'dynamic-import';
}

function reducedOutputs(outputs: ReadonlyDeep<Metafile['outputs']>): ReducedOutputs {
  return Object.keys(outputs).reduce<ReducedOutputs>((acc, p) => {
    const imports = outputs[p].imports.filter(isNotDynamic).map(({path}) => path)
    return { ...acc, ...{ [p]: { bytes: outputs[p].bytes, imports }}};
  }, {} as ReducedOutputs);
}

function mergedReducedOutputs(outputs: ReducedOutputs, mergeTargets: readonly [string, string]) {
  const hash = hashFromPaths(mergeTargets);
  const mergedChunk = mergeTargets.map((p) => outputs[p]).reduce((acc, curr) => {
    return { bytes: acc.bytes + curr.bytes, imports: [...new Set([...acc.imports, ...curr.imports])] }
  });
  return Object.keys(outputs).filter((path) => mergeTargets.includes(path)).reduce((acc, path) => {
    const imports = [...new Set(outputs[path].imports.map((i) => mergeTargets.includes(path) ? hash : path))]
    return { ...acc, ...{ [path]: { bytes: outputs[path].bytes, imports } } };
  }, { [hash]: mergedChunk });
}
