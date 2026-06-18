import { DEFAULT_MERGE_STRATEGY_CONFIG } from './config';
import type { MergeStrategyFactory } from './types';

export const mergeStrategyFactory: MergeStrategyFactory = (
  entryPointChunk,
  metafile,
  config = DEFAULT_MERGE_STRATEGY_CONFIG
) => {
  void entryPointChunk;
  void metafile;
  void config;

  throw new Error('mergeStrategyFactory is not implemented yet.');
};
