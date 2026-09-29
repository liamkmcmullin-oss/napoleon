import { cardRank, cardSuit, isJoker, rankValue } from './cards.js';
import { requiredSuit } from './legalPlays.js';
import { effectiveSuit, isTrump, trumpRank } from './trump.js';
import type { Seat, Trump, TrickPlay } from './types.js';

export interface ResolveCtx {
  trump: Trump;
  firstTrick: boolean;
}

export function resolveTrick(trick: TrickPlay[], ctx: ResolveCtx): Seat {
  if (trick.length === 0) {
    throw new Error('cannot resolve an empty trick');
  }
  const { trump, firstTrick } = ctx;

  if (firstTrick) {
    const ace = trick.find((p) => p.card === 'AS');
    if (ace) return ace.seat;

    const led = trick[0]!.card;
    if (isJoker(led)) {
      // Only reachable if config.jokerFirstTrickAllowed overrides the
      // default rule that disallows leading the Joker on trick 1.
      return trick[0]!.seat;
    }
    const ledSuit = cardSuit(led);
    let best = trick[0]!;
    for (const play of trick.slice(1)) {
      if (isJoker(play.card)) continue;
      if (cardSuit(play.card) === ledSuit && rankValue(cardRank(play.card)) > rankValue(cardRank(best.card))) {
        best = play;
      }
    }
    return best.seat;
  }

  // Rule 1: Ace of Spades always wins.
  const ace = trick.find((p) => p.card === 'AS');
  if (ace) return ace.seat;

  const led = trick[0]!.card;

  // Rule 2: Joker led (non-NT) wins outright.
  if (isJoker(led) && trump !== 'NT') {
    return trick[0]!.seat;
  }

  // Rule 3: two rule.
  if (!isJoker(led) && cardRank(led) === '2') {
    const ledEffSuit = effectiveSuit(led, trump, firstTrick);
    const allMatch = trick.every(
      (p) => !isJoker(p.card) && effectiveSuit(p.card, trump, firstTrick) === ledEffSuit,
    );
    if (allMatch) return trick[0]!.seat;
  }

  // Rule 4: highest trump, non-NT only.
  if (trump !== 'NT') {
    const trumps = trick.filter((p) => !isJoker(p.card) && isTrump(p.card, trump, firstTrick));
    if (trumps.length > 0) {
      let best = trumps[0]!;
      for (const play of trumps.slice(1)) {
        if (trumpRank(play.card, trump) > trumpRank(best.card, trump)) best = play;
      }
      return best.seat;
    }
  }

  // Rule 5: highest card of the led suit (R, from the Following rules).
  const required = isJoker(led) ? requiredSuit(trick, trump, firstTrick) : effectiveSuit(led, trump, firstTrick);
  const candidates = trick.filter((p) => !isJoker(p.card) && effectiveSuit(p.card, trump, firstTrick) === required);
  let best = candidates[0]!;
  for (const play of candidates.slice(1)) {
    if (rankValue(cardRank(play.card)) > rankValue(cardRank(best.card))) best = play;
  }
  return best.seat;
}
