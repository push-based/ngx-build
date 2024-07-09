import { Metafile } from 'esbuild';

export function importsInEntryPoint(entryPoint: string, metaFileOutputs: Metafile['outputs'], traversedImports = [entryPoint]): string[] {
  const staticImports = metaFileOutputs[entryPoint].imports.filter(
      ({ kind, path }) => kind !== 'dynamic-import' && !traversedImports.includes(path),
  );

  if (!staticImports.length) {
    return traversedImports;
  }

  return staticImports.flatMap(({ path }) => importsInEntryPoint(path, metaFileOutputs, [...traversedImports, path]));
}


export function getChunkNameByEntryPoint(entryPoint: string, metafileOutputs: Metafile['outputs']) {
  const chunkName = Object.keys(metafileOutputs).find((name) => metafileOutputs[name].entryPoint === entryPoint);
  if (!chunkName) {
    throw new Error(`Unable to find ${entryPoint} entryPoint`);
  }
  return chunkName;
}
