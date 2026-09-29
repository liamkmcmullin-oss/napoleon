import { describe, expect, it } from 'vitest';
import { effectiveSuit, isTrump, trumpRank } from '../src/trump.js';

describe('isTrump', () => {
  it('is always false on the first trick', () => {
    expect(isTrump('JH', 'H', true)).toBe(false);
    expect(isTrump('AS', 'S', true)).toBe(false);
  });

  it('is always false in an NT hand', () => {
    expect(isTrump('JH', 'NT', false)).toBe(false);
  });

  it('trump-suit cards are trump', () => {
    expect(isTrump('2H', 'H', false)).toBe(true);
    expect(isTrump('AH', 'H', false)).toBe(true);
  });

  it('the sister jack counts as trump, not its natural suit', () => {
    expect(isTrump('JD', 'H', false)).toBe(true); // D and H share color
    expect(isTrump('JC', 'H', false)).toBe(false); // C is not H's sister
  });

  it('Ace of Spades is trump only if Spades is trump', () => {
    expect(isTrump('AS', 'S', false)).toBe(true);
    expect(isTrump('AS', 'H', false)).toBe(false);
  });

  it('the Joker is never trump', () => {
    expect(isTrump('JOKER', 'H', false)).toBe(false);
  });
});

describe('effectiveSuit', () => {
  it('the Joker has no effective suit', () => {
    expect(effectiveSuit('JOKER', 'H', false)).toBe(null);
    expect(effectiveSuit('JOKER', 'NT', false)).toBe(null);
  });

  it('natural suit on the first trick regardless of trump', () => {
    expect(effectiveSuit('JH', 'H', true)).toBe('H');
    expect(effectiveSuit('AS', 'S', true)).toBe('S');
  });

  it('trump cards collapse to TRUMP outside the first trick', () => {
    expect(effectiveSuit('JD', 'H', false)).toBe('TRUMP');
    expect(effectiveSuit('2H', 'H', false)).toBe('TRUMP');
  });

  it('non-trump cards keep their natural suit', () => {
    expect(effectiveSuit('8D', 'H', false)).toBe('D');
  });
});

describe('trumpRank', () => {
  it('orders Jack of trump above the sister jack above the Ace', () => {
    const jTrump = trumpRank('JH', 'H');
    const sister = trumpRank('JD', 'H');
    const ace = trumpRank('AH', 'H');
    const king = trumpRank('KH', 'H');
    expect(jTrump).toBeGreaterThan(sister);
    expect(sister).toBeGreaterThan(ace);
    expect(ace).toBeGreaterThan(king);
  });

  it('throws for NT', () => {
    expect(() => trumpRank('AH', 'NT')).toThrow();
  });
});
