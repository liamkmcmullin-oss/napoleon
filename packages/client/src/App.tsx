import { useState } from 'react';
import { useGame } from './connection/GameContext.js';
import { Lobby } from './components/Lobby.js';
import { Table } from './components/Table.js';
import { Hand } from './components/Hand.js';
import { Scoreboard } from './components/Scoreboard.js';
import { BiddingPanel } from './components/BiddingPanel.js';
import { AngelPicker } from './components/AngelPicker.js';
import { DiscardPicker } from './components/DiscardPicker.js';
import { HandResultPanel } from './components/HandResultPanel.js';
import { RulesPage } from './pages/RulesPage.js';

export default function App(): React.JSX.Element {
  const { status, code, view, names, leaveRoom } = useGame();
  const [showRules, setShowRules] = useState(false);

  if (showRules) {
    return (
      <div className="app">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Rules</h2>
          <button className="btn btn--secondary btn--small" onClick={() => setShowRules(false)}>
            Back to game
          </button>
        </div>
        <RulesPage />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Napoleon{code ? ` — room ${code}` : ''}</h2>
        <div className="row">
          <span className={`pill ${status === 'open' ? '' : 'pill--accent'}`}>
            {status === 'open' ? 'connected' : status}
          </span>
          <button className="btn btn--secondary btn--small" onClick={() => setShowRules(true)}>
            Rules
          </button>
        </div>
      </div>

      {!view && <Lobby />}

      {view && (
        <>
          <Scoreboard view={view} names={names} />
          <Table view={view} names={names} />

          {view.phase === 'bidding' && view.turn === view.seat && <BiddingPanel />}
          {view.phase === 'angel' && view.napoleon === view.seat && <AngelPicker />}
          {view.phase === 'discard' && view.napoleon === view.seat && <DiscardPicker />}
          {view.phase === 'handOver' && <HandResultPanel view={view} names={names} />}

          <Hand view={view} />

          <button className="btn btn--secondary btn--small" onClick={leaveRoom}>
            Leave game
          </button>
        </>
      )}
    </div>
  );
}
