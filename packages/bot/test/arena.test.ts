import { describe, expect, it } from 'vitest';
import { heuristicStrategy, randomStrategy, runArena } from '../src/index.js';

describe('arena', () => {
  it('self-play plays every seat-hand', () => {
    const res = runArena({ players: 4, deals: 20, pattern: [heuristicStrategy, heuristicStrategy, heuristicStrategy, heuristicStrategy] });
    expect(res.stats).toHaveLength(1);
    expect(res.stats[0]!.hands).toBe(320);
    expect(res.diff).toBeNull();
  });

  it('is deterministic and heuristic beats random', () => {
    const opts = { players: 4 as const, deals: 30, pattern: [heuristicStrategy, randomStrategy, randomStrategy, randomStrategy] };
    const a = runArena(opts);
    const b = runArena(opts);
    const strip = (r: typeof a) => r.stats.map(({ msPerMove: _ms, ...rest }) => rest);
    expect(strip(a)).toEqual(strip(b));
    expect(a.diff).toEqual(b.diff);
    expect(a.diff!.mean).toBeGreaterThan(0);
  });
});
