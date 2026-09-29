import { JOKER } from './cards.js';
import { effectiveSuit } from './trump.js';
import type { CardId, Config, Suit, Trump, TrickPlay } from './types.js';

export interface TrickCtx {
  trump: Trump;
  firstTrick: boolean;
  config: Config;
}

/**
 * The suit a follower must match, per the "Following" rules. null means
 * any card is legal (no trick started, or Joker led in NT with nothing
 * played after it yet).
 */
export function requiredSuit(trick: TrickPlay[], trump: Trump, firstTrick: boolean): Suit | 'TRUMP' | null {
  if (trick.length === 0) return null;
  const led = trick[0]!.card;
  if (led === JOKER) {
    if (trump !== 'NT') return 'TRUMP';
    if (trick.length < 2) return null;
    return effectiveSuit(trick[1]!.card, trump, firstTrick) as Suit;
  }
  return effectiveSuit(led, trump, firstTrick) as Suit | 'TRUMP';
}

export function legalPlays(hand: CardId[], trick: TrickPlay[], ctx: TrickCtx): CardId[] {
  const { trump, firstTrick, config } = ctx;

  if (trick.length === 0) {
    if (firstTrick && !config.jokerFirstTrickAllowed) {
      const withoutJoker = hand.filter((c) => c !== JOKER);
      return withoutJoker.length > 0 ? withoutJoker : [...hand];
    }
    return [...hand];
  }

  const led = trick[0]!.card;

  if (!firstTrick && led === '3S' && config.threeOfSpadesForcesJoker && hand.includes(JOKER)) {
    return [JOKER];
  }

  const required = requiredSuit(trick, trump, firstTrick);
  let base: CardId[];
  if (required === null) {
    base = [...hand];
  } else {
    const matching = hand.filter((c) => c !== JOKER && effectiveSuit(c, trump, firstTrick) === required);
    base = matching.length > 0 ? matching : [...hand];
  }

  if (hand.includes(JOKER) && !base.includes(JOKER)) {
    base = [...base, JOKER];
  }
  return base;
}
