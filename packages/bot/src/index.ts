import type { Move, PlayerView } from '@napoleon/engine';
import type { BotStrategy } from './types.js';
import { randomStrategy } from './random.js';
import { heuristicStrategy } from './heuristic/index.js';
import { createMcStrategy } from './mc/index.js';

export type { BotStrategy } from './types.js';
export { randomStrategy } from './random.js';
export { heuristicStrategy } from './heuristic/index.js';
export { createMcStrategy } from './mc/index.js';
export type { McOptions } from './mc/index.js';
export { runArena, playHand, formatArenaResult } from './arena.js';
export type { ArenaOptions, ArenaResult, StrategyStats } from './arena.js';

/** Add new strategies here (e.g. a future search/MC bot) — everything
 * that drives a bot seat goes through this registry by name, so adding
 * one doesn't require touching the server or client. */
export const BOT_STRATEGIES: Record<string, BotStrategy> = {
  random: randomStrategy,
  heuristic: heuristicStrategy,
  mc: createMcStrategy(),
  'mc-play': createMcStrategy({ name: 'mc-play', mcBidding: false, mcAngel: false }),
};

export const DEFAULT_BOT_STRATEGY = 'mc';

export function chooseBotMove(
  strategyName: string,
  view: PlayerView,
  legalMoves: Move[],
  rng: () => number,
): Move {
  const strategy = BOT_STRATEGIES[strategyName];
  if (!strategy) throw new Error(`unknown bot strategy: ${strategyName}`);
  return strategy.chooseMove(view, legalMoves, rng);
}
