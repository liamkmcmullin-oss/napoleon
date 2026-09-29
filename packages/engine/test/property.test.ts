import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config.js';
import { createHand } from '../src/deal.js';
import { applyMove, legalMoves } from '../src/moves.js';
import { mulberry32 } from '../src/rng.js';
import { pointCardCount } from '../src/cards.js';
import { viewFor } from '../src/view.js';
import type { GameState, Move, Seat } from '../src/types.js';

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function assertNoHandLeaksAtEachTurn(state: GameState) {
  for (let a = 0; a < state.players; a++) {
    const view = viewFor(state, a);
    for (let b = 0; b < state.players; b++) {
      if (a === b) continue;
      for (const card of state.hands[b]!) {
        expect(view.hand).not.toContain(card);
      }
    }
  }
}

function playRandomHand(players: 4 | 5, dealSeed: number, botSeed: number): GameState {
  const config = defaultConfig(players);
  let state = createHand(config, dealSeed, 0);
  const rng = mulberry32(botSeed);
  let guard = 0;

  while (state.phase !== 'handOver') {
    guard++;
    if (guard > 2000) throw new Error('hand did not terminate within the step budget');

    assertNoHandLeaksAtEachTurn(state);

    const seat: Seat = state.turn;
    const moves = legalMoves(state, seat);
    expect(moves.length).toBeGreaterThan(0);

    if (state.phase === 'play') {
      expect(state.trick.length).toBeLessThan(state.players);
    }

    const move: Move = pick(moves, rng);
    const res = applyMove(state, seat, move);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.error);
    state = res.state;
  }

  return state;
}

describe('property: random legal bot-vs-bot hands', () => {
  // A deeper, thousands-of-hands run lives in the Phase 2 bot CLI
  // (packages/engine's job here is fast feedback, not the full sweep).
  const cases: [4 | 5, number][] = [];
  for (let i = 0; i < 40; i++) cases.push([4, i]);
  for (let i = 0; i < 40; i++) cases.push([5, 1000 + i]);

  for (const [players, seed] of cases) {
    it(`hand completes with all invariants holding (players=${players}, seed=${seed})`, () => {
      const final = playRandomHand(players, seed, seed * 7919 + 13);

      expect(final.phase).toBe('handOver');
      expect(final.handResult).not.toBeNull();

      // Every hand ends with all 53 cards accounted for.
      for (const hand of final.hands) expect(hand.length).toBe(0);
      const totalCards = final.captured.flat().length + final.discards.length;
      expect(totalCards).toBe(53);

      // Point cards captured (by anyone) plus discarded equals exactly 20.
      const capturedPoints = pointCardCount(final.captured.flat());
      const discardedPoints = pointCardCount(final.discards);
      expect(capturedPoints + discardedPoints).toBe(20);

      // handResult.points is napoleon's side only, not everyone's total.
      const napoleon = final.napoleon!;
      const angelSeat = final.angelSeat!;
      const napoleonSidePoints =
        angelSeat === napoleon
          ? pointCardCount(final.captured[napoleon]!)
          : pointCardCount(final.captured[napoleon]!) + pointCardCount(final.captured[angelSeat]!);
      expect(final.handResult!.points).toBe(napoleonSidePoints);
      expect(final.handResult!.points).toBeLessThanOrEqual(capturedPoints);

      // The hidden-information view never leaks another seat's hand
      // (hands are empty at the end, so also check mid-hand-over view).
      for (let seat = 0; seat < players; seat++) {
        const view = viewFor(final, seat);
        expect(view.hand).toEqual([]);
      }
    });
  }
});
