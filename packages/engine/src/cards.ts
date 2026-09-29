import type { CardId, Rank, Suit } from './types.js';

export const SUITS: Suit[] = ['C', 'D', 'H', 'S'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const JOKER: CardId = 'JOKER';

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

const POINT_RANKS: ReadonlySet<Rank> = new Set(['A', 'K', 'Q', 'J', 'T']);

export function isJoker(card: CardId): boolean {
  return card === JOKER;
}

export function cardRank(card: CardId): Rank {
  if (isJoker(card)) {
    throw new Error('JOKER has no rank');
  }
  const rank = card.slice(0, card.length - 1) as Rank;
  return rank;
}

export function cardSuit(card: CardId): Suit {
  if (isJoker(card)) {
    throw new Error('JOKER has no suit');
  }
  return card.slice(-1) as Suit;
}

export function rankValue(rank: Rank): number {
  return RANK_VALUE[rank];
}

export function isPointCard(card: CardId): boolean {
  if (isJoker(card)) return false;
  return POINT_RANKS.has(cardRank(card));
}

/** The other suit sharing trump's color: C<->S, D<->H. */
export function sisterJackSuit(trumpSuit: Suit): Suit {
  switch (trumpSuit) {
    case 'C': return 'S';
    case 'S': return 'C';
    case 'D': return 'H';
    case 'H': return 'D';
  }
}

export function makeDeck(): CardId[] {
  const deck: CardId[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }
  deck.push(JOKER);
  return deck;
}

export function pointCardCount(cards: CardId[]): number {
  return cards.filter(isPointCard).length;
}
