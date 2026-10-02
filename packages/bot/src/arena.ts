import { applyMove, createHand, defaultConfig, legalMoves, mulberry32, viewFor } from '@napoleon/engine';
import type { GameState } from '@napoleon/engine';
import type { BotStrategy } from './types.js';

export interface ArenaOptions {
  players: 4 | 5;
  /** Number of distinct deals. Each is replayed once per seat rotation. */
  deals: number;
  /** Strategy per seat, length === players. Rotated across all seats on every deal. */
  pattern: BotStrategy[];
  /** Offset so separate runs can use fresh deals. */
  seedBase?: number;
}

export interface StrategyStats {
  name: string;
  /** Seat-hands played. */
  hands: number;
  meanScore: number;
  /** Standard error of meanScore, computed over per-deal means. */
  stdErr: number;
  timesNapoleon: number;
  napoleonWins: number;
  meanBidWhenNapoleon: number;
  /** Avg score delta in hands where this strategy was Napoleon / not. */
  meanScoreAsNapoleon: number;
  meanScoreOtherwise: number;
  /** Avg ms spent inside chooseMove per call. */
  msPerMove: number;
}

export interface ArenaResult {
  options: { players: number; deals: number };
  stats: StrategyStats[];
  /** First-minus-second mean difference with std error; only when exactly two strategies. */
  diff: { a: string; b: string; mean: number; stdErr: number } | null;
}

interface Timing {
  ms: number[];
  calls: number[];
}

const now = (): number => (globalThis as { performance?: { now(): number } }).performance?.now() ?? Date.now();

/** Plays a hand to completion, one strategy per seat. Throws on an illegal move. */
export function playHand(
  state: GameState,
  seatStrategies: BotStrategy[],
  rng: () => number,
  timing?: Timing,
): GameState {
  let step = 0;
  while (state.phase !== 'handOver') {
    if (++step > 2000) throw new Error('arena: hand did not terminate');
    const seat = state.turn;
    const moves = legalMoves(state, seat);
    const strategy = seatStrategies[seat]!;
    const t0 = timing ? now() : 0;
    const move = strategy.chooseMove(viewFor(state, seat), moves, rng);
    if (timing) {
      timing.ms[seat]! += now() - t0;
      timing.calls[seat]!++;
    }
    const res = applyMove(state, seat, move);
    if (!res.ok) throw new Error(`arena: ${strategy.name} made illegal move at seat ${seat}: ${res.error}`);
    state = res.state;
  }
  return state;
}

