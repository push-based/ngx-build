import { BuildOptions } from 'esbuild';
import { posix, sep } from "node:path";

export function toFileName(absWorkingDir: BuildOptions['absWorkingDir'], path: string): string {
    return path.replace(absWorkingDir + sep, '').replaceAll(sep, posix.sep);
}
