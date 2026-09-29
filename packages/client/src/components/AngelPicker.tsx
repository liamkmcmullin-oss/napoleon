import type { CardId, Suit } from '@napoleon/engine';
import { useGame } from '../connection/GameContext.js';
import { Card } from './Card.js';

const SUITS: Suit[] = ['C', 'D', 'H', 'S'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export function AngelPicker(): React.JSX.Element {
  const { legalMoves, sendMove } = useGame();

  const angelCards = new Set(
    legalMoves.filter((m): m is Extract<typeof m, { type: 'nameAngel' }> => m.type === 'nameAngel').map((m) => m.card),
  );

  const nameAngel = (card: CardId): void => {
    sendMove({ type: 'nameAngel', card });
  };

  return (
    <div className="panel">
      <h3 style={{ margin: 0 }}>Name the angel</h3>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(245, 245, 240, 0.8)' }}>
        Name the angel — any card in the deck, including one in your own hand. Its holder becomes your secret
        partner (or, if it&rsquo;s in your hand or the widow, you play alone).
      </p>
      <div className="stack">
        {SUITS.map((suit) => (
          <div key={suit} className="hand-row">
            {RANKS.map((rank) => {
              const card: CardId = `${rank}${suit}`;
              return <Card key={card} card={card} small disabled={!angelCards.has(card)} onClick={nameAngel} />;
            })}
          </div>
        ))}
        <div className="hand-row">
          <Card card="JOKER" small disabled={!angelCards.has('JOKER')} onClick={nameAngel} />
        </div>
      </div>
    </div>
  );
}
