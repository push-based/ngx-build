import { Metafile } from 'esbuild';

export function findEntryPointOutput(entryPointPath: string, metaFileOutputs: Metafile['outputs']) {
    return Object.keys(metaFileOutputs).find((key) => metaFileOutputs[key].entryPoint === entryPointPath);
}
