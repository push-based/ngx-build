import { BuildResult, OutputFile, Plugin as EsbuildPlugin, PluginBuild, CommonOptions, BuildOptions } from "esbuild";
import { OutputChunk, rollup, Plugin as RollupPlugin, PluginImpl } from "rollup";
import { getChunkNameByEntryPoint, mergeStrategy } from "../utils-lib/src";
import { rebuildMetafileOutputs } from "../utils-lib/src/lib/chunk.utils";
import { hashFromOutputPaths } from "../nx-plugin/src/executors/rebundle/utils/utils";
import { sep, posix } from "node:path";
import { assert } from 'node:console';

type EsbuildResultsLoaderOptions = {
    outputFiles: OutputFile[],
    sourcemap: CommonOptions['sourcemap'],
    absWorkingDir: BuildOptions['absWorkingDir'],
}

function toFileName(absWorkingDir: string, path: string): string {
    return path.replace(absWorkingDir + sep, '').replaceAll(sep, posix.sep);
}

const esbuildOutputsLoader: PluginImpl<EsbuildResultsLoaderOptions> = ( { outputFiles, sourcemap, absWorkingDir} ) => {
    const hash = new Map(outputFiles.map(({path}, index) => [toFileName(absWorkingDir, path), index]));
    const getCode = (id: string) => outputFiles[hash.get(id)].text;
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
    } satisfies RollupPlugin;
};


export default {

    name: 'optimize-chunks',

    setup({ onEnd, initialOptions: { entryPoints, absWorkingDir, sourcemap } }: PluginBuild) {

        onEnd(async ({ metafile, outputFiles }: BuildResult) => {

            const entryFile = toFileName(absWorkingDir, entryPoints['main']);
            const entry = getChunkNameByEntryPoint(entryFile, metafile.outputs);
            const strategy = mergeStrategy(entryFile, metafile.outputs);

            const lookup = new Map<string, string>(Object.values(strategy).flatMap((values) => {
                const chunkPath = values.find((chunk) => chunk === entry) || `chunk-${hashFromOutputPaths(values)}.js`;
                return values.map((chunkName) => ([ chunkName, chunkPath ]));
            }));

            Object.keys(metafile.outputs)
                .filter((key) => !lookup.has(key) && !key.endsWith('.map'))
                .forEach((key) => lookup.set(key, `chunk-${hashFromOutputPaths([key])}.js`));

            const { generate, close } = await rollup({
                input: [entry],
                plugins: [
                    esbuildOutputsLoader({ outputFiles, sourcemap, absWorkingDir }),
                ]
            });

            const { output} = await generate({
                sourcemap: !!sourcemap,
                compact: true,
                manualChunks: (id) => lookup.get(id),
                chunkFileNames: ({name}) => name,
            });

            await close();

            // Remove old bundles from outputFiles
            for (let i = outputFiles.length - 1; i >= 0; i--) {
                if (lookup.has(toFileName(absWorkingDir, outputFiles[i].path).replace('.map', ''))) {
                    outputFiles.splice(i, 1);
                }
            }

            assert(
                outputFiles.length === 0,
                'Potential error: while cleaning all esbuild modules some bundles where not removed properly',
                outputFiles
            );

            metafile.outputs = rebuildMetafileOutputs(lookup, metafile.outputs);

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

            for (const { fileName, code, name, exports, map } of output.filter(( chunk): chunk is OutputChunk  => chunk.type === 'chunk')) {

                const hash = name.slice(name.length - 12, name.length - 4)
                const output = toChunk(fileName, code, hash);
                metafile.outputs[fileName].bytes = output.contents.length;
                metafile.outputs[fileName].exports = exports;
                outputFiles.push(output);

                if (sourcemap) {
                    const mapName = fileName + '.map';
                    const mapOutput = toChunk(mapName, map.file, hash)
                    metafile.outputs[mapName] = { "imports": [], "exports": [], "inputs": {}, 'bytes': mapOutput.contents.length };
                    outputFiles.push(mapOutput);
                }
            }
        });
    },
} satisfies EsbuildPlugin;
