import { Metafile } from "esbuild";

export function rebuildMetafileOutputs(
    rebuildDetails: Map<string, { bytes: number, mergedChunks: string[], path: string, exports: string[],         imports: string[],
        dynamicImports: string[] }>,
    metafileOutputs: Metafile['outputs'],
) {
    const outputs: Metafile['outputs'] = {};

    rebuildDetails.forEach((chunk) => {
        outputs[chunk.path] = {
            imports: mergedImports(chunk.imports, chunk.dynamicImports),
            inputs: mergedInputs(chunk.mergedChunks.map((chunk) => metafileOutputs[chunk].inputs)),
            entryPoint: handleEntryPoint(chunk.mergedChunks.map((chunk) => metafileOutputs[chunk].entryPoint)),
            bytes: chunk.bytes,
            exports: chunk.exports
        };
    });
    return outputs;
}

function handleEntryPoint(mergeChunksEntryPoint: Metafile['outputs'][string]['entryPoint'][]): Metafile['outputs'][string]['entryPoint'] {
    const filtered = mergeChunksEntryPoint.filter(Boolean);
    console.assert(filtered.length < 2, filtered, 'Warning merged chunks contained multiple entryPoints', filtered.length, filtered);
    return filtered[0];
}

function mergedImports(imports: string[], dynamicImports: string[]): Metafile['outputs'][string]['imports'] {
    return [
        imports.map((path): Metafile['outputs'][string]['imports'][number] => ({ path, kind: 'import-statement' })),
        dynamicImports.map((path): Metafile['outputs'][string]['imports'][number] => ({ path, kind: 'dynamic-import'}))
    ].flat();
}

function mergedInputs(mergedChunksInputs: Metafile['outputs'][string]['inputs'][]): Metafile['outputs'][string]['inputs'] {
    const inputs: Metafile['outputs'][string]['inputs'] = {};
    mergedChunksInputs.forEach((chunkInputs) => {
        Object.entries(chunkInputs).forEach(([key, value]) => {
            if (!inputs.hasOwnProperty(key)) {
                inputs[key] = value;
            }
            else {
                inputs[key].bytesInOutput += value.bytesInOutput;
            }
        })
    });
    return inputs;
}
