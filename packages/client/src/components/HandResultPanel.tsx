import type { PlayerView } from '@napoleon/engine';
import { useGame } from '../connection/GameContext.js';

export function HandResultPanel({
  view,
  names,
}: {
  view: PlayerView;
  names: (string | null)[];
}): React.JSX.Element {
  const { sendMove } = useGame();
  const result = view.handResult;

  if (!result) return <></>;

  const bid = view.currentBid;
  const swing = result.base * result.multiplier;

  const handleContinue = (): void => {
    sendMove({ type: 'nextHand' });
  };

  return (
    <div className="panel">
      <h3 style={{ margin: 0 }}>{result.napoleonWon ? "Napoleon's side won the hand" : "Napoleon's side lost the hand"}</h3>
      <p style={{ margin: 0 }}>
        Captured {result.points} point{result.points === 1 ? '' : 's'}
        {bid ? ` against a bid of ${bid.count}` : ''}.
      </p>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(245, 245, 240, 0.8)' }}>
        Base score {result.base} × multiplier {result.multiplier} = {swing} point{swing === 1 ? '' : 's'}
        {result.multiplier > 1
          ? ' (doubled if Napoleon was their own angel, doubled again for capturing all 20 points)'
          : ''}
        .
      </p>
      <div className="stack">
        {result.deltas.map((delta, seat) => (
          <div key={seat} className="row" style={{ justifyContent: 'space-between' }}>
            <span>{names[seat] ?? `Seat ${seat}`}</span>
            <span
              style={{
                fontWeight: 700,
                color: delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : undefined,
              }}
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="btn" onClick={handleContinue}>
        Continue to next hand
      </button>
    </div>
  );
}
