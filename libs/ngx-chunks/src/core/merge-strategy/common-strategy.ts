import { findOutputForEntryPoint } from './graph';
import { getStaticClosure } from './graph-queries';
import { assignMergeGroup } from './merge-groups';
import type {
  CommonStrategyDefinition,
  MergeStrategyContext,
  OutputPath,
} from './types';

export function applyCommonStrategy(
  strategy: CommonStrategyDefinition,
  context: MergeStrategyContext
): void {
  const entryPointChunks = strategy.entryPoints.map((entryPoint) =>
    resolveEntryPointChunk(strategy, entryPoint, context)
  );

  const commonChunks = getCommonChunks(entryPointChunks, context);
  const owner = commonChunks[0];

  if (!owner) {
    return;
  }

  assignMergeGroup(owner, commonChunks, context);
}

function resolveEntryPointChunk(
  strategy: CommonStrategyDefinition,
  entryPoint: string,
  context: MergeStrategyContext
): OutputPath {
  const entryPointChunk = findOutputForEntryPoint(entryPoint, context.metafile);

  if (!entryPointChunk) {
    throw new Error(
      `Entry point "${entryPoint}" specified in "${strategy.label}" was not found in the metafile outputs.`
    );
  }

  if (context.assigned.has(entryPointChunk)) {
    throw new Error(
      `Entry point chunk "${entryPointChunk}" specified in "${strategy.label}" has already been assigned.`
    );
  }

  return entryPointChunk;
}

function getCommonChunks(
  entryPointChunks: OutputPath[],
  context: MergeStrategyContext
): OutputPath[] {
  const commonChunks = new Set<OutputPath>();

  for (const entryPointChunk of entryPointChunks) {
    for (const outputPath of getStaticClosure(context, entryPointChunk)) {
      if (context.assigned.has(outputPath)) {
        continue;
      }

      commonChunks.add(outputPath);
    }
  }

  return [...commonChunks];
}
