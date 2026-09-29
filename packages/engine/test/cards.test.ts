import { describe, expect, it } from 'vitest';
import { makeDeck, isPointCard, pointCardCount } from '../src/cards.js';

describe('deck', () => {
  it('has 53 unique cards', () => {
    const deck = makeDeck();
    expect(deck.length).toBe(53);
    expect(new Set(deck).size).toBe(53);
  });

  it('has exactly 20 point cards', () => {
    const deck = makeDeck();
    expect(pointCardCount(deck)).toBe(20);
  });

  it('the joker and 2-9 are worth nothing', () => {
    expect(isPointCard('JOKER')).toBe(false);
    expect(isPointCard('2C')).toBe(false);
    expect(isPointCard('9H')).toBe(false);
  });

  it('A K Q J T of every suit are point cards', () => {
    for (const suit of ['C', 'D', 'H', 'S']) {
      for (const rank of ['A', 'K', 'Q', 'J', 'T']) {
        expect(isPointCard(`${rank}${suit}`)).toBe(true);
      }
    }
  });
});
