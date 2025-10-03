import { describe, it, expect } from 'vitest';
import { loadStatsFile } from '../../../test/utils';
import {
  generateBundleGraph,
  getReachableVerticesFromImportStatements,
} from './bundle-graph';
import { indexModuleGraph } from './indexed-graph';
import { computeEntryClosure } from './entry-closure';

describe('entry-closure', () => {
  const hostAppMetafile = loadStatsFile('./test/mocks/stats.json')

  it('should generate the entry closure', () => {
    const graph = generateBundleGraph('main-WTKNYPAX.js', hostAppMetafile);
    const indexedGraph = indexModuleGraph(graph);
    const entryClosure = computeEntryClosure(indexedGraph, 'main-WTKNYPAX.js');
    const reachableVerticesFromImportStatements = getReachableVerticesFromImportStatements('main-WTKNYPAX.js', hostAppMetafile.outputs);
    expect(entryClosure.size).toBe(reachableVerticesFromImportStatements.length);
  })
})
