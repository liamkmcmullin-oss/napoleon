import { cardRank, isJoker, isTrump, trumpRank } from '@napoleon/engine';
import type { CardId, Rank, Trump } from '@napoleon/engine';

const NATURAL_RANK_STRENGTH: Partial<Record<Rank, number>> = { A: 3, K: 2, Q: 1, J: 0.5 };
// Trump versions of the same ranks are worth more — but only ranks that
// can plausibly win a trick on their own. A bare low trump card (2-9) is
// mostly useful for length/control, not for reliably winning, so it only
// gets a modest flat bump over its non-trump value rather than scaling
// linearly up toward the Ace — otherwise a hand with several low cards
// in one suit looks deceptively strong just for being "trump-length".
const TRUMP_RANK_STRENGTH: Partial<Record<Rank, number>> = { A: 4, K: 3, Q: 2, T: 1 };
const LOW_TRUMP_STRENGTH = 0.5;

/**
 * A rough, no-lookahead "how good is this card" score — higher is
 * stronger. Not a probability of winning a trick, just a relative
 * ranking used to decide what to bid, discard, lead, or dump.
 */
export function cardStrength(card: CardId, trump: Trump): number {
  if (card === 'AS') return 4; // always wins the trick it's played in
  if (isJoker(card)) return 3; // powerful but situational (can't always be led)

  const rank = cardRank(card);

  if (trump !== 'NT' && isTrump(card, trump, false)) {
    const rankInTrump = trumpRank(card, trump);
    if (rankInTrump === 1000) return 5; // jack of trump
    if (rankInTrump === 999) return 4.5; // sister jack
    return TRUMP_RANK_STRENGTH[rank] ?? LOW_TRUMP_STRENGTH;
  }

  return NATURAL_RANK_STRENGTH[rank] ?? 0.15;
}

function trumpLength(hand: CardId[], trump: Trump): number {
  if (trump === 'NT') return 0;
  return hand.filter((c) => isTrump(c, trump, false)).length;
}

/** Sums per-card strength plus a small bonus for a long trump suit (more
 * control over the hand), for a given candidate trump. */
export function estimateHandStrength(hand: CardId[], trump: Trump): number {
  const base = hand.reduce((sum, card) => sum + cardStrength(card, trump), 0);
  const length = trumpLength(hand, trump);
  const lengthBonus = length > 3 ? (length - 3) * 0.4 : 0;
  return base + lengthBonus;
}
