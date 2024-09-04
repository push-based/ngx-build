import { Metafile } from "esbuild";

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
