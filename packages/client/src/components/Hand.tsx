import { useState } from 'react';
import type { CardId, Move, PlayerView, Suit } from '@napoleon/engine';
import { useGame } from '../connection/GameContext.js';
import { Card } from './Card.js';

const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
const CALLABLE_SUITS: Suit[] = ['C', 'D', 'H', 'S'];

type PlayMove = Extract<Move, { type: 'play' }>;

export function Hand({ view }: { view: PlayerView }): React.JSX.Element {
  const { legalMoves, sendMove } = useGame();
  const myTurnToPlay = view.phase === 'play' && view.turn === view.seat;
  // Leading the Joker in a No Trump hand offers one legal move per suit
  // (see legalMoves() in packages/engine/src/moves.ts) — the player must
  // pick which suit to call before the play is actually sent.
  const [callingSuitFor, setCallingSuitFor] = useState<CardId | null>(null);

  const playMoves = legalMoves.filter((m): m is PlayMove => m.type === 'play');
  const movesForCard = (card: CardId): PlayMove[] => playMoves.filter((m) => m.card === card);
  const legalCardIds = new Set(playMoves.map((m) => m.card));

  const playCard = (card: CardId) => {
    const options = movesForCard(card);
    if (options.length === 0) return;
    if (options.length === 1) {
      sendMove(options[0]!);
      return;
    }
    setCallingSuitFor(card);
  };

  const callSuit = (suit: Suit) => {
    if (!callingSuitFor) return;
    const move = movesForCard(callingSuitFor).find((m) => m.calledSuit === suit);
    if (move) sendMove(move);
    setCallingSuitFor(null);
  };

  return (
    <div className="panel">
      <h3 style={{ margin: 0 }}>Your hand{myTurnToPlay ? ' — your turn, pick a card' : ''}</h3>

      {callingSuitFor && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <span className="pill pill--accent">Leading the Joker — call a suit:</span>
          {CALLABLE_SUITS.map((suit) => (
            <button key={suit} type="button" className="btn btn--small" onClick={() => callSuit(suit)}>
              {SUIT_SYMBOL[suit]}
            </button>
          ))}
          <button type="button" className="btn btn--secondary btn--small" onClick={() => setCallingSuitFor(null)}>
            Cancel
          </button>
        </div>
      )}

      <div className="hand-row">
        {view.hand.map((card) => {
          const playable = myTurnToPlay && legalCardIds.has(card);
          return <Card key={card} card={card} disabled={!playable} {...(playable ? { onClick: playCard } : {})} />;
        })}
      </div>
    </div>
  );
}
