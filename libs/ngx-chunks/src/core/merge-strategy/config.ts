import { STRATEGY_TYPE, type MergeStrategyConfig } from './types';

export const DEFAULT_MERGE_STRATEGY_CONFIG: MergeStrategyConfig = {
  name: 'main',
  strategies: [
    {
      label: 'reachability',
      type: STRATEGY_TYPE.REACHABILITY,
    },
  ],
};
