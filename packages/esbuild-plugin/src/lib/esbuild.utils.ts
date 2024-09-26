import { BuildOptions, Metafile, OutputFile } from "esbuild";
import { posix, sep } from "node:path";

export function getAppEntryPoint(absWorkingDir: BuildOptions['absWorkingDir'], entry: OutputFile['path'] | BuildOptions['entryPoints'], metafileOutputs: Metafile['outputs']): string {
    const main = typeof entry === 'string' ? entry : toFileName(absWorkingDir, getEntryPointFileName(entry));
    const entryChunk = getChunkNameByEntryPoint(main, metafileOutputs);

    if (!entryChunk) {
        throw new Error('Could not find entryChunk');
    }

    return entryChunk;
}

function getChunkNameByEntryPoint(entryPoint: string, metafileOutputs: Metafile['outputs']): string | undefined {
    return Object.keys(metafileOutputs).find((name) => metafileOutputs[name].entryPoint === entryPoint);
}

function toFileName(absWorkingDir: BuildOptions['absWorkingDir'], path: OutputFile['path']): string {
    return path.replace(absWorkingDir + sep, '').replaceAll(sep, posix.sep);
}

function getEntryPointFileName(entryPoints: BuildOptions['entryPoints']): string {
    if (!entryPoints) {
        throw new Error('Could not extract entryPoints for entryPoints as its undefined');
    }
    if (Array.isArray(entryPoints)) {
        if (entryPoints.length > 1) {
            throw new Error('We currently do not support multiple entry points, if you are interested in this feature please open an issue');
        }
        if (!entryPoints.length) {
            throw new Error('Entry points seems to be an array bug has no entries');
        }
        const entryPoint = entryPoints[0];
        if (typeof entryPoint === 'string') {
            return entryPoint;
        }
        return entryPoint.in
    }
    if (typeof entryPoints === 'object' && 'main' in entryPoints) {
        return entryPoints['main'];
    }
    throw new Error('Could not extract entryPoints please pass it as an option to the plugin');
}
