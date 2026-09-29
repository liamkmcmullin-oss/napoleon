import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { CardId, Move, PlayerView, Suit } from '@napoleon/engine';
import { useGame } from '../connection/GameContext.js';
import { Card, sortForDisplay } from './Card.js';

const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
const CALLABLE_SUITS: Suit[] = ['C', 'D', 'H', 'S'];

type PlayMove = Extract<Move, { type: 'play' }>;

// Fans the hand out like cards actually held: a capped total spread (in
// percent-of-container and degrees) divided across however many cards
// there are, so a 3-card hand and a 17-card hand both look natural.
const MAX_SPREAD_PERCENT = 80;
const MAX_ROTATION_DEGREES = 44;
const LIFT_PX = 22;

function fanStyle(index: number, count: number, lifted: boolean): CSSProperties {
  const mid = (count - 1) / 2;
  const offset = count > 1 ? index - mid : 0;
  const spreadStep = count > 1 ? MAX_SPREAD_PERCENT / (count - 1) : 0;
  const rotationStep = count > 1 ? MAX_ROTATION_DEGREES / (count - 1) : 0;
  const leftPercent = 50 + offset * spreadStep;
  const rotation = offset * rotationStep;
  const arc = Math.abs(offset * spreadStep) * 0.3;

  return {
    position: 'absolute',
    left: `${leftPercent}%`,
    top: `${arc - (lifted ? LIFT_PX : 0)}px`,
    transform: `translateX(-50%) rotate(${rotation}deg)`,
    zIndex: lifted ? 100 + index : index,
  };
}

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

  const sortedHand = sortForDisplay(view.hand);

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

      <div className="own-hand">
        {sortedHand.map((card, index) => {
          const playable = myTurnToPlay && legalCardIds.has(card);
          return (
            <Card
              key={card}
              card={card}
              disabled={!playable}
              playable={playable}
              style={fanStyle(index, sortedHand.length, playable)}
              {...(playable ? { onClick: playCard } : {})}
            />
          );
        })}
      </div>
    </div>
  );
}
