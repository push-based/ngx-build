import { readFileSync } from 'node:fs';
import { Metafile } from 'esbuild';
import { strict as assert } from 'node:assert';

const HOST_APP_MAIN_ENTRY_POINT = 'packages/host-app/src/main.ts';
const SPORTS_ENTRY_POINT =
  'dist/build/packages/sports/web/libs/entrypoint-lib/esm2022/frontend-sports-web-entrypoint-lib.js';

export function loadMockStats(filePath: string) {
  const stats = loadStatsFile(filePath);
  return {
    stats,
    entryPoint: findEntryPointOutput(HOST_APP_MAIN_ENTRY_POINT, stats.outputs)!,
    sportsEntryPoint: findEntryPointOutput(SPORTS_ENTRY_POINT, stats.outputs)!,
  };
}

export function loadStatsFile(filePath: string): Metafile {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function findEntryPointOutput(
  entryPointPath: string,
  metaFileOutputs: Metafile['outputs']
) {
  return Object.keys(metaFileOutputs).find(
    (key) => metaFileOutputs[key].entryPoint === entryPointPath
  );
}

export function statsReconciler(
  strategy: Map<string, string[]>,
  metafile: Metafile
): Metafile {
  const stats = structuredClone(metafile);

  for (const [chunk, group] of strategy.entries()) {
    if (group.length === 1) {
      continue;
    }
    stats.outputs[chunk].bytes = 0;
    group
      .filter((k) => k !== chunk)
      .forEach((k) => {
        stats.outputs[chunk].bytes += stats.outputs[k].bytes;
        Object.keys(stats.outputs[k].inputs).forEach((input: string) => {
          if (stats.outputs[chunk].inputs[input]) {
            stats.outputs[chunk].inputs[input].bytesInOutput +=
              stats.outputs[k].inputs[input].bytesInOutput;
          } else {
            stats.outputs[chunk].inputs[input] = stats.outputs[k].inputs[input];
          }
        });
      });

    const entryPoints = group
      .map((k) => stats.outputs[k].entryPoint)
      .filter((ep): ep is string => Boolean(ep));
    assert(
      entryPoints.length <= 1,
      `Unexpected attempt to merge two entry points in chunk ${chunk} \n` +
        `attempted to merge the following entry points ${entryPoints.join(
          ', '
        )} \n` +
        `from the following chunks ${group
          .filter((k) => stats.outputs[k].entryPoint)
          .join(', ')}`
    );
    if (entryPoints[0]) {
      stats.outputs[chunk].entryPoint ??= entryPoints[0];
    }
  }

  for (const [chunk, group] of strategy.entries()) {
    Object.keys(stats.outputs).forEach((key) => {
      let isAffected = false;
      for (let i = stats.outputs[key].imports.length - 1; i >= 0; i--) {
        if (group.includes(stats.outputs[key].imports[i].path)) {
          // Skip import-statements as they are already processed
          if (stats.outputs[key].imports[i].kind === 'import-statement') {
            continue;
          }
          isAffected = true;
          stats.outputs[key].imports.splice(i, 1);
        }
      }
      if (isAffected) {
        stats.outputs[key].imports.push({
          path: chunk,
          kind: 'import-statement',
        });
      }
    });
    group.filter((k) => k !== chunk).forEach((k) => delete stats.outputs[k]);
  }

  return stats;
}
