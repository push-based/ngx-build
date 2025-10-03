import { describe, it, expect } from 'vitest';

import { loadMockStats } from '../../test/utils';

import { mergeStrategy } from './merge-strategy';
import { getReachableVertices, getReachableVerticesFromImportStatements } from './utils/bundle-graph';

describe.only('mergeStrategy', () => {
  const { stats: hostAppMetafile, entryPoint: entryPointChunk, sportsEntryPoint } = loadMockStats('./test/mocks/stats.json');

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

    const initialChunks = getReachableVertices(
      entryPointChunk,
      hostAppMetafile.outputs,
      (imp) => imp.path === sportsEntryPoint
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
