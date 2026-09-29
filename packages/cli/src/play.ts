import { createInterface } from 'node:readline';
import {
  applyMove,
  createHand,
  defaultConfig,
  legalMoves,
  viewFor,
} from '@napoleon/engine';
import type { GameState, Move, Seat } from '@napoleon/engine';
import { formatMove, printTable } from './render.js';

// A manual line queue, rather than node:readline/promises' question(), which
// can hang waiting on a second question when stdin is a non-TTY stream
// (piped/redirected input) that has already reached EOF.
const rl = createInterface({ input: process.stdin, terminal: false });
const lineQueue: string[] = [];
const lineWaiters: ((line: string) => void)[] = [];
rl.on('line', (line) => {
  const waiter = lineWaiters.shift();
  if (waiter) waiter(line);
  else lineQueue.push(line);
});
function nextLine(): Promise<string> {
  const buffered = lineQueue.shift();
  if (buffered !== undefined) return Promise.resolve(buffered);
  return new Promise((resolve) => lineWaiters.push(resolve));
}
async function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  return (await nextLine()).trim();
}

async function pickFromMenu(moves: Move[]): Promise<Move> {
  moves.forEach((m, i) => console.log(`  [${i}] ${formatMove(m)}`));
  for (;;) {
    const raw = await ask('Choose a number: ');
    const idx = Number(raw);
    if (Number.isInteger(idx) && idx >= 0 && idx < moves.length) return moves[idx]!;
    console.log('Not a valid choice, try again.');
  }
}

async function promptAngel(state: GameState, seat: Seat): Promise<Move> {
  for (;;) {
    const raw = (await ask('Name the angel card (e.g. AS, TD, JOKER): ')).toUpperCase();
    const move: Move = { type: 'nameAngel', card: raw };
    const res = applyMove(state, seat, move);
    if (res.ok) return move;
    console.log(`Invalid: ${res.error}`);
  }
}

async function promptDiscard(state: GameState, seat: Seat): Promise<Move> {
  const n = state.config.widowSize;
  for (;;) {
    const raw = await ask(`Enter ${n} cards to discard, space separated (e.g. 2C 3D JOKER): `);
    const cards = raw
      .toUpperCase()
      .split(/\s+/)
      .filter((s) => s.length > 0);
    const move: Move = { type: 'discard', cards };
    const res = applyMove(state, seat, move);
    if (res.ok) return move;
    console.log(`Invalid: ${res.error}`);
  }
}

async function takeTurn(state: GameState): Promise<Move> {
  const seat = state.turn;
  const view = viewFor(state, seat);
  console.log(`\n--- Seat ${seat}'s turn (pass the device) ---`);
  printTable(view);

  if (state.phase === 'angel') return promptAngel(state, seat);
  if (state.phase === 'discard') return promptDiscard(state, seat);

  const moves = legalMoves(state, seat);
  return pickFromMenu(moves);
}

async function playHand(state: GameState): Promise<GameState> {
  while (state.phase !== 'handOver') {
    const move = await takeTurn(state);
    const res = applyMove(state, state.turn, move);
    if (!res.ok) {
      console.log(`Move rejected: ${res.error}`);
      continue;
    }
    state = res.state;
  }
  const finalView = viewFor(state, state.turn);
  printTable(finalView);
  return state;
}

async function main(): Promise<void> {
  const playersRaw = await ask('How many players, 4 or 5? [4]: ');
  const players = playersRaw === '5' ? 5 : 4;
  const seedRaw = await ask('Seed (blank for random): ');
  const seed = seedRaw.trim() === '' ? Math.floor(Math.random() * 0xffffffff) : Number(seedRaw);

  let state: GameState = createHand(defaultConfig(players), seed, 0);
  console.log(`Starting a ${players}-player hot-seat game (seed ${seed}). All players share this terminal.`);

  for (;;) {
    state = await playHand(state);
    const again = await ask('Play another hand? [Y/n]: ');
    if (again.toLowerCase() === 'n') break;
    const res = applyMove(state, state.turn, { type: 'nextHand' });
    if (!res.ok) {
      console.log(`Could not start next hand: ${res.error}`);
      break;
    }
    state = res.state;
  }

  console.log('\nFinal scores:', state.scores.map((s, i) => `seat${i}: ${s}`).join('  '));
  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exitCode = 1;
});
