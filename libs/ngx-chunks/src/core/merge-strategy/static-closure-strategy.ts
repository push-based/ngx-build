import {
  findOutputForEntryPoint,
  getTransitiveStaticDependencies,
} from './graph';
import type {
  MergeStrategyContext,
  OutputPath,
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

export function getStaticClosure(
  context: Pick<MergeStrategyContext, 'graph'>,
  entryPointChunk: OutputPath
): OutputPath[] {
  return getTransitiveStaticDependencies(context.graph, entryPointChunk).filter(
    (outputPath) => !context.graph.get(outputPath)?.isEntryPoint
  );
}

export function assignMergeGroup(
  owner: OutputPath,
  chunks: OutputPath[],
  context: Pick<MergeStrategyContext, 'assigned' | 'mergeStrategy'>
): void {
  if (context.assigned.has(owner)) {
    throw new Error(`Merge group owner "${owner}" has already been assigned.`);
  }

  const unassignedChunks = chunks.filter(
    (chunk) => !context.assigned.has(chunk)
  );

  if (!unassignedChunks.includes(owner)) {
    unassignedChunks.unshift(owner);
  }

  if (unassignedChunks.length <= 1) {
    return;
  }

  context.mergeStrategy.set(owner, unassignedChunks);

  for (const chunk of unassignedChunks) {
    context.assigned.add(chunk);
  }
}
