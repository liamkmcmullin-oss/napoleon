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

export interface CardProps {
  card: CardId;
  selected?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  small?: boolean;
  onClick?: (card: CardId) => void;
}

export function Card({ card, selected, disabled, faceDown, small, onClick }: CardProps): React.JSX.Element {
  if (faceDown) {
    return <div className={`card card--back ${small ? 'card--small' : ''}`} aria-label="face-down card" />;
  }

  const { rank, symbol, red } = formatCard(card);
  const classes = [
    'card',
    red ? 'card--red' : 'card--black',
    small ? 'card--small' : '',
    selected ? 'card--selected' : '',
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
      disabled={disabled || !onClick}
      onClick={onClick ? () => onClick(card) : undefined}
      aria-pressed={selected}
    >
      <span className="card__rank">{rank}</span>
      {symbol && <span className="card__suit">{symbol}</span>}
    </button>
  );
}
