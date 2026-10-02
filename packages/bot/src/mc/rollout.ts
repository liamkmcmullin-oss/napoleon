import { applyMove, legalMoves, viewFor } from '@napoleon/engine';
import type { CardId, GameState, Move } from '@napoleon/engine';
import { chooseDiscard } from '../heuristic/discard.js';
import { choosePlay } from '../heuristic/play.js';

function apply(state: GameState, seat: number, move: Move): GameState {
  const res = applyMove(state, seat, move);
  if (!res.ok) throw new Error(`mc rollout: illegal move: ${res.error}`);
  return res.state;
}

/** Plays the rest of the hand with the heuristic policy at every seat. */
export function playOut(state: GameState): GameState {
  while (state.phase === 'play') {
    const seat = state.turn;
    state = apply(state, seat, choosePlay(viewFor(state, seat), legalMoves(state, seat)));
  }
  return state;
}

/** From the angel phase: Napoleon names `card`, discards heuristically, then everyone plays out. */
export function playOutFromAngel(state: GameState, card: CardId): GameState {
  const napoleon = state.napoleon!;
  state = apply(state, napoleon, { type: 'nameAngel', card });
  state = apply(state, napoleon, chooseDiscard(viewFor(state, napoleon)));
  return playOut(state);
}
