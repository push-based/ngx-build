import { BuildOptions, OutputFile } from 'esbuild';
import { Plugin, PreRenderedChunk, RolldownOutput, rolldown } from 'rolldown';

import { pathToFileName } from '../esbuild.utils';
import { MergeStrategyLookup } from '../merge-strategy.utils';

export async function rolldownReBundle(
    entry: string,
    outputFiles: OutputFile[],
    initialOptions: BuildOptions,
    strategyLookup: MergeStrategyLookup,
): Promise<RolldownOutput['output']> {
    const bundle = await rolldown({
        input: [entry],
        plugins: [esbuildOutputsLoaderPlugin(outputFiles, initialOptions)],
    });

    const { output } = await bundle.generate({
        sourcemap: !!initialOptions.sourcemap,
        chunkFileNames: preserveFacade,
        hashCharacters: 'base36',
        manualChunks: (id) => strategyLookup.get(id),
    });

    await bundle.close();

    return output;
}

function preserveFacade({ facadeModuleId }: PreRenderedChunk): string {
    if (!facadeModuleId) {
        return 'chunk-[hash].js';
    }
    return facadeModuleId.replace(facadeModuleId.replace(/(\.js(\.map)?)$/, '').slice(-8), '[hash]');
}

function esbuildOutputsLoaderPlugin(outputFiles: OutputFile[], { absWorkingDir, sourcemap }: BuildOptions): Plugin {
    const hash = new Map(outputFiles.map(({ path }, index) => [pathToFileName(absWorkingDir, path), index]));
    const getCode = (id: string) => outputFiles[hash.get(id)!].text;
    const getMap = (id: string) => getCode(id + '.map');
    return {
        name: 'esbuild-results-loader',
        resolveId: (id) => id.split('/').at(-1),
        load(id) {
            if (sourcemap) {
                return { code: getCode(id), map: getMap(id) };
            }
            return getCode(id);
        },
    };
}
