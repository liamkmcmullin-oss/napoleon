import { applyMove } from '@napoleon/engine';
import type { Move, PlayerView } from '@napoleon/engine';
import { choosePlay as heuristicPlay } from '../heuristic/play.js';
import { playOut } from './rollout.js';
import { inferExclusions, samplePlayState } from './sample.js';

type PlayMove = Extract<Move, { type: 'play' }>;

export interface McPlayOptions {
  samples: number;
  soloPrior?: number | undefined;
}

/**
 * Determinized Monte Carlo: deal the unseen cards at random (consistent with
 * what we've seen), play each candidate card out with the heuristic policy,
 * and pick the one with the best average score for us. Every candidate is
 * scored on the same sampled deals, which cancels most of the noise.
 */
export function chooseMcPlay(view: PlayerView, legalMoves: Move[], rng: () => number, opts: McPlayOptions): Move {
  const candidates = legalMoves.filter((m): m is PlayMove => m.type === 'play');
  if (candidates.length === 0) throw new Error('chooseMcPlay: no legal play moves');
  if (candidates.length === 1) return candidates[0]!;

  const excluded = inferExclusions(view);
  const totals = new Array<number>(candidates.length).fill(0);

  for (let i = 0; i < opts.samples; i++) {
    const sampled = samplePlayState(view, excluded, rng, opts.soloPrior);
    candidates.forEach((move, c) => {
      const res = applyMove(sampled, view.seat, move);
      if (!res.ok) throw new Error(`chooseMcPlay: sampled state rejected a legal move: ${res.error}`);
      totals[c]! += playOut(res.state).handResult!.deltas[view.seat]!;
    });
  }

  // Tiny bonus for the plain heuristic's choice so ties fall back to it.
  const fallback = heuristicPlay(view, legalMoves);
  let best = 0;
  let bestScore = -Infinity;
  candidates.forEach((move, c) => {
    const score = totals[c]! / opts.samples + (move === fallback ? 1e-6 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });
  return candidates[best]!;
}
