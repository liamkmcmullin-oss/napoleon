import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config.js';
import { createHand } from '../src/deal.js';
import { applyMove, legalMoves } from '../src/moves.js';
import type { ApplyResult, GameState, Move } from '../src/types.js';

const config = defaultConfig(4);

function unwrap(res: ApplyResult): GameState {
  if (!res.ok) throw new Error(res.error);
  return res.state;
}

/** A synthetic mid-hand NT state, seat 0 on lead holding the Joker. */
function ntPlayState(): GameState {
  const base = createHand(config, 1, 0);
  return {
    ...base,
    phase: 'play',
    trump: 'NT',
    napoleon: 0,
    trick: [],
    trickNumber: 2,
    turn: 0,
    hands: [['JOKER', '2C'], ['6D', '9C'], ['3H', 'KD'], ['4S', '7C']],
    captured: [[], [], [], []],
  };
}

describe('Joker led in a No Trump hand calls the suit and wins outright', () => {
  it('legalMoves offers one play per suit when leading the Joker in NT', () => {
    const state = ntPlayState();
    const moves = legalMoves(state, 0);
    const jokerMoves = moves.filter((m): m is Extract<Move, { type: 'play' }> => m.type === 'play' && m.card === 'JOKER');
    expect(jokerMoves.map((m) => m.calledSuit).sort()).toEqual(['C', 'D', 'H', 'S']);
  });

  it('rejects leading the Joker in NT without a calledSuit', () => {
    const state = ntPlayState();
    const res = applyMove(state, 0, { type: 'play', card: 'JOKER' });
    expect(res.ok).toBe(false);
  });

  it('rejects a calledSuit on any other play', () => {
    const state = ntPlayState();
    const res = applyMove(state, 0, { type: 'play', card: '2C', calledSuit: 'D' });
    expect(res.ok).toBe(false);
  });

  it('the leader calls a suit; the Joker wins the trick and everyone else must follow the call', () => {
    let state = ntPlayState();
    state = unwrap(applyMove(state, 0, { type: 'play', card: 'JOKER', calledSuit: 'D' }));
    expect(state.trick).toEqual([{ seat: 0, card: 'JOKER', calledSuit: 'D' }]);

    // Seat 1 holds a diamond and must play it, not '9C'.
    const seat1Moves = legalMoves(state, 1).map((m) => (m.type === 'play' ? m.card : null));
    expect(seat1Moves.sort()).toEqual(['6D']);
    state = unwrap(applyMove(state, 1, { type: 'play', card: '6D' }));

    // Seat 2 holds a diamond too.
    state = unwrap(applyMove(state, 2, { type: 'play', card: 'KD' }));

    // Seat 3 has no diamond, free to play anything.
    const seat3Moves = legalMoves(state, 3).map((m) => (m.type === 'play' ? m.card : null));
    expect(seat3Moves.sort()).toEqual(['4S', '7C']);
    state = unwrap(applyMove(state, 3, { type: 'play', card: '4S' }));

    expect(state.trickNumber).toBe(3);
    expect(state.turn).toBe(0);
    expect(state.captured[0]).toEqual(['JOKER', '6D', 'KD', '4S']);
  });
});
