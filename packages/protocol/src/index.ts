import type { Move, PlayerView, Seat } from '@napoleon/engine';

/**
 * The wire protocol between client and server. Isomorphic (no Node or DOM
 * APIs) so both @napoleon/server and @napoleon/client can depend on it
 * without pulling in the other's runtime (Node sockets vs. the browser).
 */

export type ClientMessage =
  | { type: 'createRoom'; players: 4 | 5; name: string }
  | { type: 'joinRoom'; code: string; name: string }
  | { type: 'reconnect'; code: string; seat: Seat; token: string }
  | { type: 'move'; move: Move };

/**
 * `legalMoves` is the receiving seat's own legal moves for the current
 * phase/turn (empty when it isn't their turn) — the client has no other
 * way to know what's legal, since `view` deliberately excludes the rest
 * of the true GameState. Always `[]` during the 'discard' phase — see
 * DECISIONS.md #21.
 *
 * `names` (indexed by seat) is included on both `roster` and `state`
 * because it's not part of PlayerView — the engine has no concept of a
 * player's display name, only seat numbers — but the lobby and
 * scoreboard both need it. `null` means that seat hasn't joined yet.
 */
export type ServerMessage =
  | { type: 'joined'; code: string; seat: Seat; token: string; players: number }
  | { type: 'roster'; code: string; players: number; names: (string | null)[] }
  | { type: 'state'; view: PlayerView; legalMoves: Move[]; names: (string | null)[] }
  | { type: 'error'; message: string };

function sanitizeName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, 32) : '';
  return name.length > 0 ? name : 'Player';
}

export function parseClientMessage(raw: string): ClientMessage | null {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof msg !== 'object' || msg === null || !('type' in msg)) return null;
  const obj = msg as Record<string, unknown>;

  switch (obj.type) {
    case 'createRoom':
      return { type: 'createRoom', players: obj.players === 5 ? 5 : 4, name: sanitizeName(obj.name) };
    case 'joinRoom':
      if (typeof obj.code !== 'string') return null;
      return { type: 'joinRoom', code: obj.code.toUpperCase(), name: sanitizeName(obj.name) };
    case 'reconnect': {
      if (typeof obj.code !== 'string' || typeof obj.token !== 'string') return null;
      const seat = Number(obj.seat);
      if (!Number.isInteger(seat) || seat < 0) return null;
      return { type: 'reconnect', code: obj.code.toUpperCase(), seat, token: obj.token };
    }
    case 'move':
      if (typeof obj.move !== 'object' || obj.move === null) return null;
      // Structural/semantic legality of the move itself is enforced by applyMove.
      return { type: 'move', move: obj.move as Move };
    default:
      return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof msg !== 'object' || msg === null || !('type' in msg)) return null;
  const obj = msg as Record<string, unknown>;

  switch (obj.type) {
    case 'joined':
      if (
        typeof obj.code !== 'string' ||
        typeof obj.seat !== 'number' ||
        typeof obj.token !== 'string' ||
        typeof obj.players !== 'number'
      ) {
        return null;
      }
      return { type: 'joined', code: obj.code, seat: obj.seat, token: obj.token, players: obj.players };
    case 'roster':
      if (typeof obj.code !== 'string' || typeof obj.players !== 'number' || !Array.isArray(obj.names)) {
        return null;
      }
      return { type: 'roster', code: obj.code, players: obj.players, names: obj.names as (string | null)[] };
    case 'state':
      if (
        typeof obj.view !== 'object' ||
        obj.view === null ||
        !Array.isArray(obj.legalMoves) ||
        !Array.isArray(obj.names)
      ) {
        return null;
      }
      return {
        type: 'state',
        view: obj.view as PlayerView,
        legalMoves: obj.legalMoves as Move[],
        names: obj.names as (string | null)[],
      };
    case 'error':
      if (typeof obj.message !== 'string') return null;
      return { type: 'error', message: obj.message };
    default:
      return null;
  }
}
