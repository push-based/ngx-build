import { Metafile } from 'esbuild';

import { DEFAULT_CONFIG } from './configs';
import { applyStrategies } from './strategy-applicator';
import { MergeStrategyConfig, MergeStrategyContext } from './types';
import { generateBundleGraph } from './utils/bundle-graph';

export function mergeStrategy(entryPointChunk: string, metafile: Metafile, config: MergeStrategyConfig = DEFAULT_CONFIG): Map<string, string[]> {
    const context: MergeStrategyContext = {
        assigned: new Set<string>(),
        mergedStrategy: new Map<string, string[]>(),
        graph: generateBundleGraph(entryPointChunk, metafile),
        entryPointChunk,
        metafile,
    };

    // Apply all strategies defined in the config
    applyStrategies(config, context);

    // Assign any remaining unassigned chunks to themselves
    Object.keys(metafile.outputs).forEach((output) => {
        if (!context.assigned.has(output) && output.endsWith('.js')) {
            context.mergedStrategy.set(output, [output]);
        }
    });

    return context.mergedStrategy;
}

// Re-export utilities and types for backward compatibility
export { findEntryPointOutput } from './utils';
export { STRATEGY_TYPE, type StrategyType, type MergeStrategyConfig } from './types';
export { DEFAULT_CONFIG } from './configs';
