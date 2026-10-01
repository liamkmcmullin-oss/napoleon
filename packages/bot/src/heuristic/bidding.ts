import type { Bid, Move, PlayerView, Trump } from '@napoleon/engine';
import { estimateHandStrength } from './strength.js';

type BidMove = Extract<Move, { type: 'bid' }>;

// Tuned by feel against the strength scale in strength.ts, not derived
// analytically — see packages/bot/test for the behavior this produces.
// A hand right at the threshold targets the minimum bid; strength climbs
// roughly 2 points per extra bid count after that, so it takes a genuinely
// strong hand (several aces/trump honors) to push toward the maximum.
const WORTH_BIDDING_THRESHOLD = 4;
const STRENGTH_TO_COUNT_SCALE = 0.5;

function cheapestBid(moves: BidMove[], view: PlayerView): BidMove {
  const trumpIndex = (t: Trump) => view.config.trumpRankLowToHigh.indexOf(t);
  return [...moves].sort((a, b) => a.bid.count - b.bid.count || trumpIndex(a.bid.trump) - trumpIndex(b.bid.trump))[0]!;
}

function highestBid(moves: BidMove[], view: PlayerView): BidMove {
  const trumpIndex = (t: Trump) => view.config.trumpRankLowToHigh.indexOf(t);
  return [...moves].sort((a, b) => b.bid.count - a.bid.count || trumpIndex(b.bid.trump) - trumpIndex(a.bid.trump))[0]!;
}

export function chooseBid(view: PlayerView, legalMoves: Move[], rng: () => number): Move {
  const bidMoves = legalMoves.filter((m): m is BidMove => m.type === 'bid');
  const canPass = legalMoves.some((m) => m.type === 'pass');

  if (bidMoves.length === 0) {
    return { type: 'pass' };
  }
  if (!canPass) {
    // Forced to bid (the no-all-pass rule) — bid as cheaply as legal.
    return cheapestBid(bidMoves, view);
  }

  const candidateTrumps = [...new Set(bidMoves.map((m) => m.bid.trump))];
  let bestTrump: Trump = candidateTrumps[0]!;
  let bestStrength = -Infinity;
  for (const trump of candidateTrumps) {
    // Small jitter so bots aren't perfectly predictable/exploitable.
    const strength = estimateHandStrength(view.hand, trump) + (rng() - 0.5) * 0.5;
    if (strength > bestStrength) {
      bestStrength = strength;
      bestTrump = trump;
    }
  }

  if (bestStrength < WORTH_BIDDING_THRESHOLD) {
    return { type: 'pass' };
  }

  const rawTarget = view.config.minBid + (bestStrength - WORTH_BIDDING_THRESHOLD) * STRENGTH_TO_COUNT_SCALE;
  const targetCount = Math.max(view.config.minBid, Math.min(view.config.maxBid, Math.round(rawTarget)));

  const inPreferredTrump = bidMoves.filter((m) => m.bid.trump === bestTrump);
  const pool = inPreferredTrump.length > 0 ? inPreferredTrump : bidMoves;
  const atOrAboveTarget = pool.filter((m) => m.bid.count >= targetCount);
  // If our target isn't reachable in the preferred trump (someone's
  // already bid higher than we're comfortable going), bid as high as we
  // legally can there rather than conceding the cheapest option — a
  // strong hand shouldn't fold just because it can't hit its exact number.
  const chosen: Bid = (atOrAboveTarget.length > 0 ? cheapestBid(atOrAboveTarget, view) : highestBid(pool, view)).bid;
  return { type: 'bid', bid: chosen };
}
