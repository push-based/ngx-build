export { DEFAULT_MERGE_STRATEGY_CONFIG } from './config';
export { createCommonMergeGroups } from './common-strategy';
export {
  type BundleGraph,
  type BundleGraphImport,
  type BundleGraphNode,
  type ImportKind,
  type MergeStrategy,
  type OutputImport,
  type OutputPath,
} from './contracts';
export {
  createBundleGraph,
  findOutputForEntryPoint,
  getDynamicDependencies,
  getReachableGraphOutputPaths,
  getStaticDependencies,
  getTransitiveStaticDependencies,
  isJavaScriptOutput,
} from './graph';
export { getStaticClosure } from './graph-queries';
export { mergeStrategyFactory } from './merge-strategy-factory';
export { assignMergeGroup } from './merge-groups';
export { createReachabilityMergeGroups } from './reachability-strategy';
export { createStaticClosureMergeGroups } from './static-closure-strategy';
export { applyStrategies } from './strategy-applicator';
export {
  STRATEGY_TYPE,
  type CommonStrategyDefinition,
  type MergeStrategyConfig,
  type MergeStrategyContext,
  type MergeStrategyFactory,
  type ReachabilityStrategyDefinition,
  type StaticClosureStrategyDefinition,
  type StrategyDefinition,
  type StrategyType,
} from './types';
