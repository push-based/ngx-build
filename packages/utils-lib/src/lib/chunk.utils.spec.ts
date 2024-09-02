import { Metafile } from 'esbuild';
import { getChunkNameByEntryPoint, getLookUp, importsInEntryPoint, mergeStrategy } from "./chunk.utils";
import { describe, it, expect } from "vitest";
import { readJsonSync } from "fs-extra";
import { ReadonlyDeep } from "type-fest";

describe('importsInEntryPoint', () => {
    it('should return a list of all non dynamic imports of an entry point', () => {
        const MOCK_OUTPUTS = {
            'entry.js': {
                imports: [{ path: 'a.js', kind: 'import-statement' }, { path: 'b.js', kind: 'dynamic-import' }],
            },
            'a.js': {
                imports: [{ path: 'c.js', kind: 'import-statement' }],
            },
            'b.js': {
                imports: [{ path: 'c.js', kind: 'import-statement' }],
            },
            'c.js': {
                imports: [],
            },
        } as unknown as Metafile['outputs'];

        expect(importsInEntryPoint('entry.js', MOCK_OUTPUTS)).toEqual(expect.arrayContaining(['entry.js', 'a.js', 'c.js']));

        expect(importsInEntryPoint('b.js', MOCK_OUTPUTS)).toEqual(expect.arrayContaining(['b.js', 'c.js']));

        expect(importsInEntryPoint('c.js', MOCK_OUTPUTS)).toEqual(expect.arrayContaining(['c.js']));
    });
});

describe('getChunkNameByEntryPoint', () => {
    it('should return the path of the chunk with the entryPoint', () => {
        const MOCK_OUTPUTS = {
            'main-X.js': {
                entryPoint: 'package/src/main.ts',
            },
        } as unknown as Metafile['outputs'];

        expect(getChunkNameByEntryPoint('package/src/main.ts', MOCK_OUTPUTS)).toBe('main-X.js');

        // expect(() => getChunkNameByEntryPoint('package/src/invalid.ts', MOCK_OUTPUTS)).toThrow(`Unable to find package/src/invalid.ts entryPoint`);
    });
});

function hasCycle(graph: { [key: string]: string[] }): boolean {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function dfs(node: string): boolean {
        if (visiting.has(node)) {
            return true; // Found a cycle
        }

        if (visited.has(node)) {
            return false; // Node is already fully processed, no cycle found
        }

        visiting.add(node);

        for (const neighbor of graph[node]) {
            if (dfs(neighbor)) {
                return true;
            }
        }

        visiting.delete(node);
        visited.add(node);

        return false;
    }

    for (const node in graph) {
        if (dfs(node)) {
            return true;
        }
    }

    return false;
}

function mergeToGraph(mergeMap: { [key: string]: string[] }, metafileOutputs: ReadonlyDeep<Metafile['outputs']>) {
    const graph: { [key: string]: string[] } = {};
    for (const key in mergeMap) {
        graph[key] = [];
    }

    const lookUp = getLookUp(mergeMap);
    for (const key in metafileOutputs) {
        const bin = lookUp[key];
        if (!bin) {
            continue;
        }
        for (const outputImports of metafileOutputs[key].imports) {
            if (outputImports.kind === 'dynamic-import') {
                continue;
            }
            if (!lookUp[outputImports.path]) {
                continue;
            }
            const importedBin = lookUp[outputImports.path];
            if (!graph[bin].includes(importedBin) && bin !== importedBin) {
                graph[bin].push(importedBin);
            }
        }
    }

    return graph;
}

describe.only('mergeStrategy', () => {
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach((maxChunks) => {
        it('should not throw', () => {
            const MOCK_OUTPUTS = readJsonSync('packages/utils-lib/src/lib/mock/outputs.json');
            const strategy = mergeStrategy('main.ts', MOCK_OUTPUTS, maxChunks);

            expect(Object.keys(strategy).length).toEqual(maxChunks);

            const mergedGraph = mergeToGraph(strategy, MOCK_OUTPUTS);
            expect(hasCycle(mergedGraph)).toBeFalsy();
        })
    })
})
