import { BuildResult, OutputFile, Plugin, PluginBuild } from 'esbuild';
import { getAppEntryPoint } from "./lib/esbuild.utils";
import { getMergeStrategyMap } from "./lib/merge-strategy";
import { rollupReBundle } from "./lib/rollup.utils";
import { rebuildMetafileOutputs } from "./lib/metafile";
import { OutputChunk } from "rollup";

export default function optimizeChunksPlugin(options: { main?: string, maxChunks?: number } = {}): Plugin {
    const { main, maxChunks = 6 } = options;
    return {
        name: 'optimize-chunks',
        setup({ onEnd, initialOptions: { entryPoints, absWorkingDir, sourcemap } }: PluginBuild) {
            onEnd(async ({ metafile, outputFiles }: BuildResult) => {
                if (!metafile) {
                    throw new Error('Unable to extract metafile from esbuild plugin');
                }
                if (!outputFiles) {
                    throw new Error('Unable to extract outputFiles in esbuild plugin');
                }

                const entry = getAppEntryPoint(absWorkingDir, main || entryPoints, metafile.outputs);

                const strategy = getMergeStrategyMap(entry, metafile.outputs, maxChunks);

                const reBundled = await rollupReBundle(strategy, entry, outputFiles, sourcemap, absWorkingDir);

                metafile.outputs =  rebuildMetafileOutputs(strategy, metafile.outputs);

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

                for (const { fileName, code, name, exports, map } of reBundled.filter(( chunk): chunk is OutputChunk  => chunk.type === 'chunk')) {

                    const hash = name.slice(name.length - 12, name.length - 4)
                    const output = toChunk(fileName, code, hash);
                    metafile.outputs[fileName].bytes = output.contents.length;
                    metafile.outputs[fileName].exports = exports;
                    outputFiles.push(output);

                    if (sourcemap && map) {
                        const mapName = fileName + '.map';
                        const mapOutput = toChunk(mapName, map.file, hash)
                        metafile.outputs[mapName] = { "imports": [], "exports": [], "inputs": {}, 'bytes': mapOutput.contents.length };
                        outputFiles.push(mapOutput);
                    }
                }
            });
        }
    }
}
