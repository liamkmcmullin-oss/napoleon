import { computeBaseScore, legalMoves as engineLegalMoves, pointCardCount, viewFor } from '@napoleon/engine';
import type { Bid, GameState, Move, PlayerView, Trump } from '@napoleon/engine';
import { chooseAngel } from '../heuristic/angel.js';
import { playOutFromAngel } from './rollout.js';
import { angelPhaseState, sampleDeals } from './sample.js';
import type { SampleOptions } from './sample.js';

type BidMove = Extract<Move, { type: 'bid' }>;

export interface McBidOptions extends SampleOptions {
  samples: number;
  /** Expected score we assume for passing; bid only if the best bid beats it. */
  passValue: number;
}

/** Napoleon's score for a finished hand, had the bid been `count` instead. */
function napoleonDelta(final: GameState, count: number): number {
  const napoleon = final.napoleon!;
  const angel = final.angelSeat!;
  const own = angel === napoleon;
  const points = own
    ? pointCardCount(final.captured[napoleon]!)
    : pointCardCount(final.captured[napoleon]!) + pointCardCount(final.captured[angel]!);
  let mult = 1;
  if (own) mult *= final.config.angelIsNapoleonMultiplier;
  if (points === 20) mult *= final.config.allTwentyMultiplier;
  return (points >= count ? 1 : -1) * computeBaseScore(final.config, count) * mult;
}

/**
 * Expected score of becoming Napoleon with each legal bid: deal the unseen
 * cards (widow included) at random, play the hand out with the heuristic
 * naming the Angel and discarding, and average the outcome. One rollout per
 * trump scores every count at once, since only the points won matter.
 */
export function chooseMcBid(view: PlayerView, legalMoves: Move[], rng: () => number, opts: McBidOptions): Move {
  const bidMoves = legalMoves.filter((m): m is BidMove => m.type === 'bid');
  const canPass = legalMoves.some((m) => m.type === 'pass');
  if (bidMoves.length === 0) return { type: 'pass' };

  const trumps = [...new Set(bidMoves.map((m) => m.bid.trump))] as Trump[];
  const evSum = new Map<string, number>();
  const key = (b: Bid) => `${b.count}${b.trump}`;

  for (const sample of sampleDeals(view, opts.samples, rng, opts)) {
    for (const trump of trumps) {
      const start = angelPhaseState(view, sample, trump, { count: view.config.minBid, trump });
      const angel = chooseAngel(viewFor(start, view.seat), engineLegalMoves(start, view.seat));
      const final = playOutFromAngel(start, (angel as Extract<Move, { type: 'nameAngel' }>).card);
      for (const m of bidMoves) {
        if (m.bid.trump === trump) evSum.set(key(m.bid), (evSum.get(key(m.bid)) ?? 0) + napoleonDelta(final, m.bid.count));
      }
    }
  }

  let best: BidMove | null = null;
  let bestEv = -Infinity;
  for (const m of bidMoves) {
    const ev = (evSum.get(key(m.bid)) ?? 0) / opts.samples;
    if (ev > bestEv) {
      bestEv = ev;
      best = m;
    }
  }
  if (canPass && bestEv <= opts.passValue) return { type: 'pass' };
  return best!;
}
