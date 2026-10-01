import type { BotStrategy } from '../types.js';
import { chooseAngel } from './angel.js';
import { chooseBid } from './bidding.js';
import { chooseDiscard } from './discard.js';
import { choosePlay } from './play.js';

export { estimateHandStrength, cardStrength } from './strength.js';

/**
 * Hand-strength-based bidding, discards the weakest cards first, plays
 * to win a trick cheaply (or, failing that, as late/cheaply as
 * possible), and names the most powerful card not already in hand as
 * the angel — see angel.ts for why "most powerful" and bidding.ts for
 * why bid count scales with hand strength. No lookahead or card-counting
 * — see DECISIONS.md for why that's deliberately out of scope for now.
 */
export const heuristicStrategy: BotStrategy = {
  name: 'heuristic',
  chooseMove(view, legalMoves, rng) {
    switch (view.phase) {
      case 'bidding':
        return chooseBid(view, legalMoves, rng);
      case 'angel':
        return chooseAngel(view, legalMoves);
      case 'discard':
        return chooseDiscard(view);
      case 'play':
        return choosePlay(view, legalMoves);
      case 'handOver':
        if (legalMoves.length === 0) throw new Error('heuristicStrategy: no legal moves in handOver');
        return legalMoves[0]!;
    }
  },
};
