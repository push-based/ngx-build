import { Plugin, rollup } from "rollup";
import { BuildOptions, CommonOptions, OutputFile } from "esbuild";
import { toFileName } from "./utils";

export async function rollupReBundle(mergeLookup: Map<string, string>, entry: string, outputFiles: OutputFile[], sourcemap: CommonOptions['sourcemap'], absWorkingDir: BuildOptions['absWorkingDir']) {
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
        sourcemap: !!sourcemap,
        compact: true,
        manualChunks: (id) => mergeLookup.get(id),
        chunkFileNames: ({name}) => name,
    });

    await close();
    return output;
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
