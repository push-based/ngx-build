import type { Plugin } from 'esbuild';

import type { MergeStrategyConfig } from '../core';

export interface NgxChunksPluginOptions {
  mergeStrategy?: MergeStrategyConfig;
}

export default function optimizeChunksPlugin(
  options: NgxChunksPluginOptions = {}
): Plugin {
  void options;

  return {
    name: 'ngx-chunks',
    setup() {
      return;
    },
  };
}
