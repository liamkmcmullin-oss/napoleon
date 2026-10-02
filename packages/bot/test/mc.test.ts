import { describe, expect, it } from 'vitest';
import { applyMove, createHand, defaultConfig, legalMoves, makeDeck, mulberry32, viewFor } from '@napoleon/engine';
import type { GameState } from '@napoleon/engine';
import { createMcStrategy, heuristicStrategy } from '../src/index.js';
import { inferExclusions, samplePlayState, unseenCards } from '../src/mc/sample.js';

/** Plays the heuristic until `stop` says so, returning that state. */
function advance(players: 4 | 5, seed: number, stop: (s: GameState) => boolean): GameState {
  let state = createHand(defaultConfig(players), seed, 0);
  const rng = mulberry32(seed);
  while (state.phase !== 'handOver' && !stop(state)) {
    const seat = state.turn;
    const move = heuristicStrategy.chooseMove(viewFor(state, seat), legalMoves(state, seat), rng);
    const res = applyMove(state, seat, move);
    if (!res.ok) throw new Error(res.error);
    state = res.state;
  }
  return state;
}

describe('mc sampler', () => {
  for (const players of [4, 5] as const) {
    it(`samples a consistent state mid-hand (${players} players)`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const state = advance(players, seed, (s) => s.phase === 'play' && s.trickNumber === 5 && s.trick.length === 2);
        if (state.phase !== 'play') continue;
        const seat = state.turn;
        const view = viewFor(state, seat);
        const excluded = inferExclusions(view);
        const rng = mulberry32(seed);

        // Inferred exclusions must never contradict the real hands.
        for (let s = 0; s < players; s++) {
          for (const card of state.hands[s]!) expect(excluded[s]!.has(card)).toBe(false);
        }

        for (let i = 0; i < 5; i++) {
          const sampled = samplePlayState(view, excluded, rng);
          expect(sampled.hands[seat]).toEqual(view.hand);
          for (let s = 0; s < players; s++) {
            expect(sampled.hands[s]!.length).toBe(state.hands[s]!.length);
          }
          // Every card is accounted for exactly once.
          const all = [
            ...sampled.hands.flat(),
            ...sampled.discards,
            ...sampled.captured.flat(),
            ...sampled.trick.map((p) => p.card),
          ];
          expect(new Set(all).size).toBe(53);
          expect([...all].sort()).toEqual([...makeDeck()].sort());
        }
      }
    });
  }

  it('unseen cards never include what the viewer holds or has seen played', () => {
    const state = advance(4, 3, (s) => s.phase === 'play' && s.trickNumber === 4);
    const view = viewFor(state, state.turn);
    const unseen = new Set(unseenCards(view));
    for (const c of [...view.hand, ...view.captured.flat(), ...view.ownDiscards]) expect(unseen.has(c)).toBe(false);
  });
});

describe('mc strategy', () => {
  it('only ever returns legal moves and finishes whole hands', () => {
    const mc = createMcStrategy({ playSamples: 4, bidSamples: 6, angelSamples: 3, angelCandidates: 4 });
    for (const players of [4, 5] as const) {
      let state = createHand(defaultConfig(players), 77, 1);
      const rng = mulberry32(9);
      let steps = 0;
      while (state.phase !== 'handOver') {
        if (++steps > 500) throw new Error('did not terminate');
        const seat = state.turn;
        const moves = legalMoves(state, seat);
        const move = mc.chooseMove(viewFor(state, seat), moves, rng);
        const res = applyMove(state, seat, move);
        expect(res.ok).toBe(true);
        if (res.ok) state = res.state;
      }
    }
  });
});
