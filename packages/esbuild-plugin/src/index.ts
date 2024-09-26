import { BuildResult, Plugin, PluginBuild } from 'esbuild';
import { getAppEntryPoint } from "./lib/esbuild.utils";
import { getMergeStrategyMap } from "./lib/merge-strategy";
import { rollupReBundle } from "./lib/rollup.utils";

export default function optimizeChunksPlugin(options: { main?: string, maxChunks?: number } = {}): Plugin {
    const { main, maxChunks = 6 } = options;
    return {
        name: 'optimize-chunks',
        setup(build: PluginBuild) {
            build.onEnd(async (result: BuildResult) => {
                if (!result.metafile) {
                    throw new Error('Unable to extract metafile from esbuild plugin');
                }
                if (!result.outputFiles) {
                    throw new Error('Unable to extract outputFiles in esbuild plugin');
                }

                const entry = getAppEntryPoint(build.initialOptions.absWorkingDir, main || build.initialOptions.entryPoints, result.metafile.outputs);

                const strategy = getMergeStrategyMap(entry, result.metafile.outputs, maxChunks);

                const { files, metafileOutputs} = await rollupReBundle(strategy, entry, result.outputFiles, build.initialOptions.sourcemap, build.initialOptions.absWorkingDir, result.metafile.outputs);

                result.outputFiles = files;
                result.metafile.outputs = metafileOutputs;
            });
        }
    }
}
