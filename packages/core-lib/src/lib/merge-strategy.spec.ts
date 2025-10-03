import { describe, it, expect } from 'vitest';

import { loadStatsFile } from '../../test/utils';

import { mergeStrategy } from './merge-strategy';
import { getReachableVerticesFromImportStatements } from './utils/bundle-graph';
import { Metafile } from 'esbuild';

describe('mergeStrategy', () => {
  const hostAppMetafile = loadStatsFile('./test/mocks/stats.json');
  const entryPointChunk = 'main-WTKNYPAX.js';
  const SPORTS_ENTRY_POINT =
    'dist/build/packages/sports/web/libs/entrypoint-lib/esm2022/frontend-sports-web-entrypoint-lib.js';
  const sportsEntryPoint = findEntryPointOutput(
    SPORTS_ENTRY_POINT,
    hostAppMetafile.outputs
  )!;

  it('should run', () => {
    const strategy = mergeStrategy(entryPointChunk, hostAppMetafile);
    expect(strategy).toBeDefined();
  });

  it('should reduce root as expected', () => {
    // as this is the root we expect it to pull all initial values
    const strategy = mergeStrategy(entryPointChunk, hostAppMetafile);

    expect(strategy.has(`chunk:${entryPointChunk}`)).toBeDefined();

    const initialChunks = getReachableVerticesFromImportStatements(
      entryPointChunk,
      hostAppMetafile.outputs
    );

    expect(strategy.get(`chunk:${entryPointChunk}`)?.length).toBe(
      initialChunks.length
    );
  });

  it('should reduce sports as expected', () => {
    const strategy = mergeStrategy(entryPointChunk, hostAppMetafile);

    expect(strategy.has(`chunk:${sportsEntryPoint}`)).toBeDefined();

    const initialChunks = getReachableVerticesFromImportStatements(
      entryPointChunk,
      hostAppMetafile.outputs
    );
    const sportsRootReachableChunks = getReachableVerticesFromImportStatements(
      sportsEntryPoint,
      hostAppMetafile.outputs
    );

    expect(
      strategy.get(`chunk:${sportsEntryPoint}`)!.some((c) => {
        return initialChunks.includes(c);
      })
    ).toBe(false);

    const sportInitialChunks = sportsRootReachableChunks.filter(
      (c) => !initialChunks.includes(c)
    );

    expect(strategy.get(`chunk:${sportsEntryPoint}`)!.length).toBe(
      sportInitialChunks.length
    );
  });
});

function findEntryPointOutput(
  entryPointPath: string,
  metaFileOutputs: Metafile['outputs']
) {
  return Object.keys(metaFileOutputs).find(
    (key) => metaFileOutputs[key].entryPoint === entryPointPath
  );
}
