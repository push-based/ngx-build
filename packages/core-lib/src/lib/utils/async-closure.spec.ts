import { describe, expect, it } from 'vitest';
import { loadStatsFile } from '../../../test/utils';
import { generateBundleGraph } from './bundle-graph';
import { indexModuleGraph } from './indexed-graph';
import { computeEntryClosure } from './entry-closure';
import { computePerEntryClosures } from './async-closure';

describe('async-closure', () => {
  const hostAppMetafile = loadStatsFile('./test/mocks/stats.json');

  it('should compute async closure of host app', () => {
    const graph = generateBundleGraph('main-WTKNYPAX.js', hostAppMetafile);
    const indexedGraph = indexModuleGraph(graph);
    const entryClosure = computeEntryClosure(indexedGraph, 'main-WTKNYPAX.js');
    const asyncClosures = computePerEntryClosures(
      indexedGraph,
      'main-WTKNYPAX.js',
      entryClosure
    );
    expect(asyncClosures.roots).toBeDefined();
    expect(asyncClosures.closures).toBeDefined();
    expect(asyncClosures.skipped.inEntryClosure.size).toBe(0);
    expect(asyncClosures.skipped.unreachableFromMain.size).toBe(0);
    expect(
      asyncClosures.skipped.notDynamicTargets.has('main-WTKNYPAX.js')
    ).toBe(true);
    expect(asyncClosures.skipped.notDynamicTargets.size).toBe(1);
  });
});
