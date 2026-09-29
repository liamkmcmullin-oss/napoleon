import type { CSSProperties } from 'react';
import type { CardId } from '@napoleon/engine';

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

/** Sorts by suit (clubs, diamonds, hearts, spades), then rank low to high, with the Joker last. */
export function sortForDisplay(cards: CardId[]): CardId[] {
  return [...cards].sort((a, b) => {
    if (a === 'JOKER') return 1;
    if (b === 'JOKER') return -1;
    const suitCmp = SUIT_ORDER[a.slice(-1)]! - SUIT_ORDER[b.slice(-1)]!;
    if (suitCmp !== 0) return suitCmp;
    return RANK_ORDER[a.slice(0, -1)]! - RANK_ORDER[b.slice(0, -1)]!;
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
