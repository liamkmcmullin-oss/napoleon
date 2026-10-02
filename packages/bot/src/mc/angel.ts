import { makeDeck } from '@napoleon/engine';
import type { CardId, Move, PlayerView } from '@napoleon/engine';
import { cardPower, chooseAngel as heuristicAngel } from '../heuristic/angel.js';
import { playOutFromAngel } from './rollout.js';
import { angelPhaseState, sampleDeals } from './sample.js';
import type { SampleOptions } from './sample.js';

export interface McAngelOptions extends SampleOptions {
  samples: number;
  /** How many of the most powerful unheld cards to evaluate. */
  candidates: number;
}

/**
 * Tries each of the strongest cards we don't hold as the Angel against the
 * same sampled deals (our unseen widow included) and names whichever earns
 * Napoleon the most on average.
 */
export function chooseMcAngel(view: PlayerView, legalMoves: Move[], rng: () => number, opts: McAngelOptions): Move {
  const held = new Set(view.hand);
  const pool: CardId[] = makeDeck()
    .filter((c) => !held.has(c))
    .sort((a, b) => cardPower(b, view.trump) - cardPower(a, view.trump))
    .slice(0, opts.candidates);
  if (pool.length === 0) return heuristicAngel(view, legalMoves);

  const totals = new Array<number>(pool.length).fill(0);
  for (const sample of sampleDeals(view, opts.samples, rng, opts)) {
    const start = angelPhaseState(view, sample, view.trump, view.currentBid);
    pool.forEach((card, c) => {
      totals[c]! += playOutFromAngel(start, card).handResult!.deltas[view.seat]!;
    });
  }

  let best = 0;
  for (let c = 1; c < pool.length; c++) if (totals[c]! > totals[best]!) best = c;
  return { type: 'nameAngel', card: pool[best]! };
}
