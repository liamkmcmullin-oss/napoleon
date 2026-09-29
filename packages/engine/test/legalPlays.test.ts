import { describe, expect, it } from 'vitest';
import { legalPlays } from '../src/legalPlays.js';
import { defaultConfig } from '../src/config.js';
import type { TrickPlay } from '../src/types.js';

const config = defaultConfig(4);

function trick(plays: [number, string][]): TrickPlay[] {
  return plays.map(([seat, card]) => ({ seat, card }));
}

describe('legalPlays (spec section 8)', () => {
  it('11. Spades trump: a player whose only trump is AS must play it when trump is led', () => {
    const led = trick([[0, '5S']]);
    const hand = ['AS', '3D', '7C'];
    const legal = legalPlays(hand, led, { trump: 'S', firstTrick: false, config });
    expect(legal.sort()).toEqual(['AS']);
  });

  it('12. Napoleon may not lead the Joker on trick 1; anyone may lead it later', () => {
    const hand = ['JOKER', '5H', '3C'];
    const firstTrickLegal = legalPlays(hand, [], { trump: 'H', firstTrick: true, config });
    expect(firstTrickLegal).not.toContain('JOKER');

    const laterTrickLegal = legalPlays(hand, [], { trump: 'H', firstTrick: false, config });
    expect(laterTrickLegal).toContain('JOKER');
  });

  it('13. a follower holding the led suit may still play the Joker', () => {
    const led = trick([[0, '5H']]);
    const hand = ['6H', 'JOKER', '2S'];
    const legal = legalPlays(hand, led, { trump: 'S', firstTrick: false, config });
    expect(legal.sort()).toEqual(['6H', 'JOKER'].sort());
  });

  it('14. trump hand, Joker led: must follow trump if held, else anything', () => {
    const led = trick([[0, 'JOKER']]);
    const withTrump = legalPlays(['2S', '9S', '4H'], led, { trump: 'S', firstTrick: false, config });
    expect(withTrump.sort()).toEqual(['2S', '9S'].sort());

    const withoutTrump = legalPlays(['4H', '9D', '3C'], led, { trump: 'S', firstTrick: false, config });
    expect(withoutTrump.sort()).toEqual(['4H', '9D', '3C'].sort());
  });

  it('15. sister jack is trump, not its natural suit — no forced follow', () => {
    const led = trick([[0, '8D']]);
    const hand = ['JD', '3C', '9S'];
    const legal = legalPlays(hand, led, { trump: 'H', firstTrick: false, config });
    expect(legal.sort()).toEqual(hand.sort());
  });

  it('16. NT hand, Joker led: the leader calls a suit and everyone must follow it', () => {
    const led: TrickPlay[] = [{ seat: 0, card: 'JOKER', calledSuit: 'D' }];
    const secondPlayerWithDiamond = legalPlays(['6D', '9C', 'KH'], led, { trump: 'NT', firstTrick: false, config });
    expect(secondPlayerWithDiamond.sort()).toEqual(['6D']);

    const secondPlayerWithoutDiamond = legalPlays(['9C', 'KH'], led, { trump: 'NT', firstTrick: false, config });
    expect(secondPlayerWithoutDiamond.sort()).toEqual(['9C', 'KH'].sort());
  });

  it('3 of Spades forces the Joker even when the holder could follow suit', () => {
    const led = trick([[0, '3S']]);
    const hand = ['JOKER', '5S', '2S'];
    const legal = legalPlays(hand, led, { trump: 'H', firstTrick: false, config });
    expect(legal).toEqual(['JOKER']);
  });

  it('3 of Spades has no forcing effect on the first trick', () => {
    const led = trick([[0, '3S']]);
    const hand = ['JOKER', '5S', '2S'];
    const legal = legalPlays(hand, led, { trump: 'H', firstTrick: true, config });
    expect(legal).not.toEqual(['JOKER']);
  });
});
