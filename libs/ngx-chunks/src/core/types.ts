import { Metafile } from 'esbuild';

import { ModuleGraph } from './utils/bundle-graph';

export const STRATEGY_TYPE = {
    REACHABILITY: 'reachability',
    STATIC_CLOSURE: 'static-closure',
    COMMON: 'common',
} as const;

export type StrategyType = typeof STRATEGY_TYPE;

export interface ReachabilityStrategyDefinition {
    label: string;
    type: StrategyType['REACHABILITY'];
}

export interface StaticClosureStrategyDefinition {
    label: string;
    type: StrategyType['STATIC_CLOSURE'];
    entryPoint: string;
}

export interface CommonStrategyDefinition {
    label: string;
    type: StrategyType['COMMON'];
    entryPoints: string[];
}

export type StrategyDefinition = ReachabilityStrategyDefinition | StaticClosureStrategyDefinition | CommonStrategyDefinition;

export interface MergeStrategyConfig {
    name: string;
    strategies: StrategyDefinition[];
    verbose?: boolean;
}

export interface MergeStrategyContext {
    assigned: Set<string>;
    mergedStrategy: Map<string, string[]>;
    graph: ModuleGraph;
    entryPointChunk: string;
    metafile: Metafile;
}
