import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config.js';
import { createHand } from '../src/deal.js';
import { viewFor } from '../src/view.js';
import { applyMove } from '../src/moves.js';
import type { ApplyResult, GameState } from '../src/types.js';

const config = defaultConfig(4);

function unwrap(res: ApplyResult): GameState {
  if (!res.ok) throw new Error(res.error);
  return res.state;
}

describe('viewFor hidden information (section 6)', () => {
  it('a seat never sees another seats hand', () => {
    const state = createHand(config, 5, 0);
    for (let a = 0; a < 4; a++) {
      const view = viewFor(state, a);
      for (let b = 0; b < 4; b++) {
        if (a === b) continue;
        for (const card of state.hands[b]!) {
          expect(view.hand).not.toContain(card);
        }
      }
      expect(view.hand).toEqual(state.hands[a]);
      expect(view.handCounts).toEqual(state.hands.map((h) => h.length));
    }
  });

  it('widow contents are hidden before napoleon takes it', () => {
    const state = createHand(config, 5, 0);
    for (let seat = 0; seat < 4; seat++) {
      const view = viewFor(state, seat);
      expect(view.widowCount).toBe(state.widow.length);
      expect((view as unknown as { widow?: unknown }).widow).toBeUndefined();
    }
  });

  it('napoleons discards are hidden (count only) until the hand is over', () => {
    let state = createHand(config, 5, 0);
    state = unwrap(applyMove(state, 1, { type: 'bid', bid: { count: 12, trump: 'C' } }));
    state = unwrap(applyMove(state, 2, { type: 'pass' }));
    state = unwrap(applyMove(state, 3, { type: 'pass' }));
    state = unwrap(applyMove(state, 0, { type: 'pass' }));
    expect(state.phase).toBe('angel');
    expect(state.napoleon).toBe(1);
    state = unwrap(applyMove(state, 1, { type: 'nameAngel', card: 'JOKER' }));
    expect(state.phase).toBe('discard');
    const discardCards = state.hands[1]!.slice(0, config.widowSize);
    state = unwrap(applyMove(state, 1, { type: 'discard', cards: discardCards }));
    expect(state.phase).toBe('play');

    for (let seat = 0; seat < 4; seat++) {
      const view = viewFor(state, seat);
      expect(view.discardCount).toBe(config.widowSize);
      expect(view.discards).toBeNull();
    }
  });

  it('angelSeat is hidden from everyone except napoleon and the angel holder, until revealed', () => {
    let state = createHand(config, 5, 0);
    state = unwrap(applyMove(state, 1, { type: 'bid', bid: { count: 12, trump: 'C' } }));
    state = unwrap(applyMove(state, 2, { type: 'pass' }));
    state = unwrap(applyMove(state, 3, { type: 'pass' }));
    state = unwrap(applyMove(state, 0, { type: 'pass' }));
    const napoleon = state.napoleon!;
    const otherSeat = state.hands.findIndex((h, i) => i !== napoleon && h.length > 0);
    const angelCard = state.hands[otherSeat]![0]!;
    state = unwrap(applyMove(state, napoleon, { type: 'nameAngel', card: angelCard }));
    expect(state.angelSeat).toBe(otherSeat);

    for (let seat = 0; seat < 4; seat++) {
      const view = viewFor(state, seat);
      if (seat === napoleon || seat === otherSeat) {
        expect(view.angelSeat).toBe(otherSeat);
      } else {
        expect(view.angelSeat).toBeNull();
      }
      // But the named card itself is always public.
      expect(view.angelCard).toBe(angelCard);
    }
  });

  it('the current trick, captured piles, and scores are always visible', () => {
    const state = createHand(config, 5, 0);
    const view = viewFor(state, 2);
    expect(view.trick).toEqual([]);
    expect(view.captured).toEqual(state.hands.map(() => []));
    expect(view.scores).toEqual(state.scores);
  });
});
