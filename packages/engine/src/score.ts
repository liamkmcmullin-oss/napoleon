import { computeBaseScore } from './config.js';
import { pointCardCount } from './cards.js';
import type { GameState, HandResult } from './types.js';

/**
 * Scores a completed hand. Does not mutate `state` or apply deltas to
 * cumulative scores — the caller decides when to fold deltas in.
 */
export function scoreHand(state: GameState): HandResult {
  const { config, napoleon, angelSeat, currentBid, captured, players } = state;
  if (napoleon === null || angelSeat === null || !currentBid) {
    throw new Error('scoreHand requires a finished bid, napoleon, and angel');
  }

  const isOwnAngel = angelSeat === napoleon;
  const napoleonSidePoints = isOwnAngel
    ? pointCardCount(captured[napoleon] ?? [])
    : pointCardCount(captured[napoleon] ?? []) + pointCardCount(captured[angelSeat] ?? []);

  const napoleonWon = napoleonSidePoints >= currentBid.count;
  const base = computeBaseScore(config, currentBid.count);

  let multiplier = 1;
  if (isOwnAngel) multiplier *= config.angelIsNapoleonMultiplier;
  if (napoleonSidePoints === 20) multiplier *= config.allTwentyMultiplier;

  // Each defender's share is a flat -S*m/2, independent of how many
  // defenders there are (own-angel case included) — see spec 3.9 tests
  // #25/#26, and DECISIONS.md #10.
  const sign = napoleonWon ? 1 : -1;
  const deltas = Array.from({ length: players }, () => 0);
  deltas[napoleon] = sign * base * multiplier;
  if (!isOwnAngel) {
    deltas[angelSeat] = (sign * base * multiplier) / 2;
  }
  for (let seat = 0; seat < players; seat++) {
    if (seat !== napoleon && seat !== angelSeat) {
      deltas[seat] = (-sign * base * multiplier) / 2;
    }
  }

  return {
    napoleonWon,
    points: napoleonSidePoints,
    base,
    multiplier,
    deltas,
  };
}
