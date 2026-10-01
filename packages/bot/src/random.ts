import type { BotStrategy } from './types.js';

/** Picks uniformly among the legal moves. Used for stress-testing, and as
 * the simplest possible "fill an empty seat" option. */
export const randomStrategy: BotStrategy = {
  name: 'random',
  chooseMove(_view, legalMoves, rng) {
    if (legalMoves.length === 0) {
      throw new Error('randomStrategy.chooseMove called with no legal moves');
    }
    return legalMoves[Math.floor(rng() * legalMoves.length)]!;
  },
};
