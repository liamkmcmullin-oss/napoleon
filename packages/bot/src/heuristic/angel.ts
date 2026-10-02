import { cardRank, isJoker, isTrump, makeDeck, rankValue, trumpRank } from '@napoleon/engine';
import type { CardId, Move, PlayerView } from '@napoleon/engine';

// Ranks every card by raw in-game power, independent of the hand-strength
// scale in strength.ts (that one is tuned for bidding/discard/lead
// decisions; this mirrors resolveTrick.ts's actual precedence instead):
// Ace of Spades always wins outright, then the jack of trump and its
// sister jack, then the Joker (powerful but only when led), then the
// rest of trump by rank, then plain naturals by rank.
export function cardPower(card: CardId, trump: PlayerView['trump']): number {
  if (card === 'AS') return 1000;
  if (trump && trump !== 'NT' && isTrump(card, trump, false)) {
    const rank = trumpRank(card, trump);
    if (rank === 1000) return 900; // jack of trump
    if (rank === 999) return 890; // sister jack
  }
  if (isJoker(card)) return 850;
  if (trump && trump !== 'NT' && isTrump(card, trump, false)) {
    return 500 + trumpRank(card, trump);
  }
  return rankValue(cardRank(card));
}

/**
 * Names the most powerful card we don't already hold ourselves. Naming a
 * card already in our own hand makes us our own angel (playing solo), so
 * this deliberately only considers the other `players - 1` hands' worth
 * of cards — the strongest one of those is the best guess at a strong
 * partner, with no way (fairly) to know who actually holds it.
 */
export function chooseAngel(view: PlayerView, legalMoves: Move[]): Move {
  const angelMoves = legalMoves.filter((m): m is { type: 'nameAngel'; card: CardId } => m.type === 'nameAngel');
  if (angelMoves.length === 0) throw new Error('chooseAngel: no legal nameAngel moves');

  const hand = new Set(view.hand);
  const candidates = makeDeck().filter((card) => !hand.has(card));
  const pool = candidates.length > 0 ? candidates : makeDeck();

  let best = pool[0]!;
  let bestPower = cardPower(best, view.trump);
  for (const card of pool.slice(1)) {
    const power = cardPower(card, view.trump);
    if (power > bestPower) {
      best = card;
      bestPower = power;
    }
  }
  return { type: 'nameAngel', card: best };
}
