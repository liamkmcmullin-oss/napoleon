import { describe, expect, it } from 'vitest';
import { applyMove, createHand, defaultConfig, legalMoves, mulberry32, viewFor } from '@napoleon/engine';
import type { GameState } from '@napoleon/engine';
import { heuristicStrategy, randomStrategy } from '../src/index.js';
import type { BotStrategy } from '../src/index.js';

function playOneHand(strategy: BotStrategy, players: 4 | 5, dealSeed: number, botSeed: number): GameState {
  const config = defaultConfig(players);
  let state = createHand(config, dealSeed, 0);
  const rng = mulberry32(botSeed);
  let guard = 0;

  while (state.phase !== 'handOver') {
    guard++;
    if (guard > 2000) throw new Error('hand did not terminate within the step budget');

    const seat = state.turn;
    const moves = legalMoves(state, seat);
    expect(moves.length).toBeGreaterThan(0);

    const view = viewFor(state, seat);
    // Bots run server-side via direct function calls, not over the wire,
    // so — unlike a real client — they get the engine's true legalMoves
    // (including the full discard-combination list DECISIONS.md #21 says
    // not to ship over the network; that restriction doesn't apply here).
    const move = strategy.chooseMove(view, moves, rng);

    // The bot's choice must be legal per the engine's own ground truth,
    // not just "didn't crash" — this is the core safety property.
    const isLegal =
      move.type === 'discard'
        ? move.cards.length === config.widowSize && move.cards.every((c) => view.hand.includes(c))
        : moves.some((m) => JSON.stringify(m) === JSON.stringify(move));
    expect(isLegal, `illegal move chosen: ${JSON.stringify(move)} in phase ${state.phase}`).toBe(true);

    const res = applyMove(state, seat, move);
    expect(res.ok, res.ok ? '' : res.error).toBe(true);
    if (!res.ok) throw new Error(res.error);
    state = res.state;
  }

  return state;
}

describe('property: bot strategies never produce an illegal move', () => {
  const strategies: [string, BotStrategy][] = [
    ['random', randomStrategy],
    ['heuristic', heuristicStrategy],
  ];

  for (const [name, strategy] of strategies) {
    for (const players of [4, 5] as const) {
      for (let seed = 0; seed < 15; seed++) {
        it(`${name} strategy completes a ${players}-player hand (seed=${seed})`, () => {
          const final = playOneHand(strategy, players, seed, seed * 7919 + 13);
          expect(final.phase).toBe('handOver');
          expect(final.handResult).not.toBeNull();
          for (const hand of final.hands) expect(hand.length).toBe(0);
          const totalCards = final.captured.flat().length + final.discards.length;
          expect(totalCards).toBe(53);
        });
      }
    }
  }
});
