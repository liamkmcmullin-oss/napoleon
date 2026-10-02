import type { Bid, CardId, Config, PlayerView } from '@napoleon/engine';
import { estimateHandStrength } from '../heuristic/strength.js';
import { STRENGTH_TO_COUNT_SCALE, WORTH_BIDDING_THRESHOLD } from '../heuristic/bidding.js';

// A deliberately loose model of how a player's bidding reflects their hand.
// It mirrors the heuristic's own bidding (hand strength -> target count) but
// with wide tolerances, so human opponents who bid differently only nudge
// the samples rather than being ruled out.
const PASS_TAU = 1.5;
const BID_SIGMA = 3.5;

export type AuctionSignal =
  | { kind: 'pass'; /** Count of the cheapest bid they declined to make. */ required: number }
  | { kind: 'bid'; bid: Bid };

/** Each seat's last action in the auction (null if they haven't acted). */
export function auctionSignals(view: PlayerView): (AuctionSignal | null)[] {
  const signals: (AuctionSignal | null)[] = Array.from({ length: view.players }, () => null);
  let current: Bid | null = null;
  for (const rec of view.bidHistory) {
    if (rec.bid) {
      signals[rec.seat] = { kind: 'bid', bid: rec.bid };
      current = rec.bid;
    } else {
      signals[rec.seat] = { kind: 'pass', required: current ? current.count + 0.5 : view.config.minBid };
    }
  }
  return signals;
}

function targetCount(hand: CardId[], trump: Bid['trump'], config: Config): number {
  return config.minBid + (estimateHandStrength(hand, trump) - WORTH_BIDDING_THRESHOLD) * STRENGTH_TO_COUNT_SCALE;
}

/** Log-likelihood that a player holding `hand` (at bidding time) acted as `signal` says. */
export function auctionLogLikelihood(signal: AuctionSignal, hand: CardId[], config: Config): number {
  if (signal.kind === 'pass') {
    let best = -Infinity;
    for (const trump of config.trumpRankLowToHigh) best = Math.max(best, targetCount(hand, trump, config));
    const pPass = 1 / (1 + Math.exp(-(signal.required - best) / PASS_TAU));
    return Math.log(Math.max(pPass, 1e-6));
  }
  const z = (targetCount(hand, signal.bid.trump, config) - signal.bid.count) / BID_SIGMA;
  return -0.5 * z * z;
}

/** Systematic resampling: draws `n` items with probability proportional to exp(logWeight). */
export function resample<T>(items: T[], logWeights: number[], n: number, rng: () => number): T[] {
  const max = Math.max(...logWeights);
  const weights = logWeights.map((lw) => Math.exp(lw - max));
  const total = weights.reduce((a, b) => a + b, 0);
  const out: T[] = [];
  const step = total / n;
  let target = rng() * step;
  let cumulative = 0;
  let i = 0;
  for (let k = 0; k < n; k++) {
    while (i < items.length - 1 && cumulative + weights[i]! < target) {
      cumulative += weights[i]!;
      i++;
    }
    out.push(items[i]!);
    target += step;
  }
  return out;
}
