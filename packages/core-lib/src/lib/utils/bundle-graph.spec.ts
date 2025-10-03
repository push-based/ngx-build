import { describe, expect, it } from 'vitest';
import { loadStatsFile } from '../../../test/utils';
import { generateBundleGraph } from './bundle-graph';

describe('bundle-graph', () => {
  const hostAppMetafile = loadStatsFile('./test/mocks/stats.json');

  it('should run simplify the module graph', () => {
    const graph = generateBundleGraph('main-WTKNYPAX.js', hostAppMetafile);

    expect(graph).toBeDefined();
  });
});
