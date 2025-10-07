import { Metafile } from 'esbuild';
import { generateBundleGraph } from './utils/bundle-graph';
import { reachabilityStrategy } from './reachability-strategy';
import { writeFileSync } from 'node:fs';

const exclusionEntryPoints = [
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/sport-tree/sport-tree.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/geo-location/geo-location.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/media/media.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/minigames/minigames.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/banner/banner-widget.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/teaser/teaser.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/popular-bets/popular-multi-bets-widget/popular-multi-bets.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/main/main.component.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/panic-button/panic-button.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/hidden-market/hidden-market.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/bet-column/bet-column.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/bet-generator-shared/bet-generator.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/crm-promotion-widget/crm-promotion-widget.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/favourites-widget/favourites-widget.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/story-content/story-content.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/standings/standings-widget.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/calendar/time-filters-widget.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/competition-list/top-items-widget.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/quick-links/quick-links.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/next-to-go/next-to-go.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/priceboost/price-boost.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/widget/composable/composable-widget.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/outrights-grid/outrights-grid.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/showcase/showcase.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/tabbed-grid/tabbed-grid.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/top-events/top-events.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/highlights-marquee/highlights-marquee.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/scoreboard-carousel/scoreboard-carousel.feature.js',
  'dist/build/packages/sports/web/libs/platform-lib/esm2022/lib/betfinder-integration/betfinder-wrapper.component.js',
]; //.map((p) => findEntryPointOutput(p, manifest.outputs));

export function mergeStrategy(
  entryPointChunk: string,
  metafile: Metafile
): Map<string, string[]> {
  const graph = generateBundleGraph(entryPointChunk, metafile);

  const excludedChunksFromReachability = exclusionEntryPoints.map(
    (p) => findEntryPointOutput(p, metafile.outputs)!
  );

  const _reachabilityStrategy = reachabilityStrategy(
    entryPointChunk,
    graph,
    excludedChunksFromReachability
  );
  const assigned = new Set<string>();
  let count = 0;
  _reachabilityStrategy.forEach((group) => {
    group.forEach((c) => {
      if (assigned.has(c)) {
        console.log('Something went wrong', c);
      }
      assigned.add(c);
    });
    count = count + group.length - 1;
  });
  const chunkCount = Object.keys(graph).length;
  const entryChunkCount = Object.values(graph).filter(
    (c) => c.entryPoint
  ).length;

  console.log(
    `Reachability strategy reduced ${count} chunks from ${chunkCount}\n` +
      `There should be ${
        chunkCount - count
      } chunks remaining of which ${entryChunkCount} are entry points!`
  );
  Object.keys(graph)
    .filter((c) => !assigned.has(c))
    .forEach((c) => {
      // console.warn('Assigning missing chunk', c);

      if (_reachabilityStrategy.has(c)) {
        console.log(c);
        throw new Error(c);
      }

      _reachabilityStrategy.set(c, [c]);
    });

  const jsonMergeStrategies = JSON.stringify(
    Object.fromEntries(_reachabilityStrategy),
    null,
    2
  );

  writeFileSync('strategy.json', jsonMergeStrategies, 'utf8');

  return _reachabilityStrategy;
}

export function findEntryPointOutput(
  entryPointPath: string,
  metaFileOutputs: Metafile['outputs']
) {
  return Object.keys(metaFileOutputs).find(
    (key) => metaFileOutputs[key].entryPoint === entryPointPath
  );
}
