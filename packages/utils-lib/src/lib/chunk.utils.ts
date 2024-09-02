import { Metafile } from 'esbuild';
import { ReadonlyDeep } from 'type-fest';

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

function topologicalSort(graph: { [key: string]: string[] }): string[] {
  const topologicalOrder: string[] = [];
  const visitedVertices: Set<string> = new Set();

  function depthFirstSearch(vertex: string): void {
    visitedVertices.add(vertex);

    for (const adjacentVertex of graph[vertex]) {
      if (!visitedVertices.has(adjacentVertex)) {
        depthFirstSearch(adjacentVertex);
      }
    }

    topologicalOrder.push(vertex);
  }

  for (const vertex in graph) {
    if (!visitedVertices.has(vertex)) {
      depthFirstSearch(vertex);
    }
  }

  return topologicalOrder.reverse();
}

function findMergeTargets(sortedChunks: string[], weights: { [key: string]: number }): [number, number] {
  let candidateWeight = Infinity;
  let candidateIndex = 0;
  for (let i = 0; i < sortedChunks.length - 1; i++) {
    const mergedWeight = weights[sortedChunks[i]] + weights[sortedChunks[i + 1]];
    if (mergedWeight < candidateWeight) {
      candidateWeight = mergedWeight;
      candidateIndex = i;
    }
  }
  return [candidateIndex, candidateIndex + 1];
}

export function getLookUp(mergeMap: { [key: string]: string[] }): { [key: string]: string } {
  const lookUp: { [key: string]: string } = {};
  for (const key in mergeMap) {
    for (const chunk of mergeMap[key]) {
      lookUp[chunk] = key;
    }
  }

  return lookUp;
}

export function mergeStrategy(entryPoint: string, metafileOutputs: ReadonlyDeep<Metafile['outputs']>, maxBins = 2) {
  const entryChunk = getChunkNameByEntryPoint(entryPoint, metafileOutputs);

  if (!entryChunk) {
    throw new Error(`Unable to find chunk name of entry point ${entryPoint}`);
  }

  const initialChunks = importsInEntryPoint(entryChunk, metafileOutputs);

  const initialChunksGraph: { [key: string]: string[] } = {};
  for (const initialChunk of initialChunks) {
    initialChunksGraph[initialChunk] = metafileOutputs[initialChunk].imports.filter(({kind}) => kind !== 'dynamic-import').map(({path}) => path);
  }

  const sortedChunks = topologicalSort(initialChunksGraph);

  const weights: { [key: string]: number } = {};
  for (const initialChunk of initialChunks) {
    weights[initialChunk] = metafileOutputs[initialChunk].bytes;
  }

  const mergeMap: { [key: string]: string[] } = {};
  for (const key of sortedChunks) {
    mergeMap[key] = [key];
  }

  while (sortedChunks.length > maxBins) {
    const [x, y] = findMergeTargets(sortedChunks, weights);

    mergeMap[sortedChunks[x]].push(...mergeMap[sortedChunks[y]]);
    delete mergeMap[sortedChunks[y]];

    weights[sortedChunks[x]] += weights[sortedChunks[y]];
    delete weights[sortedChunks[y]];

    sortedChunks.splice(y, 1);
  }

  return mergeMap;
}

export function rebuildMetafileOutputs(mergeStrategy: Map<string, string>, metafileOutputs: Metafile['outputs']) {
  const outputsMap = new Map<string, Metafile['outputs'][keyof Metafile['outputs']]>();
  mergeStrategy.forEach((newPath, oldPath) => {
    if (outputsMap.has(newPath)) {
      const output = outputsMap.get(newPath)!;
      outputsMap.set(newPath, {
        ...output,
        inputs: output.inputs, // @TODO Inputs will require more merge logic
        entryPoint: output.entryPoint || metafileOutputs[oldPath].entryPoint,
        imports: metafileOutputs[oldPath].imports
            .map((chunkImport) => ({ ...chunkImport, path: mergeStrategy.get(chunkImport.path)! }))
            .filter(({path}) => path !== newPath)
            .reduce((outputImports, chunkImport) => {
              const outputImport = outputImports.find(({ path}) => path === chunkImport.path);
              if (!outputImport) {
                outputImports.push(chunkImport);
              }
              else if (outputImport.kind !== chunkImport.kind) {
                //  @TODO This is probably incomplete, we should revisit this and see how to improve it!
                outputImport.kind = [chunkImport.kind, outputImport.kind].includes('import-statement') ? 'import-statement' : outputImport.kind;
              }
              return outputImports;
            }, output.imports),
      });
    } else {
      outputsMap.set(newPath, {
        bytes: 0,
        inputs: metafileOutputs[oldPath].inputs, // Do I need to do a structured clone for all of these ??
        imports: metafileOutputs[oldPath].imports
            .map((chunkImport) => ({ ...chunkImport, path: mergeStrategy.get(chunkImport.path)! }))
            .filter(({path}) => path !== newPath),
        exports: [],
        entryPoint: metafileOutputs[oldPath].entryPoint,
      });
    }
  });
  return Object.fromEntries(outputsMap.entries());
}
