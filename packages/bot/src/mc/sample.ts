import { JOKER, effectiveSuit, makeDeck, requiredSuit, shuffle } from '@napoleon/engine';
import type { CardId, GameState, PlayerView, Seat, TrickPlay } from '@napoleon/engine';

/**
 * Per seat, the cards that seat provably cannot hold, from how they
 * followed (or failed to follow) in earlier tricks: failing to follow a
 * suit means void in it, and ignoring a led 3♠ means no Joker.
 */
export function inferExclusions(view: PlayerView): Set<CardId>[] {
  const excluded = Array.from({ length: view.players }, () => new Set<CardId>());
  const trump = view.trump!;
  const deck = makeDeck();

  const scan = (plays: TrickPlay[], firstTrick: boolean): void => {
    if (plays.length < 2) return;
    const required = requiredSuit(plays, trump, firstTrick);
    const threeSpadesLed = !firstTrick && plays[0]!.card === '3S' && view.config.threeOfSpadesForcesJoker;
    for (const play of plays.slice(1)) {
      if (play.card === JOKER) continue; // the Joker can always be played — says nothing about voids
      if (threeSpadesLed) excluded[play.seat]!.add(JOKER);
      if (required !== null && effectiveSuit(play.card, trump, firstTrick) !== required) {
        for (const card of deck) {
          if (card !== JOKER && effectiveSuit(card, trump, firstTrick) === required) excluded[play.seat]!.add(card);
        }
      }
    }
  };

  view.tricks.forEach((t, i) => scan(t.plays, i === 0));
  scan(view.trick, view.trickNumber === 1);
  return excluded;
}

/** Every card the viewer can't account for: not in their hand, not already played, not their own discards. */
export function unseenCards(view: PlayerView): CardId[] {
  const known = new Set<CardId>([...view.hand, ...view.ownDiscards, ...view.captured.flat(), ...view.trick.map((p) => p.card)]);
  return makeDeck().filter((c) => !known.has(c));
}

export interface Slot {
  count: number;
  excluded?: Set<CardId> | undefined;
}

/**
 * Randomly deals `pool` into slots, respecting each slot's exclusions where
 * possible (most constrained slot first). Falls back to ignoring exclusions
 * for whatever can't be satisfied, so it always returns a full deal.
 */
export function dealPool(pool: CardId[], slots: Slot[], rng: () => number): CardId[][] {
  const order = slots.map((_, i) => i).sort((a, b) => (slots[b]!.excluded?.size ?? 0) - (slots[a]!.excluded?.size ?? 0));

  for (let attempt = 0; attempt < 6; attempt++) {
    let remaining = shuffle(pool, rng);
    const out: CardId[][] = slots.map(() => []);
    let failed = false;
    for (const i of order) {
      const { count, excluded } = slots[i]!;
      const taken: CardId[] = [];
      const rest: CardId[] = [];
      for (const card of remaining) {
        if (taken.length < count && !excluded?.has(card)) taken.push(card);
        else rest.push(card);
      }
      if (taken.length < count) {
        failed = true;
        break;
      }
      out[i] = taken;
      remaining = rest;
    }
    if (!failed) return out;
  }

  const remaining = shuffle(pool, rng);
  return slots.map(({ count }) => remaining.splice(0, count));
}

function emptyState(view: PlayerView): Omit<GameState, 'hands' | 'phase' | 'turn'> {
  return {
    config: view.config,
    players: view.players,
    dealer: view.dealer,
    widow: [],
    passed: [...view.passed],
    bidHistory: view.bidHistory,
    currentBid: view.currentBid,
    bidder: view.bidder,
    napoleon: view.napoleon,
    trump: view.trump,
    angelCard: view.angelCard,
    angelSeat: null,
    angelRevealed: view.angelRevealed,
    discards: [],
    trick: view.trick.map((p) => ({ ...p })),
    tricks: view.tricks,
    trickNumber: view.trickNumber,
    captured: view.captured.map((pile) => [...pile]),
    scores: [...view.scores],
    handResult: null,
    seed: 0,
  };
}

