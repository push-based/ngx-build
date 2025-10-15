import { describe, expect, it } from 'vitest';

import { loadMockStats } from '../../test/utils';

import { mergeStrategy } from './merge-strategy';
import { getReachableVerticesFromImportStatements } from './utils/bundle-graph';

describe('mergeStrategy', () => {
  const {
    stats: hostAppMetafile,
    entryPoint: entryPointChunk,
    sportsEntryPoint,
  } = loadMockStats('./test/mocks/stats.json');

  it('should run', { timeout: 30_000 }, () => {
    const strategy = mergeStrategy(entryPointChunk, hostAppMetafile);

    expect(strategy).toBeDefined();
  });

  it('should reduce root as expected', () => {
    // as this is the root we expect it to pull all initial values
    const strategy = mergeStrategy(entryPointChunk, hostAppMetafile);

    const rootStrategy = strategy.get(entryPointChunk);
    expect(rootStrategy).toBeTruthy();

    const initialChunks = getReachableVerticesFromImportStatements(
      entryPointChunk,
      hostAppMetafile.outputs
    );

    expect(rootStrategy?.length).toBe(initialChunks.length);
    expect(rootStrategy).toContain(entryPointChunk);
  });

  it('should reduce sports as expected', () => {
    const strategy = mergeStrategy(entryPointChunk, hostAppMetafile);

    const sportsEntryStrategy = strategy.get(sportsEntryPoint);
    expect(sportsEntryStrategy).toBeTruthy();

    const initialChunks = getReachableVerticesFromImportStatements(
      entryPointChunk,
      hostAppMetafile.outputs
    );
    const initialSportsChunks = getReachableVerticesFromImportStatements(
      sportsEntryPoint,
      hostAppMetafile.outputs
    );
    // expect(initialSportsChunks.length).toBe(10);

    expect(sportsEntryStrategy!.some((c) => initialChunks.includes(c))).toBe(
      false
    );
    // expect(sportsEntryStrategy?.length).toBe(10);
  });
});
