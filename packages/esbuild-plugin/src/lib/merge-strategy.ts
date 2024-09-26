import { Metafile } from "esbuild";
import { createHash } from "crypto";
import { importsInEntryPoint } from "./utils";

export function getMergeStrategyMap(entryPoint: string, outputs: Metafile['outputs'], maxBins: number) {
    const strategy = mergeStrategy(entryPoint, outputs, maxBins);
    const mergedChunks = new Set(Object.values(strategy).flat());

     return new Map<string, string[]>(
        Object.keys(outputs)
            .filter((chunkName) => !mergedChunks.has(chunkName))
            .map((chunkName) => [chunkName])
            .concat(Object.values(strategy))
            .map((values) => [hashFromOutputPaths(values), values])
    );
}

function mergeStrategy(entryPoint: string, metafileOutputs: Metafile['outputs'], maxBins: number) {

    const initialChunks = importsInEntryPoint(entryPoint, metafileOutputs);

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

function hashFromOutputPaths(paths: string[]): string {
    return createHash('sha256').update(paths.join('')).digest('hex').substring(0, 8).toUpperCase();
}