function meanAndStdErr(xs: number[]): { mean: number; stdErr: number } {
  const n = xs.length;
  if (n === 0) return { mean: 0, stdErr: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { mean, stdErr: 0 };
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { mean, stdErr: Math.sqrt(variance / n) };
}

/**
 * Duplicate-deal tournament: every deal is played `players` times with the
 * seat assignment rotated, so each strategy sees every seat's cards. This
 * cancels most deal luck, leaving skill differences.
 */
export function runArena(opts: ArenaOptions, onProgress?: (done: number) => void): ArenaResult {
  const { players, deals, pattern, seedBase = 0 } = opts;
  if (pattern.length !== players) throw new Error('arena: pattern length must equal players');
  const config = defaultConfig(players);
  const names = [...new Set(pattern.map((s) => s.name))];

  const perDealMeans = new Map<string, number[]>(names.map((n) => [n, []]));
  const acc = new Map(
    names.map((n) => [n, { hands: 0, nap: 0, wins: 0, bidSum: 0, scoreNap: 0, scoreOther: 0 }]),
  );
  const timing = new Map(names.map((n) => [n, { ms: 0, calls: 0 }]));

  for (let d = 0; d < deals; d++) {
    const seed = seedBase + d;
    const dealer = d % players;
    const dealSum = new Map(names.map((n) => [n, { sum: 0, count: 0 }]));

    for (let r = 0; r < players; r++) {
      const seatStrategies = Array.from({ length: players }, (_, seat) => pattern[(seat + r) % players]!);
      const t: Timing = { ms: new Array<number>(players).fill(0), calls: new Array<number>(players).fill(0) };
      const final = playHand(createHand(config, seed, dealer), seatStrategies, mulberry32(seed * 31 + r + 1), t);
      const result = final.handResult!;

      for (let seat = 0; seat < players; seat++) {
        const name = seatStrategies[seat]!.name;
        const delta = result.deltas[seat]!;
        const a = acc.get(name)!;
        a.hands++;
        const ds = dealSum.get(name)!;
        ds.sum += delta;
        ds.count++;
        const tm = timing.get(name)!;
        tm.ms += t.ms[seat]!;
        tm.calls += t.calls[seat]!;
        if (seat === final.napoleon) {
          a.nap++;
          a.bidSum += final.currentBid!.count;
          a.scoreNap += delta;
          if (result.napoleonWon) a.wins++;
        } else {
          a.scoreOther += delta;
        }
      }
    }
    for (const n of names) {
      const ds = dealSum.get(n)!;
      perDealMeans.get(n)!.push(ds.sum / ds.count);
    }
    onProgress?.(d + 1);
  }

  const stats: StrategyStats[] = names.map((name) => {
    const a = acc.get(name)!;
    const { mean, stdErr } = meanAndStdErr(perDealMeans.get(name)!);
    const tm = timing.get(name)!;
    return {
      name,
      hands: a.hands,
      meanScore: mean,
      stdErr,
      timesNapoleon: a.nap,
      napoleonWins: a.wins,
      meanBidWhenNapoleon: a.nap ? a.bidSum / a.nap : 0,
      meanScoreAsNapoleon: a.nap ? a.scoreNap / a.nap : 0,
      meanScoreOtherwise: a.hands - a.nap ? a.scoreOther / (a.hands - a.nap) : 0,
      msPerMove: tm.calls ? tm.ms / tm.calls : 0,
    };
  });

  let diff: ArenaResult['diff'] = null;
  if (names.length === 2) {
    const [x, y] = names as [string, string];
    const xs = perDealMeans.get(x)!;
    const ys = perDealMeans.get(y)!;
    const { mean, stdErr } = meanAndStdErr(xs.map((v, i) => v - ys[i]!));
    diff = { a: x, b: y, mean, stdErr };
  }

  return { options: { players, deals }, stats, diff };
}

export function formatArenaResult(res: ArenaResult): string {
  const lines = [`${res.options.deals} deals x ${res.options.players} rotations (${res.options.players}-player)`, ''];
  const pad = (s: string, n: number) => s.padEnd(n);
  lines.push(pad('strategy', 12) + pad('mean score', 20) + pad('as Napoleon', 40) + pad('otherwise', 11) + 'ms/move');
  for (const s of res.stats) {
    const winPct = s.timesNapoleon ? ((100 * s.napoleonWins) / s.timesNapoleon).toFixed(0) : '0';
    const nap = `${s.timesNapoleon}x, ${winPct}% won, bid ${s.meanBidWhenNapoleon.toFixed(1)}, avg ${s.meanScoreAsNapoleon.toFixed(1)}`;
    lines.push(
      pad(s.name, 12) +
        pad(`${s.meanScore.toFixed(2)} +/- ${(1.96 * s.stdErr).toFixed(2)}`, 20) +
        pad(nap, 40) +
        pad(s.meanScoreOtherwise.toFixed(1), 11) +
        s.msPerMove.toFixed(3),
    );
  }
  if (res.diff) {
    const d = res.diff;
    const sig = Math.abs(d.mean) > 1.96 * d.stdErr ? 'significant' : 'not significant';
    lines.push('', `${d.a} - ${d.b}: ${d.mean.toFixed(2)} +/- ${(1.96 * d.stdErr).toFixed(2)} (95% CI, ${sig})`);
  }
  return lines.join('\n');
}
