import type { CSSProperties } from 'react';
import type { PlayerView, Seat } from '@napoleon/engine';
import { Card } from './Card.js';

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
              </span>
              <span className="table-seat__count">{count} cards</span>
            </div>
          );
        })}

        <div className="trick-grid">
          {view.trick.map((play) => (
            <div className="trick-slot" key={play.seat}>
              <Card card={play.card} small />
              <span>{seatLabel(play.seat, names)}</span>
            </div>
          ))}
          {view.trick.length === 0 && <span className="pill">Trick {view.trickNumber} of {view.config.handSize}</span>}
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
