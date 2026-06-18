import { applyCommonStrategy } from './common-strategy';
import { applyReachabilityStrategy } from './reachability-strategy';
import { applyStaticClosureStrategy } from './static-closure-strategy';
import {
  STRATEGY_TYPE,
  type MergeStrategyConfig,
  type MergeStrategyContext,
  type StrategyDefinition,
} from './types';

export function applyStrategies(
  config: MergeStrategyConfig,
  context: MergeStrategyContext
): void {
  for (const strategy of config.strategies) {
    applyStrategy(strategy, context);
  }
}

function applyStrategy(
  strategy: StrategyDefinition,
  context: MergeStrategyContext
): void {
  switch (strategy.type) {
    case STRATEGY_TYPE.REACHABILITY:
      applyReachabilityStrategy(strategy, context);
      return;

    case STRATEGY_TYPE.STATIC_CLOSURE:
      applyStaticClosureStrategy(strategy, context);
      return;

    case STRATEGY_TYPE.COMMON:
      applyCommonStrategy(strategy, context);
      return;

    default:
      assertUnreachable(strategy);
  }
}

function assertUnreachable(value: never): never {
  throw new Error(`Unknown merge strategy: ${JSON.stringify(value)}`);
}
