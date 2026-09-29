import { useState } from 'react';
import { useGame } from '../connection/GameContext.js';

const NAME_KEY = 'napoleon:name';

function loadSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

export function Lobby(): React.JSX.Element {
  const { status, code, players, names, seat, createRoom, joinRoom, leaveRoom, error, clearError } = useGame();
  const [name, setName] = useState(loadSavedName());
  const [joinCode, setJoinCode] = useState('');
  const [playerCount, setPlayerCount] = useState<4 | 5>(4);

  if (code) {
    // Room exists but the hand hasn't started yet (that's App's job once `view` appears).
    const filled = names.filter((n) => n !== null).length;
    const total = players ?? 0;
    return (
      <div className="panel stack">
        <h2>Room {code}</h2>
        <p>Share this code with your friends. Waiting for {Math.max(total - filled, 0)} more player(s)...</p>
        <div className="stack">
          {Array.from({ length: total }, (_, i) => (
            <div className="pill" key={i}>
              Seat {i}: {names[i] ?? '(waiting...)'} {i === seat ? '(you)' : ''}
            </div>
          ))}
        </div>
        <button className="btn btn--secondary" onClick={leaveRoom}>
          Leave room
        </button>
      </div>
    );
  }

  const submitName = (raw: string) => {
    const trimmed = raw.trim();
    setName(trimmed);
    saveName(trimmed);
    return trimmed || 'Player';
  };

  return (
    <div className="panel stack">
      <h1>Napoleon</h1>
      <p>Play the trick-taking card game with your friends, remotely.</p>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="btn btn--small" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alice" />
      </div>

      <div className="stack">
        <h3>Start a new game</h3>
        <div className="field">
          <label htmlFor="players">Players</label>
          <select
            id="players"
            value={playerCount}
            onChange={(e) => setPlayerCount(Number(e.target.value) === 5 ? 5 : 4)}
          >
            <option value={4}>4 players</option>
            <option value={5}>5 players</option>
          </select>
        </div>
        <button className="btn" onClick={() => createRoom(playerCount, submitName(name))} disabled={status !== 'open'}>
          Create room
        </button>
      </div>

      <div className="stack">
        <h3>Join a game</h3>
        <div className="field">
          <label htmlFor="code">Room code</label>
          <input
            id="code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7QM"
            maxLength={6}
          />
        </div>
        <button
          className="btn"
          onClick={() => joinRoom(joinCode.trim(), submitName(name))}
          disabled={status !== 'open' || joinCode.trim().length === 0}
        >
          Join room
        </button>
      </div>

      {status !== 'open' && <p className="pill">Connecting to server...</p>}
    </div>
  );
}
