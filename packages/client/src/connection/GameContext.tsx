import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';
import { parseServerMessage } from '@napoleon/protocol';
import type { ServerMessage } from '@napoleon/protocol';
import type { Move, PlayerView } from '@napoleon/engine';

const STORAGE_KEY = 'napoleon:session';
const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? `ws://${window.location.hostname}:8080`;
const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

interface SavedSession {
  code: string;
  seat: number;
  token: string;
}

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    if (typeof parsed.code !== 'string' || typeof parsed.seat !== 'number' || typeof parsed.token !== 'string') {
      return null;
    }
    return { code: parsed.code, seat: parsed.seat, token: parsed.token };
  } catch {
    return null;
  }
}

function saveSession(session: SavedSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Best-effort only (private browsing, storage disabled, etc).
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type SocketStatus = 'connecting' | 'open' | 'closed';

interface GameState {
  status: SocketStatus;
  code: string | null;
  seat: number | null;
  token: string | null;
  players: number | null;
  names: (string | null)[];
  view: PlayerView | null;
  legalMoves: Move[];
  error: string | null;
}

const initialState: GameState = {
  status: 'connecting',
  code: null,
  seat: null,
  token: null,
  players: null,
  names: [],
  view: null,
  legalMoves: [],
  error: null,
};

type Action =
  | { type: 'socketOpen' }
  | { type: 'socketClosed' }
  | { type: 'server'; msg: ServerMessage }
  | { type: 'clearError' }
  | { type: 'leftRoom' };

function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'socketOpen':
      return { ...state, status: 'open' };
    case 'socketClosed':
      return { ...state, status: 'closed' };
    case 'clearError':
      return { ...state, error: null };
    case 'leftRoom':
      return { ...initialState, status: state.status };
    case 'server': {
      const msg = action.msg;
      switch (msg.type) {
        case 'joined':
          return { ...state, code: msg.code, seat: msg.seat, token: msg.token, players: msg.players, error: null };
        case 'roster':
          return { ...state, players: msg.players, names: msg.names };
        case 'state':
          return { ...state, view: msg.view, legalMoves: msg.legalMoves, names: msg.names, error: null };
        case 'error':
          return { ...state, error: msg.message };
      }
    }
  }
}

interface GameContextValue extends GameState {
  createRoom: (players: 4 | 5, name: string) => void;
  joinRoom: (code: string, name: string) => void;
  sendMove: (move: Move) => void;
  leaveRoom: () => void;
  clearError: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(reduce, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const closedByUs = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      reconnectAttempt.current = 0;
      dispatch({ type: 'socketOpen' });
      const saved = loadSession();
      if (saved) {
        ws.send(JSON.stringify({ type: 'reconnect', code: saved.code, seat: saved.seat, token: saved.token }));
      }
    });

    ws.addEventListener('message', (event) => {
      const msg = parseServerMessage(String(event.data));
      if (!msg) return;
      if (msg.type === 'joined') saveSession({ code: msg.code, seat: msg.seat, token: msg.token });
      dispatch({ type: 'server', msg });
    });

    ws.addEventListener('close', () => {
      dispatch({ type: 'socketClosed' });
      if (closedByUs.current) return;
      const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS_MS.length - 1)]!;
      reconnectAttempt.current++;
      setTimeout(connect, delay);
    });
  }, []);

  useEffect(() => {
    closedByUs.current = false;
    connect();
    return () => {
      closedByUs.current = true;
      wsRef.current?.close();
    };
    // `connect` is stable (defined with useCallback([], ...)) — this effect
    // intentionally runs once on mount only.
  }, [connect]);

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const createRoom = useCallback((players: 4 | 5, name: string) => send({ type: 'createRoom', players, name }), [send]);
  const joinRoom = useCallback((code: string, name: string) => send({ type: 'joinRoom', code, name }), [send]);
  const sendMove = useCallback((move: Move) => send({ type: 'move', move }), [send]);
  const clearError = useCallback(() => dispatch({ type: 'clearError' }), []);
  const leaveRoom = useCallback(() => {
    clearSession();
    dispatch({ type: 'leftRoom' });
  }, []);

  const value: GameContextValue = { ...state, createRoom, joinRoom, sendMove, leaveRoom, clearError };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
