import { cardRank, cardSuit, effectiveSuit, isJoker, isTrump, rankValue, trumpRank } from '@napoleon/engine';
import type { CardId, Move, PlayerView, Suit, Trump, TrickPlay } from '@napoleon/engine';
import { cardStrength } from './strength.js';

type PlayMove = Extract<Move, { type: 'play' }>;

// Below this strength, winning a trick early (not as the last player) is
// considered "cheap enough" to take; above it, hold back and let someone
// else win it instead of spending a strong card.
const WIN_CHEAPLY_THRESHOLD = 2;

/** Who is currently ahead in a (possibly incomplete) trick, using the same
 * precedence as resolveTrick(). Doesn't implement the "two rule" (which
 * needs the trick to be complete to evaluate) — an acceptable gap for a
 * no-lookahead heuristic; worst case it's slightly too eager to "win"
 * against a led two. */
function currentBestSeat(trick: TrickPlay[], trump: Trump, firstTrick: boolean): number {
  const ace = trick.find((p) => p.card === 'AS');
  if (ace) return ace.seat;

  const led = trick[0]!;
  if (firstTrick) {
    if (isJoker(led.card)) return led.seat; // not reachable under default config, but harmless
    const ledSuit = cardSuit(led.card);
    let best = led;
    for (const p of trick.slice(1)) {
      if (!isJoker(p.card) && cardSuit(p.card) === ledSuit && rankValue(cardRank(p.card)) > rankValue(cardRank(best.card))) {
        best = p;
      }
    }
    return best.seat;
  }

  if (isJoker(led.card)) return led.seat; // Joker led always currently wins (see spec 3.7)

  if (trump !== 'NT') {
    const trumps = trick.filter((p) => !isJoker(p.card) && isTrump(p.card, trump, false));
    if (trumps.length > 0) {
      let best = trumps[0]!;
      for (const p of trumps.slice(1)) {
        if (trumpRank(p.card, trump) > trumpRank(best.card, trump)) best = p;
      }
      return best.seat;
    }
  }

  const required = isJoker(led.card) ? led.calledSuit ?? null : effectiveSuit(led.card, trump, false);
  const matching = trick.filter((p) => !isJoker(p.card) && effectiveSuit(p.card, trump, false) === required);
  let best = matching[0] ?? led;
  for (const p of matching.slice(1)) {
    if (rankValue(cardRank(p.card)) > rankValue(cardRank(best.card))) best = p;
  }
  return best.seat;
}

function wouldWin(trick: TrickPlay[], play: TrickPlay, trump: Trump, firstTrick: boolean): boolean {
  return currentBestSeat([...trick, play], trump, firstTrick) === play.seat;
}

function cheapestCard(moves: PlayMove[], trump: Trump): PlayMove {
  return [...moves].sort((a, b) => cardStrength(a.card, trump) - cardStrength(b.card, trump))[0]!;
}

/** Which suit to call when leading the Joker in a No Trump hand: whichever
 * suit this hand holds the most (and strongest) cards in, since that's
 * the suit this hand has the best chance of controlling. */
function chooseCalledSuit(hand: CardId[], options: PlayMove[]): PlayMove {
  const bySuit = new Map<Suit, number>();
  for (const card of hand) {
    if (isJoker(card)) continue;
    const suit = cardSuit(card);
    bySuit.set(suit, (bySuit.get(suit) ?? 0) + 1 + cardStrength(card, 'NT') * 0.1);
  }
  return [...options].sort((a, b) => (bySuit.get(b.calledSuit!) ?? 0) - (bySuit.get(a.calledSuit!) ?? 0))[0]!;
}

function chooseLead(view: PlayerView, playMoves: PlayMove[]): Move {
  const trump = view.trump!;
  const byCard = new Map<CardId, PlayMove[]>();
  for (const move of playMoves) {
    const list = byCard.get(move.card) ?? [];
    list.push(move);
    byCard.set(move.card, list);
  }

  const cards = [...byCard.keys()];
  const weakestCard = cards.reduce((a, b) => (cardStrength(a, trump) <= cardStrength(b, trump) ? a : b));
  const options = byCard.get(weakestCard)!;
  if (options.length === 1) return options[0]!;
  // Only the Joker led in an NT hand produces more than one option here.
  return chooseCalledSuit(view.hand, options);
}

function chooseFollow(view: PlayerView, playMoves: PlayMove[]): Move {
  const trump = view.trump!;
  const firstTrick = view.trickNumber === 1;
  const isLastToPlay = view.trick.length === view.players - 1;

  const winning = playMoves.filter((m) => wouldWin(view.trick, { seat: view.seat, card: m.card }, trump, firstTrick));

  if (winning.length > 0) {
    if (isLastToPlay) return cheapestCard(winning, trump);
    const cheapWins = winning.filter((m) => cardStrength(m.card, trump) <= WIN_CHEAPLY_THRESHOLD);
    if (cheapWins.length > 0) return cheapestCard(cheapWins, trump);
  }

  const nonWinning = playMoves.filter((m) => !winning.includes(m));
  const pool = nonWinning.length > 0 ? nonWinning : winning;
  return cheapestCard(pool, trump);
}

export function choosePlay(view: PlayerView, legalMoves: Move[]): Move {
  const playMoves = legalMoves.filter((m): m is PlayMove => m.type === 'play');
  if (playMoves.length === 0) {
    throw new Error('choosePlay called with no legal play moves');
  }
  if (playMoves.length === 1) return playMoves[0]!;

  return view.trick.length === 0 ? chooseLead(view, playMoves) : chooseFollow(view, playMoves);
}