/** The Angel is whoever holds the named card, or Napoleon if nobody (else) does. */
function angelSeatFor(view: PlayerView, hands: CardId[][]): Seat | null {
  if (view.angelSeat !== null) return view.angelSeat;
  if (view.angelCard === null || view.napoleon === null) return null;
  const holder = hands.findIndex((h) => h.includes(view.angelCard!));
  return holder !== -1 ? holder : view.napoleon;
}

/**
 * Samples a full game state during the play phase that is consistent with
 * everything the viewer has seen: their own hand, played cards, inferred
 * voids and (for Napoleon) their own discards.
 */
export function samplePlayState(
  view: PlayerView,
  excluded: Set<CardId>[],
  rng: () => number,
  /** Chance a defender's sample lets Napoleon hold their own named card (i.e. play solo on purpose). */
  soloPrior = 0.1,
): GameState {
  const me = view.seat;
  const pool = unseenCards(view);
  const others: Seat[] = [];
  for (let s = 0; s < view.players; s++) if (s !== me) others.push(s);

  const slotExcluded = others.map((s) => new Set(excluded[s]));
  const napoleonIdx = view.napoleon === null ? -1 : others.indexOf(view.napoleon);
  if (
    napoleonIdx !== -1 &&
    view.angelCard !== null &&
    !view.angelRevealed &&
    pool.includes(view.angelCard) &&
    rng() >= soloPrior
  ) {
    // Napoleon names a card they can see isn't in their own hand (after picking up the widow).
    slotExcluded[napoleonIdx]!.add(view.angelCard);
  }

  const hiddenDiscards = view.napoleon === me ? 0 : view.discardCount;
  const slots: Slot[] = [
    ...others.map((s, i) => ({ count: view.handCounts[s]!, excluded: slotExcluded[i] })),
    { count: hiddenDiscards },
  ];
  const dealt = dealPool(pool, slots, rng);

  const hands: CardId[][] = Array.from({ length: view.players }, () => []);
  hands[me] = [...view.hand];
  others.forEach((s, i) => (hands[s] = dealt[i]!));

  return {
    ...emptyState(view),
    phase: 'play',
    turn: view.turn,
    hands,
    discards: view.napoleon === me ? [...view.ownDiscards] : dealt[others.length]!,
    angelSeat: angelSeatFor(view, hands),
  };
}

/**
 * Samples the unseen cards for a Napoleon who has not yet picked up the
 * widow (bidding / angel phases): returns the widow and every other hand.
 */
export function sampleDeal(view: PlayerView, rng: () => number): { widow: CardId[]; hands: CardId[][] } {
  const me = view.seat;
  const pool = unseenCards(view);
  const others: Seat[] = [];
  for (let s = 0; s < view.players; s++) if (s !== me) others.push(s);
  const slots: Slot[] = [{ count: view.config.widowSize }, ...others.map((s) => ({ count: view.handCounts[s]! }))];
  const dealt = dealPool(pool, slots, rng);
  const hands: CardId[][] = Array.from({ length: view.players }, () => []);
  hands[me] = [...view.hand];
  others.forEach((s, i) => (hands[s] = dealt[i + 1]!));
  return { widow: dealt[0]!, hands };
}

/** A sampled state sitting at the point where `me` (as Napoleon) is about to name the Angel. */
export function angelPhaseState(
  view: PlayerView,
  sample: { widow: CardId[]; hands: CardId[][] },
  trump: GameState['trump'],
  currentBid: GameState['currentBid'],
): GameState {
  const me = view.seat;
  return {
    ...emptyState(view),
    phase: 'angel',
    turn: me,
    hands: sample.hands.map((h) => [...h]),
    widow: [...sample.widow],
    napoleon: me,
    bidder: me,
    trump,
    currentBid,
    angelCard: null,
    angelRevealed: false,
    captured: Array.from({ length: view.players }, () => []),
    tricks: [],
    trick: [],
    trickNumber: 1,
  };
}
