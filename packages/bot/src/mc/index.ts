import type { BotStrategy } from '../types.js';
import { heuristicStrategy } from '../heuristic/index.js';
import { chooseMcAngel } from './angel.js';
import { chooseMcBid } from './bidding.js';
import { chooseMcPlay } from './play.js';

export interface McOptions {
  name?: string;
  /** Sampled deals per card choice in the play phase. */
  playSamples?: number;
  bidSamples?: number;
  angelSamples?: number;
  angelCandidates?: number;
  /** Assumed value of passing in the auction. */
  passValue?: number;
  /** Chance a defender's sample lets Napoleon hold the card they named. */
  soloPrior?: number | undefined;
  /** Weight sampled hands by what the auction reveals about them (default false: not shown to help in the arena yet). */
  auctionInference?: boolean;
  /** Use the heuristic for bidding / angel naming instead of Monte Carlo. */
  mcBidding?: boolean;
  mcAngel?: boolean;
}

/**
 * Determinized Monte Carlo bot. Plays, bids and names the Angel by sampling
 * the cards it can't see and simulating the rest of the hand with the
 * heuristic policy. Discarding is still the heuristic's.
 */
export function createMcStrategy(options: McOptions = {}): BotStrategy {
  const {
    name = 'mc',
    playSamples = 40,
    bidSamples = 100,
    angelSamples = 40,
    angelCandidates = 16,
    passValue = 0,
    soloPrior,
    auctionInference = false,
    mcBidding = true,
    mcAngel = true,
  } = options;

  const sampling = { auction: auctionInference, soloPrior };

  return {
    name,
    chooseMove(view, legalMoves, rng) {
      switch (view.phase) {
        case 'bidding':
          return mcBidding
            ? chooseMcBid(view, legalMoves, rng, { samples: bidSamples, passValue, ...sampling })
            : heuristicStrategy.chooseMove(view, legalMoves, rng);
        case 'angel':
          return mcAngel
            ? chooseMcAngel(view, legalMoves, rng, { samples: angelSamples, candidates: angelCandidates, ...sampling })
            : heuristicStrategy.chooseMove(view, legalMoves, rng);
        case 'play':
          return chooseMcPlay(view, legalMoves, rng, { samples: playSamples, ...sampling });
        default:
          return heuristicStrategy.chooseMove(view, legalMoves, rng);
      }
    },
  };
}
