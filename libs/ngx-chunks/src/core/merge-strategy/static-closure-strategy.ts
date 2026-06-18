import { findOutputForEntryPoint } from './graph';
import { getStaticClosure } from './graph-queries';
import { assignMergeGroup } from './merge-groups';
import type {
  MergeStrategyContext,
  StaticClosureStrategyDefinition,
} from './types';

export function applyStaticClosureStrategy(
  strategy: StaticClosureStrategyDefinition,
  context: MergeStrategyContext
): void {
  const entryPointChunk = findOutputForEntryPoint(
    strategy.entryPoint,
    context.metafile
  );

  if (!entryPointChunk) {
    throw new Error(
      `Entry point "${strategy.entryPoint}" specified in "${strategy.label}" was not found in the metafile outputs.`
    );
  }

  assignMergeGroup(
    entryPointChunk,
    [entryPointChunk, ...getStaticClosure(context, entryPointChunk)],
    context
  );
}
