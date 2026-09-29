import { describe, expect, it } from 'vitest';
import { createHand } from '../src/deal.js';
import { defaultConfig } from '../src/config.js';

describe('createHand', () => {
  it('deals are deterministic per seed', () => {
    const a = createHand(defaultConfig(4), 42, 0);
    const b = createHand(defaultConfig(4), 42, 0);
    expect(a.hands).toEqual(b.hands);
    expect(a.widow).toEqual(b.widow);
  });

  it('different seeds produce different deals', () => {
    const a = createHand(defaultConfig(4), 1, 0);
    const b = createHand(defaultConfig(4), 2, 0);
    expect(a.hands).not.toEqual(b.hands);
  });

  it('4 players: 12 cards each, widow of 5', () => {
    const state = createHand(defaultConfig(4), 7, 0);
    for (const hand of state.hands) expect(hand.length).toBe(12);
    expect(state.widow.length).toBe(5);
  });

  it('5 players: 10 cards each, widow of 3', () => {
    const state = createHand(defaultConfig(5), 7, 0);
    for (const hand of state.hands) expect(hand.length).toBe(10);
    expect(state.widow.length).toBe(3);
  });

  it('all 53 cards are accounted for with no duplicates', () => {
    const state = createHand(defaultConfig(5), 99, 2);
    const all = [...state.hands.flat(), ...state.widow];
    expect(all.length).toBe(53);
    expect(new Set(all).size).toBe(53);
  });

  it('turn starts left of the dealer', () => {
    const state = createHand(defaultConfig(4), 1, 2);
    expect(state.turn).toBe(3);
    expect(state.phase).toBe('bidding');
  });
});
