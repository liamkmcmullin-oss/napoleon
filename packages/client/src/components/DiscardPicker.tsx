import { useState } from 'react';
import type { CardId } from '@napoleon/engine';
import { useGame } from '../connection/GameContext.js';
import { Card } from './Card.js';

export function DiscardPicker(): React.JSX.Element {
  const { view, sendMove } = useGame();
  const [selected, setSelected] = useState<Set<CardId>>(new Set());

  if (!view) return <></>;

  const widowSize = view.config.widowSize;

  const toggle = (card: CardId): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(card)) next.delete(card);
      else next.add(card);
      return next;
    });
  };

  const canDiscard = selected.size === widowSize;

  const handleDiscard = (): void => {
    if (!canDiscard) return;
    sendMove({ type: 'discard', cards: [...selected] });
  };

  return (
    <div className="panel">
      <h3 style={{ margin: 0 }}>Discard to the widow</h3>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(245, 245, 240, 0.8)' }}>
        Your hand now includes the widow. Choose exactly {widowSize} cards to discard face down — discarded point
        cards count for no one.
      </p>
      <div className="hand-row">
        {view.hand.map((card) => (
          <Card key={card} card={card} selected={selected.has(card)} onClick={toggle} />
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="pill">
          {selected.size} / {widowSize} selected
        </span>
        <button type="button" className="btn" disabled={!canDiscard} onClick={handleDiscard}>
          Discard
        </button>
      </div>
    </div>
  );
}
