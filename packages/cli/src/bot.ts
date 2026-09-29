import { legalMoves } from '@napoleon/engine';
import type { GameState, Move, Seat } from '@napoleon/engine';

/** Picks uniformly among the seat's legal moves. Throws if there are none — that's an engine bug, not a game state. */
export function randomMove(state: GameState, seat: Seat, rng: () => number): Move {
  const moves = legalMoves(state, seat);
  if (moves.length === 0) {
    throw new Error(`no legal moves for seat ${seat} in phase ${state.phase}`);
  }
  return moves[Math.floor(rng() * moves.length)]!;
}
