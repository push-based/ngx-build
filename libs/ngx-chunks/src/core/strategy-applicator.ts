import { strict as assert } from 'node:assert/strict';

import { commonFeatureStrategy } from './common-strategy';
import {
  getStaticClosure,
  reachabilityStrategy,
} from './reachability-strategy';
import {
  MergeStrategyContext,
  ReachabilityStrategyDefinition,
  STRATEGY_TYPE,
  StrategyDefinition,
} from './types';
import { findEntryPointOutput } from './utils';

/**
 * Apply all strategies defined in the config in order
 */
export function applyStrategies(
  config: { strategies: StrategyDefinition[] },
  context: MergeStrategyContext
): void {
  for (const strategyDef of config.strategies) {
    applyStrategy(strategyDef, context);
  }
}

/**
 * Apply a single strategy based on its type
 */
function applyStrategy(
  strategyDef: StrategyDefinition,
  context: MergeStrategyContext
): void {
  switch (strategyDef.type) {
    case STRATEGY_TYPE.REACHABILITY:
      applyReachabilityStrategy(strategyDef, context);
      break;
    case STRATEGY_TYPE.STATIC_CLOSURE:
      applyStaticClosureStrategy(strategyDef, context);
      break;
    case STRATEGY_TYPE.COMMON:
      applyCommonStrategy(strategyDef, context);
      break;
    default:
      // @ts-ignore TODO fix this
      throw new Error('Unknown strategy', strategyDef);
  }
}

/**
 *
 * @warining
 * The reachability applicator is still a work in progress. It works when it's the first strategy, however its
 * integration at later stages is still in progress.
 *
 * Notes:
 * This is currently defensive and will throw an error if you attempt assigning elements already assigned.
 *
 * (Potential consider)
 * If we run this strategy first we do not need to consider it in future assignments
 * The idea is that with the default reachability we collapse the chunks into their own entry point. This is different
 * from other strategies as we fully remove the imports and join them into their dominators.
 * @TODO
 */
function applyReachabilityStrategy(
  strategyDef: ReachabilityStrategyDefinition,
  context: MergeStrategyContext
): void {
  const strategy = reachabilityStrategy(context.entryPointChunk, context.graph);

  for (const [entryPoint, group] of strategy) {
    /**
     * We do not need to assign groups with only one entry as it means the chunk is only the entry point, and
     * therefore we did not reassign or merge any nodes.
     */
    if (group.length === 1) {
      continue;
    }

    assert(
      !context.assigned.has(entryPoint),
      `Entry point ${entryPoint} specified in ${strategyDef.label} has already been assigned in a previews strategy`
    );
    group.forEach((node) => {
      assert(
        !context.assigned.has(node),
        `Chunk ${node} already assigned in merge strategy`
      );
      context.assigned.add(node);
    });
    context.mergedStrategy.set(entryPoint, group);
  }
}

/**
 * Apply static closure strategy for specified entry points
 */
function applyStaticClosureStrategy(
  strategyDef: { label: string; entryPoint: string },
  context: MergeStrategyContext
): void {
  const entryPointOutput = findEntryPointOutput(
    strategyDef.entryPoint,
    context.metafile.outputs
  );
  assert(
    entryPointOutput,
    `Entry point ${strategyDef.entryPoint} not found in outputs specified in ${strategyDef.label}`
  );

  const closure = getStaticClosure(entryPointOutput, context.graph);
  const chunks = [entryPointOutput, ...closure].filter(
    (chunk) => !context.assigned.has(chunk)
  );

  context.mergedStrategy.set(entryPointOutput, chunks);
  chunks.forEach((chunk) => context.assigned.add(chunk));
  // TODO applyStaticClosureStrategy to context graph
}

/**
 * Apply common strategy - creates shared chunks from common dependencies
 */
function applyCommonStrategy(
  strategyDef: { label: string; entryPoints: string[] },
  context: MergeStrategyContext
): void {
  const entryPointChunks = new Set<string>();
  for (const entryPoint of strategyDef.entryPoints) {
    const entryPointChunk = findEntryPointOutput(
      entryPoint,
      context.metafile.outputs
    );
    assert(
      entryPointChunk,
      `Unable to find chunk for ${entryPoint} specified in ${strategyDef.label} strategy`
    );
    assert(
      !entryPointChunks.has(entryPointChunk),
      `Duplicate chunk ${entryPointChunks} for ${entryPoint} specified in ${strategyDef.label} strategy`
    );
    assert(
      !context.assigned.has(entryPointChunk),
      `Chunk ${entryPointChunks} for ${entryPoint} specified in ${strategyDef.label} strategy has already been assigned`
    );
    entryPointChunks.add(entryPointChunk);
  }

  // Get already assigned entry points (to exclude from common calculation)
  const excludeFromCommon = [...context.assigned];

  const commonStrategy = commonFeatureStrategy(
    [...entryPointChunks],
    excludeFromCommon,
    context.graph
  );

  // Add common strategy results to merged strategy
  commonStrategy.forEach((chunks, entryPoint) => {
    const unassignedChunks = chunks.filter(
      (chunk) => !context.assigned.has(chunk)
    );
    if (unassignedChunks.length > 0) {
      context.mergedStrategy.set(entryPoint, unassignedChunks);
      unassignedChunks.forEach((chunk) => context.assigned.add(chunk));
    }
  });
}
