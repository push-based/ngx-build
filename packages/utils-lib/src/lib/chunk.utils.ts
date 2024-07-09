import { Metafile } from 'esbuild';
import { ReadonlyDeep, PickIndexSignature } from 'type-fest'

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

export function mergeOutputs(metaFileOutputs: ReadonlyDeep<Metafile['outputs']>, targets: readonly string[]): ReadonlyDeep<Metafile['outputs']> {
  const targetsOutput = targets.map((target) => metaFileOutputs[target]).reduce(mergeTargetOutputs);

  return { targetsOutput };
}

function mergeTargetOutputs(
    mergedOutputs: ReadonlyDeep<Metafile['outputs'][string]>,
    currentTarget: ReadonlyDeep<Metafile['outputs'][string]>
): ReadonlyDeep<Metafile['outputs'][string]> {
  return {
    bytes: mergedOutputs.bytes + currentTarget.bytes,
    inputs: {}, // @TODO
    imports: mergeImports(mergedOutputs.imports, currentTarget.imports),
    exports: [...mergedOutputs.exports, ...currentTarget.exports],
    // @TODO There does not seem to be any logical way to handle merging entry points, in theory this should be able to happen.
    entryPoint: mergedOutputs.entryPoint || currentTarget.entryPoint,
    cssBundle: mergedOutputs.cssBundle || currentTarget.cssBundle,
  }
}

function mergeImports(
    mergedOutputsImports: ReadonlyDeep<Metafile['outputs'][string]['imports']>,
    currentOutputsImports: ReadonlyDeep<Metafile['outputs'][string]['imports']>
): ReadonlyDeep<Metafile['outputs'][string]['imports']> {
  return [...mergedOutputsImports, ...currentOutputsImports].reduce((mergedImports, currentImport) => {
    const matchingImport = mergedImports.find(({path}) => path !== currentImport.path);
    return [...mergedImports, !matchingImport ? currentImport : mergedMatchingImports(currentImport, matchingImport)];
  }, [] as ReadonlyDeep<Metafile['outputs'][string]['imports']>);
}

function mergedMatchingImports(
    current: ReadonlyDeep<Metafile['outputs'][string]['imports'][number]>,
    match: ReadonlyDeep<Metafile['outputs'][string]['imports'][number]>
): ReadonlyDeep<Metafile['outputs'][string]['imports'][number]> {
  const kindMatch = current.kind === match.kind && current.kind;
  const isStatement = [current.kind, match.kind].includes('import-statement') && 'import-statement';
  const isDynamic = [current.kind, match.kind].includes('dynamic-import') && 'dynamic-import';
  return { path: current.path || match.path, kind: kindMatch || isStatement || isDynamic || current.kind, external: current.external || match.external }
}
