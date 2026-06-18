export { DEFAULT_MERGE_STRATEGY_CONFIG } from './config';
export { applyCommonStrategy } from './common-strategy';
export {
  createBundleGraph,
  findOutputForEntryPoint,
  getDynamicDependencies,
  getReachableGraphOutputPaths,
  getStaticDependencies,
  getTransitiveStaticDependencies,
  isJavaScriptOutput,
  type BundleGraph,
  type BundleGraphImport,
  type BundleGraphNode,
  type ImportKind,
  type OutputImport,
} from './graph';
export { mergeStrategyFactory } from './merge-strategy-factory';
export {
  applyStaticClosureStrategy,
  assignMergeGroup,
  getStaticClosure,
} from './static-closure-strategy';
export {
  STRATEGY_TYPE,
  type CommonStrategyDefinition,
  type MergeStrategy,
  type MergeStrategyConfig,
  type MergeStrategyContext,
  type MergeStrategyFactory,
  type OutputPath,
  type ReachabilityStrategyDefinition,
  type StaticClosureStrategyDefinition,
  type StrategyDefinition,
  type StrategyType,
} from './types';
