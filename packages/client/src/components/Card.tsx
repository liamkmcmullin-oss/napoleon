import type { CSSProperties } from 'react';
import { isTrump, trumpRank } from '@napoleon/engine';
import type { CardId, Trump } from '@napoleon/engine';

const SUIT_SYMBOL: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
const RANK_DISPLAY: Record<string, string> = { T: '10' };
const RED_SUITS = new Set(['D', 'H']);

export function formatCard(card: CardId): { rank: string; suit: string | null; symbol: string | null; red: boolean } {
  if (card === 'JOKER') return { rank: 'JOKER', suit: null, symbol: null, red: false };
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return {
    rank: RANK_DISPLAY[rank] ?? rank,
    suit,
    symbol: SUIT_SYMBOL[suit] ?? suit,
    red: RED_SUITS.has(suit),
  };
}

const SUIT_ORDER: Record<string, number> = { C: 0, D: 1, H: 2, S: 3 };
const RANK_ORDER: Record<string, number> = Object.fromEntries(
  ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].map((r, i) => [r, i]),
);

/**
 * Sorts by suit (clubs, diamonds, hearts, spades), then rank low to high,
 * with the Joker last. Once a trump is set, the sister jack (the other
 * suit's jack, which counts as a trump card during play) is grouped with
 * the rest of the trump suit instead of its printed suit — it's a trump
 * card on the table, so it should look like one in hand — and ranked by
 * its actual trump power (jack of trump highest, sister jack just below).
 */
export function sortForDisplay(cards: CardId[], trump: Trump | null = null): CardId[] {
  const trumpActive = trump !== null && trump !== 'NT';
  const isCardTrump = (card: CardId): boolean => trumpActive && isTrump(card, trump as Trump, false);
  const groupSuit = (card: CardId): string => (isCardTrump(card) ? (trump as string) : card.slice(-1));
  const rankKey = (card: CardId): number => (isCardTrump(card) ? trumpRank(card, trump as Trump) : RANK_ORDER[card.slice(0, -1)]!);

  return [...cards].sort((a, b) => {
    if (a === 'JOKER') return 1;
    if (b === 'JOKER') return -1;
    const suitCmp = SUIT_ORDER[groupSuit(a)]! - SUIT_ORDER[groupSuit(b)]!;
    if (suitCmp !== 0) return suitCmp;
    return rankKey(a) - rankKey(b);
  });
}

export interface CardProps {
  card: CardId;
  selected?: boolean;
  disabled?: boolean;
  /** Visually calls out a card as a legal choice right now (distinct from merely being clickable). */
  playable?: boolean;
  faceDown?: boolean;
  small?: boolean;
  onClick?: (card: CardId) => void;
  style?: CSSProperties;
}

export function Card({ card, selected, disabled, playable, faceDown, small, onClick, style }: CardProps): React.JSX.Element {
  if (faceDown) {
    return <div className={`card card--back ${small ? 'card--small' : ''}`} style={style} aria-label="face-down card" />;
  }

  const { rank, symbol, red } = formatCard(card);
  const classes = [
    'card',
    red ? 'card--red' : 'card--black',
    small ? 'card--small' : '',
    selected ? 'card--selected' : '',
    playable ? 'card--playable' : '',
    disabled ? 'card--disabled' : '',
    onClick ? 'card--clickable' : '',
    card === 'JOKER' ? 'card--joker' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      style={style}
      disabled={disabled || !onClick}
      onClick={onClick ? () => onClick(card) : undefined}
      aria-pressed={selected}
    >
      <span className="card__rank">{rank}</span>
      {symbol && <span className="card__suit">{symbol}</span>}
    </button>
  );
}
