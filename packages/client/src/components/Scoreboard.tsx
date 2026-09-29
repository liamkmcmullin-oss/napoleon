import type { Bid, PlayerView, Trump } from '@napoleon/engine';

const TRUMP_SYMBOL: Record<Trump, string> = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };

function formatBid(bid: Bid): string {
  return `${bid.count}${TRUMP_SYMBOL[bid.trump]}`;
}

function seatLabel(seat: number, names: (string | null)[]): string {
  return names[seat] ?? `Seat ${seat}`;
}

export function Scoreboard({
  view,
  names,
}: {
  view: PlayerView;
  names: (string | null)[];
}): React.JSX.Element {
  const trumpLabel = view.trump === null ? null : TRUMP_SYMBOL[view.trump];

  return (
    <div className="panel" style={{ padding: 'var(--space-3)', gap: 'var(--space-2)' }}>
      <div className="row">
        {view.scores.map((score, seat) => (
          <span
            key={seat}
            className={`pill ${seat === view.napoleon ? 'pill--accent' : ''}`}
          >
            {seatLabel(seat, names)}: {score}
          </span>
        ))}
      </div>

      <div className="row" style={{ fontSize: '0.85rem' }}>
        <span className="pill">Phase: {view.phase}</span>
        <span className="pill">Dealer: {seatLabel(view.dealer, names)}</span>
        {view.currentBid && <span className="pill">Bid: {formatBid(view.currentBid)}</span>}
        {trumpLabel && <span className="pill">Trump: {trumpLabel}</span>}
      </div>

      {view.phase === 'bidding' && view.bidHistory.length > 0 && (
        <div className="row" style={{ fontSize: '0.75rem', opacity: 0.85 }}>
          {view.bidHistory.map((record, idx) => (
            <span key={idx}>
              {seatLabel(record.seat, names)}: {record.bid ? `bid ${formatBid(record.bid)}` : 'passed'}
              {idx < view.bidHistory.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
