import {
  applyMove,
  createHand,
  defaultConfig,
  legalMoves,
  mulberry32,
  pointCardCount,
  viewFor,
} from '@napoleon/engine';
import type { GameState, Seat } from '@napoleon/engine';
import { randomMove } from './bot.js';

function assertInvariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`invariant violated: ${message}`);
}

function checkNoHandLeak(state: GameState): void {
  for (let a = 0; a < state.players; a++) {
    const view = viewFor(state, a);
    for (let b = 0; b < state.players; b++) {
      if (a === b) continue;
      for (const card of state.hands[b]!) {
        assertInvariant(!view.hand.includes(card), `seat ${a}'s view leaked seat ${b}'s card ${card}`);
      }
    }
  }
}

function playOneHand(players: 4 | 5, dealSeed: number, botSeed: number): GameState {
  const config = defaultConfig(players);
  let state = createHand(config, dealSeed, 0);
  const rng = mulberry32(botSeed);
  const leakCheckStep = Math.floor(rng() * 40); // spot-check one random step per hand
  let step = 0;

  while (state.phase !== 'handOver') {
    if (step > 2000) throw new Error('hand did not terminate within the step budget');
    if (state.phase === 'play') {
      assertInvariant(state.trick.length < state.players, 'trick grew beyond `players` cards');
    }

    const seat: Seat = state.turn;
    const moves = legalMoves(state, seat);
    assertInvariant(moves.length > 0, `seat ${seat} had no legal move in phase ${state.phase}`);
    if (step === leakCheckStep) checkNoHandLeak(state);

    const move = randomMove(state, seat, rng);
    const res = applyMove(state, seat, move);
    if (!res.ok) throw new Error(`applyMove rejected a move that legalMoves offered: ${res.error}`);
    state = res.state;
    step++;
  }

  for (const hand of state.hands) assertInvariant(hand.length === 0, 'a hand was non-empty at handOver');
  const totalCards = state.captured.flat().length + state.discards.length;
  assertInvariant(totalCards === 53, `expected 53 cards accounted for, got ${totalCards}`);
  const points = pointCardCount(state.captured.flat()) + pointCardCount(state.discards);
  assertInvariant(points === 20, `expected 20 point cards accounted for, got ${points}`);

  return state;
}

function main(): void {
  const n = Number(process.argv[2] ?? 10000);
  let failures = 0;
  const start = Date.now();

  for (let i = 0; i < n; i++) {
    const players: 4 | 5 = i % 2 === 0 ? 4 : 5;
    try {
      playOneHand(players, i, ((i * 2654435761) >>> 0) + 1);
    } catch (err) {
      failures++;
      console.error(`Hand ${i} (players=${players}) FAILED:`, err);
      if (failures > 20) {
        console.error('Too many failures — aborting early.');
        break;
      }
    }
    if (n >= 1000 && (i + 1) % 1000 === 0) {
      console.log(`  ...${i + 1}/${n} hands played`);
    }
  }

  const elapsedMs = Date.now() - start;
  console.log(
    `\nRan ${n} bot-vs-bot hands in ${elapsedMs}ms (${(elapsedMs / n).toFixed(2)}ms/hand). ` +
      `Failures: ${failures}`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main();
