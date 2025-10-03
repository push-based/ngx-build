import { readFileSync } from 'node:fs';
import { Metafile } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST_APP_MAIN_ENTRY_POINT = 'packages/host-app/src/main.ts';
const SPORTS_ENTRY_POINT = 'dist/build/packages/sports/web/libs/entrypoint-lib/esm2022/frontend-sports-web-entrypoint-lib.js';

export function loadMockStats(filePath: string) {
  const stats = loadStatsFile(filePath);
  return {
    stats,
    entryPoint: findEntryPointOutput(HOST_APP_MAIN_ENTRY_POINT, stats.outputs)!,
    sportsEntryPoint: findEntryPointOutput(SPORTS_ENTRY_POINT, stats.outputs)!,
  };
}

export function loadStatsFile(filePath: string): Metafile {
  // If path starts with './', resolve relative to the package root
  let resolvedPath: string;
  if (filePath.startsWith('./')) {
    resolvedPath = resolve(__dirname, '..', filePath.substring(2));
  } else {
    resolvedPath = resolve(__dirname, filePath);
  }
  return JSON.parse(readFileSync(resolvedPath, 'utf8'));
}


export function findEntryPointOutput(
  entryPointPath: string,
  metaFileOutputs: Metafile['outputs']
) {
  return Object.keys(metaFileOutputs).find(
    (key) => metaFileOutputs[key].entryPoint === entryPointPath
  );
}