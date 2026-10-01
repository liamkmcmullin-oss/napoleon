import { describe, expect, it } from 'vitest';
import { resolveTrick } from '../src/resolveTrick.js';
import type { TrickPlay } from '../src/types.js';

function trick(plays: [number, string][]): TrickPlay[] {
  return plays.map(([seat, card]) => ({ seat, card }));
}

describe('resolveTrick (spec section 8)', () => {
  it('1. highest trump wins', () => {
    const t = trick([[0, '7C'], [1, '9C'], [2, 'KC'], [3, 'JH'], [4, 'AC']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: false })).toBe(3);
  });

  it('2. trump order: JH > JD > AH > KH', () => {
    const t = trick([[0, '3C'], [1, 'JH'], [2, 'JD'], [3, 'AH'], [4, 'KH']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: false })).toBe(1);
  });

  it('3. Ace of Spades wins even against trump when Spades is not trump', () => {
    const t = trick([[0, 'JOKER'], [1, 'JH'], [2, '2H'], [3, 'AS']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: false })).toBe(3);
  });

  it('4. two rule: led 2D wins when everyone follows diamonds', () => {
    const t = trick([[0, '2D'], [1, 'KD'], [2, 'AD'], [3, '5D']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: false })).toBe(0);
  });

  it('5. two rule fails if a follower plays the Joker; highest diamond wins', () => {
    const t = trick([[0, '2D'], [1, 'KD'], [2, 'JOKER'], [3, '5D']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: false })).toBe(1);
  });

  it('6. two rule: led 2H wins even against JH when all play trump', () => {
    const t = trick([[0, '2H'], [1, '5H'], [2, 'JH'], [3, '9H']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: false })).toBe(0);
  });

  it('6b. two rule applies even when the two is not the led card, as long as the suit is unbroken', () => {
    const t = trick([[0, '5D'], [1, 'KD'], [2, '2D'], [3, 'AD']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: false })).toBe(2);
  });

  it('6c. a two played out of position still fails the two rule if anyone broke suit', () => {
    const t = trick([[0, '5D'], [1, 'KD'], [2, '2D'], [3, 'JOKER']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: false })).toBe(1);
  });

  it('7. forced Joker (from led 3S) has no effect; highest trump wins, not 3S', () => {
    const t = trick([[0, '3S'], [1, 'JOKER'], [2, '5H'], [3, '4H']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: false })).toBe(2);
  });

  it('8. first trick: trump is ineffective, highest card of led suit wins', () => {
    const t = trick([[0, '5C'], [1, '9C'], [2, 'AC'], [3, 'JH']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: true })).toBe(2);
  });

  it('9. first trick: Ace of Spades wins regardless of suit led', () => {
    const t = trick([[0, '5D'], [1, 'AS'], [2, 'KD'], [3, '2D']]);
    expect(resolveTrick(t, { trump: 'H', firstTrick: true })).toBe(1);
  });

  it('10. NT hand, Joker led: the Joker wins outright, having called the suit', () => {
    const t: TrickPlay[] = [
      { seat: 0, card: 'JOKER', calledSuit: 'D' },
      { seat: 1, card: '6D' },
      { seat: 2, card: 'KD' },
      { seat: 3, card: 'AH' },
    ];
    expect(resolveTrick(t, { trump: 'NT', firstTrick: false })).toBe(0);
  });

  it('11. Spades trump: AS wins whenever played, trump or not', () => {
    const t = trick([[0, '4S'], [1, 'AS'], [2, '2S'], [3, '9S']]);
    expect(resolveTrick(t, { trump: 'S', firstTrick: false })).toBe(1);
  });

  it('12. NT hand, Joker led: still loses to the Ace of Spades', () => {
    const t: TrickPlay[] = [
      { seat: 0, card: 'JOKER', calledSuit: 'D' },
      { seat: 1, card: '6D' },
      { seat: 2, card: 'AS' },
      { seat: 3, card: 'KD' },
    ];
    expect(resolveTrick(t, { trump: 'NT', firstTrick: false })).toBe(2);
  });
});
