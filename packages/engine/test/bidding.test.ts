import { describe, expect, it } from 'vitest';
import { outranks } from '../src/bidding.js';
import { defaultConfig } from '../src/config.js';
import { createHand } from '../src/deal.js';
import { applyMove, legalMoves } from '../src/moves.js';
import type { Bid } from '../src/types.js';

const config = defaultConfig(4);

describe('bidding (spec section 8)', () => {
  it('17. ordering: 12C < 12D < 12H < 12S < 12NT < 13C', () => {
    const seq: Bid[] = [
      { count: 12, trump: 'C' },
      { count: 12, trump: 'D' },
      { count: 12, trump: 'H' },
      { count: 12, trump: 'S' },
      { count: 12, trump: 'NT' },
      { count: 13, trump: 'C' },
    ];
    for (let i = 1; i < seq.length; i++) {
      expect(outranks(seq[i]!, seq[i - 1]!, config)).toBe(true);
      expect(outranks(seq[i - 1]!, seq[i]!, config)).toBe(false);
    }
  });

  it('18. a passed player cannot act again', () => {
    let state = createHand(config, 1, 0); // turn starts at seat 1
    const passResult = applyMove(state, 1, { type: 'pass' });
    expect(passResult.ok).toBe(true);
    state = (passResult as { ok: true; state: typeof state }).state;
    // seat 1 has passed and turn has moved on; they can no longer act.
    expect(legalMoves(state, 1)).toEqual([]);
    const retry = applyMove(state, 1, { type: 'bid', bid: { count: 13, trump: 'C' } });
    expect(retry.ok).toBe(false);
  });

  it('19. no all-pass: the last player is forced to bid at least the minimum', () => {
    let state = createHand(config, 1, 0); // dealer 0, order: 1,2,3,0
    for (const seat of [1, 2, 3]) {
      const res = applyMove(state, seat, { type: 'pass' });
      expect(res.ok).toBe(true);
      state = (res as { ok: true; state: typeof state }).state;
    }
    expect(state.turn).toBe(0);
    const moves = legalMoves(state, 0);
    expect(moves.every((m) => m.type === 'bid')).toBe(true);
    expect(moves.every((m) => m.type === 'bid' && m.bid.count >= config.minBid)).toBe(true);

    const forcedPass = applyMove(state, 0, { type: 'pass' });
    expect(forcedPass.ok).toBe(false);

    const forcedBid = applyMove(state, 0, { type: 'bid', bid: { count: 12, trump: 'C' } });
    expect(forcedBid.ok).toBe(true);
    const finalState = (forcedBid as { ok: true; state: typeof state }).state;
    expect(finalState.napoleon).toBe(0);
    expect(finalState.phase).toBe('angel');
  });

  it('20. bidding ends immediately after 20NT', () => {
    const state = createHand(config, 1, 0);
    const res = applyMove(state, 1, { type: 'bid', bid: { count: 20, trump: 'NT' } });
    expect(res.ok).toBe(true);
    const finalState = (res as { ok: true; state: typeof state }).state;
    expect(finalState.phase).toBe('angel');
    expect(finalState.napoleon).toBe(1);
    expect(finalState.trump).toBe('NT');
  });

  it('a bid that does not outrank the current bid is rejected', () => {
    let state = createHand(config, 1, 0);
    const first = applyMove(state, 1, { type: 'bid', bid: { count: 14, trump: 'H' } });
    state = (first as { ok: true; state: typeof state }).state;
    const tooLow = applyMove(state, 2, { type: 'bid', bid: { count: 13, trump: 'S' } });
    expect(tooLow.ok).toBe(false);
    const equalCountLowerTrump = applyMove(state, 2, { type: 'bid', bid: { count: 14, trump: 'C' } });
    expect(equalCountLowerTrump.ok).toBe(false);
  });

  it('bidding ends when every player but one has passed after a bid exists', () => {
    let state = createHand(config, 1, 0);
    const bidRes = applyMove(state, 1, { type: 'bid', bid: { count: 12, trump: 'C' } });
    state = (bidRes as { ok: true; state: typeof state }).state;
    for (const seat of [2, 3, 0]) {
      const res = applyMove(state, seat, { type: 'pass' });
      expect(res.ok).toBe(true);
      state = (res as { ok: true; state: typeof state }).state;
    }
    expect(state.phase).toBe('angel');
    expect(state.napoleon).toBe(1);
    expect(state.trump).toBe('C');
  });
});
