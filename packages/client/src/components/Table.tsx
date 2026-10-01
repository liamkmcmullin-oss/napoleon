import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PlayerView, Seat, TrickPlay } from '@napoleon/engine';
import { Card } from './Card.js';

// A finished trick stays on the table for at least this long — and
// longer still if nobody has led the next trick yet — so it doesn't
// vanish before players have registered what was just played.
const TRICK_HOLD_MS = 3000;

interface HeldTrick {
  trick: TrickPlay[];
  trickNumber: number;
  winnerSeat: Seat;
  until: number;
}

/**
 * Where each other seat sits relative to the viewer, going clockwise
 * starting from the viewer's left (matches turn order: mySeat+1, +2, ...).
 * The viewer's own seat is never in this list — their hand renders
 * separately, below the table.
 */
const POSITION_TEMPLATES: Record<number, string[]> = {
  4: ['left', 'top', 'right'],
  5: ['left', 'top-left', 'top-right', 'right'],
};

function seatPositions(players: number, mySeat: number): { seat: Seat; position: string }[] {
  const template = POSITION_TEMPLATES[players] ?? [];
  const others: Seat[] = [];
  for (let i = 1; i < players; i++) others.push((mySeat + i) % players);
  return others.map((seat, i) => ({ seat, position: template[i] ?? 'top' }));
}

function seatLabel(seat: Seat, names: (string | null)[]): string {
  return names[seat] ?? `Seat ${seat}`;
}

// Nudges each played card toward the screen position of the seat that
// played it, so a full trick fans out around the center instead of
// stacking into one unreadable pile. The most recently played card
// overrides this with {x:0, y:0} (dead center, on top) — see render.
const TRICK_DIRECTION_OFFSET: Record<string, { x: number; y: number }> = {
  left: { x: -48, y: 8 },
  right: { x: 48, y: 8 },
  top: { x: 0, y: -34 },
  'top-left': { x: -36, y: -30 },
  'top-right': { x: 36, y: -30 },
  self: { x: 0, y: 40 },
};

const MAX_VISIBLE_BACKS = 8;

function opponentFan(count: number) {
  const shown = Math.min(count, MAX_VISIBLE_BACKS);
  const cards: CSSProperties[] = [];
  for (let i = 0; i < shown; i++) {
    const mid = (shown - 1) / 2;
    const offset = i - mid;
    cards.push({
      position: 'absolute',
      left: `calc(50% + ${offset * 10}px)`,
      transform: `translateX(-50%) rotate(${offset * 6}deg)`,
      zIndex: i,
    });
  }
  return cards;
}

export function Table({ view, names }: { view: PlayerView; names: (string | null)[] }): React.JSX.Element {
  const others = seatPositions(view.players, view.seat);
  const directionBySeat = new Map<Seat, string>(others.map(({ seat, position }) => [seat, position]));
  directionBySeat.set(view.seat, 'self');
  const [held, setHeld] = useState<HeldTrick | null>(null);
  // `view.trick` never actually holds all N plays at once from the
  // client's perspective — the server resolves a trick (and clears
  // `trick` back to []) in the same state transition as the last card
  // being played, so there's no broadcast in between to catch it at 4.
  // `view.tricks` (every *completed* trick, each with its full `plays`
  // array and `winner`) is what actually has the full picture.
  const prevTricksCountRef = useRef(view.tricks.length);

  useEffect(() => {
    const prevCount = prevTricksCountRef.current;
    prevTricksCountRef.current = view.tricks.length;
    if (view.tricks.length > prevCount) {
      const completed = view.tricks[view.tricks.length - 1]!;
      setHeld({
        trick: completed.plays,
        trickNumber: view.tricks.length,
        winnerSeat: completed.winner,
        until: Date.now() + TRICK_HOLD_MS,
      });
    }
  }, [view]);

  useEffect(() => {
    if (!held) return;
    const remaining = held.until - Date.now();
    if (remaining <= 0) {
      setHeld(null);
      return;
    }
    const timer = setTimeout(() => setHeld(null), remaining);
    return () => clearTimeout(timer);
  }, [held]);

  const showingHeld = held !== null;
  const trickToShow = showingHeld ? held.trick : view.trick;
  const trickNumberToShow = showingHeld ? held.trickNumber : view.trickNumber;

  return (
    <div className="stack">
      <div className="table">
        {others.map(({ seat, position }) => {
          const count = view.handCounts[seat] ?? 0;
          return (
            <div key={seat} className={`table-seat table-seat--${position} ${seat === view.turn ? 'table-seat--turn' : ''}`}>
              <div className="card-fan">
                {opponentFan(count).map((style, i) => (
                  <Card key={i} card="JOKER" faceDown small style={style} />
                ))}
              </div>
              <span className="table-seat__name">
                {seatLabel(seat, names)}
                {seat === view.dealer && <span className="table-seat__dealer"> · DEALER</span>}
                {seat === view.napoleon && <span className="table-seat__napoleon"> · NAPOLEON</span>}
              </span>
              <span className="table-seat__count">{count} cards</span>
            </div>
          );
        })}

        <div className="trick-area">
          <div className="trick-grid">
            {trickToShow.map((play, i) => {
              const isLast = i === trickToShow.length - 1;
              const offset = isLast
                ? { x: 0, y: 0 }
                : TRICK_DIRECTION_OFFSET[directionBySeat.get(play.seat) ?? 'top']!;
              return (
                <div
                  key={play.seat}
                  className={`trick-slot ${isLast ? 'trick-slot--last' : ''}`}
                  style={{
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                    zIndex: isLast ? 10 : 1,
                  }}
                >
                  <Card card={play.card} small />
                  <span>{seatLabel(play.seat, names)}</span>
                </div>
              );
            })}
            {trickToShow.length === 0 && (
              <span className="pill" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                Trick {trickNumberToShow} of {view.config.handSize}
              </span>
            )}
          </div>
          {showingHeld && (
            <span className="trick-grid__winner">Trick won by {seatLabel(held.winnerSeat, names)}</span>
          )}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', fontSize: '0.8rem' }}>
        {view.angelCard && (
          <span className="pill">
            Angel: <Card card={view.angelCard} small />
            {view.angelSeat !== null ? ` held by ${seatLabel(view.angelSeat, names)}` : ' (secret)'}
          </span>
        )}
        {view.widowCount > 0 && <span className="pill">Widow: {view.widowCount} face down</span>}
        {view.captured.some((pile) => pile.length > 0) && (
          <span className="pill">
            Won: {view.captured.map((pile, seat) => `${seatLabel(seat, names)} ${pile.length}`).join(' · ')}
          </span>
        )}
      </div>
    </div>
  );
}
