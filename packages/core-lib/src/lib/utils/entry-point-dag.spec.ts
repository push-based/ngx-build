import { describe, expect, it } from 'vitest';
import { loadStatsFile } from '../../../test/utils';
import { generateBundleGraph } from './bundle-graph';
import { indexModuleGraph } from './indexed-graph';
import { computeEntryClosure } from './entry-closure';
import { computePerEntryClosures } from './async-closure';
import { buildEntryPointDAG } from './entry-point-dag';

describe('entry-point-daf', () => {
  const hostAppMetafile = loadStatsFile('./test/mocks/stats.json');

  it('should compute entry point dag', () => {
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

    expect(entryPointDAG).toBeDefined();
  });
});
