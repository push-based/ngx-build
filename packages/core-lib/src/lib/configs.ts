import { MergeStrategyConfig, STRATEGY_TYPE } from './types';

/**
 * The default strategy only runs the default reachability strategy with no additional configurations
 */
export const DEFAULT_CONFIG: MergeStrategyConfig = {
    name: 'main',
    strategies: [
        {
            label: 'reachability',
            type: STRATEGY_TYPE.REACHABILITY,
        },
    ],
};
