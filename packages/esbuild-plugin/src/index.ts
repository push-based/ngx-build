import { Plugin } from 'esbuild';
import { getAppEntryPoint } from "./lib/esbuild.utils";
import { rolldownToEsbuildOutputs } from "./lib/rolldown/bundle-adaptor.utils";
import { getStrategyLookup } from "./lib/merge-strategy.utils";
import { rolldownReBundle } from './lib/rolldown/rolldown.utils';

export default function optimizeChunksPlugin(options: { main?: string, maxChunks?: number } = {}): Plugin {
    const { maxChunks = 10 } = options;
    return {
        name: 'optimize-bundle',
        setup({ onEnd, initialOptions }) {
            onEnd(async (result) => {
                console.log(initialOptions.define)
                if (initialOptions.define?.['ngDevMode'] !== 'false') {
                    return; // Bail out of optimization on dev build or serve
                }
                if (!result.metafile) {
                    throw new Error('Unable to extract metafile from esbuild plugin');
                }
                if (!result.outputFiles) {
                    throw new Error('Unable to extract outputFiles in esbuild plugin');
                }

                const entryChunk = getAppEntryPoint(initialOptions, result.metafile);
                const { lookup, reverseLookup } = getStrategyLookup(entryChunk, result.metafile, maxChunks);
                const reBundledOutput = await rolldownReBundle(entryChunk, result.outputFiles, initialOptions, lookup);
                const { newMetafileOutputs, newOutputFiles } = rolldownToEsbuildOutputs(reBundledOutput, result.metafile, reverseLookup);

                result.metafile.outputs = newMetafileOutputs;
                result.outputFiles = newOutputFiles;
            });
        },
    };
}
