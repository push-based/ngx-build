import { describe, expect, it } from 'vitest';

import { loadMockStats } from '../../test/utils';

import { mergeStrategy } from './merge-strategy';
import {
  getReachableVertices,
  getReachableVerticesFromImportStatements,
} from './utils/bundle-graph';
import { Metafile } from 'esbuild';

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

  it.skip('should reduce root as expected', () => {
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

  it.skip('should reduce sports as expected', () => {
    const strategy = mergeStrategy(entryPointChunk, hostAppMetafile);

    expect(strategy.has(`chunk:${sportsEntryPoint}`)).toBeDefined();

    const initialChunks = getReachableVertices(
      entryPointChunk,
      hostAppMetafile.outputs,
      (imp) => imp.path === sportsEntryPoint
    );

    expect(
      strategy.get(`chunk:${sportsEntryPoint}`)!.some((c) => {
        return initialChunks.includes(c);
      })
    ).toBe(false);
  });

  it.skip('should merge shared root modules', () => {
    const mockMetafile: Metafile = {
      inputs: {},
      outputs: {
        'main.js': {
          imports: [
            { path: 'chunk-a.js', kind: 'import-statement' },
            { path: 'chunk-b.js', kind: 'import-statement' },
          ],
          exports: [],
          entryPoint: 'src/main.ts',
          inputs: {},
          bytes: 1000,
        },
        'chunk-a.js': {
          imports: [{ path: 'chunk-c.js', kind: 'import-statement' }],
          exports: [],
          inputs: {},
          bytes: 500,
        },
        'chunk-b.js': {
          imports: [],
          exports: [],
          inputs: {},
          bytes: 300,
        },
        'chunk-c.js': {
          imports: [],
          exports: [],
          inputs: {},
          bytes: 200,
        },
      },
    };
  });
});

const IMPORT_TYPE = {
  IMPORT_STATEMENT: 'import-statement',
  DYNAMIC_IMPORT: 'dynamic-import',
};

const mockOutput = () => {};
