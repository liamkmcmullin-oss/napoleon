import type { Bid, Trump } from '@napoleon/engine';
import { useGame } from '../connection/GameContext.js';

const TRUMP_SYMBOL: Record<Trump, string> = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };

function formatBid(bid: Bid): string {
  return `${bid.count}${TRUMP_SYMBOL[bid.trump]}`;
}

export function BiddingPanel(): React.JSX.Element {
  const { view, legalMoves, sendMove } = useGame();

  if (!view) return <></>;

  const bidMoves = legalMoves.filter((m): m is { type: 'bid'; bid: Bid } => m.type === 'bid');
  const canPass = legalMoves.some((m) => m.type === 'pass');

  // Group only the legal bids by count, in ascending order — rather than
  // a full count x trump grid with most cells disabled, this renders
  // just the options actually available right now.
  const counts = [...new Set(bidMoves.map((m) => m.bid.count))].sort((a, b) => a - b);
  const trumpsForCount = (count: number): Trump[] =>
    view.config.trumpRankLowToHigh.filter((trump) => bidMoves.some((m) => m.bid.count === count && m.bid.trump === trump));

  const handleBid = (count: number, trump: Trump): void => {
    sendMove({ type: 'bid', bid: { count, trump } });
  };

  const handlePass = (): void => {
    sendMove({ type: 'pass' });
  };

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Bidding</h3>
        {view.currentBid && view.bidder !== null && (
          <span className="pill pill--accent">
            Current: {formatBid(view.currentBid)} (Seat {view.bidder})
          </span>
        )}
        {!view.currentBid && <span className="pill">No bid yet</span>}
      </div>

      {view.bidHistory.length > 0 && (
        <div className="stack" style={{ fontSize: '0.85rem' }}>
          {view.bidHistory.map((record, idx) => (
            <div key={idx} className="row" style={{ gap: 'var(--space-1)' }}>
              <span>
                Seat {record.seat}: {record.bid ? `bid ${formatBid(record.bid)}` : 'passed'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="stack" style={{ gap: 'var(--space-1)' }}>
        {counts.map((count) => (
          <div key={count} className="row" style={{ gap: 'var(--space-1)', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '1.5em' }}>{count}</span>
            {trumpsForCount(count).map((trump) => (
              <button
                key={trump}
                type="button"
                className="btn btn--small"
                onClick={() => handleBid(count, trump)}
                style={{ minWidth: '44px', padding: '4px 6px' }}
              >
                {TRUMP_SYMBOL[trump]}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--secondary" disabled={!canPass} onClick={handlePass}>
          Pass
        </button>
        {!canPass && (
          <span className="pill">You must bid — everyone else has passed</span>
        )}
      </div>
    </div>
  );
}
