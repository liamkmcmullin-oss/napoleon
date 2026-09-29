import type { PlayerView } from '@napoleon/engine';
import { Card } from './Card.js';

// NOTE: intentionally minimal placeholder — packages/engine's trick-play
// rules (a Joker-led-in-NT "called suit" mechanic) are being actively
// revised outside this session, so this deliberately does not render
// TrickPlay.calledSuit yet. Revisit once that engine change settles.

function seatLabel(seat: number, names: (string | null)[]): string {
  return names[seat] ?? `Seat ${seat}`;
}

export function Table({ view, names }: { view: PlayerView; names: (string | null)[] }): React.JSX.Element {
  const trumpLabel = view.trump === null ? '—' : view.trump === 'NT' ? 'No Trump' : view.trump;

  return (
    <div className="table-felt">
      <div className="row" style={{ justifyContent: 'center' }}>
        <span className="pill">Trick {view.trickNumber} / {view.config.handSize}</span>
        <span className="pill">Trump: {trumpLabel}</span>
        {view.napoleon !== null && <span className="pill">Napoleon: {seatLabel(view.napoleon, names)}</span>}
        <span className="pill">Turn: {seatLabel(view.turn, names)}</span>
      </div>

      {view.angelCard && (
        <div className="pill">
          Angel: <Card card={view.angelCard} small />
          {view.angelSeat !== null ? ` held by ${seatLabel(view.angelSeat, names)}` : ' (secret)'}
        </div>
      )}

      <div className="trick-grid">
        {view.trick.map((play) => (
          <div className="trick-slot" key={play.seat}>
            <Card card={play.card} small />
            <span>{seatLabel(play.seat, names)}</span>
          </div>
        ))}
        {view.trick.length === 0 && <span className="pill">No cards played yet this trick.</span>}
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        {view.captured.map((pile, seat) => (
          <span className="pill" key={seat}>
            {seatLabel(seat, names)}: {pile.length} cards won
          </span>
        ))}
        {view.widowCount > 0 && <span className="pill">Widow: {view.widowCount} face down</span>}
      </div>
    </div>
  );
}
