import { Plugin, rollup, RollupOutput } from "rollup";
import { BuildOptions, CommonOptions, Metafile, OutputFile } from "esbuild";
import { toFileName } from "./utils";
import { rebuildMetafileOutputs } from "./metafile";

export async function rollupReBundle(
    strategy: Map<string, string[]>,
    entry: string,
    outputFiles: OutputFile[],
    sourcemap: CommonOptions['sourcemap'],
    absWorkingDir: BuildOptions['absWorkingDir'],
    metafileOutputs: Metafile['outputs']
) {
    const mergeHashMap = new Map<string, string>(
        Array.from(strategy).flatMap(([key, values]) => values.map(value => [value, key]))
    );

    const { generate, close } = await rollup({
        input: [entry],
        plugins: [
            esbuildOutputsLoaderPlugin({
                outputFiles,
                sourcemap,
                absWorkingDir
            }),
        ]
    });

    const { output} = await generate({
        compact: true,
        sourcemap: !!sourcemap,
        chunkFileNames: 'chunk-[hash].js',
        hashCharacters: 'base36',
        manualChunks: (id) => mergeHashMap.get(id)
    });

    await close();

    return rollupToEsbuildOutputs(output, strategy, entry, mergeHashMap, metafileOutputs);
}

function rollupToEsbuildOutputs(rollupOutput: RollupOutput['output'], strategy: Map<string, string[]>, entry: string, lookup: Map<string, string>, outputsMetafile: Metafile['outputs']) {
    const encoder = new TextEncoder();
    const toChunk = (filename: string, code: string, hash: string): OutputFile => {
        return {
            path: filename,
            contents: encoder.encode(code),
            hash,
            get text(): string {
                return new TextDecoder().decode(this.contents);
            }
        }
    }

    const files: OutputFile[] = [];
    const rebuildMetaDetails = new Map<string, {
        bytes: number,
        mergedChunks: string[],
        imports: string[],
        dynamicImports: string[]
        path: string,
        exports: string[]
    }>();

    for (const output of rollupOutput) {
        if (output.type === 'chunk') {
            const hash = getHashFromName(output.fileName);
            const file = toChunk(output.fileName, output.code, hash);

            files.push(file);
            const lookupKey = output.isEntry ? lookup.get(entry)! : output.name!;
            rebuildMetaDetails.set(lookupKey, {
                bytes: file.contents.length,
                mergedChunks: output.isEntry ? strategy.get(lookup.get(entry)!)! : strategy.get(output.name)!,
                imports: output.imports,
                dynamicImports: output.dynamicImports,
                exports: output.exports,
                path: output.fileName,
            })

            if (output.map) {
                const mapFileName = output.fileName + '.map';
                const file = toChunk(output.fileName + '.map', output.code, hash);

                files.push(file);
                rebuildMetaDetails.set(lookupKey, {
                    bytes: file.contents.length,
                    mergedChunks: [],
                    imports: [],
                    dynamicImports: [],
                    exports: [],
                    path: mapFileName,
                })
            }
        }
    }

    const metafileOutputs: Metafile['outputs'] = rebuildMetafileOutputs(rebuildMetaDetails, outputsMetafile);

    return {files, metafileOutputs};
}

// Extracts the hash from the file name eg. chunk-3UZA2KDL.js -> 3UZA2KDL
function getHashFromName(name: string): string {
    return name.slice(name.length - 11, name.length - 3);
}

type EsbuildResultsLoaderOptions = {
    outputFiles: OutputFile[],
    sourcemap: CommonOptions['sourcemap'],
    absWorkingDir: BuildOptions['absWorkingDir'],
}

function esbuildOutputsLoaderPlugin({ outputFiles, sourcemap, absWorkingDir }: EsbuildResultsLoaderOptions): Plugin {
    const hash = new Map(outputFiles.map(({path}, index) => [toFileName(absWorkingDir, path), index]));
    const getCode = (id: string) => outputFiles[hash.get(id)!].text;
    const getMap = (id: string) => getCode(id+'.map');

    return {
        name: 'esbuild-results-loader',
        resolveId: (id) => id.split('/').at(-1),
        load: (id) => {
            if (sourcemap) {
                return { code: getCode(id), map: getMap(id) }
            }
            return getCode(id);
        }
    };
}
