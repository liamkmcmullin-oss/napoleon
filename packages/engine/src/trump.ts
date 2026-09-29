import { cardRank, cardSuit, isJoker, rankValue, sisterJackSuit } from './cards.js';
import type { CardId, Suit, Trump } from './types.js';

/**
 * True if `card` counts as trump for the purposes of following suit and
 * ranking. Always false on the first trick or in a No Trump hand. The
 * Joker is never "trump" — it is handled separately in trick rules.
 */
export function isTrump(card: CardId, trump: Trump, firstTrick: boolean): boolean {
  if (firstTrick || trump === 'NT') return false;
  if (isJoker(card)) return false;
  const suit = cardSuit(card);
  const rank = cardRank(card);
  if (suit === trump) return true;
  if (rank === 'J' && suit === sisterJackSuit(trump as Suit)) return true;
  return false;
}

/**
 * The suit a card counts as for following/winning. The Joker has none
 * (null). On the first trick, or in an NT hand, this is always the
 * card's natural suit. Otherwise trump cards collapse to 'TRUMP'.
 */
export function effectiveSuit(card: CardId, trump: Trump, firstTrick: boolean): Suit | 'TRUMP' | null {
  if (isJoker(card)) return null;
  if (firstTrick || trump === 'NT') return cardSuit(card);
  if (isTrump(card, trump, firstTrick)) return 'TRUMP';
  return cardSuit(card);
}

/**
 * Ordering value among trump cards, high wins. Only meaningful when
 * `isTrump(card, trump, false)` is true. Jack of trump and the sister
 * jack sit above every natural rank (max natural value is 14, the Ace).
 */
export function trumpRank(card: CardId, trump: Trump): number {
  if (trump === 'NT') {
    throw new Error('trumpRank is undefined for No Trump');
  }
  if (isJoker(card)) {
    throw new Error('trumpRank is undefined for the Joker');
  }
  const suit = cardSuit(card);
  const rank = cardRank(card);
  if (rank === 'J' && suit === trump) return 1000;
  if (rank === 'J' && suit === sisterJackSuit(trump as Suit)) return 999;
  return rankValue(rank);
}
