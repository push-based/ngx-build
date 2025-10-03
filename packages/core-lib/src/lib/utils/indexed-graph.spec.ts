import { describe, it, expect } from 'vitest';

import { loadStatsFile } from '../../../test/utils';
import { generateBundleGraph } from './bundle-graph';
import { indexModuleGraph } from './indexed-graph';

describe('bundle-graph', () => {
  const hostAppMetafile = loadStatsFile('./test/mocks/stats.json')

  it('should index the module graph', () => {
    const graph = generateBundleGraph('main-WTKNYPAX.js', hostAppMetafile);
    const indexedGraph = indexModuleGraph(graph);

    expect(indexedGraph).toBeDefined();
    expect(indexedGraph.warnings).toHaveLength(0);
  });
})
