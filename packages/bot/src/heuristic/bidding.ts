import type { Bid, Move, PlayerView, Trump } from '@napoleon/engine';
import { estimateHandStrength } from './strength.js';

type BidMove = Extract<Move, { type: 'bid' }>;

// Calibrated against the actual distribution of estimateHandStrength()
// over random hands (see the simulation referenced in DECISIONS.md),
// not derived analytically. estimateHandStrength takes the best of
// several candidate trumps, which biases it well above what a "per-card
// average" intuition would suggest — e.g. for a 12-card hand the
// *median* random hand already scores ~14, and the top 1% scores ~24.
// Below the threshold, pass; a hand right at the threshold bids the
// minimum, and it takes a top-1%-ish hand to reach the maximum.
const WORTH_BIDDING_THRESHOLD = 13;
const STRENGTH_TO_COUNT_SCALE = 0.7;

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

  // If even the cheapest legal bid already exceeds what this hand is
  // comfortable going to, the auction has moved past us — fold rather
  // than keep matching the legal minimum round after round. Without
  // this, a hand only barely worth bidding (target just above the
  // threshold) would otherwise chase every raise all the way to
  // maxBid, since nothing below ever told it to stop.
  if (cheapestBid(pool, view).bid.count > targetCount) {
    return { type: 'pass' };
  }

  const atOrAboveTarget = pool.filter((m) => m.bid.count >= targetCount);
  // If our target is reachable (the check above passed) but not exactly
  // hittable — e.g. counts jump past it in this trump — bid as high as
  // we legally can rather than conceding the cheapest option; a strong
  // hand shouldn't fold just because it can't hit its exact number.
  const chosen: Bid = (atOrAboveTarget.length > 0 ? cheapestBid(atOrAboveTarget, view) : highestBid(pool, view)).bid;
  return { type: 'bid', bid: chosen };
}
