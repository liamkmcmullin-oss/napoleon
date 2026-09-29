import type { Bid, Trump } from '@napoleon/engine';
import { useGame } from '../connection/GameContext.js';

const TRUMP_SYMBOL: Record<Trump, string> = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };

function formatBid(bid: Bid): string {
  return `${bid.count}${TRUMP_SYMBOL[bid.trump]}`;
}

export function BiddingPanel(): React.JSX.Element {
  const { view, legalMoves, sendMove } = useGame();

  if (!view) return <></>;

  const trumps = view.config.trumpRankLowToHigh;
  const counts: number[] = [];
  for (let c = view.config.minBid; c <= view.config.maxBid; c++) counts.push(c);

  const bidMoves = legalMoves.filter((m): m is { type: 'bid'; bid: Bid } => m.type === 'bid');
  const canPass = legalMoves.some((m) => m.type === 'pass');

  const isLegal = (count: number, trump: Trump): boolean =>
    bidMoves.some((m) => m.bid.count === count && m.bid.trump === trump);

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

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '2px 6px', fontSize: '0.75rem', textAlign: 'left' }}></th>
              {trumps.map((trump) => (
                <th key={trump} style={{ padding: '2px 6px', fontSize: '0.75rem', textAlign: 'center' }}>
                  {TRUMP_SYMBOL[trump]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {counts.map((count) => (
              <tr key={count}>
                <td style={{ padding: '2px 6px', fontSize: '0.8rem', fontWeight: 600 }}>{count}</td>
                {trumps.map((trump) => {
                  const legal = isLegal(count, trump);
                  return (
                    <td key={trump} style={{ padding: '2px' }}>
                      <button
                        type="button"
                        className="btn btn--small"
                        disabled={!legal}
                        onClick={() => handleBid(count, trump)}
                        style={{ minWidth: '44px', padding: '4px 6px' }}
                      >
                        {TRUMP_SYMBOL[trump]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
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
