import { BuildOptions, OutputFile } from 'esbuild';
import { Plugin, PreRenderedChunk, rolldown, RolldownOutput } from 'rolldown';

import { pathToFileName } from '../esbuild.utils';
import { MergeStrategyMap } from '../merge-strategy.utils';

export async function rolldownReBundle(
    entry: string,
    outputFiles: OutputFile[],
    initialOptions: BuildOptions,
    strategy:  MergeStrategyMap,
): Promise<RolldownOutput['output']> {
    const bundle = await rolldown({
        input: [entry],
        // TODO add rolldown minifier
        plugins: [esbuildOutputsLoaderPlugin(outputFiles, initialOptions)],
    });

    const bundleOutput = await bundle.generate({
        sourcemap: !!initialOptions.sourcemap,
        hashCharacters: 'base36',
        chunkFileNames: preserveFacade,
        advancedChunks: {
          groups: [...strategy].filter((s) => s[1].length !== 1).map((([name, chunks] ) => ({
            name,
            test: new RegExp(chunks.filter((v) => !(v as string).includes('main')).join('|'), 'g') }))
          )
        }

    });

    await bundle.close();

    return bundleOutput.output;
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
