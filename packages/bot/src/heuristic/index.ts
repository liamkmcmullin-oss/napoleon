import type { BotStrategy } from '../types.js';
import { chooseBid } from './bidding.js';
import { chooseDiscard } from './discard.js';
import { choosePlay } from './play.js';

export { estimateHandStrength, cardStrength } from './strength.js';

/**
 * Hand-strength-based bidding, discards the weakest cards first, and
 * plays to win a trick cheaply (or, failing that, as late/cheaply as
 * possible) rather than purely at random. No lookahead or card-counting
 * — see DECISIONS.md for why that's deliberately out of scope for now.
 *
 * Angel-naming is the one phase left to chance: picking a genuinely good
 * card to name is a deep guessing-game problem on its own (who's likely
 * to hold it, how obvious is "too obvious"), not something a simple
 * heuristic can meaningfully improve on over a random pick.
 */
export const heuristicStrategy: BotStrategy = {
  name: 'heuristic',
  chooseMove(view, legalMoves, rng) {
    switch (view.phase) {
      case 'bidding':
        return chooseBid(view, legalMoves, rng);
      case 'angel': {
        const angelMoves = legalMoves.filter((m) => m.type === 'nameAngel');
        if (angelMoves.length === 0) throw new Error('heuristicStrategy: no legal nameAngel moves');
        return angelMoves[Math.floor(rng() * angelMoves.length)]!;
      }
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
