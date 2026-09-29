import type { Move, PlayerView, Seat } from '@napoleon/engine';

export type ClientMessage =
  | { type: 'createRoom'; players: 4 | 5; name: string }
  | { type: 'joinRoom'; code: string; name: string }
  | { type: 'reconnect'; code: string; seat: Seat; token: string }
  | { type: 'move'; move: Move };

/**
 * `legalMoves` is the receiving seat's own legal moves for the current
 * phase/turn (empty when it isn't their turn) — the client has no other
 * way to know what's legal, since `view` deliberately excludes the rest
 * of the true GameState.
 */
export type ServerMessage =
  | { type: 'joined'; code: string; seat: Seat; token: string; players: number }
  | { type: 'state'; view: PlayerView; legalMoves: Move[] }
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
