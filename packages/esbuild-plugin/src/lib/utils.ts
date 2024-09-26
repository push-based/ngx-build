import { BuildOptions, Metafile } from 'esbuild';
import { posix, sep } from "node:path";

export function toFileName(absWorkingDir: BuildOptions['absWorkingDir'], path: string): string {
    return path.replace(absWorkingDir + sep, '').replaceAll(sep, posix.sep);
}

export function importsInEntryPoint(
    entryPoint: string,
    metaFileOutputs: Metafile['outputs'],
    traversedImports: readonly string[] = [entryPoint]
): readonly string[] {
    const staticImports = metaFileOutputs[entryPoint].imports.filter(
        ({ kind, path }) => kind !== 'dynamic-import' && !traversedImports.includes(path),
    );

    if (!staticImports.length) {
        return traversedImports;
    }

    return staticImports.flatMap(({ path }) => importsInEntryPoint(path, metaFileOutputs, [...traversedImports, path]));
}
