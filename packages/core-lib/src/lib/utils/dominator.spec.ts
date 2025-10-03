import { describe, it, expect } from 'vitest';

import { loadStatsFile } from '../../../test/utils';

import { generateBundleGraph } from './bundle-graph';
import { indexModuleGraph } from './indexed-graph';
import { computeEntryClosure } from './entry-closure';
import { computePerEntryClosures } from './async-closure';
import { buildEntryPointDAG } from './entry-point-dag';
import { computeDominators } from './dominator';

describe('dominator', () => {
  const hostAppMetafile = loadStatsFile('./test/mocks/stats.json');

  it('should compute dominator', () => {
    const graph = generateBundleGraph('main-WTKNYPAX.js', hostAppMetafile);
    const indexedGraph = indexModuleGraph(graph);
    const entryClosure = computeEntryClosure(indexedGraph, 'main-WTKNYPAX.js');
    const asyncClosures = computePerEntryClosures(
      indexedGraph,
      'main-WTKNYPAX.js',
      entryClosure
    );

    const entryPointDAG = buildEntryPointDAG(
      indexedGraph,
      'main-WTKNYPAX.js',
      entryClosure,
      asyncClosures
    );

    const dominators = computeDominators('main-WTKNYPAX.js', entryPointDAG);
    expect(dominators).toBeDefined();
  });
})
